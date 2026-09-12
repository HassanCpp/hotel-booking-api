import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/auth.types';
import { HotelAccount } from '../../models/HotelAccount';
import { User } from '../../models/User';
import { Property } from '../../models/Property';

export class AdminController {
  static async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [totalHotels, totalUsers, totalProperties] = await Promise.all([
        HotelAccount.countDocuments(),
        User.countDocuments(),
        Property.countDocuments(),
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalHotels,
          totalUsers,
          totalProperties,
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
}
