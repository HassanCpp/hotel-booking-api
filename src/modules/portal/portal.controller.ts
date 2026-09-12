import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { Property } from '../../models/Property';
import { AppError } from '../../middleware/errorHandler';

export class PortalController {
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

  static async getMyProperties(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.hotelAccountId) {
        throw new AppError('No hotel account linked to your profile', 404, 'HOTEL_NOT_FOUND');
      }

      const properties = await Property.find({ hotelAccountId: req.hotelAccountId }).lean();

      res.status(200).json({
        success: true,
        data: {
          properties,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
