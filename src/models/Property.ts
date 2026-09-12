import { Schema, model, Document, Types } from 'mongoose';

export type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface IProperty extends Document {
  _id: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  city: string;
  country: string;
  checkInTime: string;
  checkOutTime: string;
  status: PropertyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      required: true,
      index: true,
    },
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
    description: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    country: {
      type: String,
      default: 'Pakistan',
      trim: true,
    },
    checkInTime: {
      type: String,
      default: '14:00',
    },
    checkOutTime: {
      type: String,
      default: '12:00',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
  },
  { timestamps: true }
);

export const Property = model<IProperty>('Property', PropertySchema);
