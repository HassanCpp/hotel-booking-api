import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { AuthRequest } from '../../types/auth.types';
import { AppError } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import { env } from '../../config/env';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const getAuthCookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  ...(maxAge ? { maxAge } : {}),
});

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const { user, accessToken, refreshToken } = await AuthService.login(email, password);

      // Set refresh token in HttpOnly secure cookie
      res.cookie('refreshToken', refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user,
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!refreshToken) {
        throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED');
      }

      const { accessToken, user } = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          user,
        },
      });
    } catch (error) {
      res.clearCookie('refreshToken', getAuthCookieOptions());
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('refreshToken', getAuthCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const googleSchema = z.object({
        email: z.string().email().optional(),
        name: z.string().min(1).optional(),
        googleId: z.string().optional(),
        avatar: z.string().optional(),
        credential: z.string().optional(),
      });

      const body = googleSchema.parse(req.body);
      let email = body.email;
      let name = body.name;
      let googleId = body.googleId;
      let avatar = body.avatar;

      // Decode Google Identity Services JWT if provided
      if (body.credential) {
        try {
          const decoded: any = jwt.decode(body.credential);
          if (decoded && typeof decoded.email === 'string') {
            email = decoded.email;
            name = decoded.name || decoded.given_name || decoded.email.split('@')[0];
            googleId = decoded.sub || googleId;
            avatar = decoded.picture || avatar;
          }
        } catch (e) {
          console.warn('[Google Auth] Failed to decode Google credential token:', e);
        }
      }

      if (!email || !name) {
        throw new AppError('Email and name are required for Google authentication', 400, 'INVALID_INPUT');
      }

      const emailLower = email.toLowerCase();

      // Find or create guest user
      let user = await User.findOne({ email: emailLower });
      if (!user) {
        user = await User.create({
          email: emailLower,
          fullName: name,
          role: 'GUEST',
          status: 'ACTIVE',
          googleId: googleId,
          avatar: avatar,
          savedProperties: [],
        });
      } else {
        let changed = false;
        if (!user.googleId && googleId) {
          user.googleId = googleId;
          changed = true;
        }
        if (avatar && !user.avatar) {
          user.avatar = avatar;
          changed = true;
        }
        if (changed) {
          await user.save();
        }
      }

      if (user.status !== 'ACTIVE') {
        throw new AppError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
      }

      const accessToken = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        env.JWT_ACCESS_SECRET,
        { expiresIn: (env.JWT_ACCESS_EXPIRES_IN || '15m') as any }
      );

      const refreshToken = jwt.sign(
        { userId: user._id.toString(), role: user.role },
        env.JWT_REFRESH_SECRET,
        { expiresIn: (env.JWT_REFRESH_EXPIRES_IN || '7d') as any }
      );

      res.cookie('refreshToken', refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

      res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            nationality: user.nationality,
          },
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const user = await AuthService.getMe(req.user.id);

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGoogleConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          clientId: env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
