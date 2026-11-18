import mongoose from 'mongoose';
import { Property } from '../models/Property';
import { ChatSession } from '../models/ChatSession';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/ai_hotel_agent');
  console.log('Connected to MongoDB');

  const prop = await Property.findOne({ status: 'PUBLISHED' }).lean();
  console.log('Found property:', prop ? { id: prop._id, name: prop.name } : 'None');

  const count = await ChatSession.countDocuments();
  if (count === 0 && prop) {
    const testSession = new ChatSession({
      sessionId: 'sess_surveillance_demo_01',
      guestName: 'Alex Mercer (VIP Guest)',
      guestEmail: 'alex.mercer@gmail.com',
      propertyId: prop._id,
      hotelAccountId: prop.hotelAccountId,
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
      status: 'ACTIVE',
      messageCount: 2,
      lastActivityAt: new Date(),
      messages: [
        {
          role: 'user',
          content: 'What time does the breakfast buffet start, and is room service 24/7?',
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          content: 'Breakfast is served daily at the Terrace Dining Hall from 6:30 AM to 10:30 AM. Room service operates 24/7 with a late-night menu after 11:00 PM.',
          route: 'PROPERTY_INQUIRY',
          confidence: 'HIGH',
          latencyMs: 342,
          citations: [
            {
              title: 'House Dining & Service Standards',
              snippet: 'Breakfast buffet is available every morning between 06:30 and 10:30. In-room dining operates 24 hours daily.',
              tier: 'MEDIUM',
            },
          ],
          timestamp: new Date(),
        },
      ],
    });
    await testSession.save();
    console.log('Inserted demo surveillance session!');
  }

  const all = await ChatSession.find().lean();
  console.log(`Total ChatSessions in DB: ${all.length}`);
  for (const s of all) {
    console.log(`- Session: ${s.sessionId} | IP: ${s.ipAddress} | Status: ${s.status} | Msgs: ${s.messages.length}`);
  }

  await mongoose.disconnect();
  console.log('Done');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
