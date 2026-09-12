import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import { HotelMembership } from '../models/HotelMembership';
import { HotelAccount } from '../models/HotelAccount';
import { AuthRequest, TokenPayload, AuthenticatedUser } from '../types/auth.types';
import { AppError } from './errorHandler';
import { Types } from 'mongoose';

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authorization token required', 401, 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
    }

    let hotelAccountId: string | undefined = undefined;
    let hotelAccountName: string | undefined = undefined;

    // For hotel admins and staff, resolve their hotel membership
    if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
      const membership = await HotelMembership.findOne({ userId: user._id })
        .populate('hotelAccountId')
        .lean();

      if (membership && membership.hotelAccountId) {
        const hotel = membership.hotelAccountId as any;
        if (hotel.status === 'SUSPENDED') {
          throw new AppError('Hotel account is suspended', 403, 'HOTEL_SUSPENDED');
        }
        hotelAccountId = hotel._id.toString();
        hotelAccountName = hotel.name;
      }
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      hotelAccountId,
      hotelAccountName,
    };

    req.user = authenticatedUser;
    if (hotelAccountId) {
      req.hotelAccountId = new Types.ObjectId(hotelAccountId);
    }

    next();
  } catch (error) {
    next(error);
  }
}
