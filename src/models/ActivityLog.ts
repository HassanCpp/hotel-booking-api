import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId;  // null for platform-level events
  actorId: Types.ObjectId;
  actorRole: 'SUPER_ADMIN' | 'HOTEL_ADMIN';
  action: string;  // e.g. 'HOTEL_CREATED', 'STATUS_CHANGED', 'PASSWORD_RESET', 'PROPERTY_CREATED', 'ROOM_TYPE_CREATED', 'POLICY_UPDATED', 'HOTEL_UPDATED', 'PROPERTY_UPDATED', 'PROPERTY_PUBLISHED', 'PROPERTY_UNPUBLISHED', 'ROOM_TYPE_UPDATED', 'ROOM_TYPE_DELETED', 'EMAIL_CHANGED', 'PASSWORD_CHANGED'
  targetType: string;  // 'HotelAccount', 'User', 'Property', 'RoomType', 'Policy'
  targetId: Types.ObjectId;
  metadata?: Record<string, any>;  // before/after values, extra context
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'HotelAccount' },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ tenantId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', ActivityLogSchema);
