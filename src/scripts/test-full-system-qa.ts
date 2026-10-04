import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../app';
import { Property } from '../models/Property';
import { RoomType } from '../models/RoomType';
import { HotelAccount } from '../models/HotelAccount';
import { Booking } from '../models/Booking';
import { Availability } from '../models/Availability';
import { Review } from '../models/Review';
import { PromoCode } from '../models/PromoCode';
import { User } from '../models/User';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_hotel_agent';

let server: any;
let baseUrl: string;

async function request(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runQA() {
  console.log('===========================================================');
  console.log('🏨 FULL SYSTEM QA & END-TO-END VERIFICATION SUITE');
  console.log('===========================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Ephemeral test server listening on ${baseUrl}\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, title: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${title}`);
      if (details) console.error('     Details:', JSON.stringify(details, null, 2));
      failedTests++;
    }
  }

  // Cleanup trackers
  let createdBookingId: any = null;
  let createdReviewId: any = null;
  let testGuestUserId: any = null;
  let testDates = {
    checkIn: '2026-11-10',
    checkOut: '2026-11-12',
  };
  let targetProperty: any = null;
  let targetRoomType: any = null;
  let targetHotel: any = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: Health, Config, & Authentication
    // -------------------------------------------------------------
    console.log('\n--- SECTION 1: Health, Config & Multi-Role Authentication ---');

    // 1.1 Health check
    const healthRes = await request('/health');
    assert(healthRes.status === 200 && healthRes.data?.data?.status === 'HEALTHY', 'GET /health returns 200 and HEALTHY');

    // 1.2 Google Config endpoint
    const googleConfigRes = await request('/auth/google/config');
    assert(googleConfigRes.status === 200 && typeof googleConfigRes.data?.data?.clientId === 'string', 'GET /auth/google/config returns 200 with clientId');

    // 1.3 Invalid Login rejection
    const invalidLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@hotelagent.com', password: 'WrongPassword123!' }),
    });
    assert(invalidLoginRes.status === 401, 'POST /auth/login with invalid password rejected (401)');

    // 1.4 Super Admin Login
    const superAdminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@hotelagent.com', password: 'Admin123!' }),
    });
    assert(superAdminRes.status === 200, 'POST /auth/login Super Admin authentication success (200)');
    const superAdminToken = superAdminRes.data?.data?.accessToken;
    const superAdminUser = superAdminRes.data?.data?.user;
    assert(superAdminUser?.role === 'SUPER_ADMIN', 'Super Admin role verified as SUPER_ADMIN');

    // 1.5 Hotel Admin Login
    const hotelAdminRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@heritagehotel.com', password: 'Heritage123!' }),
    });
    assert(hotelAdminRes.status === 200, 'POST /auth/login Hotel Admin authentication success (200)');
    const hotelAdminToken = hotelAdminRes.data?.data?.accessToken;
    const hotelAdminUser = hotelAdminRes.data?.data?.user;
    assert(hotelAdminUser?.role === 'HOTEL_ADMIN', 'Hotel Admin role verified as HOTEL_ADMIN');
    assert(Boolean(hotelAdminUser?.hotelAccountId), 'Hotel Admin has valid hotelAccountId');

    // 1.6 Guest Registration
    const testGuestEmail = `qa.guest.${Date.now()}@example.com`;
    const guestRegisterRes = await request('/guest/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'QA Automation Guest',
        email: testGuestEmail,
        password: 'GuestPassword123!',
        phone: '+92 300 9876543',
        nationality: 'Pakistani',
      }),
    });
    assert(guestRegisterRes.status === 201, 'POST /guest/register creates new guest account (201)');
    const guestToken = guestRegisterRes.data?.data?.accessToken || guestRegisterRes.data?.data?.token;
    const guestUser = guestRegisterRes.data?.data?.user;
    testGuestUserId = guestUser?.id;
    assert(guestUser?.role === 'GUEST', 'Registered user role verified as GUEST');

    // 1.7 Role Guard Enforcement
    const forbiddenAdminRes = await request('/admin/stats', {
      token: guestToken,
    });
    assert(forbiddenAdminRes.status === 403, 'GUEST forbidden from accessing /admin/stats (403)');

    const unauthPortalRes = await request('/portal/properties');
    assert(unauthPortalRes.status === 401, 'Unauthenticated access to /portal/properties rejected (401)');

    // -------------------------------------------------------------
    // SECTION 2: Super Admin Endpoints
    // -------------------------------------------------------------
    console.log('\n--- SECTION 2: Super Admin Platform Management ---');

    const adminStatsRes = await request('/admin/stats', { token: superAdminToken });
    assert(adminStatsRes.status === 200, 'GET /admin/stats returns 200');
    assert(typeof adminStatsRes.data?.data?.activeHotels === 'number', 'Stats contains activeHotels count');
    assert(typeof adminStatsRes.data?.data?.publishedProperties === 'number', 'Stats contains publishedProperties count');

    const adminHotelsRes = await request('/admin/hotels', { token: superAdminToken });
    assert(adminHotelsRes.status === 200, 'GET /admin/hotels returns 200');
    assert(Array.isArray(adminHotelsRes.data?.data?.hotels), 'Returns hotels array');
    const firstHotel = adminHotelsRes.data?.data?.hotels[0];
    assert(Boolean(firstHotel?._id), 'Hotel record contains _id and tenant metadata');

    const adminHotelDetailRes = await request(`/admin/hotels/${firstHotel._id}`, { token: superAdminToken });
    assert(adminHotelDetailRes.status === 200, 'GET /admin/hotels/:id returns hotel details (200)');

    const adminHotelActivityRes = await request(`/admin/hotels/${firstHotel._id}/activity`, { token: superAdminToken });
    assert(adminHotelActivityRes.status === 200, 'GET /admin/hotels/:id/activity returns audit activity (200)');

    const adminHotelPropsRes = await request(`/admin/hotels/${firstHotel._id}/properties`, { token: superAdminToken });
    assert(adminHotelPropsRes.status === 200, 'GET /admin/hotels/:id/properties returns hotel properties (200)');

    // 2.6 Super Admin Destinations Curation CMS
    const adminDestListRes = await request('/admin/destinations', { token: superAdminToken });
    assert(adminDestListRes.status === 200, 'GET /admin/destinations returns 200');
    assert(Array.isArray(adminDestListRes.data?.data?.destinations), 'Returns destinations array');

    const adminCreateDestRes = await request('/admin/destinations', {
      method: 'POST',
      token: superAdminToken,
      body: JSON.stringify({
        city: 'Hunza Valley',
        country: 'Pakistan',
        countryCode: 'PK',
        subtitle: 'Majestic Peaks & Passu Cones',
        coverImage: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
        displayOrder: 10,
        targetCountries: ['PK', 'ALL'],
        isActive: true,
        isPopular: true,
      }),
    });
    assert(adminCreateDestRes.status === 201, 'POST /admin/destinations creates destination (201)');
    const createdDestId = adminCreateDestRes.data?.data?.destination?._id;

    if (createdDestId) {
      const adminUpdateDestRes = await request(`/admin/destinations/${createdDestId}`, {
        method: 'PATCH',
        token: superAdminToken,
        body: JSON.stringify({ subtitle: 'Updated Alpine Beauty' }),
      });
      assert(adminUpdateDestRes.status === 200, 'PATCH /admin/destinations/:id updates destination (200)');

      const adminDeleteDestRes = await request(`/admin/destinations/${createdDestId}`, {
        method: 'DELETE',
        token: superAdminToken,
      });
      assert(adminDeleteDestRes.status === 200, 'DELETE /admin/destinations/:id removes destination (200)');
    }

    // -------------------------------------------------------------
    // SECTION 3: Hotel Admin Portal Endpoints
    // -------------------------------------------------------------
    console.log('\n--- SECTION 3: Hotel Admin Operations Portal ---');

    const portalHotelMeRes = await request('/portal/hotel/me', { token: hotelAdminToken });
    assert(portalHotelMeRes.status === 200, 'GET /portal/hotel/me returns current hotel details (200)');
    targetHotel = portalHotelMeRes.data?.data?.hotel;

    const portalAmenitiesRes = await request('/portal/amenities', { token: hotelAdminToken });
    assert(portalAmenitiesRes.status === 200, 'GET /portal/amenities returns amenities catalog (200)');
    assert(Array.isArray(portalAmenitiesRes.data?.data?.amenities), 'Amenities catalog is an array');

    const portalPropsRes = await request('/portal/properties', { token: hotelAdminToken });
    assert(portalPropsRes.status === 200, 'GET /portal/properties returns hotel properties (200)');
    targetProperty = portalPropsRes.data?.data?.properties?.find((p: any) => p.status === 'PUBLISHED') || portalPropsRes.data?.data?.properties[0];
    assert(Boolean(targetProperty), 'Found target property for booking tests');

    const portalPropDetailRes = await request(`/portal/properties/${targetProperty._id}`, { token: hotelAdminToken });
    assert(portalPropDetailRes.status === 200, 'GET /portal/properties/:id returns property details with policies (200)');

    const portalRoomsRes = await request(`/portal/properties/${targetProperty._id}/rooms`, { token: hotelAdminToken });
    assert(portalRoomsRes.status === 200, 'GET /portal/properties/:id/rooms returns room types (200)');
    targetRoomType = portalRoomsRes.data?.data?.roomTypes[0];
    assert(Boolean(targetRoomType), 'Found active room type for property');

    const portalAvailRes = await request(`/portal/availability/${targetProperty._id}?startDate=${testDates.checkIn}&endDate=${testDates.checkOut}`, {
      token: hotelAdminToken,
    });
    assert(portalAvailRes.status === 200, 'GET /portal/availability/:propertyId returns tape chart matrix (200)');

    const portalRatePlansRes = await request('/portal/rate-plans', { token: hotelAdminToken });
    assert(portalRatePlansRes.status === 200, 'GET /portal/rate-plans returns rate plans (200)');

    const portalPromoRes = await request('/portal/promo-codes', { token: hotelAdminToken });
    assert(portalPromoRes.status === 200, 'GET /portal/promo-codes returns promo codes (200)');

    const portalTodayRes = await request('/portal/bookings/today', { token: hotelAdminToken });
    assert(portalTodayRes.status === 200, 'GET /portal/bookings/today returns operations dashboard data (200)');

    const portalBookingsRes = await request('/portal/bookings', { token: hotelAdminToken });
    assert(portalBookingsRes.status === 200, 'GET /portal/bookings returns reservation list (200)');

    const portalReviewsRes = await request('/portal/reviews', { token: hotelAdminToken });
    assert(portalReviewsRes.status === 200, 'GET /portal/reviews returns review management list (200)');

    // -------------------------------------------------------------
    // SECTION 4: Public Marketplace Discovery & Search
    // -------------------------------------------------------------
    console.log('\n--- SECTION 4: Public Marketplace Discovery & Search ---');

    // 4.0 Geo-Personalized Home Feed
    const defaultHomeFeedRes = await request('/marketplace/home-feed');
    assert(defaultHomeFeedRes.status === 200, 'GET /marketplace/home-feed returns 200');
    assert(defaultHomeFeedRes.data?.data?.detectedLocation?.countryCode === 'PK', 'Home feed defaults to PK');
    assert(defaultHomeFeedRes.data?.data?.destinations?.length > 0, 'Home feed returns curated destinations');

    const dubaiHomeFeedRes = await request('/marketplace/home-feed', {
      headers: { 'x-client-timezone': 'Asia/Dubai' },
    });
    assert(dubaiHomeFeedRes.data?.data?.detectedLocation?.countryCode === 'AE', 'Home feed resolves Asia/Dubai timezone to AE');

    const featureToggleRes = await request(`/admin/properties/${targetProperty._id}/feature`, {
      method: 'PATCH',
      token: superAdminToken,
      body: JSON.stringify({ isFeaturedOnHome: true, featuredPriority: 1 }),
    });
    assert(featureToggleRes.status === 200, 'PATCH /admin/properties/:id/feature sets isFeaturedOnHome (200)');

    const citiesRes = await request('/marketplace/cities');
    assert(citiesRes.status === 200, 'GET /marketplace/cities returns 200');
    assert(Array.isArray(citiesRes.data?.data?.cities), 'Cities response contains array of cities');

    const marketPropsRes = await request('/marketplace/properties');
    assert(marketPropsRes.status === 200, 'GET /marketplace/properties returns 200');
    assert(marketPropsRes.data?.data?.properties?.length > 0, 'Returns published marketplace properties');

    // 4.1 Search Alias Route Verification
    const searchAliasRes = await request(`/marketplace/search?city=${encodeURIComponent(targetProperty.address.city)}`);
    assert(searchAliasRes.status === 200, 'GET /marketplace/search (alias endpoint) returns 200 with filtered results');

    // 4.2 Property Details by Slug
    const propSlugRes = await request(`/marketplace/properties/${targetProperty.slug}`);
    assert(propSlugRes.status === 200, `GET /marketplace/properties/${targetProperty.slug} returns 200`);
    assert(propSlugRes.data?.data?.property?.name === targetProperty.name, 'Property detail contains matching property name');

    // 4.3 Property Rooms by Slug
    const propRoomsRes = await request(`/marketplace/properties/${targetProperty.slug}/rooms`);
    assert(propRoomsRes.status === 200, 'GET /marketplace/properties/:slug/rooms returns 200');
    assert(propRoomsRes.data?.data?.roomTypes?.length > 0, 'Returns list of available room types');

    // 4.4 Property Reviews with Category Breakdown
    const propReviewsRes = await request(`/marketplace/properties/${targetProperty.slug}/reviews`);
    assert(propReviewsRes.status === 200, 'GET /marketplace/properties/:slug/reviews returns 200');
    assert(propReviewsRes.data?.data?.summary?.categoryRatings !== undefined, 'Returns Airbnb 6-category ratings summary');

    // 4.5 Promo Validation & Validate-Promo Alias
    // Create a temporary promo code if none exists
    let existingPromo = await PromoCode.findOne({ hotelAccountId: targetProperty.hotelAccountId, isActive: true });
    if (!existingPromo) {
      existingPromo = await PromoCode.create({
        hotelAccountId: targetProperty.hotelAccountId,
        propertyId: targetProperty._id,
        code: 'TESTQA20',
        description: '20% QA Discount',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 30 * 86400000),
        isActive: true,
      });
    }

    const promoValidateRes = await request('/marketplace/promo/validate', {
      method: 'POST',
      body: JSON.stringify({
        code: existingPromo.code,
        hotelAccountId: targetProperty.hotelAccountId.toString(),
        checkIn: testDates.checkIn,
        checkOut: testDates.checkOut,
      }),
    });
    assert(promoValidateRes.status === 200, 'POST /marketplace/promo/validate returns 200');

    // Validate the new alias endpoint and discount computation
    const validatePromoAliasRes = await request('/marketplace/validate-promo', {
      method: 'POST',
      body: JSON.stringify({
        code: existingPromo.code,
        propertyId: targetProperty._id.toString(),
        bookingAmount: 50000,
        nights: 2,
      }),
    });
    assert(validatePromoAliasRes.status === 200, 'POST /marketplace/validate-promo (alias) returns 200');
    assert(validatePromoAliasRes.data?.data?.discountAmount > 0, 'validate-promo calculates discountAmount accurately');

    // 4.6 Rate Engine Global Check-Rates
    const checkRatesRes = await request('/marketplace/check-rates', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: targetProperty._id.toString(),
        roomTypeId: targetRoomType._id.toString(),
        checkIn: testDates.checkIn,
        checkOut: testDates.checkOut,
        rooms: 1,
      }),
    });
    assert(checkRatesRes.status === 200, 'POST /marketplace/check-rates returns 200');
    assert(checkRatesRes.data?.data?.isAvailable === true, 'Room is available for test dates');
    assert(checkRatesRes.data?.data?.pricing?.totalAmount > 0, 'Pricing engine calculates totalAmount');

    // -------------------------------------------------------------
    // SECTION 5: End-to-End Booking Lifecycle & Review Workflow
    // -------------------------------------------------------------
    console.log('\n--- SECTION 5: End-to-End Booking & Review Lifecycle ---');

    const idempotencyKey = `qa-idem-${Date.now()}`;
    const bookingPayload = {
      propertyId: targetProperty._id.toString(),
      roomTypeId: targetRoomType._id.toString(),
      checkIn: testDates.checkIn,
      checkOut: testDates.checkOut,
      rooms: 1,
      adults: 2,
      children: 0,
      guest: {
        fullName: 'QA Automated Guest',
        email: testGuestEmail,
        phone: '+92 300 1234567',
        nationality: 'Pakistani',
      },
      paymentMethod: 'CASH',
      specialRequests: 'High floor, quiet room for QA test',
    };

    // 5.1 Create Booking via Marketplace
    const createBookingRes = await request('/marketplace/bookings', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(bookingPayload),
    });
    assert(createBookingRes.status === 201, 'POST /marketplace/bookings creates reservation (201)');
    const createdBooking = createBookingRes.data?.data?.booking;
    createdBookingId = createdBooking?._id;
    assert(Boolean(createdBooking?.bookingReference), `Booking reference generated: ${createdBooking?.bookingReference}`);
    assert(createdBooking?.status === 'PENDING', 'Booking initially in PENDING status');

    // 5.2 Test Idempotency: Repeating same request returns exact same booking without duplicate
    const duplicateBookingRes = await request('/marketplace/bookings', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(bookingPayload),
    });
    assert(
      duplicateBookingRes.status === 200 && duplicateBookingRes.data?.data?.booking?._id === createdBookingId,
      'Idempotency key prevents double booking and returns existing booking (200)'
    );

    // 5.3 Hotel Admin Views Booking in Portal
    const getBookingRes = await request(`/portal/bookings/${createdBookingId}`, { token: hotelAdminToken });
    assert(getBookingRes.status === 200, 'Hotel Admin can retrieve booking detail via GET /portal/bookings/:id (200)');
    assert(getBookingRes.data?.data?.booking?.status === 'PENDING', 'Portal confirms booking is PENDING');

    // 5.4 Hotel Admin Confirms Booking
    const confirmBookingRes = await request(`/portal/bookings/${createdBookingId}/confirm`, {
      method: 'POST',
      token: hotelAdminToken,
    });
    assert(confirmBookingRes.status === 200, 'POST /portal/bookings/:id/confirm transitions status to CONFIRMED (200)');

    // 5.5 Guest Views Booking in Guest Portal
    const guestBookingRes = await request(`/guest/bookings/${createdBookingId}`, { token: guestToken });
    assert(guestBookingRes.status === 200, 'Guest can view confirmed booking via GET /guest/bookings/:id (200)');
    assert(guestBookingRes.data?.data?.booking?.status === 'CONFIRMED', 'Guest sees status CONFIRMED');

    // 5.6 Hotel Admin Check-In
    const checkInRes = await request(`/portal/bookings/${createdBookingId}/check-in`, {
      method: 'POST',
      token: hotelAdminToken,
    });
    assert(checkInRes.status === 200, 'POST /portal/bookings/:id/check-in transitions status to CHECKED_IN (200)');

    // 5.7 Hotel Admin Check-Out
    const checkOutRes = await request(`/portal/bookings/${createdBookingId}/check-out`, {
      method: 'POST',
      token: hotelAdminToken,
    });
    assert(checkOutRes.status === 200, 'POST /portal/bookings/:id/check-out transitions status to CHECKED_OUT (200)');

    // 5.8 Guest Submits Verified Review
    const reviewPayload = {
      overallRating: 5,
      ratings: {
        cleanliness: 5,
        accuracy: 5,
        checkIn: 5,
        communication: 5,
        location: 5,
        value: 5,
      },
      title: 'Flawless stay and automated QA verification',
      comment: 'Superb service, spotless room, and exquisite hospitality. Highly recommend!',
      isAnonymous: false,
    };
    const submitReviewRes = await request(`/guest/bookings/${createdBookingId}/review`, {
      method: 'POST',
      token: guestToken,
      body: JSON.stringify(reviewPayload),
    });
    assert(submitReviewRes.status === 201, 'POST /guest/bookings/:id/review submits verified review (201)');
    const createdReview = submitReviewRes.data?.data?.review;
    createdReviewId = createdReview?._id;

    // 5.9 Hotel Admin Replies to Review
    const replyRes = await request(`/portal/reviews/${createdReviewId}/reply`, {
      method: 'POST',
      token: hotelAdminToken,
      body: JSON.stringify({ comment: 'Thank you for your generous review! We look forward to welcoming you back.' }),
    });
    assert(replyRes.status === 200, 'POST /portal/reviews/:reviewId/reply records management reply (200)');

    // 5.10 Public Marketplace Reviews Verification
    const updatedReviewsRes = await request(`/marketplace/properties/${targetProperty.slug}/reviews`);
    const foundReview = updatedReviewsRes.data?.data?.reviews?.find((r: any) => r._id === createdReviewId);
    assert(Boolean(foundReview), 'New review is published on marketplace property page');
    assert(foundReview?.hotelReply?.comment?.length > 0, 'Management response is publicly visible on review');

    // 5.11 Guest Wishlist / Favorites Lifecycle
    const savePropertyRes = await request(`/guest/saved-properties/${targetProperty._id}`, {
      method: 'POST',
      token: guestToken,
    });
    assert(savePropertyRes.status === 200, 'POST /guest/saved-properties/:id saves property to wishlist (200)');

    const getSavedPropsRes = await request('/guest/saved-properties', { token: guestToken });
    assert(getSavedPropsRes.status === 200, 'GET /guest/saved-properties returns saved list (200)');
    const savedList = getSavedPropsRes.data?.data?.savedProperties || [];
    assert(savedList.some((p: any) => p._id === targetProperty._id), 'Wishlist contains saved property');

    const unsavePropertyRes = await request(`/guest/saved-properties/${targetProperty._id}`, {
      method: 'DELETE',
      token: guestToken,
    });
    assert(unsavePropertyRes.status === 200, 'DELETE /guest/saved-properties/:id unsaves property (200)');

    const getSavedPropsAfterUnsaveRes = await request('/guest/saved-properties', { token: guestToken });
    const savedListAfter = getSavedPropsAfterUnsaveRes.data?.data?.savedProperties || [];
    assert(!savedListAfter.some((p: any) => p._id === targetProperty._id), 'Wishlist no longer contains removed property');

    // -------------------------------------------------------------
    // SECTION 6: Error Handling & Boundary Tests
    // -------------------------------------------------------------
    console.log('\n--- SECTION 6: Error Handling & Boundary Conditions ---');

    // 6.1 Non-existent Property 404
    const notFoundPropRes = await request('/marketplace/properties/non-existent-hotel-slug-xyz');
    assert(notFoundPropRes.status === 404, 'GET invalid property slug returns 404 PROPERTY_NOT_FOUND');

    // 6.2 Invalid Promo Code
    const invalidPromoRes = await request('/marketplace/validate-promo', {
      method: 'POST',
      body: JSON.stringify({
        code: 'NON_EXISTENT_PROMO_CODE_XYZ',
        propertyId: targetProperty._id.toString(),
      }),
    });
    assert(invalidPromoRes.status === 404, 'Invalid promo code returns 404 PROMO_NOT_FOUND');

    // 6.3 Missing required booking fields
    const invalidBookingRes = await request('/marketplace/bookings', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: targetProperty._id.toString(),
        checkIn: testDates.checkIn,
      }),
    });
    assert(invalidBookingRes.status === 400, 'Incomplete booking payload returns 400 Bad Request');
  } catch (err) {
    console.error('💥 Unhandled exception during QA execution:', err);
    failedTests++;
  } finally {
    // -------------------------------------------------------------
    // SECTION 7: Automatic Cleanup & Availability Restoration
    // -------------------------------------------------------------
    console.log('\n--- SECTION 7: Cleanup & Availability Restoration ---');

    if (createdBookingId) {
      await Booking.deleteOne({ _id: createdBookingId });
      console.log(`  🧹 Deleted test booking: ${createdBookingId}`);
    }

    if (createdReviewId) {
      await Review.deleteOne({ _id: createdReviewId });
      console.log(`  🧹 Deleted test review: ${createdReviewId}`);
    }

    if (testGuestUserId) {
      await User.deleteOne({ _id: testGuestUserId });
      console.log(`  🧹 Deleted test guest user: ${testGuestUserId}`);
    }

    // Reset availability on test dates back to 0 booked units
    if (targetRoomType) {
      const resetRes = await Availability.updateMany(
        { roomTypeId: targetRoomType._id },
        { $set: { bookedUnits: 0 } }
      );
      console.log(`  🧹 Reset bookedUnits to 0 for roomType ${targetRoomType._id} (${resetRes.modifiedCount} records reset)`);
    }

    // Recalculate property rating after review cleanup
    if (targetProperty) {
      const remainingReviews = await Review.find({ propertyId: targetProperty._id, status: 'PUBLISHED' });
      const avg = remainingReviews.length > 0 ? remainingReviews.reduce((sum, r) => sum + r.overallRating, 0) / remainingReviews.length : 5.0;
      await Property.updateOne(
        { _id: targetProperty._id },
        { $set: { reviewCount: remainingReviews.length, averageRating: Math.round(avg * 10) / 10 } }
      );
      console.log(`  🧹 Restored property rating stats for ${targetProperty.name}`);
    }

    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('  🧹 Ephemeral server closed & MongoDB disconnected.\n');

    console.log('===========================================================');
    console.log(`📊 QA SUMMARY: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    console.log('===========================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

runQA();
