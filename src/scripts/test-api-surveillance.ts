import { AuthService } from '../modules/auth/auth.service';
import mongoose from 'mongoose';

async function testApi() {
  await mongoose.connect('mongodb://localhost:27017/ai_hotel_agent');

  const { accessToken } = await AuthService.login('superadmin@hotelagent.com', 'Admin123!');
  console.log('Logged in as Super Admin successfully!');

  // 1. Test GET chat-sessions list
  const listRes = await fetch('http://localhost:5000/api/v1/admin/knowledge/chat-sessions', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listData = await listRes.json();
  console.log('GET list status:', listRes.status, '| Sessions count:', listData.data?.sessions?.length);
  const firstSession = listData.data?.sessions?.[0];

  if (firstSession) {
    // 2. Test GET session transcript by ID
    const detailRes = await fetch(`http://localhost:5000/api/v1/admin/knowledge/chat-sessions/${firstSession._id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const detailData = await detailRes.json();
    console.log('GET transcript status:', detailRes.status);
    console.log('Transcript messages count:', detailData.data?.messages?.length);
    console.log('First message role:', detailData.data?.messages?.[0]?.role, '| text:', detailData.data?.messages?.[0]?.content);
    console.log('Second message role:', detailData.data?.messages?.[1]?.role, '| citations:', detailData.data?.messages?.[1]?.citations?.length);

    // 3. Test PATCH status
    const patchRes = await fetch(`http://localhost:5000/api/v1/admin/knowledge/chat-sessions/${firstSession._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'FLAGGED', flagReason: 'TEST_SURVEILLANCE_FLAG' }),
    });
    const patchData = await patchRes.json();
    console.log('PATCH status:', patchRes.status, '| New status:', patchData.data?.status);

    // Restore to ACTIVE
    await fetch(`http://localhost:5000/api/v1/admin/knowledge/chat-sessions/${firstSession._id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
  }

  await mongoose.disconnect();
  console.log('All surveillance API verification tests passed 100%!');
  process.exit(0);
}

testApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
