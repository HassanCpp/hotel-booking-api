import { Schema, model, Document, Types } from 'mongoose';

export type RatePlanType =
  | 'SEASONAL'
  | 'WEEKEND'
  | 'PROMOTIONAL'
  | 'LENGTH_OF_STAY'
  | 'EARLY_BIRD';

export type AdjustmentType =
  | 'FIXED_PRICE'
  | 'PERCENTAGE_INCREASE'
  | 'PERCENTAGE_DISCOUNT';

export interface IRatePlan extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  roomTypeId: Types.ObjectId;

  name: string;
  type: RatePlanType;

  adjustmentType: AdjustmentType;
  adjustmentValue: number;

  validFrom: Date;
  validTo: Date;
  daysOfWeek?: number[]; // [5, 6] for Fri, Sat (0=Sun, 6=Sat)
  minNights?: number;
  maxNights?: number;
  advanceBookingDays?: number;

  isActive: boolean;
  priority: number; // Higher number = higher precedence

  createdAt: Date;
  updatedAt: Date;
}

const RatePlanSchema = new Schema<IRatePlan>(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['SEASONAL', 'WEEKEND', 'PROMOTIONAL', 'LENGTH_OF_STAY', 'EARLY_BIRD'],
      default: 'PROMOTIONAL',
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: ['FIXED_PRICE', 'PERCENTAGE_INCREASE', 'PERCENTAGE_DISCOUNT'],
      required: true,
    },
    adjustmentValue: {
      type: Number,
      required: true,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    minNights: { type: Number, min: 1 },
    maxNights: { type: Number, min: 1 },
    advanceBookingDays: { type: Number, min: 0 },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 10,
      index: true,
    },
  },
  { timestamps: true }
);

RatePlanSchema.index({ roomTypeId: 1, isActive: 1, priority: -1 });

export const RatePlan = model<IRatePlan>('RatePlan', RatePlanSchema);
