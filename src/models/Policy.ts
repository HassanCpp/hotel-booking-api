import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomRule {
  title: string;
  content: string;
}

export interface IPolicy extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  hotelAccountId: Types.ObjectId;
  cancellationPolicy: string;
  cancellationDeadlineHours: number;
  petPolicy: {
    allowed: boolean;
    fee: number;
    notes?: string;
  };
  smokingPolicy: {
    allowed: boolean;
    notes?: string;
  };
  childPolicy?: string;
  customRules: ICustomRule[];
  createdAt: Date;
  updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      unique: true,
      index: true,
    },
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      required: true,
      index: true,
    },
    cancellationPolicy: {
      type: String,
      required: true,
      default: 'Free cancellation up to 48 hours before check-in. Late cancellations incur a 1-night fee.',
      trim: true,
    },
    cancellationDeadlineHours: {
      type: Number,
      default: 48,
      min: 0,
    },
    petPolicy: {
      allowed: { type: Boolean, default: false },
      fee: { type: Number, default: 0, min: 0 },
      notes: { type: String, trim: true },
    },
    smokingPolicy: {
      allowed: { type: Boolean, default: false },
      notes: { type: String, trim: true },
    },
    childPolicy: {
      type: String,
      default: 'Children of all ages are welcome. Children under 6 stay free when sharing existing bedding.',
      trim: true,
    },
    customRules: [
      {
        title: { type: String, required: true, trim: true },
        content: { type: String, required: true, trim: true },
      },
    ],
  },
  { timestamps: true }
);

export const Policy = model<IPolicy>('Policy', PolicySchema);
