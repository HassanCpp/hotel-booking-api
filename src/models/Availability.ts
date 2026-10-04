import { Schema, model, Document, Types } from 'mongoose';

export interface IAvailability extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  roomTypeId: Types.ObjectId;
  date: Date; // Normalized to midnight UTC

  totalUnits: number;
  bookedUnits: number;
  blockedUnits: number;

  rateOverride?: number;
  minStay?: number;
  isClosed: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const AvailabilitySchema = new Schema<IAvailability>(
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
    roomTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'RoomType',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalUnits: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    bookedUnits: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    blockedUnits: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    rateOverride: {
      type: Number,
      min: 0,
    },
    minStay: {
      type: Number,
      min: 1,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique compound index: One availability record per roomType per calendar date
AvailabilitySchema.index({ roomTypeId: 1, date: 1 }, { unique: true });
AvailabilitySchema.index({ propertyId: 1, date: 1 });
AvailabilitySchema.index({ hotelAccountId: 1, date: 1 });

export const Availability = model<IAvailability>('Availability', AvailabilitySchema);
