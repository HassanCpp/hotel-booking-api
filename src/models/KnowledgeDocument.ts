import mongoose, { Document, Schema, Types } from 'mongoose';

export type KnowledgeDocumentStatus = 'UPLOADING' | 'PROCESSING' | 'INDEXED' | 'FAILED';

export interface IKnowledgeDocument extends Document {
  hotelAccountId?: Types.ObjectId | null;
  propertyId?: Types.ObjectId | null;
  title: string;
  filename: string;
  fileType: 'txt' | 'pdf';
  fileSize: number;
  status: KnowledgeDocumentStatus;
  errorMessage?: string;
  stats: {
    totalTokens: number;
    largeChunkCount: number;
    mediumChunkCount: number;
    smallChunkCount: number;
    vectorCount: number;
  };
  uploadedBy: {
    userId: Types.ObjectId;
    userRole: string;
    userEmail: string;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>(
  {
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      default: null,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['txt', 'pdf'],
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['UPLOADING', 'PROCESSING', 'INDEXED', 'FAILED'],
      default: 'PROCESSING',
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    stats: {
      totalTokens: { type: Number, default: 0 },
      largeChunkCount: { type: Number, default: 0 },
      mediumChunkCount: { type: Number, default: 0 },
      smallChunkCount: { type: Number, default: 0 },
      vectorCount: { type: Number, default: 0 },
    },
    uploadedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      userRole: { type: String, required: true },
      userEmail: { type: String, required: true },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

KnowledgeDocumentSchema.index({ hotelAccountId: 1, propertyId: 1, status: 1 });
KnowledgeDocumentSchema.index({ createdAt: -1 });

export const KnowledgeDocument = mongoose.model<IKnowledgeDocument>(
  'KnowledgeDocument',
  KnowledgeDocumentSchema
);
