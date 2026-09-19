import { Schema, model, Document, Types } from 'mongoose';

export interface IRoomTypeOccupancy {
  adults: number;
  children: number;
}

export interface IRoomType extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  name: string;
  code: string;
  description: string;
  maxOccupancy: IRoomTypeOccupancy;
  bedConfig: string;
  roomSizeSqm?: number;
  totalUnits: number;
  basePricePerNight: number;
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
    roomSizeSqm: {
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
