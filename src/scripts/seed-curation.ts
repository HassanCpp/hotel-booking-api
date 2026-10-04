import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeaturedDestination } from '../models/FeaturedDestination';
import { Property } from '../models/Property';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_hotel_agent';

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

async function seedCuration() {
  console.log('🌱 Connecting to MongoDB for initial curation seed...');
  await mongoose.connect(MONGO_URI);

  const existingCount = await FeaturedDestination.countDocuments();
  if (existingCount === 0) {
    await FeaturedDestination.insertMany(INITIAL_DESTINATIONS);
    console.log(`✅ Seeded ${INITIAL_DESTINATIONS.length} curated destinations.`);
  } else {
    console.log(`ℹ️ Featured destinations already exist (${existingCount} found).`);
  }

  // Feature the first published property for the home page spotlight
  const firstProperty = await Property.findOne({ status: 'PUBLISHED' });
  if (firstProperty) {
    firstProperty.isFeaturedOnHome = true;
    firstProperty.featuredPriority = 1;
    await firstProperty.save();
    console.log(`✅ Featured property "${firstProperty.name}" on homepage.`);
  }

  await mongoose.disconnect();
  console.log('✅ Seeding complete.');
}

seedCuration().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
