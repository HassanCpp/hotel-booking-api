import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { Property } from '../../models/Property';
import { Policy } from '../../models/Policy';
import { RoomType } from '../../models/RoomType';
import { AppError } from '../../middleware/errorHandler';
import { AMENITIES_CATALOG } from '../../utils/amenities-catalog';

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

// Schemas
const createPropertySchema = z.object({
  name: z.string().min(2, 'Property name must be at least 2 characters'),
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
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  checkInTime: z.string().default('14:00'),
  checkOutTime: z.string().default('12:00'),
  coverImage: z.string().optional(),
  gallery: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
});

const updatePropertySchema = createPropertySchema.partial();

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

const createRoomTypeSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  code: z.string().min(2, 'Room code must be at least 2 characters').toUpperCase(),
  description: z.string().default(''),
  maxOccupancy: z.object({
    adults: z.number().min(1, 'At least 1 adult required').default(2),
    children: z.number().min(0).default(1),
  }),
  bedConfig: z.string().min(1, 'Bed configuration required').default('1 King Bed'),
  roomSizeSqm: z.number().min(0).optional(),
  totalUnits: z.number().min(1, 'At least 1 unit must exist').default(5),
  basePricePerNight: z.number().min(0, 'Base price cannot be negative'),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const updateRoomTypeSchema = createRoomTypeSchema.partial();

export class PortalController {
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

      const propertyCount = await Property.countDocuments({ hotelAccountId: req.hotelAccountId });

      res.status(200).json({
        success: true,
        data: {
          hotel,
          metrics: {
            propertyCount,
            onboardingComplete: propertyCount > 0,
          },
        },
      });
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

      // If name changed, optionally update slug if requested
      Object.assign(property, data);
      await property.save();

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

      Object.assign(room, data);
      await room.save();

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
