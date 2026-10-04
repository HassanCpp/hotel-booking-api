import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'HOTEL_ADMIN' | 'HOTEL_STAFF' | 'GUEST';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface IUserPreferences {
  preferredCurrency?: string;
  smokingPreference?: 'SMOKING' | 'NON_SMOKING' | 'NO_PREFERENCE';
  floorPreference?: 'HIGH' | 'LOW' | 'NO_PREFERENCE';
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  googleId?: string;

  // Guest Specific Fields
  phone?: string;
  nationality?: string;
  dateOfBirth?: Date;
  identityDocument?: string;
  avatar?: string;
  savedProperties: Types.ObjectId[];
  preferences?: IUserPreferences;

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
      required: false,
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
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
    phone: {
      type: String,
      trim: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    identityDocument: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
    savedProperties: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Property',
      },
    ],
    preferences: {
      preferredCurrency: { type: String, default: 'PKR' },
      smokingPreference: {
        type: String,
        enum: ['SMOKING', 'NON_SMOKING', 'NO_PREFERENCE'],
        default: 'NO_PREFERENCE',
      },
      floorPreference: {
        type: String,
        enum: ['HIGH', 'LOW', 'NO_PREFERENCE'],
        default: 'NO_PREFERENCE',
      },
    },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
