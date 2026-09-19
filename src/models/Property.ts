import { Schema, model, Document, Types } from 'mongoose';

export type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PropertyType = 'HOTEL' | 'RESORT' | 'BOUTIQUE' | 'APARTMENT';

export interface IPropertyAddress {
  street?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface IProperty extends Document {
  _id: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  propertyType: PropertyType;
  address: IPropertyAddress;
  contactEmail?: string;
  contactPhone?: string;
  checkInTime: string;
  checkOutTime: string;
  coverImage?: string;
  gallery: string[];
  amenities: string[];
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
      trim: true,
    },
    propertyType: {
      type: String,
      enum: ['HOTEL', 'RESORT', 'BOUTIQUE', 'APARTMENT'],
      default: 'HOTEL',
      index: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, required: true, trim: true, index: true },
      state: { type: String, trim: true },
      country: { type: String, required: true, default: 'Pakistan', trim: true },
      postalCode: { type: String, trim: true },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    checkInTime: {
      type: String,
      default: '14:00',
    },
    checkOutTime: {
      type: String,
      default: '12:00',
    },
    coverImage: { type: String, trim: true },
    gallery: [{ type: String, trim: true }],
    amenities: [{ type: String, trim: true }],
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
