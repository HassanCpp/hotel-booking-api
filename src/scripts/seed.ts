import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { HotelAccount } from '../models/HotelAccount';
import { HotelMembership } from '../models/HotelMembership';
import { Property } from '../models/Property';

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

  await Property.create({
    hotelAccountId: hotelA._id,
    name: 'The Grand Heritage Mall Road',
    slug: 'grand-heritage-mall-road',
    description: 'A 5-star boutique heritage hotel in the cultural heart of Lahore.',
    city: 'Lahore',
    country: 'Pakistan',
    status: 'PUBLISHED',
  });
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

  await Property.create({
    hotelAccountId: hotelB._id,
    name: 'Serene Oasis Beach & Spa',
    slug: 'serene-oasis-beach-spa',
    description: 'An idyllic luxury coastal retreat with private chalets.',
    city: 'Karachi',
    country: 'Pakistan',
    status: 'PUBLISHED',
  });
  console.log('✅ Hotel B created: "Serene Oasis Resort" (Admin: admin@sereneresort.com / Oasis123!)');

  console.log('\n🎉 Database seeding completed successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
