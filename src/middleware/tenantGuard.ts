import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { AppError } from './errorHandler';

/**
 * Ensures the authenticated user only accesses resources belonging to their assigned HotelAccount.
 * SUPER_ADMIN is exempt and possesses platform-wide access.
 */
export function tenantGuard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  // Super Admins have platform-wide access
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Hotel Admins & Staff must have an assigned hotel account
  if (!req.user.hotelAccountId || !req.hotelAccountId) {
    next(
      new AppError(
        'User is not associated with any active hotel account',
        403,
        'TENANT_MEMBERSHIP_REQUIRED'
      )
    );
    return;
  }

  // Check if target hotel account ID is provided in params or body
  const targetHotelId =
    req.params.hotelId ||
    req.params.hotelAccountId ||
    req.body.hotelAccountId ||
    req.query.hotelAccountId;

  if (targetHotelId && targetHotelId.toString() !== req.user.hotelAccountId) {
    next(
      new AppError(
        'Cross-tenant access violation: You cannot access or modify resources of another hotel',
        403,
        'CROSS_TENANT_ACCESS_DENIED'
      )
    );
    return;
  }

  next();
}
