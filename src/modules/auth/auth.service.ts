import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { User, IUser } from '../../models/User';
import { HotelMembership } from '../../models/HotelMembership';
import { HotelAccount } from '../../models/HotelAccount';
import { AppError } from '../../middleware/errorHandler';
import { TokenPayload, AuthenticatedUser } from '../../types/auth.types';

export class AuthService {
  static async login(email: string, password: string): Promise<{
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.passwordHash) {
      throw new AppError('This account was registered via Google sign-in. Please sign in with Google.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Your account has been suspended. Please contact platform support.', 403, 'ACCOUNT_SUSPENDED');
    }

    let hotelAccountId: string | undefined = undefined;
    let hotelAccountName: string | undefined = undefined;

    if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
      const membership = await HotelMembership.findOne({ userId: user._id })
        .populate('hotelAccountId')
        .lean();

      if (membership && membership.hotelAccountId) {
        const hotel = membership.hotelAccountId as any;
        if (hotel.status === 'SUSPENDED') {
          throw new AppError('Your hotel account has been suspended.', 403, 'HOTEL_SUSPENDED');
        }
        hotelAccountId = hotel._id.toString();
        hotelAccountName = hotel.name;
      }
    }

    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      hotelAccountId,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign({ userId: user._id.toString() }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      hotelAccountId,
      hotelAccountName,
    };

    return { user: authenticatedUser, accessToken, refreshToken };
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    user: AuthenticatedUser;
  }> {
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId).lean();

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    let hotelAccountId: string | undefined = undefined;
    let hotelAccountName: string | undefined = undefined;

    if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
      const membership = await HotelMembership.findOne({ userId: user._id })
        .populate('hotelAccountId')
        .lean();

      if (membership && membership.hotelAccountId) {
        const hotel = membership.hotelAccountId as any;
        hotelAccountId = hotel._id.toString();
        hotelAccountName = hotel.name;
      }
    }

    const payload: TokenPayload = {
      userId: user._id.toString(),
      role: user.role,
      hotelAccountId,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      hotelAccountId,
      hotelAccountName,
    };

    return { accessToken, user: authenticatedUser };
  }

  static async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    let hotelAccountId: string | undefined = undefined;
    let hotelAccountName: string | undefined = undefined;

    if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
      const membership = await HotelMembership.findOne({ userId: user._id })
        .populate('hotelAccountId')
        .lean();

      if (membership && membership.hotelAccountId) {
        const hotel = membership.hotelAccountId as any;
        hotelAccountId = hotel._id.toString();
        hotelAccountName = hotel.name;
      }
    }

    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      hotelAccountId,
      hotelAccountName,
    };
  }
}
