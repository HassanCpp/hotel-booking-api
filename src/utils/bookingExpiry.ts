import { Booking } from '../models/Booking';
import { releaseRooms } from './availability';
import { normalizeDate } from './rateEngine';

/**
 * Sweeps and expires abandoned PENDING bookings that are older than 24h
 * or have already reached their check-in date without hotel confirmation.
 * Safely releases held inventory back to the marketplace.
 */
export async function expireAbandonedPendingBookings(): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = normalizeDate(new Date());

    const expiredBookings = await Booking.find({
      status: 'PENDING',
      $or: [
        { createdAt: { $lt: cutoffTime } },
        { checkIn: { $lte: today } },
      ],
    });

    if (!expiredBookings || expiredBookings.length === 0) {
      return 0;
    }

    let releasedCount = 0;
    for (const booking of expiredBookings) {
      try {
        await releaseRooms({
          roomTypeId: booking.roomTypeId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          rooms: booking.rooms,
        });

        booking.status = 'CANCELLED';
        booking.cancellation = {
          cancelledAt: new Date(),
          cancelledBy: 'SYSTEM',
          reason: 'Auto-expired: Reservation was unconfirmed by hotel administration within 24 hours',
          refundAmount: 0,
        };
        await booking.save();
        releasedCount++;
      } catch (err) {
        console.error(`[BookingExpiry] Failed to release expired booking ${booking.bookingReference}:`, err);
      }
    }

    if (releasedCount > 0) {
      console.log(`[BookingExpiry] Auto-expired ${releasedCount} abandoned pending reservation(s).`);
    }

    return releasedCount;
  } catch (err) {
    console.error('[BookingExpiry] Error running abandoned bookings sweep:', err);
    return 0;
  }
}
