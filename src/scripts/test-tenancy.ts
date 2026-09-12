import http from 'http';
import app from '../app';
import { connectDB } from '../config/database';
import mongoose from 'mongoose';

async function runTenancyTests() {
  console.log('🧪 Starting Phase 1 Tenant Isolation & Auth Automated Test Suite...\n');

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
    // 1. Health check
    console.log('\n--- 1. API Health Check ---');
    const health = await request('/health');
    assert(health.status === 200 && health.data.data.status === 'HEALTHY', 'Health check returns 200 HEALTHY');

    // 2. Authentication: Login tests
    console.log('\n--- 2. Authentication Tests ---');
    
    // Login Super Admin
    const superAdminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'superadmin@hotelagent.com', password: 'Admin123!' },
    });
    assert(superAdminRes.status === 200, 'Super Admin login succeeds');
    const superAdminToken = superAdminRes.data.data?.accessToken;

    // Login Hotel A Admin
    const hotelAAdminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@heritagehotel.com', password: 'Heritage123!' },
    });
    assert(hotelAAdminRes.status === 200, 'Hotel A Admin login succeeds');
    const hotelAToken = hotelAAdminRes.data.data?.accessToken;
    const hotelAId = hotelAAdminRes.data.data?.user?.hotelAccountId;

    // Login Hotel B Admin
    const hotelBAdminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@sereneresort.com', password: 'Oasis123!' },
    });
    assert(hotelBAdminRes.status === 200, 'Hotel B Admin login succeeds');
    const hotelBToken = hotelBAdminRes.data.data?.accessToken;
    const hotelBId = hotelBAdminRes.data.data?.user?.hotelAccountId;

    assert(Boolean(hotelAId && hotelBId && hotelAId !== hotelBId), 'Hotel A and Hotel B have distinct tenant IDs');

    // Wrong password test
    const badLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@heritagehotel.com', password: 'WrongPassword!' },
    });
    assert(badLoginRes.status === 401, 'Invalid password correctly rejected with 401');

    // 3. Super Admin Role Guard Tests
    console.log('\n--- 3. Role-Based Access Control (RBAC) Tests ---');
    const adminStatsWithSuper = await request('/admin/stats', { token: superAdminToken });
    assert(adminStatsWithSuper.status === 200, 'Super Admin can access /admin/stats');

    const adminStatsWithHotelAdmin = await request('/admin/stats', { token: hotelAToken });
    assert(
      adminStatsWithHotelAdmin.status === 403,
      'Hotel Admin access to /admin/stats blocked with 403 Forbidden'
    );

    // 4. Critical Tenant Isolation Tests
    console.log('\n--- 4. Mandatory Tenant Isolation Security Tests ---');

    // Hotel A Admin accesses own hotel
    const hotelAOwndata = await request(`/portal/hotels/${hotelAId}`, { token: hotelAToken });
    assert(hotelAOwndata.status === 200, 'Hotel A Admin can access own hotel record');

    // Hotel A Admin accesses Hotel B (CRITICAL TEST)
    const hotelACrossTenant = await request(`/portal/hotels/${hotelBId}`, { token: hotelAToken });
    assert(
      hotelACrossTenant.status === 403 &&
        hotelACrossTenant.data.error?.code === 'CROSS_TENANT_ACCESS_DENIED',
      'Hotel A Admin BLOCKED from accessing Hotel B record (403 CROSS_TENANT_ACCESS_DENIED)'
    );

    // Hotel B Admin accesses Hotel A (CRITICAL TEST)
    const hotelBCrossTenant = await request(`/portal/hotels/${hotelAId}`, { token: hotelBToken });
    assert(
      hotelBCrossTenant.status === 403 &&
        hotelBCrossTenant.data.error?.code === 'CROSS_TENANT_ACCESS_DENIED',
      'Hotel B Admin BLOCKED from accessing Hotel A record (403 CROSS_TENANT_ACCESS_DENIED)'
    );

    // Super Admin accesses Hotel A and Hotel B (Super Admin is exempt)
    const superAdminGetHotelA = await request(`/portal/hotels/${hotelAId}`, { token: superAdminToken });
    const superAdminGetHotelB = await request(`/portal/hotels/${hotelBId}`, { token: superAdminToken });
    assert(
      superAdminGetHotelA.status === 200 && superAdminGetHotelB.status === 200,
      'Super Admin can access both Hotel A and Hotel B records'
    );

    // Unauthenticated access
    const unauthRes = await request(`/portal/hotels/${hotelAId}`);
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with 401');

    console.log('\n===========================================');
    console.log(`🎯 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTenancyTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
