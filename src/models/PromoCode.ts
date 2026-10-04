import { Schema, model, Document, Types } from 'mongoose';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface IPromoCode extends Document {
  _id: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  propertyId?: Types.ObjectId; // null = applies to all properties of this hotel

  code: string;
  description: string;

  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minBookingAmount?: number;

  validFrom: Date;
  validTo: Date;
  maxUses?: number; // null = unlimited
  currentUses: number;
  maxUsesPerGuest?: number;

  applicableRoomTypes?: Types.ObjectId[];
  minNights?: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PromoCodeSchema = new Schema<IPromoCode>(
  {
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    minBookingAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    maxUses: {
      type: Number,
      min: 1,
    },
    currentUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUsesPerGuest: {
      type: Number,
      default: 1,
      min: 1,
    },
    applicableRoomTypes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'RoomType',
      },
    ],
    minNights: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Unique code per hotel
PromoCodeSchema.index({ hotelAccountId: 1, code: 1 }, { unique: true });
PromoCodeSchema.index({ hotelAccountId: 1, isActive: 1 });

export const PromoCode = model<IPromoCode>('PromoCode', PromoCodeSchema);
