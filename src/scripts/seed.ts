import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { HotelAccount } from '../models/HotelAccount';
import { HotelMembership } from '../models/HotelMembership';
import { Property } from '../models/Property';
import { Policy } from '../models/Policy';
import { RoomType } from '../models/RoomType';
import { ActivityLog } from '../models/ActivityLog';
import { Booking } from '../models/Booking';
import { Availability } from '../models/Availability';
import { RatePlan } from '../models/RatePlan';
import { PromoCode } from '../models/PromoCode';
import { Review } from '../models/Review';
import { FeaturedDestination } from '../models/FeaturedDestination';
import { recalculatePropertyRatings } from '../utils/reviewAggregation';
import { normalizeDate } from '../utils/rateEngine';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_hotel_agent';

async function seed() {
  console.log('🌱 Connecting to MongoDB for seeding...');
  await mongoose.connect(MONGO_URI);

  const resetAll = process.env.RESET_ALL === 'true';

  if (resetAll) {
    console.log('🧹 [RESET_ALL=true] Wiping all records from database...');
    await Promise.all([
      User.deleteMany({}),
      HotelAccount.deleteMany({}),
      HotelMembership.deleteMany({}),
      Property.deleteMany({}),
      Policy.deleteMany({}),
      RoomType.deleteMany({}),
      ActivityLog.deleteMany({}),
      Booking.deleteMany({}),
      Availability.deleteMany({}),
      RatePlan.deleteMany({}),
      PromoCode.deleteMany({}),
      Review.deleteMany({}),
      FeaturedDestination.deleteMany({}),
    ]);
  } else {
    console.log('🧹 Cleaning existing demo records (preserving user-created businesses)...');
    const demoUserEmails = [
      'superadmin@hotelagent.com',
      'admin@heritagehotel.com',
      'admin@sereneresort.com',
      'guest@hotelai.com',
      'ayesha@guest.com',
    ];
    const demoHotelSlugs = ['grand-heritage-lahore', 'serene-oasis-resort'];

    const existingDemoHotels = await HotelAccount.find({ slug: { $in: demoHotelSlugs } }).lean();
    const demoHotelIds = existingDemoHotels.map((h) => h._id);

    await Promise.all([
      User.deleteMany({ email: { $in: demoUserEmails } }),
      HotelAccount.deleteMany({ slug: { $in: demoHotelSlugs } }),
      HotelMembership.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      Property.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      Policy.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      RoomType.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      Booking.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      Availability.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      RatePlan.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      PromoCode.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      Review.deleteMany({ hotelAccountId: { $in: demoHotelIds } }),
      FeaturedDestination.deleteMany({}),
    ]);
  }

  const salt = await bcrypt.genSalt(12);

  // 1. Create Super Admin
  const superAdminPasswordHash = await bcrypt.hash('Admin123!', salt);
  await User.create({
    email: 'superadmin@hotelagent.com',
    passwordHash: superAdminPasswordHash,
    fullName: 'Platform Super Admin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });
  console.log('✅ Super Admin created: superadmin@hotelagent.com / Admin123!');

  // 2. Create Demo Guest User
  const guestPasswordHash = await bcrypt.hash('Guest123!', salt);
  const demoGuest = await User.create({
    email: 'guest@hotelai.com',
    passwordHash: guestPasswordHash,
    fullName: 'Hamza Farooq',
    role: 'GUEST',
    status: 'ACTIVE',
    phone: '+92 300 1234567',
    nationality: 'Pakistani',
    savedProperties: [],
    preferences: {
      preferredCurrency: 'PKR',
      smokingPreference: 'NON_SMOKING',
      floorPreference: 'HIGH',
    },
  });
  console.log('✅ Demo Guest created: guest@hotelai.com / Guest123!');

  // 3. Create Hotel A ("The Grand Heritage Lahore")
  const hotelAAdminPasswordHash = await bcrypt.hash('Heritage123!', salt);
  const hotelAAdmin = await User.create({
    email: 'admin@heritagehotel.com',
    passwordHash: hotelAAdminPasswordHash,
    fullName: 'Tariq Malik',
    role: 'HOTEL_ADMIN',
    status: 'ACTIVE',
  });

  const hotelA = await HotelAccount.create({
    name: 'The Grand Heritage Lahore',
    slug: 'grand-heritage-lahore',
    status: 'ACTIVE',
    contactEmail: 'contact@heritagehotel.com',
    contactPhone: '+92 42 35789000',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    primaryAdminUserId: hotelAAdmin._id,
  });

  await HotelMembership.create({
    userId: hotelAAdmin._id,
    hotelAccountId: hotelA._id,
    role: 'HOTEL_ADMIN',
  });

  // 5 high-res photos for Airbnb 5-photo bento box
  const propertyA = await Property.create({
    hotelAccountId: hotelA._id,
    name: 'The Grand Heritage Mall Road',
    slug: 'grand-heritage-mall-road',
    description:
      'A 5-star boutique heritage hotel in the cultural heart of Lahore, featuring Mughal-inspired courtyards, signature dining, luxury swimming pool, and white-glove concierge services.',
    propertyType: 'BOUTIQUE',
    starRating: 5,
    address: {
      street: '23 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      country: 'Pakistan',
      postalCode: '54000',
      coordinates: { lat: 31.5546, lng: 74.3572 },
      googlePlaceId: 'ChIJX9p0K_0BGTkRW6v7vQJt4-0',
      formattedAddress: '23 Mall Road, Garhi Shahu, Lahore, Pakistan',
    },
    contactEmail: 'concierge@heritagehotel.com',
    contactPhone: '+92 42 35789000',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    coverImage:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'High-Speed Wi-Fi',
      'Outdoor Swimming Pool',
      '24/7 Concierge',
      'Valet Parking',
      'Spa & Wellness Sanctuary',
      'Fine Dining Restaurant',
      'Airport Shuttle',
      'Fitness Center',
    ],
    status: 'PUBLISHED',
    isFeaturedOnHome: true,
    featuredPriority: 1,
  });

  // Link Property A to Demo Guest Wishlist for immediate out-of-the-box testing
  demoGuest.savedProperties = [propertyA._id as any];
  await demoGuest.save();

  await Policy.create({
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    cancellationPolicy:
      'Free cancellation up to 48 hours before check-in. Late cancellations incur a 1-night fee.',
    cancellationDeadlineHours: 48,
    petPolicy: {
      allowed: false,
      fee: 0,
      notes: 'Service animals permitted with prior notification.',
    },
    smokingPolicy: {
      allowed: false,
      notes: 'Strictly non-smoking across all indoor guestrooms and dining spaces.',
    },
    childPolicy:
      'Children of all ages are welcome. Children under 6 stay free of charge using existing bedding.',
    customRules: [
      {
        title: 'Check-in Identification',
        content: 'Original CNIC or Passport required upon arrival for all adult guests.',
      },
    ],
  });

  const roomA1 = await RoomType.create({
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    name: 'Executive Mughal Suite',
    code: 'EMS-01',
    category: 'SUITE',
    viewType: 'GARDEN_VIEW',
    outdoorSpace: 'BALCONY',
    description:
      'An expansive 55m² suite inspired by Lahore royal courts, featuring a private jharokha balcony, handcrafted carved wood furnishings, and a freestanding marble bathtub.',
    maxOccupancy: { adults: 2, children: 1 },
    bedConfig: '1 Super King Bed',
    bedding: {
      primaryBed: 'King',
      bedCount: 1,
      allowsRollaway: true,
      rollawayFee: 3500,
      allowsCrib: true,
    },
    bathroom: {
      hasTub: true,
      hasWalkInShower: true,
      hasDoubleVanity: true,
      bathroomCount: 1,
    },
    roomSizeSqm: 55,
    roomSizeSqft: 592,
    totalUnits: 5,
    basePricePerNight: 45000,
    pricing: {
      basePricePerNight: 45000,
      extraAdultRate: 5000,
      extraChildRate: 2500,
    },
    mealPlan: 'BREAKFAST_INCLUDED',
    isSmokingAllowed: false,
    isAccessible: true,
    amenities: [
      'High-Speed Wi-Fi',
      'Balcony',
      'Freestanding Marble Tub',
      'Nespresso Machine',
      'Smart 55" 4K TV',
      'Turn-down Service',
    ],
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    isActive: true,
  });

  const roomA2 = await RoomType.create({
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    name: 'Deluxe Heritage King',
    code: 'DHK-02',
    category: 'DELUXE',
    viewType: 'CITY_VIEW',
    outdoorSpace: 'NONE',
    description:
      'A refined 38m² sanctuary blending colonial grace with modern comforts, featuring oak parquet floors and a luxurious marble rain shower.',
    maxOccupancy: { adults: 2, children: 1 },
    bedConfig: '1 King Bed',
    bedding: {
      primaryBed: 'King',
      bedCount: 1,
      allowsRollaway: true,
      rollawayFee: 3000,
      allowsCrib: true,
    },
    bathroom: {
      hasTub: false,
      hasWalkInShower: true,
      hasDoubleVanity: false,
      bathroomCount: 1,
    },
    roomSizeSqm: 38,
    roomSizeSqft: 409,
    totalUnits: 10,
    basePricePerNight: 28000,
    pricing: {
      basePricePerNight: 28000,
      extraAdultRate: 4000,
      extraChildRate: 2000,
    },
    mealPlan: 'ROOM_ONLY',
    isSmokingAllowed: false,
    isAccessible: true,
    amenities: ['High-Speed Wi-Fi', 'Rain Shower', 'Artisan Work Desk', 'Smart TV', 'In-Room Safe'],
    images: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    isActive: true,
  });

  // Rate Plan for Hotel A
  await RatePlan.create({
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    roomTypeId: roomA1._id,
    name: 'Weekend Getaway 15% Off',
    type: 'WEEKEND',
    adjustmentType: 'PERCENTAGE_DISCOUNT',
    adjustmentValue: 15,
    validFrom: new Date(Date.now() - 7 * 86400000),
    validTo: new Date(Date.now() + 60 * 86400000),
    daysOfWeek: [5, 6], // Fri, Sat
    minNights: 2,
    priority: 20,
    isActive: true,
  });

  // Promo Code for Hotel A
  await PromoCode.create({
    hotelAccountId: hotelA._id,
    code: 'WELCOME15',
    description: '15% discount for first-time direct bookings',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    maxDiscountAmount: 10000,
    minBookingAmount: 20000,
    validFrom: new Date(Date.now() - 7 * 86400000),
    validTo: new Date(Date.now() + 90 * 86400000),
    maxUses: 100,
    currentUses: 3,
    isActive: true,
  });

  // 4. Create Hotel B ("Serene Oasis Resort")
  const hotelBAdminPasswordHash = await bcrypt.hash('Oasis123!', salt);
  const hotelBAdmin = await User.create({
    email: 'admin@sereneresort.com',
    passwordHash: hotelBAdminPasswordHash,
    fullName: 'Sara Khan',
    role: 'HOTEL_ADMIN',
    status: 'ACTIVE',
  });

  const hotelB = await HotelAccount.create({
    name: 'Serene Oasis Resort',
    slug: 'serene-oasis-resort',
    status: 'ACTIVE',
    contactEmail: 'info@sereneresort.com',
    contactPhone: '+92 21 34567890',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    primaryAdminUserId: hotelBAdmin._id,
  });

  await HotelMembership.create({
    userId: hotelBAdmin._id,
    hotelAccountId: hotelB._id,
    role: 'HOTEL_ADMIN',
  });

  const propertyB = await Property.create({
    hotelAccountId: hotelB._id,
    name: 'Serene Oasis Beach & Spa',
    slug: 'serene-oasis-beach-spa',
    description:
      'An idyllic coastal retreat overlooking the Arabian Sea in Karachi, offering secluded beachfront villas, Thalasso spa therapies, infinity pool, and private cabanas.',
    propertyType: 'RESORT',
    starRating: 5,
    address: {
      street: 'Seaview Avenue, Phase 8 DHA',
      city: 'Karachi',
      state: 'Sindh',
      country: 'Pakistan',
      postalCode: '75500',
      coordinates: { lat: 24.7938, lng: 67.0658 },
      googlePlaceId: 'ChIJ57jM4P_3sz4RW_NlZ2z0W6Q',
      formattedAddress: 'Seaview Avenue, Phase 8 DHA, Karachi, Pakistan',
    },
    contactEmail: 'stay@sereneresort.com',
    contactPhone: '+92 21 34567890',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    coverImage:
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Beachfront Access',
      'Infinity Pool',
      'Thalasso Spa',
      'Beachside Seafood Grill',
      'Water Sports Center',
      'Sunset Lounge',
      'High-Speed Wi-Fi',
      'Valet Parking',
    ],
    status: 'PUBLISHED',
    isFeaturedOnHome: true,
    featuredPriority: 2,
  });

  await Policy.create({
    propertyId: propertyB._id,
    hotelAccountId: hotelB._id,
    cancellationPolicy:
      'Full refund if cancelled at least 72 hours prior to arrival. 50% refund between 72h and 24h.',
    cancellationDeadlineHours: 72,
    petPolicy: {
      allowed: true,
      fee: 5000,
      notes: 'Pets under 12kg welcome in ground-floor beach chalets.',
    },
    smokingPolicy: {
      allowed: false,
      notes: 'Smoking permitted only in outdoor designated garden pavilions.',
    },
    childPolicy: 'Family friendly resort with Kids Beach Club activities.',
    customRules: [],
  });

  const roomB1 = await RoomType.create({
    propertyId: propertyB._id,
    hotelAccountId: hotelB._id,
    name: 'Oceanfront Beach Villa',
    code: 'OBV-01',
    category: 'VILLA',
    viewType: 'SEA_VIEW',
    outdoorSpace: 'TERRACE',
    description:
      'Luxury 65m² beachfront villa steps away from the sand, featuring panoramic ocean vistas, private sundeck, and outdoor rain shower.',
    maxOccupancy: { adults: 2, children: 2 },
    bedConfig: '1 King Bed + 1 Daybed',
    bedding: {
      primaryBed: 'King',
      bedCount: 1,
      allowsRollaway: true,
      rollawayFee: 4000,
      allowsCrib: true,
    },
    bathroom: {
      hasTub: true,
      hasWalkInShower: true,
      hasDoubleVanity: true,
      bathroomCount: 2,
    },
    roomSizeSqm: 65,
    roomSizeSqft: 700,
    totalUnits: 6,
    basePricePerNight: 65000,
    pricing: {
      basePricePerNight: 65000,
      extraAdultRate: 6000,
      extraChildRate: 3000,
    },
    mealPlan: 'HALF_BOARD',
    isSmokingAllowed: false,
    isAccessible: true,
    amenities: ['Private Beach Access', 'Terrace', 'Soaking Tub', 'Espresso Machine', 'Butler Service'],
    images: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    ],
    isActive: true,
  });

  // 5. Seed Demo Bookings for Operations & Guest Showcase
  const today = normalizeDate(new Date());
  const pastCheckIn = new Date(today.getTime() - 5 * 86400000);
  const pastCheckOut = new Date(today.getTime() - 2 * 86400000);

  // Completed Booking with a 5-Star Verified Review
  const completedBooking = await Booking.create({
    bookingReference: 'BK-GRAN-2509-0010',
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    roomTypeId: roomA1._id,
    guest: {
      fullName: 'Ayesha Khan',
      email: 'ayesha@guest.com',
      phone: '+92 321 9876543',
      nationality: 'Pakistani',
      guestUserId: demoGuest._id,
    },
    checkIn: pastCheckIn,
    checkOut: pastCheckOut,
    nights: 3,
    rooms: 1,
    adults: 2,
    children: 0,
    pricing: {
      ratePerNight: 45000,
      roomTotal: 135000,
      taxes: 21600,
      taxRate: 0.16,
      addOns: [],
      discount: 0,
      totalAmount: 156600,
      currency: 'PKR',
    },
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    paymentMethod: 'CARD_ON_ARRIVAL',
    source: 'MARKETPLACE',
    hasReview: true,
  });

  // Seed Review for Completed Booking
  const reviewA1 = await Review.create({
    bookingId: completedBooking._id,
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    roomTypeId: roomA1._id,
    guestUserId: demoGuest._id,
    guestName: 'Ayesha Khan',
    guestCountry: 'Pakistan',
    stayDate: pastCheckIn,
    roomTypeName: 'Executive Mughal Suite',
    overallRating: 5.0,
    categories: {
      cleanliness: 5,
      accuracy: 5,
      checkIn: 5,
      communication: 5,
      location: 5,
      value: 4.8,
    },
    title: 'An unforgettable Mughal luxury experience',
    comment:
      'From the moment we arrived at Mall Road, the concierge team made us feel like royalty. The Executive Suite with its carved wooden balcony and marble bath was immaculate. Breakfast in the courtyard is a must!',
    photos: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
    ],
    hotelReply: {
      comment:
        'Thank you so much Ayesha for your wonderful words! It was our pleasure hosting you at The Grand Heritage, and we hope to welcome you back on your next visit to Lahore.',
      repliedAt: new Date(pastCheckOut.getTime() + 86400000),
      repliedByUserId: hotelAAdmin._id,
      repliedByName: 'Tariq Malik, General Manager',
    },
    status: 'PUBLISHED',
  });

  completedBooking.reviewId = reviewA1._id;
  await completedBooking.save();

  // In-House Booking (for Today's Ops demonstration)
  await Booking.create({
    bookingReference: 'BK-GRAN-2510-0024',
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    roomTypeId: roomA2._id,
    guest: {
      fullName: 'Dr. Zeeshan Ali',
      email: 'zeeshan@medical.pk',
      phone: '+92 333 4445566',
      nationality: 'Pakistani',
    },
    checkIn: new Date(today.getTime() - 1 * 86400000),
    checkOut: new Date(today.getTime() + 2 * 86400000),
    nights: 3,
    rooms: 1,
    adults: 1,
    children: 0,
    pricing: {
      ratePerNight: 28000,
      roomTotal: 84000,
      taxes: 13440,
      taxRate: 0.16,
      addOns: [],
      discount: 0,
      totalAmount: 97440,
      currency: 'PKR',
    },
    status: 'CHECKED_IN',
    paymentStatus: 'PAID',
    paymentMethod: 'CASH',
    source: 'WALK_IN',
    specialRequests: 'Quiet room on upper floor',
    hasReview: false,
  });

  // Expected Arrival Today Booking
  await Booking.create({
    bookingReference: 'BK-GRAN-2510-0035',
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    roomTypeId: roomA1._id,
    guest: {
      fullName: 'Fatima Noor',
      email: 'fatima@corporate.com',
      phone: '+92 301 8877665',
      nationality: 'Pakistani',
    },
    checkIn: today,
    checkOut: new Date(today.getTime() + 3 * 86400000),
    nights: 3,
    rooms: 1,
    adults: 2,
    children: 1,
    pricing: {
      ratePerNight: 45000,
      roomTotal: 135000,
      taxes: 21600,
      taxRate: 0.16,
      addOns: [],
      discount: 0,
      totalAmount: 156600,
      currency: 'PKR',
    },
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    paymentMethod: 'CARD_ON_ARRIVAL',
    source: 'MARKETPLACE',
    specialRequests: 'Late arrival around 8pm, need baby crib',
    hasReview: false,
  });

  // Calculate Ratings on Properties
  await recalculatePropertyRatings(propertyA._id);
  await recalculatePropertyRatings(propertyB._id);

  // 11. Seed Featured Destinations for Geo-Targeted Marketplace Discovery
  const INITIAL_DESTINATIONS = [
    {
      city: 'Lahore',
      country: 'Pakistan',
      countryCode: 'PK',
      subtitle: 'Cultural Heritage & MM Alam Dining',
      coverImage: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
      displayOrder: 1,
      targetCountries: ['PK', 'ALL'],
      isActive: true,
      isPopular: true,
    },
    {
      city: 'Islamabad',
      country: 'Pakistan',
      countryCode: 'PK',
      subtitle: 'Margalla Foothills & Diplomatic Enclave',
      coverImage: 'https://images.unsplash.com/photo-1594911772125-07fc7a2d8d9f?auto=format&fit=crop&w=800&q=80',
      displayOrder: 2,
      targetCountries: ['PK', 'ALL'],
      isActive: true,
      isPopular: true,
    },
    {
      city: 'Karachi',
      country: 'Pakistan',
      countryCode: 'PK',
      subtitle: 'Arabian Coast & Financial Epicenter',
      coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
      displayOrder: 3,
      targetCountries: ['PK', 'ALL'],
      isActive: true,
      isPopular: true,
    },
    {
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      subtitle: 'Downtown Skyline & Marina Suites',
      coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
      displayOrder: 4,
      targetCountries: ['AE', 'ALL'],
      isActive: true,
      isPopular: true,
    },
    {
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      subtitle: 'Corniche Waterfront & Cultural Louvre',
      coverImage: 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?auto=format&fit=crop&w=800&q=80',
      displayOrder: 5,
      targetCountries: ['AE', 'ALL'],
      isActive: true,
      isPopular: true,
    },
    {
      city: 'Riyadh',
      country: 'Saudi Arabia',
      countryCode: 'SA',
      subtitle: 'Diriyah Heritage & Kingdom Center',
      coverImage: 'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?auto=format&fit=crop&w=800&q=80',
      displayOrder: 6,
      targetCountries: ['SA', 'ALL'],
      isActive: true,
      isPopular: true,
    },
  ];

  await FeaturedDestination.insertMany(INITIAL_DESTINATIONS);
  console.log(`✅ Seeded ${INITIAL_DESTINATIONS.length} curated destinations for Geo-Targeted Discovery`);

  console.log('\n===============================================================');
  console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('===============================================================');
  console.log('👑 Super Admin Portal:');
  console.log('   Email:    superadmin@hotelagent.com');
  console.log('   Password: Admin123!');
  console.log('   Features: Hotel Onboarding, Audit Logs, Marketplace Curation\n');
  console.log('🏨 Hotel Operations Portal:');
  console.log('   Hotel A:  admin@heritagehotel.com / Heritage123!');
  console.log('   Hotel B:  admin@sereneresort.com / Oasis123!');
  console.log('   Features: Tape Chart Calendar, Rate Plans, Promos, Reviews, Bookings\n');
  console.log('🛍️ Public Marketplace & Guest Experience:');
  console.log('   Guest:    guest@hotelai.com / Guest123!');
  console.log('   Features: Geo-Targeted Home Feed, Search, Wishlist, Booking & Voucher');
  console.log('===============================================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
