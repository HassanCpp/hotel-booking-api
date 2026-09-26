import mongoose from 'mongoose';
import http from 'http';
import app from '../app';
import { connectDB } from '../config/database';
import { HotelAccount } from '../models/HotelAccount';
import { User } from '../models/User';
import { HotelMembership } from '../models/HotelMembership';
import { ActivityLog } from '../models/ActivityLog';

let server: http.Server;
let baseUrl: string;

async function request(path: string, options: RequestInit = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runEnhancementTests() {
  console.log('🧪 Starting Phase A Enhancement Automated Test Suite...\n');

  await connectDB();

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://localhost:${port}/api/v1`;
      console.log(`📡 Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  let superAdminToken = '';
  let hotelAdminToken = '';
  let hotelId = '';
  const testTimestamp = Date.now();
  const testAdminEmail = `test_enhancement_${testTimestamp}@testsuite.com`;

  try {
    // 1. Super Admin Login
    console.log('--- 1. Super Admin Login ---');
    const saRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@hotelagent.com',
        password: 'Admin123!',
      }),
    });
    if (saRes.status !== 200) throw new Error('Super Admin login failed');
    superAdminToken = saRes.data.data.accessToken;
    console.log('  ✅ PASS: Super Admin authenticated successfully');

    // 2. Fetch Stats & Check Enriched Metrics
    console.log('\n--- 2. Enriched Stats & Platform Metrics ---');
    const statsRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (statsRes.status !== 200) throw new Error('Stats endpoint failed');
    console.log('  ✅ PASS: Stats returns 200 OK');
    console.log('     Hotels:', statsRes.data.data.totalHotels, `(${statsRes.data.data.activeHotels} active)`);
    console.log('     Properties:', statsRes.data.data.totalProperties, `(${statsRes.data.data.publishedProperties} published)`);
    console.log('     Room types:', statsRes.data.data.totalRoomTypes);

    // 3. Create an Isolated Test Hotel (Does not touch user's real hotels)
    console.log('\n--- 3. Isolated Test Hotel Creation ---');
    const onboardRes = await request('/admin/hotels', {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        name: `Automated Test Hotel ${testTimestamp}`,
        contactEmail: `contact_${testTimestamp}@testsuite.com`,
        country: 'Pakistan',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        adminFullName: 'Temporary Test Admin',
        adminEmail: testAdminEmail,
        adminPassword: 'InitialPassword123!',
      }),
    });
    if (onboardRes.status !== 201) throw new Error(`Failed to create test hotel: ${JSON.stringify(onboardRes.data)}`);
    hotelId = onboardRes.data.data?.hotel?.id || onboardRes.data.data?.hotel?._id;
    console.log(`  ✅ PASS: Created isolated test hotel (ID: ${hotelId})`);

    // 4. Super Admin Resets Hotel Admin Password
    console.log('\n--- 4. Super Admin Password Reset ---');
    const resetRes = await request(`/admin/hotels/${hotelId}/admin-password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({ newPassword: 'NewPassword123!' }),
    });
    if (resetRes.status !== 200) throw new Error(`Password reset failed: ${JSON.stringify(resetRes.data)}`);
    console.log('  ✅ PASS: Super Admin reset hotel admin password (200 OK)');

    // Verify login with new password
    const newLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdminEmail,
        password: 'NewPassword123!',
      }),
    });
    if (newLoginRes.status !== 200) throw new Error('Login with new reset password failed');
    hotelAdminToken = newLoginRes.data.data.accessToken;
    console.log('  ✅ PASS: Hotel Admin successfully authenticated with new reset password');

    // 5. Hotel Admin Profile Update
    console.log('\n--- 5. Hotel Admin Profile Self-Update ---');
    const updateProfileRes = await request('/portal/hotel/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${hotelAdminToken}` },
      body: JSON.stringify({
        name: `Automated Test Hotel Renamed`,
        contactPhone: '+92 300 9999999',
      }),
    });
    if (updateProfileRes.status !== 200) throw new Error(`Profile update failed: ${JSON.stringify(updateProfileRes.data)}`);
    console.log('  ✅ PASS: Hotel Admin updated hotel profile (200 OK)');

    // 6. Hotel Admin Self-Password Change
    console.log('\n--- 6. Hotel Admin Self-Password Change ---');
    const changePwRes = await request('/portal/account/password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hotelAdminToken}` },
      body: JSON.stringify({
        currentPassword: 'NewPassword123!',
        newPassword: 'FinalPassword123!',
      }),
    });
    if (changePwRes.status !== 200) throw new Error(`Self password change failed: ${JSON.stringify(changePwRes.data)}`);
    console.log('  ✅ PASS: Hotel Admin changed own password (200 OK)');

    // Verify login with updated password
    const restoredLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdminEmail,
        password: 'FinalPassword123!',
      }),
    });
    if (restoredLoginRes.status !== 200) throw new Error('Login with final password failed');
    console.log('  ✅ PASS: Verified login with updated password');

    // 7. Activity Log Verification
    console.log('\n--- 7. Activity Log Verification ---');
    const activityRes = await request(`/admin/hotels/${hotelId}/activity`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    if (activityRes.status !== 200) throw new Error('Activity endpoint failed');
    const activities = activityRes.data.data.activities || activityRes.data.data.activity || [];
    console.log(`  ✅ PASS: Retrieved ${activities.length} activity records for hotel`);
    const actions = activities.map((a: any) => a.action);
    console.log('     Recent actions logged:', actions.slice(0, 5).join(', '));

    // 8. Super Admin Updates Primary Administrator Profile
    console.log('\n--- 8. Super Admin Updates Primary Admin Profile ---');
    const updateAdminRes = await request(`/admin/hotels/${hotelId}/admin-profile`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${superAdminToken}` },
      body: JSON.stringify({
        fullName: 'Final Test Admin Name',
        status: 'ACTIVE',
      }),
    });
    if (updateAdminRes.status !== 200) throw new Error(`Admin profile update failed: ${JSON.stringify(updateAdminRes.data)}`);
    console.log('  ✅ PASS: Super Admin updated primary admin full name & status (200 OK)');

    // 9. Hotel Admin Image Upload
    console.log('\n--- 9. Image Upload Pipeline ---');
    const formData = new FormData();
    const fakeImageBlob = new Blob(['fake-image-content-bytes'], { type: 'image/png' });
    formData.append('file', fakeImageBlob, 'test-suite-photo.png');

    const uploadRes = await fetch(`${baseUrl}/portal/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hotelAdminToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (uploadRes.status !== 200) throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
    console.log(`  ✅ PASS: Image uploaded successfully -> ${uploadData.data.url}`);

    console.log('\n===========================================');
    console.log('🎯 ALL PHASE A ENHANCEMENT TESTS PASSED!');
    console.log('===========================================\n');
  } finally {
    // Clean up the isolated test hotel and users so test is 100% idempotent
    if (hotelId) {
      await HotelAccount.findByIdAndDelete(hotelId);
      await User.deleteMany({ email: { $regex: /test_enhancement_/ } });
      await HotelMembership.deleteMany({ hotelAccountId: hotelId });
      await ActivityLog.deleteMany({ tenantId: hotelId });
      console.log('🧹 Cleaned up temporary test hotel and data.');
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await mongoose.disconnect();
    console.log('⚠️ MongoDB disconnected.');
  }
}

runEnhancementTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
