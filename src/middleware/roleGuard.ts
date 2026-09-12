import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { UserRole } from '../models/User';
import { AppError } from './errorHandler';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          `Forbidden: role '${req.user.role}' does not have access to this resource`,
          403,
          'FORBIDDEN'
        )
      );
      return;
    }

    next();
  };
}
