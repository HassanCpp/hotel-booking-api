import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app';
import { Property } from '../models/Property';
import { RoomType } from '../models/RoomType';
import { HotelAccount } from '../models/HotelAccount';
import { Booking } from '../models/Booking';
import { Availability } from '../models/Availability';
import { Review } from '../models/Review';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_hotel_agent';

let server: any;
let baseUrl: string;

async function request(path: string, options: RequestInit = {}): Promise<{ status: number; data: any }> {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting Marketplace & Reviews Backend Test Suite...\n');
  await mongoose.connect(MONGO_URI);

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/v1`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Marketplace Discovery API
    console.log('--- 1. Testing Marketplace Discovery ---');
    const searchRes = await request('/marketplace/properties');
    assert(searchRes.status === 200, 'GET /marketplace/properties returns 200');
    assert(searchRes.data?.data?.properties?.length > 0, 'Returns published properties');
    const firstProp = searchRes.data?.data?.properties[0];
    assert(typeof firstProp?.startingPrice === 'number', 'Property has computed startingPrice');
    assert(typeof firstProp?.averageRating === 'number', 'Property has averageRating');

    // 2. Property Detail by Slug
    console.log('\n--- 2. Testing Property Detail by Slug ---');
    const detailRes = await request('/marketplace/properties/grand-heritage-mall-road');
    assert(detailRes.status === 200, 'GET /marketplace/properties/:slug returns 200');
    assert(detailRes.data?.data?.property?.name === 'The Grand Heritage Mall Road', 'Correct property returned');
    assert(Boolean(detailRes.data?.data?.property?.address?.coordinates?.lat), 'Property has Google Maps coordinates');
    assert(Boolean(detailRes.data?.data?.policies), 'Property has attached Policies');

    // 3. Available Rooms with Pricing
    console.log('\n--- 3. Testing Available Rooms & Rate Engine ---');
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
    const roomsRes = await request(
      `/marketplace/properties/grand-heritage-mall-road/rooms?checkIn=${today}&checkOut=${tomorrow}&adults=2`
    );
    assert(roomsRes.status === 200, 'GET /marketplace/properties/:slug/rooms returns 200');
    assert(roomsRes.data?.data?.rooms?.length > 0, 'Returns room types');
    const firstRoom = roomsRes.data?.data?.rooms[0];
    assert(Boolean(firstRoom?.availability?.isAvailable), 'Room availability calculated');
    assert(firstRoom?.pricing?.totalAmount > 0, 'Rate engine calculated stay total');

    // 4. Rate Check Endpoint
    console.log('\n--- 4. Testing Check Rates & Promo Code Validation ---');
    const checkRateRes = await request('/marketplace/properties/grand-heritage-mall-road/check-rates', {
      method: 'POST',
      body: JSON.stringify({
        roomTypeId: firstRoom._id,
        checkIn: today,
        checkOut: tomorrow,
        rooms: 1,
        promoCode: 'WELCOME15',
      }),
    });
    assert(checkRateRes.status === 200, 'POST /properties/:slug/check-rates returns 200');
    assert(checkRateRes.data?.data?.pricing?.discount > 0, 'Promo discount correctly applied');
    assert(checkRateRes.data?.data?.pricing?.taxes > 0, 'Taxes computed (16% GST)');

    // 5. Booking Creation Flow
    console.log('\n--- 5. Testing Guest Booking Creation (Idempotent & Atomic) ---');
    const idempotencyKey = `test-key-${Date.now()}`;
    const bookingRes = await request('/marketplace/bookings', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        propertyId: firstProp._id,
        roomTypeId: firstRoom._id,
        checkIn: today,
        checkOut: tomorrow,
        rooms: 1,
        adults: 2,
        children: 0,
        guest: {
          fullName: 'Test Traveler',
          email: 'traveler@test.com',
          phone: '+92 300 9988776',
          nationality: 'Pakistani',
        },
        paymentMethod: 'CASH',
        specialRequests: 'Ground floor room',
      }),
    });
    assert(bookingRes.status === 201, 'POST /marketplace/bookings returns 201 Created');
    assert(Boolean(bookingRes.data?.data?.booking?.bookingReference), 'Human-readable booking reference generated');
    assert(bookingRes.data?.data?.booking?.status === 'PENDING', 'Online booking status is PENDING awaiting admin approval');

    // Idempotent retry test
    const retryRes = await request('/marketplace/bookings', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        propertyId: firstProp._id,
        roomTypeId: firstRoom._id,
        checkIn: today,
        checkOut: tomorrow,
        rooms: 1,
        adults: 2,
        guest: { fullName: 'Test Traveler', email: 'traveler@test.com', phone: '+92 300 9988776' },
      }),
    });
    assert(retryRes.status === 200, 'Idempotent retry returns 200 OK');
    assert(
      retryRes.data?.data?.booking?._id === bookingRes.data?.data?.booking?._id,
      'Same booking returned without creating duplicate'
    );

    // 6. Reviews & Ratings API
    console.log('\n--- 6. Testing Public Reviews & 6-Category Breakdown ---');
    const reviewsRes = await request('/marketplace/properties/grand-heritage-mall-road/reviews');
    assert(reviewsRes.status === 200, 'GET /properties/:slug/reviews returns 200');
    assert(Boolean(reviewsRes.data?.data?.summary?.averageRating), 'Summary includes average rating');
    assert(
      typeof reviewsRes.data?.data?.summary?.categoryRatings?.cleanliness === 'number',
      'Summary includes 6 category breakdown'
    );
    assert(reviewsRes.data?.data?.reviews?.length > 0, 'Returns verified guest reviews');
    assert(Boolean(reviewsRes.data?.data?.reviews[0]?.hotelReply?.comment), 'Review includes hotel management response');

    // 7. Hotel Admin Portal Operations
    console.log('\n--- 7. Testing Hotel Admin Portal Endpoints ---');
    // Login as hotel admin
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@heritagehotel.com',
        password: 'Heritage123!',
      }),
    });
    assert(loginRes.status === 200, 'Hotel admin login returns 200');
    const token = loginRes.data?.data?.accessToken;

    // Today's Ops snapshot
    const todayOpsRes = await request('/portal/bookings/today', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(todayOpsRes.status === 200, 'GET /portal/bookings/today returns 200');
    assert(typeof todayOpsRes.data?.data?.occupancyRate === 'number', 'Returns today occupancy rate');
    assert(todayOpsRes.data?.data?.arrivalsCount >= 0, 'Returns arrivals count');

    // Availability Tape Chart
    const tapeChartRes = await request(`/portal/availability/${firstProp._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(tapeChartRes.status === 200, 'GET /portal/availability/:propertyId returns 200');
    assert(tapeChartRes.data?.data?.matrix?.length > 0, 'Returns room inventory matrix');

    // Front Desk Manual Booking
    const manualBookingRes = await request('/portal/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        propertyId: firstProp._id,
        roomTypeId: firstRoom._id,
        checkIn: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
        checkOut: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        rooms: 1,
        adults: 1,
        guest: {
          fullName: 'Walk-in VIP Guest',
          phone: '+92 345 1122334',
        },
        source: 'WALK_IN',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        rateOverridePerNight: 25000,
        internalNotes: 'VIP guest referred by director',
      }),
    });
    assert(manualBookingRes.status === 201, 'POST /portal/bookings (manual) returns 201 Created');
    assert(manualBookingRes.data?.data?.booking?.source === 'WALK_IN', 'Booking source tagged WALK_IN');

    // Check In / Check Out lifecycle
    const testBookingId = manualBookingRes.data?.data?.booking?._id;
    const checkInRes = await request(`/portal/bookings/${testBookingId}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(checkInRes.status === 200, 'POST /portal/bookings/:id/check-in succeeds');
    assert(checkInRes.data?.data?.booking?.status === 'CHECKED_IN', 'Status is CHECKED_IN');

    // Google Auth endpoint test
    console.log('\n--- 8. Testing Google Sign-in for Guests ---');
    const googleAuthRes = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        email: 'google.guest@example.com',
        name: 'Google Traveler',
        googleId: 'goog-12345678',
        avatar: 'https://lh3.googleusercontent.com/a/default-user',
      }),
    });
    assert(googleAuthRes.status === 200, 'POST /auth/google returns 200');
    assert(Boolean(googleAuthRes.data?.data?.accessToken), 'Google auth issues JWT access token');
    assert(googleAuthRes.data?.data?.user?.role === 'GUEST', 'Google user role is GUEST');

    // Admin Confirmation Gate Test (approving the pending online booking)
    console.log('\n--- 9. Testing Hotel Admin Approval Gate ---');
    const pendingBookingId = bookingRes.data?.data?.booking?._id;
    const confirmApprovalRes = await request(`/portal/bookings/${pendingBookingId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(confirmApprovalRes.status === 200, 'POST /portal/bookings/:id/confirm succeeds');
    assert(confirmApprovalRes.data?.data?.booking?.status === 'CONFIRMED', 'Status transitioned from PENDING to CONFIRMED');

    console.log(`\n================================`);
    console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`================================`);
  } finally {
    try {
      await Booking.deleteMany({ bookingReference: /^BK-GRAN-2610-/ });
      await Availability.updateMany({}, { $set: { bookedUnits: 0, blockedUnits: 0, isClosed: false } });
    } catch (e) {
      // Ignore cleanup error
    }
    if (server) server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test runner encountered error:', err);
  process.exit(1);
});
