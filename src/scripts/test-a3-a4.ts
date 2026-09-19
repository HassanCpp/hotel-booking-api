import http from 'http';
import app from '../app';
import { connectDB } from '../config/database';
import mongoose from 'mongoose';
import { Property } from '../models/Property';
import { RoomType } from '../models/RoomType';
import { Policy } from '../models/Policy';

async function runA3A4Tests() {
  console.log('🧪 Starting Milestones A3 & A4 (Properties, Policies & Room Catalog) Automated Test Suite...\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/v1`;

  console.log(`📡 Test server running at ${baseUrl}`);

  async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Hotel A Admin and Hotel B Admin
    console.log('\n--- 1. Authenticate Hotel Admins ---');
    const hotelARes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@heritagehotel.com', password: 'Heritage123!' },
    });
    assert(hotelARes.status === 200, 'Hotel A Admin login succeeds');
    const tokenA = hotelARes.data.data?.accessToken;

    const hotelBRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@sereneresort.com', password: 'Oasis123!' },
    });
    assert(hotelBRes.status === 200, 'Hotel B Admin login succeeds');
    const tokenB = hotelBRes.data.data?.accessToken;

    // 2. Amenities Catalog
    console.log('\n--- 2. Amenities Catalog Test ---');
    const amenitiesRes = await request('/portal/amenities', { token: tokenA });
    assert(amenitiesRes.status === 200, 'Amenities catalog endpoint returns 200');
    assert(
      Array.isArray(amenitiesRes.data.data?.catalog) && amenitiesRes.data.data.catalog.length >= 5,
      'Amenities catalog includes at least 5 standard categories'
    );

    // 3. Milestone A3: Property Creation & Policy
    console.log('\n--- 3. Property Creation (Milestone A3) ---');
    const newPropertyPayload = {
      name: 'The Heritage Palace Gulberg',
      description: 'An ultra-exclusive heritage residence in Gulberg, Lahore.',
      propertyType: 'BOUTIQUE',
      address: {
        street: '14-C Main Boulevard, Gulberg III',
        city: 'Lahore',
        country: 'Pakistan',
        postalCode: '54000',
        coordinates: { lat: 31.5204, lng: 74.3587 },
      },
      checkInTime: '15:00',
      checkOutTime: '11:00',
      amenities: ['Free High-Speed WiFi', 'Valet Parking', 'Luxury Spa & Wellness Center', 'Rooftop Bar & Lounge'],
      gallery: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
    };

    const createPropRes = await request('/portal/properties', {
      method: 'POST',
      token: tokenA,
      body: newPropertyPayload,
    });

    assert(createPropRes.status === 201, 'Hotel A creates property successfully (201 Created)');
    const propertyA = createPropRes.data.data?.property;
    assert(propertyA?.name === 'The Heritage Palace Gulberg', 'Created property has correct name');
    assert(propertyA?.slug.startsWith('the-heritage-palace-gulberg'), 'Property generated correct route-safe slug');
    assert(propertyA?.status === 'DRAFT', 'New property defaults to DRAFT status');

    // Check auto-initialized policy
    const policyGetRes = await request(`/portal/properties/${propertyA._id}/policies`, { token: tokenA });
    assert(policyGetRes.status === 200, 'Default policy automatically created for new property');

    // Update policies
    const policyUpdateRes = await request(`/portal/properties/${propertyA._id}/policies`, {
      method: 'PUT',
      token: tokenA,
      body: {
        cancellationPolicy: 'Complimentary cancellation up to 48 hours prior to arrival.',
        cancellationDeadlineHours: 48,
        petPolicy: { allowed: true, fee: 3500, notes: 'Small pets under 12kg permitted in suites.' },
        smokingPolicy: { allowed: false, notes: 'Strictly non-smoking interior.' },
        childPolicy: 'Children under 10 stay complimentary.',
        customRules: [{ title: 'Quiet Hours', content: 'Quiet hours observed between 11 PM and 7 AM.' }],
      },
    });
    assert(policyUpdateRes.status === 200, 'Policy updated successfully');
    assert(policyUpdateRes.data.data?.policy?.petPolicy?.allowed === true, 'Structured pet policy updated correctly');

    // 4. Milestone A4: Room Type Catalog
    console.log('\n--- 4. Room Type Catalog (Milestone A4) ---');
    const room1Payload = {
      name: 'Royal Executive Suite',
      code: 'ROYAL-EXEC',
      description: 'Luxurious 65 sqm suite with private terrace and marble bathroom.',
      maxOccupancy: { adults: 2, children: 1 },
      bedConfig: '1 Super King Bed',
      roomSizeSqm: 65,
      totalUnits: 8,
      basePricePerNight: 35000,
      amenities: ['Private Balcony with City View', 'Luxury Bathtub', 'Nespresso / Espresso Machine'],
      images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b'],
    };

    const createRoom1Res = await request(`/portal/properties/${propertyA._id}/rooms`, {
      method: 'POST',
      token: tokenA,
      body: room1Payload,
    });
    assert(createRoom1Res.status === 201, 'Room 1 (Royal Executive Suite) created successfully (201 Created)');
    const room1 = createRoom1Res.data.data?.room;
    assert(room1?.code === 'ROYAL-EXEC', 'Room 1 has correct uppercase code');
    assert(room1?.totalUnits === 8, 'Room 1 has correct sellable unit count');

    // Test duplicate room code on same property
    const duplicateCodeRes = await request(`/portal/properties/${propertyA._id}/rooms`, {
      method: 'POST',
      token: tokenA,
      body: room1Payload,
    });
    assert(duplicateCodeRes.status === 400, 'Duplicate room code correctly rejected (400 Bad Request)');

    // Create Room 2
    const room2Payload = {
      name: 'Presidential Penthouse',
      code: 'PRES-PENT',
      description: 'Exclusive 120 sqm top-floor penthouse with panoramic views.',
      maxOccupancy: { adults: 4, children: 2 },
      bedConfig: '2 King Beds',
      roomSizeSqm: 120,
      totalUnits: 2,
      basePricePerNight: 95000,
      amenities: ['Private Balcony with City View', 'Luxury Bathtub', 'Curated Mini Bar', 'Acoustic Soundproofing'],
      images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304'],
    };

    const createRoom2Res = await request(`/portal/properties/${propertyA._id}/rooms`, {
      method: 'POST',
      token: tokenA,
      body: room2Payload,
    });
    assert(createRoom2Res.status === 201, 'Room 2 (Presidential Penthouse) created successfully');
    const room2 = createRoom2Res.data.data?.room;

    // Fetch room list for property
    const listRoomsRes = await request(`/portal/properties/${propertyA._id}/rooms`, { token: tokenA });
    assert(listRoomsRes.status === 200 && listRoomsRes.data.data?.rooms?.length === 2, 'Property lists both room types');

    // 5. Milestone A4: Publication Readiness Validator
    console.log('\n--- 5. Publication Readiness Validator ---');
    // Create an incomplete draft property (no rooms)
    const incompletePropRes = await request('/portal/properties', {
      method: 'POST',
      token: tokenA,
      body: {
        name: 'Incomplete Draft Inn',
        address: { city: 'Rawalpindi', country: 'Pakistan' },
      },
    });
    const incompleteProp = incompletePropRes.data.data?.property;

    // Attempt to publish incomplete property -> must fail
    const invalidPublishRes = await request(`/portal/properties/${incompleteProp._id}/publish`, {
      method: 'POST',
      token: tokenA,
    });
    assert(
      invalidPublishRes.status === 400 &&
        invalidPublishRes.data.error?.code === 'PUBLICATION_REQUIREMENTS_NOT_MET',
      'Publication blocked for incomplete property without rooms (400 PUBLICATION_REQUIREMENTS_NOT_MET)'
    );

    // Now publish complete property (has address, 2 rooms, 10 units, policies) -> must succeed!
    const validPublishRes = await request(`/portal/properties/${propertyA._id}/publish`, {
      method: 'POST',
      token: tokenA,
    });
    assert(validPublishRes.status === 200, 'Valid property successfully published (200 OK)');
    assert(validPublishRes.data.data?.property?.status === 'PUBLISHED', 'Property status updated to PUBLISHED');

    // 6. Mandatory Cross-Tenant Isolation Tests on Properties & Rooms
    console.log('\n--- 6. Cross-Tenant Isolation Tests (Properties & Rooms) ---');

    // Hotel B Admin attempts to view Hotel A's property
    const crossGetPropRes = await request(`/portal/properties/${propertyA._id}`, { token: tokenB });
    assert(crossGetPropRes.status === 403, 'Hotel B Admin BLOCKED from viewing Hotel A property (403 Forbidden)');

    // Hotel B Admin attempts to add a room to Hotel A's property
    const crossAddRoomRes = await request(`/portal/properties/${propertyA._id}/rooms`, {
      method: 'POST',
      token: tokenB,
      body: {
        name: 'Hacker Room',
        code: 'HACK-1',
        totalUnits: 1,
        basePricePerNight: 1000,
      },
    });
    assert(crossAddRoomRes.status === 403, 'Hotel B Admin BLOCKED from creating rooms in Hotel A property (403 Forbidden)');

    // Hotel B Admin attempts to update Hotel A's room
    const crossUpdateRoomRes = await request(`/portal/rooms/${room1._id}`, {
      method: 'PATCH',
      token: tokenB,
      body: { basePricePerNight: 1 },
    });
    assert(crossUpdateRoomRes.status === 403, 'Hotel B Admin BLOCKED from modifying Hotel A room (403 Forbidden)');

    // Hotel B Admin attempts to publish Hotel A's property
    const crossPublishRes = await request(`/portal/properties/${propertyA._id}/publish`, {
      method: 'POST',
      token: tokenB,
    });
    assert(crossPublishRes.status === 403, 'Hotel B Admin BLOCKED from publishing Hotel A property (403 Forbidden)');

    console.log('\n===========================================');
    console.log(`🎯 MILESTONES A3 & A4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runA3A4Tests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
