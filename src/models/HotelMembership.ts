import { Schema, model, Document, Types } from 'mongoose';

export type HotelRole = 'HOTEL_ADMIN' | 'HOTEL_STAFF';

export interface IHotelMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  role: HotelRole;
  createdAt: Date;
  updatedAt: Date;
}

const HotelMembershipSchema = new Schema<IHotelMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['HOTEL_ADMIN', 'HOTEL_STAFF'],
      default: 'HOTEL_ADMIN',
    },
  },
  { timestamps: true }
);

// Compound index to ensure a user only has one membership per hotel account
HotelMembershipSchema.index({ userId: 1, hotelAccountId: 1 }, { unique: true });

export const HotelMembership = model<IHotelMembership>('HotelMembership', HotelMembershipSchema);
