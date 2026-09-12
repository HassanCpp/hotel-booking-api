import { Request } from 'express';
import { UserRole } from '../models/User';
import { Types } from 'mongoose';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  hotelAccountId?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  hotelAccountId?: string;
  hotelAccountName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  hotelAccountId?: Types.ObjectId;
}
