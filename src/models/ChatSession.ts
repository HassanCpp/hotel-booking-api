import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IChatSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  route?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'FALLBACK';
  citations?: Array<{
    documentId?: string;
    title: string;
    snippet: string;
    tier?: string;
  }>;
  latencyMs?: number;
  timestamp: Date;
}

export interface IChatSession extends Document {
  sessionId: string;
  guestId?: Types.ObjectId | null;
  guestEmail?: string | null;
  guestName?: string | null;
  propertyId?: Types.ObjectId | null;
  hotelAccountId?: Types.ObjectId | null;
  ipAddress?: string;
  userAgent?: string;
  status: 'ACTIVE' | 'RESOLVED' | 'FLAGGED';
  flagReason?: string;
  messages: IChatSessionMessage[];
  messageCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionMessageSchema = new Schema<IChatSessionMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    route: { type: String, default: 'PROPERTY_INQUIRY' },
    confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'FALLBACK'], default: 'HIGH' },
    citations: [
      {
        documentId: { type: String },
        title: { type: String },
        snippet: { type: String },
        tier: { type: String },
      },
    ],
    latencyMs: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guestId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      default: null,
    },
    guestName: {
      type: String,
      default: null,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    hotelAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'HotelAccount',
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'FLAGGED'],
      default: 'ACTIVE',
      index: true,
    },
    flagReason: {
      type: String,
      default: null,
    },
    messages: [ChatSessionMessageSchema],
    messageCount: {
      type: Number,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ChatSessionSchema.index({ propertyId: 1, lastActivityAt: -1 });
ChatSessionSchema.index({ hotelAccountId: 1, lastActivityAt: -1 });
ChatSessionSchema.index({ 'messages.content': 'text' });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
