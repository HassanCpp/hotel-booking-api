import { ClientSession, Types } from 'mongoose';
import { Availability } from '../models/Availability';
import { RoomType } from '../models/RoomType';
import { normalizeDate } from './rateEngine';

export interface DateAvailability {
  date: string;
  totalUnits: number;
  bookedUnits: number;
  blockedUnits: number;
  availableUnits: number;
  isClosed: boolean;
  rateOverride?: number;
}

export interface CheckAvailabilityResult {
  isAvailable: boolean;
  minAvailableUnits: number;
  dates: DateAvailability[];
}

/**
 * Checks room availability for every night in [checkIn, checkOut).
 */
export async function checkAvailability(params: {
  roomTypeId: Types.ObjectId | string;
  propertyId: Types.ObjectId | string;
  checkIn: Date | string;
  checkOut: Date | string;
  requestedRooms?: number;
}): Promise<CheckAvailabilityResult> {
  const roomType = await RoomType.findById(params.roomTypeId).lean();
  if (!roomType || !roomType.isActive) {
    return { isAvailable: false, minAvailableUnits: 0, dates: [] };
  }

  const checkIn = normalizeDate(params.checkIn);
  const checkOut = normalizeDate(params.checkOut);
  const requestedRooms = params.requestedRooms || 1;

  const diffTime = checkOut.getTime() - checkIn.getTime();
  const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  const dateList: Date[] = [];
  for (let i = 0; i < nights; i++) {
    dateList.push(new Date(checkIn.getTime() + i * 24 * 60 * 60 * 1000));
  }

  // Fetch all existing Availability records for these dates
  const existingAvails = await Availability.find({
    roomTypeId: params.roomTypeId,
    date: { $in: dateList },
  }).lean();

  const availMap = new Map<string, any>();
  for (const a of existingAvails) {
    const key = normalizeDate(a.date).toISOString().split('T')[0];
    availMap.set(key, a);
  }

  const resultDates: DateAvailability[] = [];
  let minAvailable = roomType.totalUnits;
  let isAvailable = true;

  for (const d of dateList) {
    const key = d.toISOString().split('T')[0];
    const rec = availMap.get(key);

    const totalUnits = rec ? rec.totalUnits : roomType.totalUnits;
    const bookedUnits = rec ? rec.bookedUnits : 0;
    const blockedUnits = rec ? rec.blockedUnits : 0;
    const isClosed = rec ? rec.isClosed : false;
    const rateOverride = rec ? rec.rateOverride : undefined;

    const availableUnits = Math.max(0, totalUnits - bookedUnits - blockedUnits);

    if (availableUnits < minAvailable) {
      minAvailable = availableUnits;
    }

    if (isClosed || availableUnits < requestedRooms) {
      isAvailable = false;
    }

    resultDates.push({
      date: key,
      totalUnits,
      bookedUnits,
      blockedUnits,
      availableUnits,
      isClosed,
      rateOverride,
    });
  }

  return {
    isAvailable,
    minAvailableUnits: minAvailable,
    dates: resultDates,
  };
}

/**
 * Atomically reserves rooms across all nights in a booking.
 * Throws an error if any night has insufficient availability.
 */
export async function reserveRooms(params: {
  roomTypeId: Types.ObjectId | string;
  propertyId: Types.ObjectId | string;
  hotelAccountId: Types.ObjectId | string;
  checkIn: Date | string;
  checkOut: Date | string;
  rooms: number;
  session?: ClientSession;
}): Promise<void> {
  const roomType = await RoomType.findById(params.roomTypeId).lean();
  if (!roomType) {
    throw new Error('Room type not found');
  }

  const checkIn = normalizeDate(params.checkIn);
  const checkOut = normalizeDate(params.checkOut);
  const rooms = params.rooms || 1;

  const diffTime = checkOut.getTime() - checkIn.getTime();
  const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkIn.getTime() + i * 24 * 60 * 60 * 1000);

    // Find and update or upsert with optimistic check
    const query = {
      roomTypeId: params.roomTypeId,
      date: currentDate,
    };

    // Ensure Availability document exists
    await Availability.findOneAndUpdate(
      query,
      {
        $setOnInsert: {
          propertyId: params.propertyId,
          hotelAccountId: params.hotelAccountId,
          totalUnits: roomType.totalUnits,
          bookedUnits: 0,
          blockedUnits: 0,
          isClosed: false,
        },
      },
      { upsert: true, new: true, session: params.session }
    );

    // Atomically increment booked units where (bookedUnits + blockedUnits + rooms) <= totalUnits AND isClosed == false
    const updateResult = await Availability.findOneAndUpdate(
      {
        roomTypeId: params.roomTypeId,
        date: currentDate,
        isClosed: false,
        $expr: {
          $lte: [
            { $add: ['$bookedUnits', '$blockedUnits', rooms] },
            '$totalUnits',
          ],
        },
      },
      {
        $inc: { bookedUnits: rooms },
      },
      { new: true, session: params.session }
    );

    if (!updateResult) {
      const dateStr = currentDate.toISOString().split('T')[0];
      throw new Error(`Insufficient room availability for date ${dateStr}`);
    }
  }
}

/**
 * Releases rooms when a booking is cancelled or dates are modified.
 */
export async function releaseRooms(params: {
  roomTypeId: Types.ObjectId | string;
  checkIn: Date | string;
  checkOut: Date | string;
  rooms: number;
  session?: ClientSession;
}): Promise<void> {
  const checkIn = normalizeDate(params.checkIn);
  const checkOut = normalizeDate(params.checkOut);
  const rooms = params.rooms || 1;

  const diffTime = checkOut.getTime() - checkIn.getTime();
  const nights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkIn.getTime() + i * 24 * 60 * 60 * 1000);

    await Availability.findOneAndUpdate(
      {
        roomTypeId: params.roomTypeId,
        date: currentDate,
      },
      {
        $inc: { bookedUnits: -rooms },
      },
      { session: params.session }
    );
  }
}
