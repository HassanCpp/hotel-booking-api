export interface AmenityCategory {
  category: string;
  items: string[];
}

export const AMENITIES_CATALOG: AmenityCategory[] = [
  {
    category: 'FACILITIES',
    items: [
      'Swimming Pool',
      'Rooftop Terrace',
      'Fitness Center',
      'Business Center',
      'Valet Parking',
      'EV Charging Station',
      'Free High-Speed WiFi',
      '24-Hour Front Desk',
      'Elevator',
    ],
  },
  {
    category: 'DINING',
    items: [
      'Fine Dining Restaurant',
      'Rooftop Bar & Lounge',
      'Complimentary Breakfast',
      '24/7 Room Service',
      'Coffee Shop & Bakery',
    ],
  },
  {
    category: 'WELLNESS',
    items: [
      'Luxury Spa & Wellness Center',
      'Sauna & Steam Room',
      'Massage Therapy',
      'Heated Indoor Pool',
      'Yoga & Meditation Studio',
    ],
  },
  {
    category: 'SERVICES',
    items: [
      'Airport Shuttle Service',
      'Boutique Concierge Service',
      'Daily Housekeeping',
      'Laundry & Dry Cleaning',
      'Luggage Storage',
      'Currency Exchange',
    ],
  },
  {
    category: 'ROOM_AMENITIES',
    items: [
      'Private Balcony with City View',
      'Luxury Bathtub',
      'Walk-in Rain Shower',
      'Smart TV with Streaming',
      'Curated Mini Bar',
      'Nespresso / Espresso Machine',
      'In-Room Electronic Safe',
      'Individual Climate Control',
      'Executive Work Desk',
      'Acoustic Soundproofing',
      'Premium Egyptian Cotton Linens',
      'Designer Bathrobes & Slippers',
    ],
  },
];
