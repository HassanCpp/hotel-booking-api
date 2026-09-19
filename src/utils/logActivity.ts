import { Types } from 'mongoose';
import { ActivityLog } from '../models/ActivityLog';

interface LogActivityParams {
  tenantId?: Types.ObjectId | string;
  actorId: Types.ObjectId | string;
  actorRole: 'SUPER_ADMIN' | 'HOTEL_ADMIN';
  action: string;
  targetType: string;
  targetId: Types.ObjectId | string;
  metadata?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await ActivityLog.create(params);
  } catch (err) {
    console.error('[ActivityLog] Failed to write activity log:', err);
    // Don't throw — activity logging should never break the main flow
  }
}
