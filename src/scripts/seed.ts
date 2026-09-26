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

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_hotel_agent';

async function seed() {
  console.log('🌱 Connecting to MongoDB for seeding...');
  await mongoose.connect(MONGO_URI);

  console.log('🧹 Cleaning existing test records...');
  await Promise.all([
    User.deleteMany({}),
    HotelAccount.deleteMany({}),
    HotelMembership.deleteMany({}),
    Property.deleteMany({}),
    Policy.deleteMany({}),
    RoomType.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);

  const salt = await bcrypt.genSalt(12);

  // 1. Create Super Admin
  const superAdminPasswordHash = await bcrypt.hash('Admin123!', salt);
  const superAdmin = await User.create({
    email: 'superadmin@hotelagent.com',
    passwordHash: superAdminPasswordHash,
    fullName: 'Platform Super Admin',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  });
  console.log('✅ Super Admin created: superadmin@hotelagent.com / Admin123!');

  // 2. Create Hotel A ("The Grand Heritage Lahore")
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

  const propertyA = await Property.create({
    hotelAccountId: hotelA._id,
    name: 'The Grand Heritage Mall Road',
    slug: 'grand-heritage-mall-road',
    description: 'A 5-star boutique heritage hotel in the cultural heart of Lahore, featuring Mughal-inspired courtyards, signature dining, and white-glove concierge services.',
    propertyType: 'BOUTIQUE',
    address: {
      street: '23 Mall Road',
      city: 'Lahore',
      state: 'Punjab',
      country: 'Pakistan',
      postalCode: '54000',
      coordinates: { lat: 31.5546, lng: 74.3572 },
    },
    contactEmail: 'concierge@heritagehotel.com',
    contactPhone: '+92 42 35789000',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'High-Speed Wi-Fi',
      'Outdoor Swimming Pool',
      '24/7 Concierge',
      'Valet Parking',
      'Spa & Wellness Sanctuary',
      'Fine Dining Restaurant',
    ],
    status: 'PUBLISHED',
  });

  await Policy.create({
    propertyId: propertyA._id,
    hotelAccountId: hotelA._id,
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in. Late cancellations incur a 1-night fee.',
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
    childPolicy: 'Children of all ages are welcome. Children under 6 stay free of charge using existing bedding.',
    customRules: [
      { title: 'Dress Code', content: 'Smart casual attire is requested in evening dining venues.' },
    ],
  });

  await RoomType.create([
    {
      propertyId: propertyA._id,
      hotelAccountId: hotelA._id,
      name: 'Heritage Executive Suite',
      code: 'HES-01',
      category: 'SUITE',
      viewType: 'GARDEN_VIEW',
      outdoorSpace: 'BALCONY',
      description: 'Expansive 55m² master suite with private courtyard veranda, hand-carved furnishings, and marble bath.',
      maxOccupancy: { adults: 2, children: 1 },
      bedConfig: '1 King Bed',
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
      totalUnits: 8,
      basePricePerNight: 45000,
      pricing: {
        basePricePerNight: 45000,
        extraAdultRate: 5000,
        extraChildRate: 2500,
      },
      mealPlan: 'BREAKFAST_INCLUDED',
      isSmokingAllowed: false,
      isAccessible: true,
      amenities: ['High-Speed Wi-Fi', 'Balcony', 'Espresso Machine', 'Marble Bath', 'Smart TV', 'Mini Bar'],
      images: [
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      ],
      isActive: true,
    },
    {
      propertyId: propertyA._id,
      hotelAccountId: hotelA._id,
      name: 'Deluxe Heritage King',
      code: 'DHK-02',
      category: 'DELUXE',
      viewType: 'CITY_VIEW',
      outdoorSpace: 'NONE',
      description: 'Sophisticated 38m² sanctuary with bespoke linen, artisan brass lighting, and rainfall shower.',
      maxOccupancy: { adults: 2, children: 0 },
      bedConfig: '1 King Bed',
      bedding: {
        primaryBed: 'King',
        bedCount: 1,
        allowsRollaway: false,
        rollawayFee: 0,
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
      totalUnits: 16,
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
    },
  ]);

  console.log('✅ Hotel A created: "The Grand Heritage Lahore" (Admin: admin@heritagehotel.com / Heritage123!)');

  // 3. Create Hotel B ("Serene Oasis Resort")
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
    description: 'An idyllic coastal retreat overlooking the Arabian Sea, offering secluded beachfront villas, Thalasso spa therapies, and private cabanas.',
    propertyType: 'RESORT',
    address: {
      street: 'Seaview Avenue, Phase 8 DHA',
      city: 'Karachi',
      state: 'Sindh',
      country: 'Pakistan',
      postalCode: '75500',
      coordinates: { lat: 24.7938, lng: 67.0658 },
    },
    contactEmail: 'stay@sereneresort.com',
    contactPhone: '+92 21 34567890',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    coverImage: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Beach Access',
      'Infinity Pool',
      'Thalasso Spa',
      'Butler Service',
      'Beachfront Dining',
    ],
    status: 'PUBLISHED',
  });

  await Policy.create({
    propertyId: propertyB._id,
    hotelAccountId: hotelB._id,
    cancellationPolicy: 'Moderate policy: 100% refund up to 72 hours prior to arrival.',
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

  await RoomType.create({
    propertyId: propertyB._id,
    hotelAccountId: hotelB._id,
    name: 'Oceanfront Beach Villa',
    code: 'OBV-01',
    category: 'VILLA',
    viewType: 'SEA_VIEW',
    outdoorSpace: 'TERRACE',
    description: 'Luxury 65m² beachfront villa steps away from the sand, featuring panoramic ocean vistas, private sundeck, and outdoor rain shower.',
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

  console.log('✅ Hotel B created: "Serene Oasis Resort" (Admin: admin@sereneresort.com / Oasis123!)');

  console.log('\n🎉 Database seeding completed successfully with luxury properties, policies & room catalogs!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
