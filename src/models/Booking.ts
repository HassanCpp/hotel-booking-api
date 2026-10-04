import { Schema, model, Document, Types } from 'mongoose';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'REFUNDED';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD_ON_ARRIVAL'
  | 'ONLINE'
  | 'BANK_TRANSFER'
  | 'COMPLIMENTARY';

export type BookingSource =
  | 'MARKETPLACE'
  | 'MANUAL'
  | 'WALK_IN'
  | 'PHONE'
  | 'AGENT'
  | 'CORPORATE';

export interface IBookingGuest {
  fullName: string;
  email: string;
  phone: string;
  nationality?: string;
  identityDocument?: string;
  guestUserId?: Types.ObjectId; // ref: User if registered
}

export interface IBookingPricing {
  ratePerNight: number;
  ratePlanName?: string;
  roomTotal: number;
  taxes: number;
  taxRate: number;
  addOns: Array<{ name: string; price: number }>;
  discount: number;
  promoCode?: string;
  totalAmount: number;
  currency: string;
}

export interface IBookingCancellation {
  cancelledAt: Date;
  cancelledBy: 'GUEST' | 'HOTEL' | 'SYSTEM';
  reason?: string;
  refundAmount: number;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingReference: string;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  roomTypeId: Types.ObjectId;

  guest: IBookingGuest;

  checkIn: Date;
  checkOut: Date;
  nights: number;

  rooms: number;
  adults: number;
  children: number;

  pricing: IBookingPricing;

  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  source: BookingSource;

  specialRequests?: string;
  internalNotes?: string;

  cancellation?: IBookingCancellation;
  idempotencyKey?: string;

  hasReview: boolean;
  reviewId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
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
    guest: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true, index: true },
      phone: { type: String, required: true, trim: true },
      nationality: { type: String, trim: true },
      identityDocument: { type: String, trim: true },
      guestUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    },
    checkIn: {
      type: Date,
      required: true,
      index: true,
    },
    checkOut: {
      type: Date,
      required: true,
      index: true,
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    rooms: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    adults: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    children: {
      type: Number,
      default: 0,
      min: 0,
    },
    pricing: {
      ratePerNight: { type: Number, required: true, min: 0 },
      ratePlanName: { type: String, trim: true },
      roomTotal: { type: Number, required: true, min: 0 },
      taxes: { type: Number, default: 0, min: 0 },
      taxRate: { type: Number, default: 0.16, min: 0 },
      addOns: [
        {
          name: { type: String, required: true, trim: true },
          price: { type: Number, required: true, min: 0 },
        },
      ],
      discount: { type: Number, default: 0, min: 0 },
      promoCode: { type: String, uppercase: true, trim: true },
      totalAmount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'PKR', uppercase: true, trim: true },
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'CONFIRMED',
        'CHECKED_IN',
        'CHECKED_OUT',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
        'REFUNDED',
      ],
      default: 'CONFIRMED',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD_ON_ARRIVAL', 'ONLINE', 'BANK_TRANSFER', 'COMPLIMENTARY'],
      default: 'CASH',
    },
    source: {
      type: String,
      enum: ['MARKETPLACE', 'MANUAL', 'WALK_IN', 'PHONE', 'AGENT', 'CORPORATE'],
      default: 'MARKETPLACE',
      index: true,
    },
    specialRequests: {
      type: String,
      trim: true,
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    cancellation: {
      cancelledAt: { type: Date },
      cancelledBy: { type: String, enum: ['GUEST', 'HOTEL', 'SYSTEM'] },
      reason: { type: String, trim: true },
      refundAmount: { type: Number, default: 0 },
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
    },
    hasReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Review',
    },
  },
  { timestamps: true }
);

// Compound indexes for high performance querying & reporting
BookingSchema.index({ hotelAccountId: 1, checkIn: 1, status: 1 });
BookingSchema.index({ hotelAccountId: 1, createdAt: -1 });
BookingSchema.index({ propertyId: 1, checkIn: 1 });
BookingSchema.index({ 'guest.guestUserId': 1, createdAt: -1 });

export const Booking = model<IBooking>('Booking', BookingSchema);
