import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChunkTier = 'LARGE' | 'MEDIUM' | 'SMALL';

export interface IKnowledgeChunk extends Document {
  documentId: Types.ObjectId;
  hotelAccountId?: Types.ObjectId | null;
  propertyId?: Types.ObjectId | null;
  tier: ChunkTier;
  chunkIndex: number;
  parentId?: Types.ObjectId | null;
  grandParentId?: Types.ObjectId | null;
  title: string;
  text: string;
  tokenCount: number;
  pineconeVectorId?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeDocument',
      required: true,
      index: true,
    },
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
    tier: {
      type: String,
      enum: ['LARGE', 'MEDIUM', 'SMALL'],
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeChunk',
      default: null,
      index: true,
    },
    grandParentId: {
      type: Schema.Types.ObjectId,
      ref: 'KnowledgeChunk',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    pineconeVectorId: {
      type: String,
      default: null,
      index: true,
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

// Text index for Lexical Search (FTS) with title having higher weight
KnowledgeChunkSchema.index(
  { title: 'text', text: 'text' },
  { weights: { title: 3, text: 1 }, name: 'KnowledgeChunkTextIndex' }
);

// Compound indexes for fast tenant-scoped and document-scoped retrieval
KnowledgeChunkSchema.index({ hotelAccountId: 1, propertyId: 1, tier: 1 });
KnowledgeChunkSchema.index({ documentId: 1, tier: 1, chunkIndex: 1 });

export const KnowledgeChunk = mongoose.model<IKnowledgeChunk>(
  'KnowledgeChunk',
  KnowledgeChunkSchema
);
