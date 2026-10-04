import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AuthRequest } from '../../types/auth.types';
import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { Review } from '../../models/Review';
import { Property } from '../../models/Property';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { releaseRooms } from '../../utils/availability';
import { recalculatePropertyRatings } from '../../utils/reviewAggregation';

export class GuestController {
  /**
   * Guest Registration
   */
  static async register(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const registerSchema = z.object({
        fullName: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        phone: z.string().optional(),
        nationality: z.string().optional(),
      });

      const body = registerSchema.parse(req.body);
      const emailLower = body.email.toLowerCase();

      const existing = await User.findOne({ email: emailLower });
      if (existing) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
      }

      const passwordHash = await bcrypt.hash(body.password, 12);
      const user = await User.create({
        fullName: body.fullName,
        email: emailLower,
        passwordHash,
        role: 'GUEST',
        status: 'ACTIVE',
        phone: body.phone,
        nationality: body.nationality,
        savedProperties: [],
      });

      // Link any prior bookings made with this email
      await Booking.updateMany(
        { 'guest.email': emailLower, 'guest.guestUserId': { $exists: false } },
        { 'guest.guestUserId': user._id }
      );

      const token = jwt.sign(
        { userId: user._id.toString(), role: 'GUEST' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        data: {
          token,
          accessToken: token,
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            phone: user.phone,
            nationality: user.nationality,
            savedProperties: user.savedProperties,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all bookings for the logged-in guest.
   */
  static async getMyBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const userEmail = req.user!.email;

      const bookings = await Booking.find({
        $or: [{ 'guest.guestUserId': userId }, { 'guest.email': userEmail }],
      })
        .populate('propertyId', 'name slug coverImage starRating address averageRating')
        .populate('roomTypeId', 'name category images')
        .sort({ createdAt: -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: { bookings },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get booking detail.
   */
  static async getBookingDetail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userEmail = req.user!.email;

      const booking = await Booking.findOne({
        _id: id,
        $or: [{ 'guest.guestUserId': userId }, { 'guest.email': userEmail }],
      })
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
   * Cancel booking (Guest initiated).
   */
  static async cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;
      const userEmail = req.user!.email;

      const booking = await Booking.findOne({
        _id: id,
        $or: [{ 'guest.guestUserId': userId }, { 'guest.email': userEmail }],
      });

      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      if (['CANCELLED', 'CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
        throw new AppError(`Cannot cancel a booking with status ${booking.status}`, 400, 'INVALID_STATUS');
      }

      // Release reserved inventory
      await releaseRooms({
        roomTypeId: booking.roomTypeId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: booking.rooms,
      });

      booking.status = 'CANCELLED';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'GUEST',
        reason: reason || 'Cancelled by guest',
        refundAmount: 0,
      };

      await booking.save();

      res.status(200).json({
        success: true,
        data: { booking },
        message: 'Booking cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit a verified review for a completed stay.
   */
  static async submitReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bookingId } = req.params;
      const userId = req.user!.id;

      const categoryRatingSchema = z.object({
        cleanliness: z.number().min(1).max(5),
        accuracy: z.number().min(1).max(5),
        checkIn: z.number().min(1).max(5),
        communication: z.number().min(1).max(5),
        location: z.number().min(1).max(5),
        value: z.number().min(1).max(5),
      });

      const reviewSchema = z.object({
        overallRating: z.number().min(1).max(5),
        categories: categoryRatingSchema.optional(),
        ratings: categoryRatingSchema.optional(),
        title: z.string().optional(),
        comment: z.string().min(10, 'Review comment must be at least 10 characters'),
        photos: z.array(z.string()).default([]),
      });

      const body = reviewSchema.parse(req.body);
      const categories = body.categories || body.ratings;
      if (!categories) {
        throw new AppError('Category ratings (cleanliness, accuracy, checkIn, communication, location, value) are required', 400, 'INVALID_INPUT');
      }

      const booking = await Booking.findById(bookingId).populate('roomTypeId', 'name');
      if (!booking) {
        throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
      }

      // Check ownership
      const isOwner =
        booking.guest.guestUserId?.toString() === userId ||
        booking.guest.email.toLowerCase() === req.user!.email.toLowerCase();

      if (!isOwner) {
        throw new AppError('You are not authorized to review this reservation', 403, 'UNAUTHORIZED');
      }

      // Check status: guest must have completed the stay
      if (!['CHECKED_OUT', 'COMPLETED'].includes(booking.status)) {
        throw new AppError('Reviews can only be submitted after check-out', 400, 'STAY_NOT_COMPLETED');
      }

      if (booking.hasReview) {
        throw new AppError('A review has already been submitted for this booking', 409, 'REVIEW_EXISTS');
      }

      const user = await User.findById(userId).lean();
      const roomType = booking.roomTypeId as any;

      const review = await Review.create({
        bookingId: booking._id,
        propertyId: booking.propertyId,
        hotelAccountId: booking.hotelAccountId,
        roomTypeId: booking.roomTypeId,
        guestUserId: user?._id,
        guestName: booking.guest.fullName,
        guestCountry: user?.nationality || booking.guest.nationality || 'Guest',
        guestAvatar: user?.avatar,
        stayDate: booking.checkIn,
        roomTypeName: roomType?.name || 'Standard Room',
        overallRating: body.overallRating,
        categories,
        title: body.title,
        comment: body.comment,
        photos: body.photos,
        status: 'PUBLISHED',
      });

      booking.hasReview = true;
      booking.reviewId = review._id;
      await booking.save();

      // Recalculate property scores
      await recalculatePropertyRatings(booking.propertyId);

      res.status(201).json({
        success: true,
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get profile.
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id)
        .populate('savedProperties', 'name slug coverImage starRating address averageRating')
        .lean();

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update profile.
   */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updateSchema = z.object({
        fullName: z.string().min(2).optional(),
        phone: z.string().optional(),
        nationality: z.string().optional(),
        avatar: z.string().optional(),
        preferences: z
          .object({
            preferredCurrency: z.string().optional(),
            smokingPreference: z.enum(['SMOKING', 'NON_SMOKING', 'NO_PREFERENCE']).optional(),
            floorPreference: z.enum(['HIGH', 'LOW', 'NO_PREFERENCE']).optional(),
          })
          .optional(),
      });

      const body = updateSchema.parse(req.body);

      const user = await User.findByIdAndUpdate(req.user!.id, { $set: body }, { new: true }).lean();

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Wishlist / Saved Properties
   */
  static async getSavedProperties(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await User.findById(req.user!.id)
        .populate({
          path: 'savedProperties',
          match: { status: 'PUBLISHED' },
          select: 'name slug coverImage starRating address averageRating reviewCount isGuestFavorite propertyType',
        })
        .lean();

      res.status(200).json({
        success: true,
        data: { savedProperties: user?.savedProperties || [] },
      });
    } catch (error) {
      next(error);
    }
  }

  static async saveProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId } = req.params;
      const user = await User.findByIdAndUpdate(
        req.user!.id,
        { $addToSet: { savedProperties: propertyId } },
        { new: true }
      ).lean();

      res.status(200).json({
        success: true,
        data: { savedProperties: user?.savedProperties || [] },
      });
    } catch (error) {
      next(error);
    }
  }

  static async unsaveProperty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { propertyId } = req.params;
      const user = await User.findByIdAndUpdate(
        req.user!.id,
        { $pull: { savedProperties: propertyId } },
        { new: true }
      ).lean();

      res.status(200).json({
        success: true,
        data: { savedProperties: user?.savedProperties || [] },
      });
    } catch (error) {
      next(error);
    }
  }
}
