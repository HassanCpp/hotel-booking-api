import { Schema, model, Document, Types } from 'mongoose';

export type HotelAccountStatus = 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface IHotelAccount extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: HotelAccountStatus;
  contactEmail: string;
  contactPhone?: string;
  country: string;
  currency: string;
  timezone: string;
  primaryAdminUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HotelAccountSchema = new Schema<IHotelAccount>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'],
      default: 'ONBOARDING',
      index: true,
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      default: 'Pakistan',
      trim: true,
    },
    currency: {
      type: String,
      default: 'PKR',
      trim: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
      trim: true,
    },
    primaryAdminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const HotelAccount = model<IHotelAccount>('HotelAccount', HotelAccountSchema);
