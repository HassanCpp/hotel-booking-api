import { Schema, model, Document, Types } from 'mongoose';

export type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PropertyType = 'HOTEL' | 'RESORT' | 'BOUTIQUE' | 'APARTMENT' | 'VILLA' | 'LODGE' | 'GLAMPING';

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
  googlePlaceId?: string;
  formattedAddress?: string;
}

export interface IPropertyCategoryRatings {
  cleanliness: number;
  accuracy: number;
  checkIn: number;
  communication: number;
  location: number;
  value: number;
}

export interface IProperty extends Document {
  _id: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  propertyType: PropertyType;
  starRating?: number;
  address: IPropertyAddress;
  contactEmail?: string;
  contactPhone?: string;
  checkInTime: string;
  checkOutTime: string;
  coverImage?: string;
  gallery: string[];
  amenities: string[];
  status: PropertyStatus;

  // Review & Rating Aggregates
  averageRating: number;
  reviewCount: number;
  categoryRatings: IPropertyCategoryRatings;
  isGuestFavorite: boolean;
  isFeaturedOnHome?: boolean;
  featuredPriority?: number;

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
      enum: ['HOTEL', 'RESORT', 'BOUTIQUE', 'APARTMENT', 'VILLA', 'LODGE', 'GLAMPING'],
      default: 'HOTEL',
      index: true,
    },
    starRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 4,
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
      googlePlaceId: { type: String, trim: true },
      formattedAddress: { type: String, trim: true },
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

    // Rating Aggregations
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    categoryRatings: {
      cleanliness: { type: Number, default: 0, min: 0, max: 5 },
      accuracy: { type: Number, default: 0, min: 0, max: 5 },
      checkIn: { type: Number, default: 0, min: 0, max: 5 },
      communication: { type: Number, default: 0, min: 0, max: 5 },
      location: { type: Number, default: 0, min: 0, max: 5 },
      value: { type: Number, default: 0, min: 0, max: 5 },
    },
    isGuestFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFeaturedOnHome: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredPriority: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

// Search indexes
PropertySchema.index({ status: 1, averageRating: -1 });
PropertySchema.index({ status: 1, 'address.city': 1 });
PropertySchema.index({ status: 1, isFeaturedOnHome: 1, featuredPriority: 1 });

export const Property = model<IProperty>('Property', PropertySchema);
