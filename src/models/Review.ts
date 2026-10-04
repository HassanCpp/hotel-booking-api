import { Schema, model, Document, Types } from 'mongoose';

export interface IReviewCategoryRatings {
  cleanliness: number; // 1 to 5
  accuracy: number; // 1 to 5
  checkIn: number; // 1 to 5
  communication: number; // 1 to 5
  location: number; // 1 to 5
  value: number; // 1 to 5
}

export interface IReviewHotelReply {
  comment: string;
  repliedAt: Date;
  repliedByUserId: Types.ObjectId;
  repliedByName: string;
}

export interface IReview extends Document {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  roomTypeId: Types.ObjectId;
  guestUserId?: Types.ObjectId;

  guestName: string;
  guestCountry?: string;
  guestAvatar?: string;

  stayDate: Date;
  roomTypeName: string;

  overallRating: number;
  categories: IReviewCategoryRatings;

  title?: string;
  comment: string;
  photos: string[];

  hotelReply?: IReviewHotelReply;
  status: 'PUBLISHED' | 'HIDDEN' | 'FLAGGED';

  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true, // Strictly 1 review per booking
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
    guestUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    guestName: {
      type: String,
      required: true,
      trim: true,
    },
    guestCountry: {
      type: String,
      trim: true,
    },
    guestAvatar: {
      type: String,
      trim: true,
    },
    stayDate: {
      type: Date,
      required: true,
    },
    roomTypeName: {
      type: String,
      required: true,
      trim: true,
    },
    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true,
    },
    categories: {
      cleanliness: { type: Number, required: true, min: 1, max: 5 },
      accuracy: { type: Number, required: true, min: 1, max: 5 },
      checkIn: { type: Number, required: true, min: 1, max: 5 },
      communication: { type: Number, required: true, min: 1, max: 5 },
      location: { type: Number, required: true, min: 1, max: 5 },
      value: { type: Number, required: true, min: 1, max: 5 },
    },
    title: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    photos: [{ type: String, trim: true }],
    hotelReply: {
      comment: { type: String, trim: true },
      repliedAt: { type: Date },
      repliedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      repliedByName: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ['PUBLISHED', 'HIDDEN', 'FLAGGED'],
      default: 'PUBLISHED',
      index: true,
    },
  },
  { timestamps: true }
);

ReviewSchema.index({ propertyId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ hotelAccountId: 1, createdAt: -1 });

export const Review = model<IReview>('Review', ReviewSchema);
