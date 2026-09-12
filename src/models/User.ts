import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'HOTEL_ADMIN' | 'HOTEL_STAFF' | 'GUEST';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'HOTEL_STAFF', 'GUEST'],
      default: 'GUEST',
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
