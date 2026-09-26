import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { User } from '../../models/User';
import { Property } from '../../models/Property';
import { Policy } from '../../models/Policy';
import { RoomType } from '../../models/RoomType';
import { AppError } from '../../middleware/errorHandler';
import { AMENITIES_CATALOG } from '../../utils/amenities-catalog';
import { logActivity } from '../../utils/logActivity';

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
  }),
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

      room.set(data);
      if (data.images !== undefined) room.markModified('images');
      if (data.amenities !== undefined) room.markModified('amenities');
      await room.save();

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
}
