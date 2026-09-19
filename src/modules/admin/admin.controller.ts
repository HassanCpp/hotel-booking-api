import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { User } from '../../models/User';
import { HotelMembership } from '../../models/HotelMembership';
import { Property } from '../../models/Property';
import { AppError } from '../../middleware/errorHandler';
import { generateUniqueHotelSlug } from '../../utils/slugify';
import { logActivity } from '../../utils/logActivity';
import { ActivityLog } from '../../models/ActivityLog';
import { RoomType } from '../../models/RoomType';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateAdminEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
});

const onboardHotelSchema = z.object({
  name: z.string().min(2, 'Hotel name must be at least 2 characters'),
  contactEmail: z.string().email('Invalid contact email'),
  contactPhone: z.string().optional(),
  country: z.string().default('Pakistan'),
  currency: z.string().default('PKR'),
  timezone: z.string().default('Asia/Karachi'),
  adminFullName: z.string().min(2, 'Admin full name must be at least 2 characters'),
  adminEmail: z.string().email('Invalid admin email'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateHotelSchema = z.object({
  name: z.string().min(2).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']),
});

const updateAdminProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export class AdminController {
  static async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [
        totalHotels,
        totalUsers,
        totalProperties,
        activeHotels,
        suspendedHotels,
        onboardingHotels,
        publishedProperties,
        totalRoomTypes,
        recentActivity
      ] = await Promise.all([
        HotelAccount.countDocuments(),
        User.countDocuments(),
        Property.countDocuments(),
        HotelAccount.countDocuments({ status: 'ACTIVE' }),
        HotelAccount.countDocuments({ status: 'SUSPENDED' }),
        HotelAccount.countDocuments({ status: 'ONBOARDING' }),
        Property.countDocuments({ status: 'PUBLISHED' }),
        RoomType.countDocuments({ isActive: true }),
        ActivityLog.find().sort({ createdAt: -1 }).limit(15).populate('actorId', 'fullName email').lean()
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalHotels,
          totalUsers,
          totalProperties,
          activeHotels,
          suspendedHotels,
          onboardingHotels,
          publishedProperties,
          totalRoomTypes,
          recentActivity,
          platformStatus: 'OPERATIONAL',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listHotels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hotels = await HotelAccount.find()
        .populate('primaryAdminUserId', 'fullName email status')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          hotels,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async onboardHotel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = onboardHotelSchema.parse(req.body);

      // Check if admin email is already registered
      const existingUser = await User.findOne({ email: data.adminEmail.toLowerCase().trim() });
      if (existingUser) {
        throw new AppError('An administrator with this email address already exists', 400, 'USER_ALREADY_EXISTS');
      }

      // Hash administrator password
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(data.adminPassword, salt);

      // 1. Create Hotel Admin User
      const newAdmin = await User.create({
        email: data.adminEmail.toLowerCase().trim(),
        passwordHash,
        fullName: data.adminFullName.trim(),
        role: 'HOTEL_ADMIN',
        status: 'ACTIVE',
      });

      // 2. Generate unique slug and create HotelAccount
      const slug = await generateUniqueHotelSlug(data.name);
      const newHotel = await HotelAccount.create({
        name: data.name.trim(),
        slug,
        status: 'ACTIVE',
        contactEmail: data.contactEmail.toLowerCase().trim(),
        contactPhone: data.contactPhone?.trim(),
        country: data.country.trim(),
        currency: data.currency.trim(),
        timezone: data.timezone.trim(),
        primaryAdminUserId: newAdmin._id,
      });

      // 3. Create HotelMembership
      await HotelMembership.create({
        userId: newAdmin._id,
        hotelAccountId: newHotel._id,
        role: 'HOTEL_ADMIN',
      });

      await logActivity({
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'HOTEL_CREATED',
        targetType: 'HotelAccount',
        targetId: newHotel._id,
        metadata: { hotelName: newHotel.name, adminEmail: newAdmin.email }
      });

      res.status(201).json({
        success: true,
        message: 'Hotel onboarded and activated successfully',
        data: {
          hotel: {
            id: newHotel._id,
            name: newHotel.name,
            slug: newHotel.slug,
            status: newHotel.status,
            contactEmail: newHotel.contactEmail,
            country: newHotel.country,
            currency: newHotel.currency,
          },
          admin: {
            id: newAdmin._id,
            fullName: newAdmin.fullName,
            email: newAdmin.email,
            role: newAdmin.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHotelById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const hotel = await HotelAccount.findById(id)
        .populate('primaryAdminUserId', 'fullName email status createdAt')
        .lean();

      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      const [propertyCount, publishedPropertyCount, totalRoomTypes, recentActivity] = await Promise.all([
        Property.countDocuments({ hotelAccountId: hotel._id }),
        Property.countDocuments({ hotelAccountId: hotel._id, status: 'PUBLISHED' }),
        RoomType.countDocuments({ hotelAccountId: hotel._id, isActive: true }),
        ActivityLog.find({ tenantId: hotel._id }).sort({ createdAt: -1 }).limit(10).populate('actorId', 'fullName email').lean()
      ]);

      res.status(200).json({
        success: true,
        data: {
          hotel,
          propertyCount,
          publishedPropertyCount,
          totalRoomTypes,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHotel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateHotelSchema.parse(req.body);

      const hotel = await HotelAccount.findByIdAndUpdate(
        id,
        { $set: data },
        { returnDocument: 'after', runValidators: true }
      ).populate('primaryAdminUserId', 'fullName email status');

      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      await logActivity({
        tenantId: hotel._id,
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'HOTEL_UPDATED',
        targetType: 'HotelAccount',
        targetId: hotel._id,
      });

      res.status(200).json({
        success: true,
        message: 'Hotel details updated successfully',
        data: {
          hotel,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHotelStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = updateStatusSchema.parse(req.body);

      const hotelBefore = await HotelAccount.findById(id);
      if (!hotelBefore) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }
      const previousStatus = hotelBefore.status;

      const hotel = await HotelAccount.findByIdAndUpdate(
        id,
        { $set: { status } },
        { returnDocument: 'after' }
      ).populate('primaryAdminUserId', 'fullName email status');

      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      await logActivity({
        tenantId: hotel._id,
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'STATUS_CHANGED',
        targetType: 'HotelAccount',
        targetId: hotel._id,
        metadata: { previousStatus, newStatus: status }
      });

      res.status(200).json({
        success: true,
        message: `Hotel status updated to ${status}`,
        data: {
          hotel,
        },
      });
    } catch (error) {
      next(error);
    }
  }
  static async resetHotelAdminPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { newPassword } = resetPasswordSchema.parse(req.body);

      const hotel = await HotelAccount.findById(id);
      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      const user = await User.findById(hotel.primaryAdminUserId);
      if (!user) {
        throw new AppError('Admin user not found', 404, 'USER_NOT_FOUND');
      }

      const salt = await bcrypt.genSalt(12);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await user.save();

      await logActivity({
        tenantId: hotel._id,
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'PASSWORD_RESET',
        targetType: 'User',
        targetId: user._id,
      });

      res.status(200).json({
        success: true,
        message: 'Admin password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHotelAdminEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { newEmail } = updateAdminEmailSchema.parse(req.body);
      const email = newEmail.toLowerCase().trim();

      const hotel = await HotelAccount.findById(id);
      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== hotel.primaryAdminUserId.toString()) {
        throw new AppError('An administrator with this email address already exists', 400, 'USER_ALREADY_EXISTS');
      }

      const user = await User.findById(hotel.primaryAdminUserId);
      if (!user) {
        throw new AppError('Admin user not found', 404, 'USER_NOT_FOUND');
      }

      const oldEmail = user.email;
      user.email = email;
      await user.save();

      await logActivity({
        tenantId: hotel._id,
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_EMAIL_CHANGED',
        targetType: 'User',
        targetId: user._id,
        metadata: { oldEmail, newEmail: email }
      });

      res.status(200).json({
        success: true,
        message: 'Admin email updated successfully',
        data: { email }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateHotelAdminProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateAdminProfileSchema.parse(req.body);

      const hotel = await HotelAccount.findById(id);
      if (!hotel) {
        throw new AppError('Hotel not found', 404, 'HOTEL_NOT_FOUND');
      }

      const user = await User.findById(hotel.primaryAdminUserId);
      if (!user) {
        throw new AppError('Admin user not found', 404, 'USER_NOT_FOUND');
      }

      if (data.fullName) user.fullName = data.fullName.trim();
      if (data.status) user.status = data.status;
      await user.save();

      await logActivity({
        tenantId: hotel._id,
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_PROFILE_UPDATED',
        targetType: 'User',
        targetId: user._id,
        metadata: { fullName: user.fullName, status: user.status },
      });

      res.status(200).json({
        success: true,
        message: 'Hotel admin profile updated successfully',
        data: {
          admin: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            status: user.status,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHotelActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const activities = await ActivityLog.find({ tenantId: id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('actorId', 'fullName email')
        .lean();

      res.status(200).json({
        success: true,
        data: { activities }
      });
    } catch (error) {
      next(error);
    }
  }
}
