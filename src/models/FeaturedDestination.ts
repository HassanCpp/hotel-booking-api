import { Schema, model, Document, Types } from 'mongoose';

export interface IFeaturedDestination extends Document {
  _id: Types.ObjectId;
  city: string;
  country: string;
  countryCode: string;
  subtitle: string;
  coverImage: string;
  displayOrder: number;
  targetCountries: string[]; // e.g. ['PK', 'ALL'], ['AE']
  isActive: boolean;
  isPopular: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeaturedDestinationSchema = new Schema<IFeaturedDestination>(
  {
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      required: true,
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    targetCountries: {
      type: [String],
      default: ['ALL'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

FeaturedDestinationSchema.index({ isActive: 1, displayOrder: 1 });
FeaturedDestinationSchema.index({ targetCountries: 1, isActive: 1 });

export const FeaturedDestination = model<IFeaturedDestination>(
  'FeaturedDestination',
  FeaturedDestinationSchema
);
