import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { User } from '../../models/User';
import { Property } from '../../models/Property';
import { Policy } from '../../models/Policy';
import { RoomType } from '../../models/RoomType';
import { Booking } from '../../models/Booking';
import { Availability } from '../../models/Availability';
import { RatePlan } from '../../models/RatePlan';
import { PromoCode } from '../../models/PromoCode';
import { Review } from '../../models/Review';
import { AppError } from '../../middleware/errorHandler';
import { AMENITIES_CATALOG } from '../../utils/amenities-catalog';
import { logActivity } from '../../utils/logActivity';
import { checkAvailability, reserveRooms, releaseRooms } from '../../utils/availability';
import { calculateStayPricing, normalizeDate } from '../../utils/rateEngine';
import { generateBookingReference } from '../../utils/bookingReference';
import { recalculatePropertyRatings } from '../../utils/reviewAggregation';
import { sendBookingConfirmationEmail } from '../../utils/email';

// Helper to generate route-safe property slug
async function generateUniquePropertySlug(name: string): Promise<string> {
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) baseSlug = 'property';

  let slug = baseSlug;
  let counter = 1;

  while (await Property.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// Property Validation Schemas
const propertyBaseFields = {
  name: z.string().min(2, 'Property name must be at least 2 characters'),
  description: z.string(),
  propertyType: z.enum(['HOTEL', 'RESORT', 'BOUTIQUE', 'APARTMENT']),
  address: z.object({
    street: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    country: z.string(),
    postalCode: z.string().optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
    googlePlaceId: z.string().optional(),
    formattedAddress: z.string().optional(),
  }),
  starRating: z.number().min(1).max(5).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  coverImage: z.string().optional(),
  gallery: z.array(z.string()),
  amenities: z.array(z.string()),
};

const createPropertySchema = z.object({
  ...propertyBaseFields,
  description: z.string().default(''),
  propertyType: z.enum(['HOTEL', 'RESORT', 'BOUTIQUE', 'APARTMENT']).default('HOTEL'),
  address: z.object({
    street: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    country: z.string().default('Pakistan'),
    postalCode: z.string().optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
  checkInTime: z.string().default('14:00'),
  checkOutTime: z.string().default('12:00'),
  gallery: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
});

const updatePropertySchema = z
  .object({
    ...propertyBaseFields,
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
        coordinates: z
          .object({
            lat: z.number(),
            lng: z.number(),
          })
          .optional(),
      })
      .optional(),
  })
  .partial();

const updatePolicySchema = z.object({
  cancellationPolicy: z.string().min(5, 'Cancellation policy required'),
  cancellationDeadlineHours: z.number().min(0).default(48),
  petPolicy: z
    .object({
      allowed: z.boolean().default(false),
      fee: z.number().default(0),
      notes: z.string().optional(),
    })
    .default({ allowed: false, fee: 0 }),
  smokingPolicy: z
    .object({
      allowed: z.boolean().default(false),
      notes: z.string().optional(),
    })
    .default({ allowed: false }),
  childPolicy: z.string().optional(),
  customRules: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
      })
    )
    .default([]),
});

// Room Type Validation Schemas
const roomTypeBaseFields = {
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  code: z.string().min(2, 'Room code must be at least 2 characters').toUpperCase(),
  category: z.enum(['STANDARD', 'DELUXE', 'EXECUTIVE', 'SUITE', 'VILLA', 'PENTHOUSE']),
  viewType: z.enum(['CITY_VIEW', 'SEA_VIEW', 'GARDEN_VIEW', 'POOL_VIEW', 'COURTYARD_VIEW', 'MOUNTAIN_VIEW', 'INTERNAL']),
  outdoorSpace: z.enum(['NONE', 'BALCONY', 'TERRACE', 'PATIO', 'PRIVATE_POOL']),
  description: z.string(),
  maxOccupancy: z.object({
    adults: z.number().min(1, 'At least 1 adult required'),
    children: z.number().min(0),
  }),
  bedConfig: z.string().min(1, 'Bed configuration required'),
  bedding: z.object({
    primaryBed: z.string().optional(),
    bedCount: z.number().optional(),
    allowsRollaway: z.boolean().optional(),
    rollawayFee: z.number().optional(),
    allowsCrib: z.boolean().optional(),
  }),
  bathroom: z.object({
    hasTub: z.boolean().optional(),
    hasWalkInShower: z.boolean().optional(),
    hasDoubleVanity: z.boolean().optional(),
    bathroomCount: z.number().optional(),
  }),
  roomSizeSqm: z.number().min(0).optional(),
  roomSizeSqft: z.number().min(0).optional(),
  totalUnits: z.number().min(1, 'At least 1 unit must exist'),
  basePricePerNight: z.number().min(0, 'Base price cannot be negative'),
  pricing: z
    .object({
      basePricePerNight: z.number().optional(),
      extraAdultRate: z.number().optional(),
      extraChildRate: z.number().optional(),
    })
    .optional(),
  mealPlan: z.enum(['ROOM_ONLY', 'BREAKFAST_INCLUDED', 'HALF_BOARD', 'ALL_INCLUSIVE']),
  isSmokingAllowed: z.boolean(),
  isAccessible: z.boolean(),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  isActive: z.boolean(),
};

const createRoomTypeSchema = z.object({
  ...roomTypeBaseFields,
  category: z.enum(['STANDARD', 'DELUXE', 'EXECUTIVE', 'SUITE', 'VILLA', 'PENTHOUSE']).default('STANDARD'),
  viewType: z.enum(['CITY_VIEW', 'SEA_VIEW', 'GARDEN_VIEW', 'POOL_VIEW', 'COURTYARD_VIEW', 'MOUNTAIN_VIEW', 'INTERNAL']).default('CITY_VIEW'),
  outdoorSpace: z.enum(['NONE', 'BALCONY', 'TERRACE', 'PATIO', 'PRIVATE_POOL']).default('NONE'),
  description: z.string().default(''),
  maxOccupancy: z.object({
    adults: z.number().min(1, 'At least 1 adult required').default(2),
    children: z.number().min(0).default(1),
  }).default({ adults: 2, children: 1 }),
  bedConfig: z.string().min(1, 'Bed configuration required').default('1 King Bed'),
  bedding: z.object({
    primaryBed: z.string().default('King'),
    bedCount: z.number().default(1),
    allowsRollaway: z.boolean().default(false),
    rollawayFee: z.number().default(0),
    allowsCrib: z.boolean().default(true),
  }).default({ primaryBed: 'King', bedCount: 1, allowsRollaway: false, rollawayFee: 0, allowsCrib: true }),
  bathroom: z.object({
    hasTub: z.boolean().default(false),
    hasWalkInShower: z.boolean().default(true),
    hasDoubleVanity: z.boolean().default(false),
    bathroomCount: z.number().default(1),
  }).default({ hasTub: false, hasWalkInShower: true, hasDoubleVanity: false, bathroomCount: 1 }),
  totalUnits: z.number().min(1, 'At least 1 unit must exist').default(5),
  pricing: z
    .object({
      basePricePerNight: z.number().optional(),
      extraAdultRate: z.number().default(0),
      extraChildRate: z.number().default(0),
    })
    .optional(),
  mealPlan: z.enum(['ROOM_ONLY', 'BREAKFAST_INCLUDED', 'HALF_BOARD', 'ALL_INCLUSIVE']).default('ROOM_ONLY'),
  isSmokingAllowed: z.boolean().default(false),
  isAccessible: z.boolean().default(false),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const updateRoomTypeSchema = z.object(roomTypeBaseFields).partial();

const updateMyHotelSchema = z.object({
  name: z.string().min(2).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newEmail: z.string().email('Invalid email address'),
});

export class PortalController {
  // ─── IMAGE UPLOADS ──────────────────────────────────────────────────
  static async uploadImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No image file provided', 400, 'NO_FILE_PROVIDED');
      }

      const relativeUrl = `/uploads/${req.file.filename}`;
      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url: relativeUrl,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── AMENITIES CATALOG ──────────────────────────────────────────────
  static getAmenitiesCatalog(req: AuthRequest, res: Response): void {
    res.status(200).json({
      success: true,
      data: {
        catalog: AMENITIES_CATALOG,
        amenities: AMENITIES_CATALOG,
      },
    });
  }

  // ─── HOTEL ACCOUNT ──────────────────────────────────────────────────
  static async getMyHotel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.hotelAccountId) {
        throw new AppError('No hotel account linked to your profile', 404, 'HOTEL_NOT_FOUND');
      }

      const hotel = await HotelAccount.findById(req.hotelAccountId).lean();
      if (!hotel) {
        throw new AppError('Hotel account not found', 404, 'HOTEL_NOT_FOUND');
      }

      const [propertyCount, publishedPropertyCount, totalRoomTypes, draftPropertyCount] = await Promise.all([
        Property.countDocuments({ hotelAccountId: req.hotelAccountId }),
        Property.countDocuments({ hotelAccountId: req.hotelAccountId, status: 'PUBLISHED' }),
        RoomType.countDocuments({ hotelAccountId: req.hotelAccountId, isActive: true }),
        Property.countDocuments({ hotelAccountId: req.hotelAccountId, status: 'DRAFT' }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          hotel,
          metrics: {
            propertyCount,
            publishedPropertyCount,
            totalRoomTypes,
            draftPropertyCount,
            onboardingComplete: propertyCount > 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMyHotel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.hotelAccountId) {
        throw new AppError('No hotel account linked', 404, 'HOTEL_NOT_FOUND');
      }

      const data = updateMyHotelSchema.parse(req.body);
      
      const hotel = await HotelAccount.findByIdAndUpdate(
        req.hotelAccountId,
        { $set: data },
        { returnDocument: 'after', runValidators: true }
      ).lean();

      if (!hotel) {
        throw new AppError('Hotel account not found', 404, 'HOTEL_NOT_FOUND');
      }

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: 'HOTEL_ADMIN',
        action: 'HOTEL_UPDATED',
        targetType: 'HotelAccount',
        targetId: req.hotelAccountId,
      });

      res.status(200).json({ success: true, data: { hotel } });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = changePasswordSchema.parse(req.body);

      const user = await User.findById(req.user!.id).select('+passwordHash');
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.passwordHash) {
        throw new AppError('This account does not have a local password set.', 400, 'NO_PASSWORD_SET');
      }

      const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
      }

      const salt = await bcrypt.genSalt(12);
      user.passwordHash = await bcrypt.hash(data.newPassword, salt);
      await user.save();

      await logActivity({
        tenantId: req.hotelAccountId || undefined,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PASSWORD_CHANGED',
        targetType: 'User',
        targetId: user._id,
      });

      res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async changeEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = changeEmailSchema.parse(req.body);
      const email = data.newEmail.toLowerCase().trim();

      const user = await User.findById(req.user!.id).select('+passwordHash');
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      if (!user.passwordHash) {
        throw new AppError('This account does not have a local password set.', 400, 'NO_PASSWORD_SET');
      }

      const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isMatch) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
      }

      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        throw new AppError('An account with this email address already exists', 400, 'USER_ALREADY_EXISTS');
      }

      const oldEmail = user.email;
      user.email = email;
      await user.save();

      await logActivity({
        tenantId: req.hotelAccountId || undefined,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'EMAIL_CHANGED',
        targetType: 'User',
        targetId: user._id,
        metadata: { oldEmail, newEmail: email }
      });

      res.status(200).json({ success: true, message: 'Email updated successfully', data: { email } });
    } catch (error) {
      next(error);
    }
  }

  static async getHotelById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hotelId } = req.params;
      const hotel = await HotelAccount.findById(hotelId).lean();

      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: {
          hotel,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── PROPERTY CRUD (MILESTONE A3) ───────────────────────────────────
  static async getMyProperties(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.hotelAccountId) {
        throw new AppError('No hotel account linked', 404, 'HOTEL_NOT_FOUND');
      }

      const properties = await Property.find({
        hotelAccountId: req.hotelAccountId,
        status: { $ne: 'ARCHIVED' },
      })
        .sort({ createdAt: -1 })
        .lean();

      // Attach room count for each property
      const propertiesWithRooms = await Promise.all(
        properties.map(async (p) => {
          const roomCount = await RoomType.countDocuments({ propertyId: p._id, isActive: true });
          return { ...p, roomCount };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          properties: propertiesWithRooms,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.hotelAccountId) {
        throw new AppError('No hotel account linked', 404, 'HOTEL_NOT_FOUND');
      }

      const data = createPropertySchema.parse(req.body);
      const slug = await generateUniquePropertySlug(data.name);

      const property = await Property.create({
        ...data,
        hotelAccountId: req.hotelAccountId,
        slug,
        status: 'DRAFT',
      });

      // Automatically initialize default policy for the property
      await Policy.create({
        propertyId: property._id,
        hotelAccountId: req.hotelAccountId,
      });

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PROPERTY_CREATED',
        targetType: 'Property',
        targetId: property._id,
      });

      res.status(201).json({
        success: true,
        message: 'Property created successfully in draft mode',
        data: {
          property,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPropertyById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id).lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      // Tenant isolation: Ensure property belongs to active hotel account
      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const [policy, roomTypes] = await Promise.all([
        Policy.findOne({ propertyId: property._id }).lean(),
        RoomType.find({ propertyId: property._id, isActive: true }).lean(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          property,
          policy,
          roomTypes,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id);

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const data = updatePropertySchema.parse(req.body);

      // If gallery is updated and coverImage wasn't specified, sync coverImage to first photo
      if (data.gallery !== undefined && data.coverImage === undefined) {
        data.coverImage = data.gallery[0] || '';
      }

      // Apply partial updates and ensure array fields are marked modified
      property.set(data);
      if (data.gallery !== undefined) property.markModified('gallery');
      if (data.amenities !== undefined) property.markModified('amenities');
      await property.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PROPERTY_UPDATED',
        targetType: 'Property',
        targetId: property._id,
      });

      res.status(200).json({
        success: true,
        message: 'Property updated successfully',
        data: {
          property,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id);

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      // Soft delete: set status to ARCHIVED
      property.status = 'ARCHIVED';
      await property.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PROPERTY_ARCHIVED',
        targetType: 'Property',
        targetId: property._id,
      });

      res.status(200).json({
        success: true,
        message: 'Property archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── POLICIES (MILESTONE A3) ─────────────────────────────────────────
  static async getPropertyPolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id).lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      let policy = await Policy.findOne({ propertyId: id }).lean();
      if (!policy) {
        policy = await Policy.create({
          propertyId: property._id,
          hotelAccountId: property.hotelAccountId,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          policy,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePropertyPolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id).lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const data = updatePolicySchema.parse(req.body);

      const policy = await Policy.findOneAndUpdate(
        { propertyId: id },
        { $set: { ...data, hotelAccountId: property.hotelAccountId } },
        { returnDocument: 'after', upsert: true, runValidators: true }
      );

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'POLICY_UPDATED',
        targetType: 'Policy',
        targetId: policy!._id,
      });

      res.status(200).json({
        success: true,
        message: 'Property policies updated successfully',
        data: {
          policy,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── ROOM TYPE CATALOG (MILESTONE A4) ───────────────────────────────
  static async getRoomTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params; // propertyId
      const property = await Property.findById(id).lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const rooms = await RoomType.find({ propertyId: id }).sort({ basePricePerNight: 1 }).lean();

      res.status(200).json({
        success: true,
        data: {
          rooms,
          roomTypes: rooms,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRoomType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params; // propertyId
      const property = await Property.findById(id).lean();

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const data = createRoomTypeSchema.parse(req.body);

      // Check unique code per property
      const existingRoom = await RoomType.findOne({ propertyId: id, code: data.code });
      if (existingRoom) {
        throw new AppError(`Room code '${data.code}' already exists for this property`, 400, 'ROOM_CODE_EXISTS');
      }

      const room = await RoomType.create({
        ...data,
        propertyId: property._id,
        hotelAccountId: property.hotelAccountId,
      });

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'ROOM_TYPE_CREATED',
        targetType: 'RoomType',
        targetId: room._id,
      });

      res.status(201).json({
        success: true,
        message: 'Room type added to catalog successfully',
        data: {
          room,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRoomType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;
      const room = await RoomType.findById(roomId);

      if (!room) {
        throw new AppError('Room type not found', 404, 'ROOM_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && room.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const data = updateRoomTypeSchema.parse(req.body);

      if (data.code && data.code !== room.code) {
        const duplicate = await RoomType.findOne({
          propertyId: room.propertyId,
          code: data.code,
          _id: { $ne: room._id },
        });
        if (duplicate) {
          throw new AppError(`Room code '${data.code}' already exists for this property`, 400, 'ROOM_CODE_EXISTS');
        }
      }

      const oldUnits = room.totalUnits;
      room.set(data);
      if (data.images !== undefined) room.markModified('images');
      if (data.amenities !== undefined) room.markModified('amenities');
      await room.save();

      // Synchronize future Availability documents if totalUnits changed
      if (data.totalUnits !== undefined && data.totalUnits !== oldUnits) {
        await Availability.updateMany(
          {
            roomTypeId: room._id,
            date: { $gte: normalizeDate(new Date()) },
          },
          { $set: { totalUnits: data.totalUnits } }
        );
      }

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'ROOM_TYPE_UPDATED',
        targetType: 'RoomType',
        targetId: room._id,
      });

      res.status(200).json({
        success: true,
        message: 'Room type updated successfully',
        data: {
          room,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRoomType(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roomId } = req.params;
      const room = await RoomType.findById(roomId);

      if (!room) {
        throw new AppError('Room type not found', 404, 'ROOM_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && room.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      // Soft deactivate
      room.isActive = false;
      await room.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'ROOM_TYPE_DEACTIVATED',
        targetType: 'RoomType',
        targetId: room._id,
      });

      res.status(200).json({
        success: true,
        message: 'Room type deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── PUBLICATION READINESS ENGINE (MILESTONE A4) ────────────────────
  static async publishProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id);

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const [rooms, policy] = await Promise.all([
        RoomType.find({ propertyId: id, isActive: true }).lean(),
        Policy.findOne({ propertyId: id }).lean(),
      ]);

      const missingRequirements: string[] = [];

      if (!property.name || property.name.length < 2) {
        missingRequirements.push('Property name must be at least 2 characters');
      }
      if (!property.address?.city) {
        missingRequirements.push('Property city is required in location settings');
      }
      if (!rooms || rooms.length === 0) {
        missingRequirements.push('At least one active room type must be created in the catalog');
      }
      const totalUnits = rooms.reduce((acc, r) => acc + (r.totalUnits || 0), 0);
      if (totalUnits <= 0) {
        missingRequirements.push('Total inventory units across rooms must be greater than zero');
      }
      if (!policy?.cancellationPolicy) {
        missingRequirements.push('Cancellation policy must be configured');
      }

      if (missingRequirements.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'PUBLICATION_REQUIREMENTS_NOT_MET',
            message: 'Property cannot be published until all catalog requirements are fulfilled',
            details: missingRequirements,
          },
        });
        return;
      }

      property.status = 'PUBLISHED';
      await property.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PROPERTY_PUBLISHED',
        targetType: 'Property',
        targetId: property._id,
      });

      res.status(200).json({
        success: true,
        message: 'Property successfully published! It is now eligible for public showcase.',
        data: {
          property,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async unpublishProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const property = await Property.findById(id);

      if (!property) {
        throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      }

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      property.status = 'DRAFT';
      await property.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'PROPERTY_UNPUBLISHED',
        targetType: 'Property',
        targetId: property._id,
      });

      res.status(200).json({
        success: true,
        message: 'Property status reverted to Draft',
        data: {
          property,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 6. RESERVATIONS MANAGEMENT (Hotel Admin)
  // ==========================================

  /**
   * Create Manual Booking (Front desk walk-in, phone, travel agent, corporate)
   */
  static async createManualBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        propertyId: z.string(),
        roomTypeId: z.string(),
        checkIn: z.string(),
        checkOut: z.string(),
        rooms: z.number().int().min(1).default(1),
        adults: z.number().int().min(1).default(1),
        children: z.number().int().min(0).default(0),
        guest: z.object({
          fullName: z.string().min(2),
          email: z.string().email().optional().or(z.literal('')),
          phone: z.string().min(5),
          nationality: z.string().optional(),
          identityDocument: z.string().optional(),
        }),
        rateOverridePerNight: z.number().min(0).optional(),
        source: z.enum(['MANUAL', 'WALK_IN', 'PHONE', 'AGENT', 'CORPORATE']).default('WALK_IN'),
        paymentMethod: z.enum(['CASH', 'CARD_ON_ARRIVAL', 'ONLINE', 'BANK_TRANSFER', 'COMPLIMENTARY']).default('CASH'),
        paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']).default('PAID'),
        addOns: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
        discount: z.number().min(0).optional(),
        specialRequests: z.string().optional(),
        internalNotes: z.string().optional(),
        sendConfirmationEmail: z.boolean().default(false),
      });

      const body = schema.parse(req.body);

      const property = await Property.findById(body.propertyId);
      if (!property) throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');

      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const roomType = await RoomType.findById(body.roomTypeId);
      if (!roomType || !roomType.isActive) {
        throw new AppError('Room type is not available', 400, 'ROOM_TYPE_INACTIVE');
      }

      const hotel = await HotelAccount.findById(property.hotelAccountId);
      if (!hotel) throw new AppError('Hotel account not found', 404, 'HOTEL_NOT_FOUND');

      // 1. Atomically reserve rooms
      await reserveRooms({
        roomTypeId: roomType._id,
        propertyId: property._id,
        hotelAccountId: hotel._id,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        rooms: body.rooms,
      });

      // 2. Calculate stay pricing
      const pricing = await calculateStayPricing({
        roomTypeId: roomType._id,
        hotelAccountId: hotel._id,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        rooms: body.rooms,
        rateOverridePerNight: body.rateOverridePerNight,
        addOns: body.addOns,
      });

      if (body.discount && body.discount > 0) {
        pricing.discount = body.discount;
        pricing.totalAmount = Math.max(0, pricing.totalAmount - body.discount);
      }

      // 3. Generate reference
      const bookingReference = await generateBookingReference(hotel.slug);

      const checkInDate = normalizeDate(body.checkIn);
      const checkOutDate = normalizeDate(body.checkOut);
      const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000));

      const booking = await Booking.create({
        bookingReference,
        propertyId: property._id,
        hotelAccountId: hotel._id,
        roomTypeId: roomType._id,
        guest: {
          fullName: body.guest.fullName,
          email: body.guest.email || `${bookingReference.toLowerCase()}@guest.local`,
          phone: body.guest.phone,
          nationality: body.guest.nationality,
          identityDocument: body.guest.identityDocument,
        },
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        rooms: body.rooms,
        adults: body.adults,
        children: body.children,
        pricing,
        status: body.source === 'WALK_IN' ? 'CHECKED_IN' : 'CONFIRMED',
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        source: body.source,
        specialRequests: body.specialRequests,
        internalNotes: body.internalNotes,
        hasReview: false,
      });

      // Send email if requested and email provided
      if (body.sendConfirmationEmail && body.guest.email) {
        sendBookingConfirmationEmail({
          to: body.guest.email,
          guestName: body.guest.fullName,
          bookingReference,
          propertyName: property.name,
          roomTypeName: roomType.name,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          nights,
          rooms: body.rooms,
          totalAmount: pricing.totalAmount,
          currency: pricing.currency,
          propertyAddress: property.address.formattedAddress || `${property.address.city}, ${property.address.country}`,
          propertyPhone: property.contactPhone,
          specialRequests: body.specialRequests,
        }).catch((e) => console.error('[Email Error]', e));
      }

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'BOOKING_CREATED',
        targetType: 'Booking',
        targetId: booking._id,
        metadata: {
          reference: bookingReference,
          property: property.name,
          source: body.source,
          totalAmount: pricing.totalAmount,
        },
      });

      res.status(201).json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get filtered and paginated bookings for this hotel account.
   */
  static async getBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        status,
        source,
        propertyId,
        search,
        dateFrom,
        dateTo,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const query: any = {};
      if (req.user?.role !== 'SUPER_ADMIN') {
        query.hotelAccountId = req.hotelAccountId;
      }

      if (status && status !== 'ALL') query.status = status;
      if (source && source !== 'ALL') query.source = source;
      if (propertyId && propertyId !== 'ALL') query.propertyId = propertyId;

      if (dateFrom || dateTo) {
        query.checkIn = {};
        if (dateFrom) query.checkIn.$gte = normalizeDate(dateFrom);
        if (dateTo) query.checkIn.$lte = normalizeDate(dateTo);
      }

      if (search && search.trim()) {
        const s = search.trim();
        query.$or = [
          { bookingReference: { $regex: s, $options: 'i' } },
          { 'guest.fullName': { $regex: s, $options: 'i' } },
          { 'guest.email': { $regex: s, $options: 'i' } },
          { 'guest.phone': { $regex: s, $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const totalCount = await Booking.countDocuments(query);
      const bookings = await Booking.find(query)
        .populate('propertyId', 'name city slug')
        .populate('roomTypeId', 'name category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          bookings,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Today's Operational Snapshot (Arrivals, Departures, In-House, Occupancy Rate).
   */
  static async getTodayOps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hotelAccountId = req.hotelAccountId;
      const today = normalizeDate(new Date());
      const tomorrow = new Date(today.getTime() + 86400000);

      const queryBase: any = {};
      if (req.user?.role !== 'SUPER_ADMIN') {
        queryBase.hotelAccountId = hotelAccountId;
      }

      // 1. Arrivals today (checkIn == today, status == CONFIRMED)
      const arrivals = await Booking.find({
        ...queryBase,
        checkIn: { $gte: today, $lt: tomorrow },
        status: 'CONFIRMED',
      })
        .populate('propertyId', 'name')
        .populate('roomTypeId', 'name category')
        .lean();

      // 2. Departures today (checkOut == today, status == CHECKED_IN)
      const departures = await Booking.find({
        ...queryBase,
        checkOut: { $gte: today, $lt: tomorrow },
        status: 'CHECKED_IN',
      })
        .populate('propertyId', 'name')
        .populate('roomTypeId', 'name category')
        .lean();

      // 3. Currently In-House (status == CHECKED_IN)
      const inHouse = await Booking.find({
        ...queryBase,
        status: 'CHECKED_IN',
      })
        .populate('propertyId', 'name')
        .populate('roomTypeId', 'name category')
        .lean();

      // 4. Calculate total room capacity and current occupied rooms
      const activeRooms = await RoomType.find({
        ...(req.user?.role !== 'SUPER_ADMIN' ? { hotelAccountId } : {}),
        isActive: true,
      }).select('totalUnits').lean();

      const totalInventoryUnits = activeRooms.reduce((acc, curr) => acc + curr.totalUnits, 0);
      const occupiedUnits = inHouse.reduce((acc, curr) => acc + curr.rooms, 0);

      const occupancyRate =
        totalInventoryUnits > 0 ? Math.round((occupiedUnits / totalInventoryUnits) * 100) : 0;

      res.status(200).json({
        success: true,
        data: {
          today: today.toISOString().split('T')[0],
          arrivalsCount: arrivals.length,
          departuresCount: departures.length,
          inHouseCount: inHouse.length,
          occupancyRate,
          totalInventoryUnits,
          occupiedUnits,
          arrivals,
          departures,
          inHouse,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single booking detail.
   */
  static async getBookingById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') {
        query.hotelAccountId = req.hotelAccountId;
      }

      const booking = await Booking.findOne(query)
        .populate('propertyId')
        .populate('roomTypeId')
        .populate('reviewId')
        .lean();

      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update booking notes, special requests, or payment status.
   */
  static async updateBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') {
        query.hotelAccountId = req.hotelAccountId;
      }

      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      const updateSchema = z.object({
        paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED']).optional(),
        paymentMethod: z.enum(['CASH', 'CARD_ON_ARRIVAL', 'ONLINE', 'BANK_TRANSFER', 'COMPLIMENTARY']).optional(),
        specialRequests: z.string().optional(),
        internalNotes: z.string().optional(),
        guest: z
          .object({
            fullName: z.string().optional(),
            phone: z.string().optional(),
            nationality: z.string().optional(),
            identityDocument: z.string().optional(),
          })
          .optional(),
      });

      const body = updateSchema.parse(req.body);

      if (body.paymentStatus) booking.paymentStatus = body.paymentStatus;
      if (body.paymentMethod) booking.paymentMethod = body.paymentMethod;
      if (body.specialRequests !== undefined) booking.specialRequests = body.specialRequests;
      if (body.internalNotes !== undefined) booking.internalNotes = body.internalNotes;
      if (body.guest) {
        booking.guest.fullName = body.guest.fullName || booking.guest.fullName;
        booking.guest.phone = body.guest.phone || booking.guest.phone;
        booking.guest.nationality = body.guest.nationality || booking.guest.nationality;
        booking.guest.identityDocument = body.guest.identityDocument || booking.guest.identityDocument;
      }

      await booking.save();

      res.status(200).json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm/Approve a pending reservation.
   */
  static async confirmBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query).populate('propertyId').populate('roomTypeId');
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      if (booking.status !== 'PENDING') {
        throw new AppError(`Cannot confirm a booking with status ${booking.status}`, 400, 'INVALID_STATUS');
      }

      booking.status = 'CONFIRMED';
      await booking.save();

      const prop = booking.propertyId as any;
      const room = booking.roomTypeId as any;

      // Send official confirmation email now that admin approved
      sendBookingConfirmationEmail({
        to: booking.guest.email,
        guestName: booking.guest.fullName,
        bookingReference: booking.bookingReference,
        propertyName: prop?.name || 'Hotel',
        roomTypeName: room?.name || 'Room',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        rooms: booking.rooms,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        propertyAddress: prop?.address?.formattedAddress || prop?.address?.city,
        propertyPhone: prop?.contactPhone,
        specialRequests: booking.specialRequests,
      }).catch((e) => console.error('[Email Error]', e));

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'STATUS_CHANGED',
        targetType: 'Booking',
        targetId: booking._id,
        metadata: { newStatus: 'CONFIRMED', reference: booking.bookingReference },
      });

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Reservation approved and confirmed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Decline a pending reservation.
   */
  static async declineBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      if (booking.status !== 'PENDING') {
        throw new AppError(`Cannot decline a booking with status ${booking.status}`, 400, 'INVALID_STATUS');
      }

      await releaseRooms({
        roomTypeId: booking.roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: booking.rooms,
      });

      booking.status = 'CANCELLED';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'HOTEL',
        reason: reason || 'Reservation request declined by hotel administration',
        refundAmount: 0,
      };
      await booking.save();

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Reservation declined and inventory released',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check in guest.
   */
  static async checkInBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      booking.status = 'CHECKED_IN';
      await booking.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'STATUS_CHANGED',
        targetType: 'Booking',
        targetId: booking._id,
        metadata: { newStatus: 'CHECKED_IN', reference: booking.bookingReference },
      });

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Guest checked in successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check out guest.
   */
  static async checkOutBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;
      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      // Early check-out: if checking out before scheduled checkOut date, release unused nights
      const nowNormalized = normalizeDate(new Date());
      const scheduledCheckOut = normalizeDate(booking.checkOut);
      if (nowNormalized < scheduledCheckOut) {
        await releaseRooms({
          roomTypeId: booking.roomTypeId,
          checkIn: nowNormalized,
          checkOut: scheduledCheckOut,
          rooms: booking.rooms,
        });
      }

      booking.status = 'CHECKED_OUT';
      booking.actualCheckOut = new Date();
      await booking.save();

      await logActivity({
        tenantId: req.hotelAccountId,
        actorId: req.user!.id,
        actorRole: req.user!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN',
        action: 'STATUS_CHANGED',
        targetType: 'Booking',
        targetId: booking._id,
        metadata: { newStatus: 'CHECKED_OUT', reference: booking.bookingReference },
      });

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Guest checked out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel booking & release room inventory.
   */
  static async cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason, refundAmount = 0 } = req.body;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      if (['CANCELLED', 'CHECKED_OUT'].includes(booking.status)) {
        throw new AppError(`Cannot cancel a booking with status ${booking.status}`, 400, 'INVALID_STATUS');
      }

      await releaseRooms({
        roomTypeId: booking.roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: booking.rooms,
      });

      booking.status = 'CANCELLED';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'HOTEL',
        reason: reason || 'Cancelled by hotel staff',
        refundAmount,
      };

      await booking.save();

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Booking cancelled and room inventory released',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark as No-Show.
   */
  static async markNoShow(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query);
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      await releaseRooms({
        roomTypeId: booking.roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: booking.rooms,
      });

      booking.status = 'NO_SHOW';
      await booking.save();

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Booking marked as No-Show',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend booking confirmation email.
   */
  static async resendConfirmation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const booking = await Booking.findOne(query).populate('propertyId').populate('roomTypeId');
      if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');

      const prop = booking.propertyId as any;
      const room = booking.roomTypeId as any;

      await sendBookingConfirmationEmail({
        to: booking.guest.email,
        guestName: booking.guest.fullName,
        bookingReference: booking.bookingReference,
        propertyName: prop?.name || 'Hotel',
        roomTypeName: room?.name || 'Room',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        rooms: booking.rooms,
        totalAmount: booking.pricing.totalAmount,
        currency: booking.pricing.currency,
        propertyAddress: prop?.address?.formattedAddress || prop?.address?.city,
        propertyPhone: prop?.contactPhone,
        specialRequests: booking.specialRequests,
      });

      res.status(200).json({
        success: true,
        message: `Confirmation email resent to ${booking.guest.email}`,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 7. AVAILABILITY CALENDAR & TAPE CHART
  // ==========================================

  /**
   * Get availability matrix for property across date range.
   */
  static async getAvailabilityCalendar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { startDate, endDate } = req.query as Record<string, string>;

      const property = await Property.findById(propertyId).lean();
      if (!property) throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const start = startDate ? normalizeDate(startDate) : normalizeDate(new Date());
      const end = endDate ? normalizeDate(endDate) : new Date(start.getTime() + 30 * 86400000);

      const roomTypes = await RoomType.find({ propertyId: property._id, isActive: true }).lean();
      const roomTypeIds = roomTypes.map((r) => r._id);

      const avails = await Availability.find({
        roomTypeId: { $in: roomTypeIds },
        date: { $gte: start, $lte: end },
      }).lean();

      const availMap = new Map<string, any>();
      for (const a of avails) {
        const key = `${a.roomTypeId.toString()}_${normalizeDate(a.date).toISOString().split('T')[0]}`;
        availMap.set(key, a);
      }

      // Generate dates list
      const dates: string[] = [];
      const curr = new Date(start);
      while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      const matrix = roomTypes.map((rt) => {
        const row = dates.map((d) => {
          const key = `${rt._id.toString()}_${d}`;
          const found = availMap.get(key);

          const totalUnits = found ? found.totalUnits : rt.totalUnits;
          const bookedUnits = found ? found.bookedUnits : 0;
          const blockedUnits = found ? found.blockedUnits : 0;
          const availableUnits = Math.max(0, totalUnits - bookedUnits - blockedUnits);
          const isClosed = found ? found.isClosed : false;
          const rateOverride = found ? found.rateOverride : undefined;

          return {
            date: d,
            totalUnits,
            bookedUnits,
            blockedUnits,
            availableUnits,
            isClosed,
            rateOverride,
          };
        });

        return {
          roomTypeId: rt._id,
          roomTypeName: rt.name,
          category: rt.category,
          basePricePerNight: rt.basePricePerNight,
          totalUnits: rt.totalUnits,
          dates: row,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          matrix,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch update availability (Block/Unblock, rateOverride, isClosed).
   */
  static async updateAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId, roomTypeId } = req.params;
      const { dates } = req.body as {
        dates: Array<{
          date: string;
          blockedUnits?: number;
          rateOverride?: number | null;
          isClosed?: boolean;
          minStay?: number;
        }>;
      };

      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        throw new AppError('Dates array required', 400, 'INVALID_INPUT');
      }

      const property = await Property.findById(propertyId).lean();
      if (!property) throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
      if (req.user?.role !== 'SUPER_ADMIN' && property.hotelAccountId.toString() !== req.hotelAccountId?.toString()) {
        throw new AppError('Cross-tenant access violation', 403, 'CROSS_TENANT_ACCESS_DENIED');
      }

      const roomType = await RoomType.findOne({ _id: roomTypeId, propertyId: property._id });
      if (!roomType) throw new AppError('Room type not found for this property', 404, 'ROOM_TYPE_NOT_FOUND');

      const operations: any[] = dates.map((item) => {
        const d = normalizeDate(item.date);
        const setFields: any = {};
        if (item.blockedUnits !== undefined) setFields.blockedUnits = Math.max(0, item.blockedUnits);
        if (item.rateOverride !== undefined) setFields.rateOverride = item.rateOverride;
        if (item.isClosed !== undefined) setFields.isClosed = item.isClosed;
        if (item.minStay !== undefined) setFields.minStay = item.minStay;

        return {
          updateOne: {
            filter: { roomTypeId: new Types.ObjectId(String(roomTypeId)), date: d },
            update: {
              $set: setFields,
              $setOnInsert: {
                propertyId: new Types.ObjectId(String(propertyId)),
                hotelAccountId: property.hotelAccountId,
                totalUnits: roomType.totalUnits,
                bookedUnits: 0,
              },
            },
            upsert: true,
          },
        };
      });

      await Availability.bulkWrite(operations);

      res.status(200).json({
        success: true,
        message: `Successfully updated availability for ${dates.length} date(s)`,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 8. RATE PLANS CRUD
  // ==========================================

  static async getRatePlans(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId } = req.query;
      const query: any = {};
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;
      if (propertyId) query.propertyId = propertyId;

      const ratePlans = await RatePlan.find(query)
        .populate('propertyId', 'name')
        .populate('roomTypeId', 'name category basePricePerNight')
        .sort({ priority: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: { ratePlans },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        propertyId: z.string(),
        roomTypeId: z.string(),
        name: z.string().min(2),
        type: z.enum(['SEASONAL', 'WEEKEND', 'PROMOTIONAL', 'LENGTH_OF_STAY', 'EARLY_BIRD']),
        adjustmentType: z.enum(['FIXED_PRICE', 'PERCENTAGE_INCREASE', 'PERCENTAGE_DISCOUNT']),
        adjustmentValue: z.number().min(0),
        validFrom: z.string(),
        validTo: z.string(),
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        minNights: z.number().min(1).optional(),
        maxNights: z.number().min(1).optional(),
        advanceBookingDays: z.number().min(0).optional(),
        priority: z.number().default(10),
      });

      const body = schema.parse(req.body);

      const ratePlan = await RatePlan.create({
        ...body,
        hotelAccountId: req.hotelAccountId,
        validFrom: normalizeDate(body.validFrom),
        validTo: normalizeDate(body.validTo),
        isActive: true,
      });

      res.status(201).json({
        success: true,
        data: { ratePlan },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateRatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const ratePlan = await RatePlan.findOneAndUpdate(query, { $set: req.body }, { new: true });
      if (!ratePlan) throw new AppError('Rate plan not found', 404, 'RATE_PLAN_NOT_FOUND');

      res.status(200).json({
        success: true,
        data: { ratePlan },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      await RatePlan.findOneAndDelete(query);

      res.status(200).json({
        success: true,
        message: 'Rate plan deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 9. PROMO CODES CRUD
  // ==========================================

  static async getPromoCodes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query: any = {};
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const promoCodes = await PromoCode.find(query).sort({ createdAt: -1 }).lean();

      res.status(200).json({
        success: true,
        data: { promoCodes },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPromoCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        code: z.string().min(3).toUpperCase(),
        description: z.string().optional(),
        discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
        discountValue: z.number().min(0),
        maxDiscountAmount: z.number().min(0).optional(),
        minBookingAmount: z.number().min(0).optional(),
        validFrom: z.string(),
        validTo: z.string(),
        maxUses: z.number().min(1).optional(),
        maxUsesPerGuest: z.number().min(1).optional(),
        propertyId: z.string().optional(),
        minNights: z.number().min(1).optional(),
      });

      const body = schema.parse(req.body);

      const existing = await PromoCode.findOne({
        hotelAccountId: req.hotelAccountId,
        code: body.code,
      });

      if (existing) {
        throw new AppError('A promo code with this name already exists', 409, 'PROMO_EXISTS');
      }

      const promoCode = await PromoCode.create({
        ...body,
        hotelAccountId: req.hotelAccountId,
        validFrom: normalizeDate(body.validFrom),
        validTo: normalizeDate(body.validTo),
        isActive: true,
      });

      res.status(201).json({
        success: true,
        data: { promoCode },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePromoCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const promoCode = await PromoCode.findOneAndUpdate(query, { $set: req.body }, { new: true });
      if (!promoCode) throw new AppError('Promo code not found', 404, 'PROMO_NOT_FOUND');

      res.status(200).json({
        success: true,
        data: { promoCode },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deletePromoCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query: any = { _id: id };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      await PromoCode.findOneAndDelete(query);

      res.status(200).json({
        success: true,
        message: 'Promo code deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 10. REVIEWS MANAGEMENT (Portal)
  // ==========================================

  static async getReviews(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId, page = '1', limit = '20' } = req.query as Record<string, string>;
      const query: any = {};
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;
      if (propertyId && propertyId !== 'ALL') query.propertyId = propertyId;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const totalCount = await Review.countDocuments(query);
      const reviews = await Review.find(query)
        .populate('propertyId', 'name slug coverImage')
        .populate('roomTypeId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          reviews,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async replyToReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { comment } = req.body;

      if (!comment || !comment.trim()) {
        throw new AppError('Reply comment cannot be empty', 400, 'INVALID_INPUT');
      }

      const query: any = { _id: reviewId };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;

      const review = await Review.findOne(query);
      if (!review) throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');

      review.hotelReply = {
        comment: comment.trim(),
        repliedAt: new Date(),
        repliedByUserId: new Types.ObjectId(req.user!.id),
        repliedByName: req.user!.fullName || 'Hotel Management',
      };

      await review.save();

      res.status(200).json({
        success: true,
        data: { review },
        message: 'Reply posted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 11. REVENUE & OCCUPANCY ANALYTICS
  // ==========================================

  static async getRevenueAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId, period = '30d' } = req.query as Record<string, string>;
      const query: any = { status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED'] } };
      if (req.user?.role !== 'SUPER_ADMIN') query.hotelAccountId = req.hotelAccountId;
      if (propertyId && propertyId !== 'ALL') query.propertyId = propertyId;

      const now = new Date();
      const pastDays = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      const startDate = new Date(now.getTime() - pastDays * 86400000);
      query.createdAt = { $gte: startDate };

      const bookings = await Booking.find(query).lean();

      let totalRevenue = 0;
      let totalNights = 0;
      let totalRoomsBooked = 0;
      const bySource: Record<string, number> = {};
      const byDayMap: Record<string, number> = {};

      for (const b of bookings) {
        const rev = b.pricing?.totalAmount || 0;
        totalRevenue += rev;
        totalNights += (b.nights || 1) * (b.rooms || 1);
        totalRoomsBooked += b.rooms || 1;

        const src = b.source || 'MARKETPLACE';
        bySource[src] = (bySource[src] || 0) + rev;

        const dayKey = b.createdAt.toISOString().split('T')[0];
        byDayMap[dayKey] = (byDayMap[dayKey] || 0) + rev;
      }

      const adr = totalNights > 0 ? Math.round(totalRevenue / totalNights) : 0;
      const avgBookingValue = bookings.length > 0 ? Math.round(totalRevenue / bookings.length) : 0;

      const dailyRevenue = Object.entries(byDayMap)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.status(200).json({
        success: true,
        data: {
          period,
          totalRevenue,
          totalBookings: bookings.length,
          totalNights,
          adr,
          avgBookingValue,
          dailyRevenue,
          revenueBySource: bySource,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOccupancyAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId } = req.query as Record<string, string>;
      const hotelAccountId = req.hotelAccountId;

      const roomQuery: any = { isActive: true };
      if (req.user?.role !== 'SUPER_ADMIN') roomQuery.hotelAccountId = hotelAccountId;
      if (propertyId && propertyId !== 'ALL') roomQuery.propertyId = propertyId;

      const rooms = await RoomType.find(roomQuery).lean();
      const totalCapacity = rooms.reduce((acc, curr) => acc + curr.totalUnits, 0);

      // Bookings currently active
      const inHouse = await Booking.find({
        ...(req.user?.role !== 'SUPER_ADMIN' ? { hotelAccountId } : {}),
        ...(propertyId && propertyId !== 'ALL' ? { propertyId } : {}),
        status: 'CHECKED_IN',
      }).lean();

      const occupiedRooms = inHouse.reduce((acc, curr) => acc + curr.rooms, 0);
      const occupancyRate = totalCapacity > 0 ? Math.round((occupiedRooms / totalCapacity) * 100) : 0;

      res.status(200).json({
        success: true,
        data: {
          totalCapacity,
          occupiedRooms,
          occupancyRate,
          roomTypesBreakdown: rooms.map((r) => ({
            name: r.name,
            totalUnits: r.totalUnits,
            category: r.category,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

