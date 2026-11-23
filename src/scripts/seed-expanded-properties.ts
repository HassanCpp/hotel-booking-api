import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { HotelAccount } from '../models/HotelAccount';
import { HotelMembership } from '../models/HotelMembership';
import { Property, PropertyType } from '../models/Property';
import { RoomType, RoomCategory } from '../models/RoomType';
import { Policy } from '../models/Policy';
import { Availability } from '../models/Availability';
import { FeaturedDestination } from '../models/FeaturedDestination';
import { normalizeDate } from '../utils/rateEngine';

interface SeedPropertyDefinition {
  // Hotel Account
  hotelName: string;
  hotelSlug: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  country: string;
  currency: string;
  timezone: string;
  contactPhone: string;

  // Property Details
  propertyName: string;
  propertySlug: string;
  propertyType: PropertyType;
  starRating: number;
  averageRating: number;
  reviewCount: number;
  description: string;
  address: {
    street: string;
    city: string;
    state?: string;
    country: string;
    postalCode?: string;
    coordinates?: { lat: number; lng: number };
    formattedAddress?: string;
  };
  coverImage: string;
  gallery: string[];
  amenities: string[];
  isFeaturedOnHome?: boolean;
  featuredPriority?: number;

  // Policies
  cancellationPolicy: string;
  childPolicy: string;
  customRules?: Array<{ title: string; content: string }>;

  // Rooms
  rooms: Array<{
    name: string;
    code: string;
    category: RoomCategory;
    viewType: 'CITY_VIEW' | 'SEA_VIEW' | 'GARDEN_VIEW' | 'POOL_VIEW' | 'COURTYARD_VIEW' | 'MOUNTAIN_VIEW' | 'INTERNAL';
    outdoorSpace: 'NONE' | 'BALCONY' | 'TERRACE' | 'PATIO' | 'PRIVATE_POOL';
    description: string;
    maxOccupancy: { adults: number; children: number };
    bedConfig: string;
    bedding: {
      primaryBed: string;
      bedCount: number;
      allowsRollaway: boolean;
      rollawayFee: number;
      allowsCrib: boolean;
    };
    bathroom: {
      hasTub: boolean;
      hasWalkInShower: boolean;
      hasDoubleVanity: boolean;
      bathroomCount: number;
    };
    roomSizeSqm: number;
    totalUnits: number;
    basePricePerNight: number;
    mealPlan: 'ROOM_ONLY' | 'BREAKFAST_INCLUDED' | 'HALF_BOARD' | 'ALL_INCLUSIVE';
    amenities: string[];
    images: string[];
  }>;
}

const EXPANDED_PROPERTIES: SeedPropertyDefinition[] = [
  // ==========================================
  // PAKISTAN DESTINATIONS
  // ==========================================
  {
    hotelName: 'Hunza Serai Alpine Hospitality',
    hotelSlug: 'hunza-serai-hospitality',
    adminFullName: 'Karim Ullah Baig',
    adminEmail: 'admin@hunzaserai.com',
    adminPassword: 'Hunza123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 5813 457890',
    propertyName: 'Hunza Serai Mountain Glamping & Lodge',
    propertySlug: 'hunza-serai-mountain-glamping',
    propertyType: 'GLAMPING',
    starRating: 5,
    averageRating: 4.96,
    reviewCount: 42,
    description:
      'Perched on the cliffside of Karimabad with unobstructed vistas of Rakaposhi, Ultar Sar, and Ladyfinger Peak. Features luxury heated geodesic domes, private cedarwood balconies, open fire pits, and organic farm-to-table Karakoram dining.',
    address: {
      street: 'Zero Point Cliff Road',
      city: 'Hunza',
      state: 'Gilgit-Baltistan',
      country: 'Pakistan',
      postalCode: '15700',
      coordinates: { lat: 36.3167, lng: 74.65 },
      formattedAddress: 'Zero Point Cliff Road, Karimabad, Hunza Valley, Gilgit-Baltistan, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Heated Geodesic Domes',
      'Panoramic Mountain View Balconies',
      'Stargazing Telescope Deck',
      'Campfire & Live Acoustic Sessions',
      'Organic Orchard Dining',
      'High-Speed Satellite Wi-Fi',
      'Guided Karakoram Treks',
      'Heated Blankets & Fireplaces',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 2,
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in due to mountain logistics.',
    childPolicy: 'Children under 8 stay free in existing bedding. Heated cribs available upon advance request.',
    customRules: [
      {
        title: 'Alpine Environment',
        content: 'Please observe silence after 10:00 PM for community stargazing sessions.',
      },
    ],
    rooms: [
      {
        name: 'Rakaposhi Vista Geodesic Dome',
        code: 'HS-RVD-01',
        category: 'SUITE',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          'A 45m² luxury heated geodesic dome with a transparent skylight ceiling for stargazing, king plush bed, underfloor heating, and a private timber cantilevered balcony.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
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
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 45,
        totalUnits: 6,
        basePricePerNight: 38000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: [
          'Transparent Stargazing Ceiling',
          'Heated Hardwood Floors',
          'Private Timber Balcony',
          'Espresso Bar',
          'High-Speed Wi-Fi',
        ],
        images: [
          'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        name: "Eagle's Nest Cedarwood Chalet",
        code: 'HS-ENC-02',
        category: 'VILLA',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'TERRACE',
        description:
          'A handcrafted 70m² two-story timber chalet featuring a stone fireplace, private outdoor cedar hot tub, panoramic valley views, and dedicated butler.',
        maxOccupancy: { adults: 4, children: 2 },
        bedConfig: '2 King Beds',
        bedding: {
          primaryBed: 'King',
          bedCount: 2,
          allowsRollaway: true,
          rollawayFee: 5000,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 2,
        },
        roomSizeSqm: 70,
        totalUnits: 4,
        basePricePerNight: 58000,
        mealPlan: 'HALF_BOARD',
        amenities: [
          'Outdoor Cedar Hot Tub',
          'Stone Wood-Burning Fireplace',
          'Wraparound Terrace',
          'Nespresso Bar',
          'Butler Service',
        ],
        images: [
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'The Margalla Ridge Collection',
    hotelSlug: 'the-margalla-ridge-collection',
    adminFullName: 'Shahid Mehmood',
    adminEmail: 'admin@margallaridge.com',
    adminPassword: 'Margalla123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 51 2899000',
    propertyName: 'The Margalla Ridge Boutique & Spa',
    propertySlug: 'margalla-ridge-boutique-spa',
    propertyType: 'BOUTIQUE',
    starRating: 5,
    averageRating: 4.92,
    reviewCount: 38,
    description:
      "Perched high on the Margalla Hills foothills in Sector E-7, offering an infinity edge pool overlooking Islamabad's green avenues, Himalayan pink salt spa, and fine dining French-Pakistani fusion.",
    address: {
      street: 'Hill View Road, Sector E-7',
      city: 'Islamabad',
      state: 'Federal Capital',
      country: 'Pakistan',
      postalCode: '44000',
      coordinates: { lat: 33.7294, lng: 73.0372 },
      formattedAddress: 'Hill View Road, Sector E-7, Islamabad, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Infinity Pool with Skyline View',
      'Himalayan Salt Cave Spa',
      '24/7 Diplomatic Security Concierge',
      'Fine Dining Rooftop Terrace',
      'Tesla & EV Charging Station',
      'Chauffeured Mercedes Airport Transfer',
      'Fitness & Pilates Studio',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 3,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children of all ages welcome. Baby cribs provided complimentary.',
    rooms: [
      {
        name: 'Margalla Foothills Deluxe King',
        code: 'MR-MFD-01',
        category: 'DELUXE',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '42m² of contemporary minimalist luxury with floor-to-ceiling glass looking toward the Margalla forest, Italian rain shower, and acoustic quiet glass.',
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
          hasTub: false,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 42,
        totalUnits: 8,
        basePricePerNight: 34000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Private Forest Balcony', 'Nespresso Coffee', 'Smart 55" TV', 'High-Speed Wi-Fi'],
        images: [
          'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        name: 'Diplomatic Skyline Suite',
        code: 'MR-DSS-02',
        category: 'SUITE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'TERRACE',
        description:
          "65m² presidential suite boasting a private sun terrace with outdoor soaking tub and 180-degree panoramas of Islamabad's skyline and Faisal Mosque.",
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 Super King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 5000,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 65,
        totalUnits: 5,
        basePricePerNight: 58000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: [
          'Private Terrace Soaking Tub',
          'Panoramic Skyline View',
          'Wine Chiller & Bar',
          'Executive Lounge Access',
        ],
        images: [
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Shangrila Pines Estates',
    hotelSlug: 'shangrila-pines-estates',
    adminFullName: 'Farhan Abbasi',
    adminEmail: 'admin@shangrilapines.com',
    adminPassword: 'Pines123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 51 3355000',
    propertyName: 'Shangrila Pines Heritage Villa',
    propertySlug: 'shangrila-pines-heritage-villa',
    propertyType: 'VILLA',
    starRating: 5,
    averageRating: 4.88,
    reviewCount: 29,
    description:
      'A restored 1920s colonial stone and cedarwood manor in the tranquil pine forests of Bhurban near Murree. Roaring fireplaces, manicured English tea lawns, and dedicated resident chefs.',
    address: {
      street: 'Pine Forest Road, Bhurban',
      city: 'Murree',
      state: 'Punjab',
      country: 'Pakistan',
      postalCode: '47150',
      coordinates: { lat: 33.9556, lng: 73.4542 },
      formattedAddress: 'Pine Forest Road, Bhurban, Murree Hills, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Colonial Wood Fireplaces',
      'Private Forest Grounds & Gazebo',
      'Traditional English High Tea',
      'Private Chef & Butler Service',
      'Heated Jacuzzi & Sauna',
      'Billiards & Library Salon',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 4,
    cancellationPolicy: 'Free cancellation up to 5 days prior to check-in.',
    childPolicy: 'Great for families. Board games, outdoor swings, and campfire setup included.',
    rooms: [
      {
        name: 'Colonial Pine Master Suite',
        code: 'SP-CPM-01',
        category: 'SUITE',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '48m² suite with handcrafted walnut furnishings, working stone fireplace, bay window reading nook, and deep soaking tub.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
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
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 48,
        totalUnits: 5,
        basePricePerNight: 42000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Stone Fireplace', 'Forest View Balcony', 'High Tea Service', 'Antique Writing Desk'],
        images: [
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        name: "The Governor's 3-Bedroom Private Villa",
        code: 'SP-GPV-02',
        category: 'VILLA',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'PATIO',
        description:
          'Full private two-story villa with 3 en-suite bedrooms, living hall with grand stone hearth, private kitchen with butler, and private lawn with barbecue pit.',
        maxOccupancy: { adults: 6, children: 3 },
        bedConfig: '3 King Beds',
        bedding: {
          primaryBed: 'King',
          bedCount: 3,
          allowsRollaway: true,
          rollawayFee: 6000,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 3,
        },
        roomSizeSqm: 140,
        totalUnits: 2,
        basePricePerNight: 98000,
        mealPlan: 'HALF_BOARD',
        amenities: [
          'Private 3-Bedroom Villa',
          'Private Butler & Chef',
          'Grand Stone Fireplace',
          'Private Lawn & Firepit',
        ],
        images: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Skardu Celestial Resorts',
    hotelSlug: 'skardu-celestial-resorts',
    adminFullName: 'Ghulam Raza Balti',
    adminEmail: 'admin@skarduresort.com',
    adminPassword: 'Skardu123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 5815 456789',
    propertyName: 'Skardu Celestial Stargazing Resort',
    propertySlug: 'skardu-celestial-stargazing-resort',
    propertyType: 'RESORT',
    starRating: 5,
    averageRating: 4.95,
    reviewCount: 35,
    description:
      'Set along the crystal waters of Lower Kachura Lake with views of snow-dusted Karakoram summits. Offers heated Balti-style timber lodges, astronomy telescopes, and traditional wood-fired gastronomy.',
    address: {
      street: 'Kachura Lake Road',
      city: 'Skardu',
      state: 'Gilgit-Baltistan',
      country: 'Pakistan',
      postalCode: '16100',
      coordinates: { lat: 35.35, lng: 75.45 },
      formattedAddress: 'Kachura Lake Road, Skardu, Gilgit-Baltistan, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Lakefront Private Pier & Boats',
      'Astronomical Observatory & Telescopes',
      'Underfloor Heated Bathrooms',
      'Wood-Fired Trout Barbecue',
      'Heated Alpine Jacuzzi',
      'Airport Shuttle Service',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 5,
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in.',
    childPolicy: 'Children under 6 stay free.',
    rooms: [
      {
        name: 'Alpine Lakefront Chalet',
        code: 'SC-ALC-01',
        category: 'SUITE',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '40m² lakeside chalet built from local deodar cedarwood, private balcony over the water, and heated feather-down bedding.',
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
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 40,
        totalUnits: 6,
        basePricePerNight: 36000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Lake View Balcony', 'Heated Flooring', 'Artisan Coffee Maker', 'Down Bedding'],
        images: [
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        name: 'Stargazer Glass-Ceiling Suite',
        code: 'SC-SGS-02',
        category: 'PENTHOUSE',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'TERRACE',
        description:
          'A futuristic luxury suite featuring a 180° glass dome ceiling over the king bed, in-room astronomical telescope, and private outdoor sauna.',
        maxOccupancy: { adults: 2, children: 0 },
        bedConfig: '1 King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: false,
          rollawayFee: 0,
          allowsCrib: false,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 52,
        totalUnits: 3,
        basePricePerNight: 52000,
        mealPlan: 'HALF_BOARD',
        amenities: [
          'Glass Dome Ceiling',
          'Private Telescope',
          'Outdoor Timber Sauna',
          'Artisan Hot Chocolate & Coffee Bar',
        ],
        images: [
          'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Gwadar Ocean Resorts',
    hotelSlug: 'gwadar-ocean-resorts',
    adminFullName: 'Nadeem Baloch',
    adminEmail: 'admin@gwadarpearl.com',
    adminPassword: 'Gwadar123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 86 4210000',
    propertyName: 'Gwadar Pearl Oceanfront Resort',
    propertySlug: 'gwadar-pearl-oceanfront-resort',
    propertyType: 'RESORT',
    starRating: 5,
    averageRating: 4.86,
    reviewCount: 22,
    description:
      "Balochistan's premier 5-star beachfront destination on Marine Drive. Features private white sand beach on the Arabian Sea, deep-sea angling yacht excursions, infinity swimming pool, and fresh seafood cabanas.",
    address: {
      street: 'Marine Drive, West Bay',
      city: 'Gwadar',
      state: 'Balochistan',
      country: 'Pakistan',
      postalCode: '91200',
      coordinates: { lat: 25.1264, lng: 62.3225 },
      formattedAddress: 'Marine Drive, West Bay, Gwadar, Balochistan, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Sandy Beach Cove',
      'Infinity Pool Facing Arabian Sea',
      'Sunset Catamaran Cruises',
      'Fresh Seafood Grill Pavilion',
      'Helipad & Executive Airport Transport',
      'Water Sports & Jet Skiing',
    ],
    isFeaturedOnHome: false,
    cancellationPolicy: 'Free cancellation up to 48 hours before arrival.',
    childPolicy: 'Children of all ages welcome.',
    rooms: [
      {
        name: 'Arabian Azure Ocean Suite',
        code: 'GP-AOS-01',
        category: 'SUITE',
        viewType: 'SEA_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '50m² oceanfront suite with wraparound glass balcony, king bed facing the sunset, and soaking bathtub overlooking the waves.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
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
          bathroomCount: 1,
        },
        roomSizeSqm: 50,
        totalUnits: 8,
        basePricePerNight: 34000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Oceanfront Balcony', 'Soaking Bathtub', 'Smart TV', 'Beach Bag & Towels'],
        images: [
          'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Gulberg Urban Suites',
    hotelSlug: 'gulberg-urban-suites',
    adminFullName: 'Zainab Siddiqui',
    adminEmail: 'admin@gulbergsuites.com',
    adminPassword: 'Gulberg123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 42 35870000',
    propertyName: 'Gulberg Executive Luxury Apartments',
    propertySlug: 'gulberg-executive-luxury-apartments',
    propertyType: 'APARTMENT',
    starRating: 4,
    averageRating: 4.84,
    reviewCount: 31,
    description:
      'Chic, modern designer serviced residences on MM Alam Road, Gulberg III. Featuring custom Italian kitchens, gym, 24/7 security concierge, and doorstep access to Lahore premier dining and boutiques.',
    address: {
      street: 'Block C2, MM Alam Road, Gulberg III',
      city: 'Lahore',
      state: 'Punjab',
      country: 'Pakistan',
      postalCode: '54660',
      coordinates: { lat: 31.512, lng: 74.348 },
      formattedAddress: 'MM Alam Road, Gulberg III, Lahore, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Fully Equipped Modern Kitchen',
      'High-Speed Fiber Wi-Fi (100 Mbps)',
      '24/7 Concierge & Covered Parking',
      'Washer & Dryer in Unit',
      'Rooftop Residents Gym',
      'Housekeeping on Demand',
    ],
    isFeaturedOnHome: false,
    cancellationPolicy: 'Free cancellation up to 24 hours prior to check-in.',
    childPolicy: 'Children welcome. High chairs and folding cots available.',
    rooms: [
      {
        name: 'Designer 1-Bedroom Serviced Loft',
        code: 'GA-1BR-01',
        category: 'STANDARD',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '55m² urban loft with exposed concrete accents, modular kitchen, smart work desk, 65" OLED TV, and private balcony.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 Queen Bed',
        bedding: {
          primaryBed: 'Queen',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 2500,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: false,
          hasWalkInShower: true,
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 55,
        totalUnits: 10,
        basePricePerNight: 18500,
        mealPlan: 'ROOM_ONLY',
        amenities: ['Full Kitchen', 'Washer/Dryer', 'Work Desk', 'Balcony', 'Fiber Wi-Fi'],
        images: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Peshawar Heritage Collection',
    hotelSlug: 'peshawar-heritage-collection',
    adminFullName: 'Sherzaman Afridi',
    adminEmail: 'admin@peshawarhaveli.com',
    adminPassword: 'Peshawar123!',
    country: 'Pakistan',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    contactPhone: '+92 91 2590000',
    propertyName: 'Qissa Khwani Heritage Haveli',
    propertySlug: 'qissa-khwani-heritage-haveli',
    propertyType: 'BOUTIQUE',
    starRating: 4,
    averageRating: 4.87,
    reviewCount: 26,
    description:
      'A meticulously restored 19th-century merchant haveli in the historic Bazaar of the Storytellers. Hand-carved deodar wood jharokhas, Persian carpets, rooftop kahwah tea salons, and authentic Pashtun hospitality.',
    address: {
      street: 'Qissa Khwani Bazaar, Old Walled City',
      city: 'Peshawar',
      state: 'Khyber Pakhtunkhwa',
      country: 'Pakistan',
      postalCode: '25000',
      coordinates: { lat: 34.008, lng: 71.578 },
      formattedAddress: 'Qissa Khwani Bazaar, Peshawar Old City, Pakistan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Traditional Courtyard & Jharokha Balconies',
      'Rooftop Green Tea & Kahwah Lounge',
      'Authentic Shinwari & Chapli Kebab Dining',
      'Curated Heritage Walking Tours',
      'Brass & Copper Crafts Library',
    ],
    isFeaturedOnHome: false,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children of all ages welcome.',
    rooms: [
      {
        name: "Emir's Courtyard Suite",
        code: 'QH-ECS-01',
        category: 'SUITE',
        viewType: 'COURTYARD_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '45m² historic suite with carved wood ceiling, private balcony overlooking the brick fountain courtyard, and brass clawfoot tub.',
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
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 45,
        totalUnits: 5,
        basePricePerNight: 24000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Carved Wood Jharokha', 'Courtyard View', 'Kahwah Tea Set', 'Handmade Rugs'],
        images: [
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  // ==========================================
  // GLOBAL & INTERNATIONAL DESTINATIONS
  // ==========================================
  {
    hotelName: 'Burj Vista Hospitality Dubai',
    hotelSlug: 'burj-vista-dubai',
    adminFullName: 'Omar Al-Hashemi',
    adminEmail: 'admin@burjvista.ae',
    adminPassword: 'Dubai123!',
    country: 'United Arab Emirates',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    contactPhone: '+971 4 4567890',
    propertyName: 'Burj Vista Sky Penthouse & Residences',
    propertySlug: 'burj-vista-sky-penthouse',
    propertyType: 'APARTMENT',
    starRating: 5,
    averageRating: 4.97,
    reviewCount: 54,
    description:
      'Sky-high luxury overlooking the Burj Khalifa and Dubai Fountain. Boasts floor-to-ceiling glass, private infinity terrace jacuzzi, Italian marble, and personal chauffeur services.',
    address: {
      street: 'Sheikh Mohammed bin Rashid Blvd, Downtown Dubai',
      city: 'Dubai',
      state: 'Dubai',
      country: 'United Arab Emirates',
      postalCode: '00000',
      coordinates: { lat: 25.1972, lng: 55.2744 },
      formattedAddress: 'Sheikh Mohammed bin Rashid Blvd, Downtown Dubai, UAE',
    },
    coverImage:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Burj Khalifa & Fountain Frontline View',
      'Private Terrace Heated Jacuzzi',
      'Private Chauffeur & Rolls Royce Airport Pickup',
      '24/7 White-Glove Butler',
      'Infinity Pool & Sky Gym',
      'Bespoke In-Suite Chef Dining',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 6,
    cancellationPolicy: 'Free cancellation up to 72 hours before arrival.',
    childPolicy: 'Children welcome. High-end cribs and children amenities provided.',
    rooms: [
      {
        name: 'Skyline 2-Bedroom Fountain Suite',
        code: 'BV-SFS-01',
        category: 'SUITE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'TERRACE',
        description:
          '110m² luxury suite with panoramic glass terrace facing the Burj Khalifa fountain show, 2 en-suite bedrooms, and designer kitchen.',
        maxOccupancy: { adults: 4, children: 2 },
        bedConfig: '2 King Beds',
        bedding: {
          primaryBed: 'King',
          bedCount: 2,
          allowsRollaway: true,
          rollawayFee: 500,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 2,
        },
        roomSizeSqm: 110,
        totalUnits: 4,
        basePricePerNight: 1850,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: [
          'Direct Burj Khalifa Views',
          'Private Terrace Jacuzzi',
          'Designer Kitchen',
          'Butler Service',
        ],
        images: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Al Ula Sanctuary Resorts',
    hotelSlug: 'al-ula-sanctuary-resorts',
    adminFullName: 'Faisal Al-Otaibi',
    adminEmail: 'admin@alulaoasis.sa',
    adminPassword: 'Alula123!',
    country: 'Saudi Arabia',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    contactPhone: '+966 14 8880000',
    propertyName: 'Al Ula Desert Rose Canyon Oasis',
    propertySlug: 'al-ula-desert-rose-canyon-oasis',
    propertyType: 'RESORT',
    starRating: 5,
    averageRating: 4.98,
    reviewCount: 39,
    description:
      'A sublime eco-luxury sanctuary nestled among towering sandstone canyons near ancient Hegra ruins. Features tented pool villas, stargazing firepits, and sound-bath wellness.',
    address: {
      street: 'Ashar Valley Road',
      city: 'Al Ula',
      state: 'Medina Province',
      country: 'Saudi Arabia',
      postalCode: '43511',
      coordinates: { lat: 26.6189, lng: 37.9189 },
      formattedAddress: 'Ashar Valley, Al Ula, Saudi Arabia',
    },
    coverImage:
      'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Canyon Plunge Pool',
      'Under-Stars Stargazing Platform',
      'Sound Bath & Yoga Sanctuary',
      'Farm-to-Table Dates & Citrus Dining',
      'Private Archeological Hegra Guides',
      'Desert Buggy & Camel Excursions',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 7,
    cancellationPolicy: 'Free cancellation up to 5 days prior to arrival.',
    childPolicy: 'Adults and families with children 10+ welcome.',
    rooms: [
      {
        name: 'Canyon View Tented Pool Villa',
        code: 'AU-CPV-01',
        category: 'VILLA',
        viewType: 'MOUNTAIN_VIEW',
        outdoorSpace: 'PRIVATE_POOL',
        description:
          '85m² tented desert villa with private heated plunge pool facing the sandstone cliffs, indoor and outdoor rain showers, and daybed lounge.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 600,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 85,
        totalUnits: 6,
        basePricePerNight: 2400,
        mealPlan: 'HALF_BOARD',
        amenities: [
          'Private Plunge Pool',
          'Outdoor Daybed',
          'Star Telescope',
          'Artisan Date & Coffee Service',
        ],
        images: [
          'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Bosphorus Imperial Palaces',
    hotelSlug: 'bosphorus-imperial-palaces',
    adminFullName: 'Emre Yilmaz',
    adminEmail: 'admin@bosphoruspalace.com',
    adminPassword: 'Istanbul123!',
    country: 'Turkey',
    currency: 'TRY',
    timezone: 'Europe/Istanbul',
    contactPhone: '+90 212 3456789',
    propertyName: 'Bosphorus Waterfront Ottoman Palace',
    propertySlug: 'bosphorus-waterfront-ottoman-palace',
    propertyType: 'HOTEL',
    starRating: 5,
    averageRating: 4.93,
    reviewCount: 46,
    description:
      'A restored 19th-century Ottoman imperial yalı standing directly on the sparkling waters of the Bosphorus strait. Private yacht pier, marble Turkish hammam, and panoramic sunset terraces.',
    address: {
      street: 'Çırağan Caddesi, Ortaköy',
      city: 'Istanbul',
      state: 'Beşiktaş',
      country: 'Turkey',
      postalCode: '34347',
      coordinates: { lat: 41.048, lng: 29.022 },
      formattedAddress: 'Çırağan Caddesi, Beşiktaş, Istanbul, Turkey',
    },
    coverImage:
      'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Bosphorus Yacht Pier',
      'Historical Marble Turkish Hammam & Spa',
      'Waterfront Seafood Dining & Bar',
      'Heated Outdoor Saltwater Pool',
      'Helicopter Transfers to Istanbul Airport',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 8,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children of all ages welcome.',
    rooms: [
      {
        name: 'Bosphorus Sea View Suite',
        code: 'BP-BSS-01',
        category: 'SUITE',
        viewType: 'SEA_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '55m² imperial suite overlooking the passing ships and Asian shoreline, with high ceilings, gold leaf moldings, and freestanding clawfoot tub.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 2500,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 55,
        totalUnits: 6,
        basePricePerNight: 14000,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Direct Bosphorus Balcony', 'Clawfoot Tub', 'Turkish Delight Welcome', 'Butler Service'],
        images: [
          'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Mayfair Townhouse Group',
    hotelSlug: 'mayfair-townhouse-group',
    adminFullName: 'Lord Arthur Sterling',
    adminEmail: 'admin@mayfairresidence.co.uk',
    adminPassword: 'London123!',
    country: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London',
    contactPhone: '+44 20 7946 0123',
    propertyName: 'Mayfair Royal Georgian Residence',
    propertySlug: 'mayfair-royal-georgian-residence',
    propertyType: 'BOUTIQUE',
    starRating: 5,
    averageRating: 4.94,
    reviewCount: 41,
    description:
      'An aristocratic Georgian townhouse on Berkeley Square in London premier luxury district. Curated antique art, English afternoon tea salon, bespoke concierge, and marble fireplaces.',
    address: {
      street: '14 Berkeley Square, Mayfair',
      city: 'London',
      state: 'Greater London',
      country: 'United Kingdom',
      postalCode: 'W1J 6BQ',
      coordinates: { lat: 51.509, lng: -0.146 },
      formattedAddress: '14 Berkeley Square, Mayfair, London, United Kingdom',
    },
    coverImage:
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private High Tea Salon',
      '24/7 Mayfair Clefs d\'Or Concierge',
      'Private Library & Gin Bar',
      'Rolls-Royce House Car Service',
      'Complimentary Fortnum & Mason Hamper',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 9,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children welcome.',
    rooms: [
      {
        name: 'Mayfair Club Room',
        code: 'MR-MCR-01',
        category: 'DELUXE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'NONE',
        description:
          '36m² of quintessential English refinement with bespoke velvet upholstery, marble rain shower, and Penhaligon amenities.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 80,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: false,
          hasWalkInShower: true,
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 36,
        totalUnits: 8,
        basePricePerNight: 450,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Penhaligon Bath Products', 'Afternoon Tea Voucher', 'Nespresso Coffee', 'High-Speed Wi-Fi'],
        images: [
          'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Parisian Marais Collection',
    hotelSlug: 'parisian-marais-collection',
    adminFullName: 'Camille Delacroix',
    adminEmail: 'admin@lemaraisloft.fr',
    adminPassword: 'Paris123!',
    country: 'France',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    contactPhone: '+33 1 42 68 55 00',
    propertyName: 'Le Marais Haussmann Luxury Loft',
    propertySlug: 'le-marais-haussmann-luxury-loft',
    propertyType: 'APARTMENT',
    starRating: 5,
    averageRating: 4.96,
    reviewCount: 34,
    description:
      'Quintessential Parisian elegance in the historic 4th arrondissement. Herringbone chevron oak parquet, ornate crown moldings, designer kitchen, and wrought-iron balconies over cobblestone streets.',
    address: {
      street: '28 Rue des Francs-Bourgeois',
      city: 'Paris',
      state: 'Île-de-France',
      country: 'France',
      postalCode: '75004',
      coordinates: { lat: 48.8575, lng: 2.36 },
      formattedAddress: '28 Rue des Francs-Bourgeois, Le Marais, 75004 Paris, France',
    },
    coverImage:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Wrought-Iron Parisian Balcony',
      'Chevron Hardwood Parquet & Marble Fireplace',
      'Gourmet Bulthaup Kitchen & Wine Cellar',
      'Diptyque Paris Luxury Bath Amenities',
      'Daily French Bakery Breakfast Delivery',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 10,
    cancellationPolicy: 'Free cancellation up to 72 hours prior to arrival.',
    childPolicy: 'Children welcome.',
    rooms: [
      {
        name: 'Haussmann Atelier Suite',
        code: 'LM-HAS-01',
        category: 'SUITE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '65m² apartment with floor-to-ceiling French windows opening to a street-facing balcony, queen bedroom, and freestanding porcelain bath.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 Queen Bed',
        bedding: {
          primaryBed: 'Queen',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 60,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 65,
        totalUnits: 5,
        basePricePerNight: 380,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Parisian Balcony', 'Wine Cellar', 'Diptyque Amenities', 'Fresh Croissants Delivered'],
        images: [
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Tribeca Manhattan Lofts',
    hotelSlug: 'tribeca-manhattan-lofts',
    adminFullName: 'Julian Vance',
    adminEmail: 'admin@tribecapenthouse.com',
    adminPassword: 'Newyork123!',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York',
    contactPhone: '+1 212 555 0199',
    propertyName: 'Tribeca Cast-Iron Designer Penthouse',
    propertySlug: 'tribeca-cast-iron-designer-penthouse',
    propertyType: 'APARTMENT',
    starRating: 5,
    averageRating: 4.95,
    reviewCount: 48,
    description:
      "A masterwork of industrial luxury in downtown Manhattan. Exposed brick, soaring 14-foot timber ceilings, chef's kitchen, private landscaped rooftop garden, and Freedom Tower views.",
    address: {
      street: '72 Franklin Street, Tribeca',
      city: 'New York',
      state: 'New York',
      country: 'United States',
      postalCode: '10013',
      coordinates: { lat: 40.718, lng: -74.004 },
      formattedAddress: '72 Franklin St, New York, NY 10013, USA',
    },
    coverImage:
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502005229762-ee1b2da3c5bd?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Landscaped Rooftop Deck',
      'Custom Sub-Zero & Wolf Kitchen',
      'Private Keyed Elevator Access',
      'In-Residence Pelotons & Gym Space',
      'Sonos Architectural Sound System',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 11,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children welcome.',
    rooms: [
      {
        name: 'Tribeca Artist Loft',
        code: 'TP-TAL-01',
        category: 'SUITE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'TERRACE',
        description:
          '95m² industrial loft with 14ft beamed ceilings, original cast-iron pillars, designer furniture, and terrace facing southern Manhattan.',
        maxOccupancy: { adults: 3, children: 1 },
        bedConfig: '1 King Bed, 1 Daybed',
        bedding: {
          primaryBed: 'King',
          bedCount: 2,
          allowsRollaway: true,
          rollawayFee: 100,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 2,
        },
        roomSizeSqm: 95,
        totalUnits: 4,
        basePricePerNight: 650,
        mealPlan: 'ROOM_ONLY',
        amenities: ['Private Keyed Elevator', 'Wolf Kitchen', 'Sonos Sound', 'Rooftop Deck Access'],
        images: [
          'https://images.unsplash.com/photo-1502005229762-ee1b2da3c5bd?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Bali Rainforest Sanctuaries',
    hotelSlug: 'bali-rainforest-sanctuaries',
    adminFullName: 'Wayan Sudarta',
    adminEmail: 'admin@ubudrainforest.com',
    adminPassword: 'Bali123!',
    country: 'Indonesia',
    currency: 'USD',
    timezone: 'Asia/Makassar',
    contactPhone: '+62 361 977000',
    propertyName: 'Ubud Sacred Valley Rainforest Villa',
    propertySlug: 'ubud-sacred-valley-rainforest-villa',
    propertyType: 'VILLA',
    starRating: 5,
    averageRating: 4.98,
    reviewCount: 52,
    description:
      'Suspended amidst the emerald jungle canopy along the sacred Ayung River in Ubud. Private cantilevered heated infinity pool, open-air stone bathing pavilion, yoga shala, and personalized Ayurvedic wellness.',
    address: {
      street: 'Jalan Raya Sayan',
      city: 'Bali',
      state: 'Ubud',
      country: 'Indonesia',
      postalCode: '80571',
      coordinates: { lat: -8.5069, lng: 115.242 },
      formattedAddress: 'Jalan Raya Sayan, Ubud, Bali, Indonesia',
    },
    coverImage:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Cantilevered Infinity Pool',
      'Open-Air Jungle Stone Bathing Pavilion',
      'Complimentary Daily Morning Yoga',
      'Ayurvedic Organic Spa Therapies',
      'Floating Breakfast in Pool Experience',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 12,
    cancellationPolicy: 'Free cancellation up to 5 days prior to arrival.',
    childPolicy: 'Children over 6 welcome in pool villas.',
    rooms: [
      {
        name: 'River Canopy Pool Villa',
        code: 'UB-RCP-01',
        category: 'VILLA',
        viewType: 'GARDEN_VIEW',
        outdoorSpace: 'PRIVATE_POOL',
        description:
          '120m² open-concept luxury villa with private infinity pool overlooking the river gorge, outdoor terrazzo tub, and four-poster king bed.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 Four-Poster King Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 50,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: true,
          bathroomCount: 1,
        },
        roomSizeSqm: 120,
        totalUnits: 6,
        basePricePerNight: 420,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Private Infinity Pool', 'Floating Breakfast Option', 'Outdoor Terrazzo Tub', 'Jungle View Deck'],
        images: [
          'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },

  {
    hotelName: 'Tokyo Zen Hospitality',
    hotelSlug: 'tokyo-zen-hospitality',
    adminFullName: 'Kenji Takahashi',
    adminEmail: 'admin@zenryokan.jp',
    adminPassword: 'Tokyo123!',
    country: 'Japan',
    currency: 'USD',
    timezone: 'Asia/Tokyo',
    contactPhone: '+81 3 3344 0011',
    propertyName: 'Shinjuku Zen Modern Ryokan & Onsen',
    propertySlug: 'shinjuku-zen-modern-ryokan',
    propertyType: 'BOUTIQUE',
    starRating: 5,
    averageRating: 4.97,
    reviewCount: 56,
    description:
      'An oasis of quiet serenity in central Tokyo. Tatami-matted suites, hinoki cedar soaking tubs fed by hot mineral waters, multi-course Kaiseki cuisine, and traditional tea ceremonies.',
    address: {
      street: '3-14-1 Kabukicho, Shinjuku-ku',
      city: 'Tokyo',
      state: 'Tokyo Prefecture',
      country: 'Japan',
      postalCode: '160-0021',
      coordinates: { lat: 35.6938, lng: 139.7034 },
      formattedAddress: '3-14-1 Kabukicho, Shinjuku, Tokyo, Japan',
    },
    coverImage:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: [
      'Private Hinoki Cedar Onsen Tub',
      'Traditional Multi-Course Kaiseki Dining',
      'Yukata & Geta Robes Provided',
      'Rooftop Zen Rock Garden & Tea Pavilion',
      'Shoe-Free Tatami Sanctuary',
    ],
    isFeaturedOnHome: true,
    featuredPriority: 13,
    cancellationPolicy: 'Free cancellation up to 48 hours prior to arrival.',
    childPolicy: 'Children over 6 welcome.',
    rooms: [
      {
        name: 'Hinoki Deluxe Tatami Suite',
        code: 'ZR-HTS-01',
        category: 'SUITE',
        viewType: 'CITY_VIEW',
        outdoorSpace: 'BALCONY',
        description:
          '48m² serene sanctuary with igusa rush tatami mats, custom futon king bedding, shoji sliding paper screens, and private aromatic hinoki cedar hot spring bath.',
        maxOccupancy: { adults: 2, children: 1 },
        bedConfig: '1 King Futon Bed',
        bedding: {
          primaryBed: 'King',
          bedCount: 1,
          allowsRollaway: true,
          rollawayFee: 60,
          allowsCrib: true,
        },
        bathroom: {
          hasTub: true,
          hasWalkInShower: true,
          hasDoubleVanity: false,
          bathroomCount: 1,
        },
        roomSizeSqm: 48,
        totalUnits: 8,
        basePricePerNight: 390,
        mealPlan: 'BREAKFAST_INCLUDED',
        amenities: ['Hinoki Wood Bath', 'Tatami Flooring', 'Tea Ceremony Set', 'Kaiseki Breakfast Included'],
        images: [
          'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
  },
];

const EXPANDED_DESTINATIONS = [
  {
    city: 'Hunza Valley',
    country: 'Pakistan',
    countryCode: 'PK',
    subtitle: 'Rakaposhi Peaks & Glamping Sanctuaries',
    coverImage: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80',
    displayOrder: 1,
    targetCountries: ['PK', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Skardu',
    country: 'Pakistan',
    countryCode: 'PK',
    subtitle: 'Lower Kachura Lake & Celestial Stargazing',
    coverImage: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
    displayOrder: 2,
    targetCountries: ['PK', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Islamabad',
    country: 'Pakistan',
    countryCode: 'PK',
    subtitle: 'Margalla Foothills & Diplomatic Enclave',
    coverImage: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    displayOrder: 3,
    targetCountries: ['PK', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Murree',
    country: 'Pakistan',
    countryCode: 'PK',
    subtitle: 'Bhurban Pine Forests & Colonial Manors',
    coverImage: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
    displayOrder: 4,
    targetCountries: ['PK', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    subtitle: 'Burj Khalifa Skylines & Island Suites',
    coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
    displayOrder: 5,
    targetCountries: ['AE', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Al Ula',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    subtitle: 'Ancient Hegra & Sandstone Canyons',
    coverImage: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80',
    displayOrder: 6,
    targetCountries: ['SA', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Istanbul',
    country: 'Turkey',
    countryCode: 'TR',
    subtitle: 'Bosphorus Yalı Palaces & Old Town',
    coverImage: 'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=800&q=80',
    displayOrder: 7,
    targetCountries: ['TR', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    subtitle: 'Mayfair Townhouses & Royal Parks',
    coverImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
    displayOrder: 8,
    targetCountries: ['GB', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    subtitle: 'Le Marais Lofts & Seine Bridges',
    coverImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80',
    displayOrder: 9,
    targetCountries: ['FR', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Bali',
    country: 'Indonesia',
    countryCode: 'ID',
    subtitle: 'Ubud Sacred Valley & Infinity Pools',
    coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    displayOrder: 10,
    targetCountries: ['ID', 'ALL'],
    isActive: true,
    isPopular: true,
  },
  {
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    subtitle: 'Shinjuku Ryokans & Hinoki Onsens',
    coverImage: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80',
    displayOrder: 11,
    targetCountries: ['JP', 'ALL'],
    isActive: true,
    isPopular: true,
  },
];

async function seedExpanded() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_hotel_agent';
  console.log(`🔌 Connecting to MongoDB: ${uri}...`);
  await mongoose.connect(uri);

  const salt = await bcrypt.genSalt(10);
  const today = normalizeDate(new Date());

  console.log(`\n🚀 Seeding ${EXPANDED_PROPERTIES.length} Premium Worldwide Properties...`);

  const seededAdminCreds: Array<{
    hotel: string;
    property: string;
    type: string;
    city: string;
    country: string;
    email: string;
    password: string;
    slug: string;
  }> = [];

  for (const def of EXPANDED_PROPERTIES) {
    // 1. Hotel Admin User
    let admin = await User.findOne({ email: def.adminEmail.toLowerCase() });
    if (!admin) {
      const passwordHash = await bcrypt.hash(def.adminPassword, salt);
      admin = await User.create({
        email: def.adminEmail.toLowerCase(),
        passwordHash,
        fullName: def.adminFullName,
        role: 'HOTEL_ADMIN',
        status: 'ACTIVE',
      });
      console.log(`  👤 Created Admin: ${def.adminEmail}`);
    } else {
      console.log(`  ℹ️ Existing Admin: ${def.adminEmail}`);
    }

    // 2. Hotel Account
    let hotel = await HotelAccount.findOne({ slug: def.hotelSlug });
    if (!hotel) {
      hotel = await HotelAccount.create({
        name: def.hotelName,
        slug: def.hotelSlug,
        status: 'ACTIVE',
        contactEmail: def.adminEmail,
        contactPhone: def.contactPhone,
        country: def.country,
        currency: def.currency,
        timezone: def.timezone,
        primaryAdminUserId: admin._id,
      });
      console.log(`  🏨 Created HotelAccount: ${def.hotelName}`);
    } else {
      hotel.status = 'ACTIVE';
      hotel.name = def.hotelName;
      hotel.currency = def.currency;
      hotel.country = def.country;
      await hotel.save();
    }

    // 3. Hotel Membership
    const existingMembership = await HotelMembership.findOne({
      userId: admin._id,
      hotelAccountId: hotel._id,
    });
    if (!existingMembership) {
      await HotelMembership.create({
        userId: admin._id,
        hotelAccountId: hotel._id,
        role: 'HOTEL_ADMIN',
      });
    }

    // 4. Property
    let property = await Property.findOne({ slug: def.propertySlug });
    const propertyData = {
      hotelAccountId: hotel._id,
      name: def.propertyName,
      slug: def.propertySlug,
      description: def.description,
      propertyType: def.propertyType,
      starRating: def.starRating,
      address: def.address,
      contactEmail: def.adminEmail,
      contactPhone: def.contactPhone,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      coverImage: def.coverImage,
      gallery: def.gallery,
      amenities: def.amenities,
      status: 'PUBLISHED' as const,
      isFeaturedOnHome: !!def.isFeaturedOnHome,
      featuredPriority: def.featuredPriority || 10,
      averageRating: def.averageRating,
      reviewCount: def.reviewCount,
      isGuestFavorite: true,
      categoryRatings: {
        cleanliness: 4.9,
        accuracy: 4.9,
        checkIn: 5.0,
        communication: 5.0,
        location: 4.9,
        value: 4.8,
      },
    };

    if (!property) {
      property = await Property.create(propertyData);
      console.log(`  ✨ Created Property: ${def.propertyName} (${def.propertyType})`);
    } else {
      Object.assign(property, propertyData);
      await property.save();
      console.log(`  🔄 Updated Property: ${def.propertyName}`);
    }

    // 5. Policy
    await Policy.findOneAndUpdate(
      { propertyId: property._id },
      {
        propertyId: property._id,
        hotelAccountId: hotel._id,
        cancellationPolicy: def.cancellationPolicy,
        cancellationDeadlineHours: 48,
        petPolicy: { allowed: false, fee: 0, notes: 'Service animals permitted.' },
        smokingPolicy: { allowed: false, notes: 'Non-smoking across all guestrooms.' },
        childPolicy: def.childPolicy,
        customRules: def.customRules || [],
      },
      { upsert: true, new: true }
    );

    // 6. Rooms & Availability
    for (const rDef of def.rooms) {
      let room = await RoomType.findOne({
        propertyId: property._id,
        code: rDef.code,
      });

      const roomData = {
        propertyId: property._id,
        hotelAccountId: hotel._id,
        name: rDef.name,
        code: rDef.code,
        category: rDef.category,
        viewType: rDef.viewType,
        outdoorSpace: rDef.outdoorSpace,
        description: rDef.description,
        maxOccupancy: rDef.maxOccupancy,
        bedConfig: rDef.bedConfig,
        bedding: rDef.bedding,
        bathroom: rDef.bathroom,
        roomSizeSqm: rDef.roomSizeSqm,
        totalUnits: rDef.totalUnits,
        basePricePerNight: rDef.basePricePerNight,
        pricing: {
          basePricePerNight: rDef.basePricePerNight,
          extraAdultRate: Math.round(rDef.basePricePerNight * 0.15),
          extraChildRate: Math.round(rDef.basePricePerNight * 0.08),
        },
        mealPlan: rDef.mealPlan,
        isSmokingAllowed: false,
        isAccessible: true,
        amenities: rDef.amenities,
        images: rDef.images,
        isActive: true,
      };

      if (!room) {
        room = await RoomType.create(roomData);
        console.log(`    🛏️ Created RoomType: ${rDef.name} (${rDef.totalUnits} units)`);
      } else {
        Object.assign(room, roomData);
        await room.save();
      }

      // Initialize 60 days availability for instant booking
      const availBulkOps = [];
      for (let day = 0; day < 60; day++) {
        const d = new Date(today.getTime() + day * 86400000);
        availBulkOps.push({
          updateOne: {
            filter: { roomTypeId: room._id, date: d },
            update: {
              $setOnInsert: {
                propertyId: property._id,
                hotelAccountId: hotel._id,
                roomTypeId: room._id,
                date: d,
                totalUnits: rDef.totalUnits,
                bookedUnits: 0,
                blockedUnits: 0,
                isClosed: false,
              },
            },
            upsert: true,
          },
        });
      }
      if (availBulkOps.length > 0) {
        await Availability.bulkWrite(availBulkOps);
      }
    }

    seededAdminCreds.push({
      hotel: def.hotelName,
      property: def.propertyName,
      type: def.propertyType,
      city: def.address.city,
      country: def.address.country,
      email: def.adminEmail,
      password: def.adminPassword,
      slug: def.propertySlug,
    });
  }

  // 7. Upsert Curated Featured Destinations
  console.log(`\n🌍 Upserting ${EXPANDED_DESTINATIONS.length} Featured Geo-Destinations...`);
  for (const dest of EXPANDED_DESTINATIONS) {
    await FeaturedDestination.findOneAndUpdate(
      { city: dest.city, country: dest.country },
      dest,
      { upsert: true, new: true }
    );
  }

  console.log('\n=============================================================================');
  console.log('🎉 WORLDWIDE EXPANDED SEED COMPLETED!');
  console.log('=============================================================================');
  console.log(`Total properties created/verified: ${seededAdminCreds.length}`);
  console.table(
    seededAdminCreds.map((c) => ({
      'Property Name': c.property,
      Type: c.type,
      Location: `${c.city}, ${c.country}`,
      'Admin Email': c.email,
      Password: c.password,
    }))
  );

  await mongoose.disconnect();
}

seedExpanded().catch((err) => {
  console.error('❌ Failed seeding expanded properties:', err);
  process.exit(1);
});
