import { Schema, model, Document, Types } from 'mongoose';

export type RoomCategory = 'STANDARD' | 'DELUXE' | 'EXECUTIVE' | 'SUITE' | 'VILLA' | 'PENTHOUSE';
export type RoomViewType = 'CITY_VIEW' | 'SEA_VIEW' | 'GARDEN_VIEW' | 'POOL_VIEW' | 'COURTYARD_VIEW' | 'MOUNTAIN_VIEW' | 'INTERNAL';
export type OutdoorSpaceType = 'NONE' | 'BALCONY' | 'TERRACE' | 'PATIO' | 'PRIVATE_POOL';
export type MealPlanType = 'ROOM_ONLY' | 'BREAKFAST_INCLUDED' | 'HALF_BOARD' | 'ALL_INCLUSIVE';

export interface IRoomTypeOccupancy {
  adults: number;
  children: number;
}

export interface IRoomBathroom {
  hasTub: boolean;
  hasWalkInShower: boolean;
  hasDoubleVanity: boolean;
  bathroomCount: number;
}

export interface IRoomBedding {
  primaryBed: string;
  bedCount: number;
  allowsRollaway: boolean;
  rollawayFee: number;
  allowsCrib: boolean;
}

export interface IRoomPricing {
  basePricePerNight: number;
  extraAdultRate?: number;
  extraChildRate?: number;
}

export interface IRoomType extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  name: string;
  code: string;
  category: RoomCategory;
  viewType: RoomViewType;
  outdoorSpace: OutdoorSpaceType;
  description: string;
  maxOccupancy: IRoomTypeOccupancy;
  bedConfig: string;
  bedding?: IRoomBedding;
  bathroom?: IRoomBathroom;
  roomSizeSqm?: number;
  roomSizeSqft?: number;
  totalUnits: number;
  basePricePerNight: number;
  pricing?: IRoomPricing;
  mealPlan: MealPlanType;
  isSmokingAllowed: boolean;
  isAccessible: boolean;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomTypeSchema = new Schema<IRoomType>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
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
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      enum: ['STANDARD', 'DELUXE', 'EXECUTIVE', 'SUITE', 'VILLA', 'PENTHOUSE'],
      default: 'STANDARD',
      index: true,
    },
    viewType: {
      type: String,
      enum: ['CITY_VIEW', 'SEA_VIEW', 'GARDEN_VIEW', 'POOL_VIEW', 'COURTYARD_VIEW', 'MOUNTAIN_VIEW', 'INTERNAL'],
      default: 'CITY_VIEW',
    },
    outdoorSpace: {
      type: String,
      enum: ['NONE', 'BALCONY', 'TERRACE', 'PATIO', 'PRIVATE_POOL'],
      default: 'NONE',
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    maxOccupancy: {
      adults: {
        type: Number,
        required: true,
        default: 2,
        min: 1,
      },
      children: {
        type: Number,
        default: 1,
        min: 0,
      },
    },
    bedConfig: {
      type: String,
      required: true,
      default: '1 King Bed',
      trim: true,
    },
    bedding: {
      primaryBed: { type: String, default: 'King' },
      bedCount: { type: Number, default: 1 },
      allowsRollaway: { type: Boolean, default: false },
      rollawayFee: { type: Number, default: 0 },
      allowsCrib: { type: Boolean, default: true },
    },
    bathroom: {
      hasTub: { type: Boolean, default: false },
      hasWalkInShower: { type: Boolean, default: true },
      hasDoubleVanity: { type: Boolean, default: false },
      bathroomCount: { type: Number, default: 1 },
    },
    roomSizeSqm: {
      type: Number,
      min: 0,
    },
    roomSizeSqft: {
      type: Number,
      min: 0,
    },
    totalUnits: {
      type: Number,
      required: true,
      min: 1,
      default: 5,
    },
    basePricePerNight: {
      type: Number,
      required: true,
      min: 0,
    },
    pricing: {
      basePricePerNight: { type: Number },
      extraAdultRate: { type: Number, default: 0 },
      extraChildRate: { type: Number, default: 0 },
    },
    mealPlan: {
      type: String,
      enum: ['ROOM_ONLY', 'BREAKFAST_INCLUDED', 'HALF_BOARD', 'ALL_INCLUSIVE'],
      default: 'ROOM_ONLY',
    },
    isSmokingAllowed: {
      type: Boolean,
      default: false,
    },
    isAccessible: {
      type: Boolean,
      default: false,
    },
    amenities: [{ type: String, trim: true }],
    images: [{ type: String, trim: true }],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index: Unique room code per property
RoomTypeSchema.index({ propertyId: 1, code: 1 }, { unique: true });

export const RoomType = model<IRoomType>('RoomType', RoomTypeSchema);
