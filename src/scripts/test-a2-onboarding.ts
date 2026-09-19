import http from 'http';
import app from '../app';
import { connectDB } from '../config/database';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { HotelAccount } from '../models/HotelAccount';
import { HotelMembership } from '../models/HotelMembership';

async function runA2OnboardingTests() {
  console.log('🧪 Starting Milestone A2 Hotel Onboarding & Activation Automated Test Suite...\n');

  await connectDB();

  // Clean up any test hotel and user from previous runs to ensure idempotence
  await Promise.all([
    User.deleteMany({ email: 'admin@pclahore.com' }),
    HotelAccount.deleteMany({ slug: /^pearl-continental-lahore/ }),
  ]);

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
    // 1. Super Admin login
    console.log('\n--- 1. Super Admin Login ---');
    const superAdminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@hotelagent.com', password: 'Admin123!' },
    });
    assert(superAdminRes.status === 200, 'Super Admin login succeeds');
    const superAdminToken = superAdminRes.data.data?.accessToken;

    // 2. Onboard New Hotel via Super Admin
    console.log('\n--- 2. Onboard New Hotel ---');
    const newHotelPayload = {
      name: 'Pearl Continental Lahore',
      contactEmail: 'contact@pclahore.com',
      contactPhone: '+92 42 111 505 505',
      country: 'Pakistan',
      currency: 'PKR',
      timezone: 'Asia/Karachi',
      adminFullName: 'Farhan Zaidi',
      adminEmail: 'admin@pclahore.com',
      adminPassword: 'PCAdmin2026!',
    };

    const onboardRes = await request('/admin/hotels', {
      method: 'POST',
      token: superAdminToken,
      body: newHotelPayload,
    });

    assert(onboardRes.status === 201, 'Super Admin successfully onboards new hotel (201 Created)');
    const createdHotel = onboardRes.data.data?.hotel;
    const createdAdmin = onboardRes.data.data?.admin;

    assert(createdHotel?.name === 'Pearl Continental Lahore', 'Created hotel has correct name');
    assert(createdHotel?.slug === 'pearl-continental-lahore', 'Created hotel generated correct route-safe slug');
    assert(createdAdmin?.email === 'admin@pclahore.com', 'Created admin user has correct email');

    // Duplicate admin email rejection test
    const duplicateRes = await request('/admin/hotels', {
      method: 'POST',
      token: superAdminToken,
      body: newHotelPayload,
    });
    assert(duplicateRes.status === 400, 'Duplicate admin email correctly rejected (400 Bad Request)');

    // 3. Newly Created Hotel Admin Login
    console.log('\n--- 3. Newly Created Admin Portal Login ---');
    const newAdminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@pclahore.com', password: 'PCAdmin2026!' },
    });
    assert(newAdminLoginRes.status === 200, 'New hotel admin can immediately authenticate');
    const newAdminToken = newAdminLoginRes.data.data?.accessToken;
    const newAdminHotelId = newAdminLoginRes.data.data?.user?.hotelAccountId;

    assert(newAdminHotelId === createdHotel.id, 'New admin token is correctly scoped to the new hotel tenant ID');

    // New Admin accesses their scoped portal
    const newAdminPortalRes = await request('/portal/hotel/me', { token: newAdminToken });
    assert(newAdminPortalRes.status === 200, 'New admin can access their scoped /portal/hotel/me endpoint');
    assert(
      newAdminPortalRes.data.data?.hotel?.name === 'Pearl Continental Lahore',
      'Portal returns correct hotel name for the new admin'
    );

    // 4. Hotel Suspension Lifecycle
    console.log('\n--- 4. Hotel Suspension Lifecycle ---');
    const suspendRes = await request(`/admin/hotels/${createdHotel.id}/status`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 'SUSPENDED' },
    });
    assert(suspendRes.status === 200, 'Super Admin can update hotel status to SUSPENDED');
    assert(suspendRes.data.data?.hotel?.status === 'SUSPENDED', 'Hotel status successfully marked SUSPENDED');

    // Suspended admin's authenticated request is rejected
    const suspendedAccessRes = await request('/portal/hotel/me', { token: newAdminToken });
    assert(
      suspendedAccessRes.status === 403 &&
        suspendedAccessRes.data.error?.code === 'HOTEL_SUSPENDED',
      'Suspended hotel admin is BLOCKED from portal operations (403 HOTEL_SUSPENDED)'
    );

    // Suspended admin login attempt is rejected
    const suspendedLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@pclahore.com', password: 'PCAdmin2026!' },
    });
    assert(
      suspendedLoginRes.status === 403 &&
        suspendedLoginRes.data.error?.code === 'HOTEL_SUSPENDED',
      'Suspended hotel admin login is BLOCKED (403 HOTEL_SUSPENDED)'
    );

    // 5. Hotel Reactivation Lifecycle
    console.log('\n--- 5. Hotel Reactivation Lifecycle ---');
    const reactivateRes = await request(`/admin/hotels/${createdHotel.id}/status`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 'ACTIVE' },
    });
    assert(reactivateRes.status === 200, 'Super Admin can reactivate hotel to ACTIVE');

    const reactivatedLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@pclahore.com', password: 'PCAdmin2026!' },
    });
    assert(reactivatedLoginRes.status === 200, 'Reactivated hotel admin can log in again');

    console.log('\n===========================================');
    console.log(`🎯 MILESTONE A2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runA2OnboardingTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
