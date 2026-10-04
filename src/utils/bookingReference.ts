import { Booking } from '../models/Booking';

/**
 * Generates human-friendly, unique booking reference:
 * e.g., "BK-MILL-2510-0042"
 * Format: BK-{4 chars of slug}-{YYMM}-{4 digit sequential sequence}
 */
export async function generateBookingReference(hotelSlug: string): Promise<string> {
  const cleanSlug = hotelSlug
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dateCode = `${yy}${mm}`;

  const prefix = `BK-${cleanSlug}-${dateCode}-`;

  // Count existing bookings with this prefix to get sequential sequence
  const count = await Booking.countDocuments({
    bookingReference: new RegExp(`^${prefix}`),
  });

  const seq = String(count + 1).padStart(4, '0');
  let ref = `${prefix}${seq}`;

  // Collision safety check
  let attempts = 0;
  while (await Booking.findOne({ bookingReference: ref })) {
    attempts++;
    ref = `${prefix}${String(count + 1 + attempts).padStart(4, '0')}`;
  }

  return ref;
}
