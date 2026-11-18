import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { env } from '../config/env';
import { HotelAccount } from '../models/HotelAccount';
import { Property } from '../models/Property';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { KnowledgeChunk } from '../models/KnowledgeChunk';
import { DocumentIngestionService } from '../services/ai/document-ingestion.service';
import { RagPipelineService } from '../services/ai/rag-pipeline.service';

const COMPREHENSIVE_HOTEL_POLICY_TEXT = `
# Grand Heritage Royal Palace & Residences - Master Policy & Operations Guide 2026

## 1. Check-in, Check-out & Scheduling Guidelines
- Standard check-in time commences at 3:00 PM.
- Early check-in between 8:00 AM and 11:00 AM incurs an early arrival surcharge of $45.00, subject to room readiness.
- Check-in before 8:00 AM requires reserving the preceding calendar night at the standard nightly rate.
- Standard check-out time is strictly 11:00 AM.
- Late check-out between 11:00 AM and 2:00 PM is billed at $25.00 per hour. Departures after 2:00 PM will be billed the full room rate.
- A mandatory pre-authorization security deposit of $250.00 is taken upon check-in via credit card or cash; holds are released within 3 to 5 business days after departure.

## 2. Cancellation Policy & Reference Codes
- Standard Flexible Policy (Code: FLEX-48H):
  - Free cancellation until 48 hours prior to 3:00 PM on the scheduled arrival date.
  - Cancellations received between 24 and 48 hours prior to arrival incur a 50% reservation penalty.
  - Cancellations under 24 hours or no-shows will be charged 100% of the entire booking total.
- Non-Refundable Rate Policy (Code: NREF-SALE):
  - Zero refunds or date adjustments permitted under any circumstances.
- Lost Baggage & Found Item Protocol (Reference: SEC-REF-902):
  - Inquiries regarding forgotten guest belongings must quote reference code SEC-REF-902 with the security dispatch office.

## 3. Wi-Fi Access & Network Credentials
- Complimentary ultra-high-speed fiber Wi-Fi is accessible throughout the hotel and gardens.
- Guest SSID: GrandHeritage_Guest_5G
- Network Passkey: Heritage@Stay2026!
- Bandwidth speed is provisioned at 100 Mbps per registered device with no device limit.

## 4. Seasonal Dates & Facility Operating Hours
- Rooftop Horizon Infinity Pool:
  - Standard operating hours: Daily from 6:00 AM to 10:00 PM.
  - Annual Winter Maintenance Closure: Closed from December 15 through January 10.
- Ramadan Dining & Iftar Schedule:
  - Effective from March 10 through April 9.
  - Iftar Buffet is served at the Grand Palm Court starting at 6:45 PM.
  - Suhoor in-room dining service is available from 3:30 AM to 5:00 AM.
- Voucher & Certificate Blackout Dates:
  - Gift certificates and promo vouchers cannot be redeemed on blackout dates: December 24 to January 2, and February 14.

## 5. Dining Services, Breakfast & Room Service
- Breakfast at the Grand Bistro:
  - Weekday breakfast hours: 6:30 AM to 10:30 AM (Monday to Friday).
  - Weekend and Holiday hours: 7:00 AM to 11:30 AM (Saturday, Sunday, and Public Holidays).
  - Price for walk-in guests: $38.50 per person (complimentary for Club and Presidential Suite guests).
- Executive Club Lounge Afternoon Tea:
  - High tea with finger sandwiches and French pastries is served daily from 2:30 PM to 4:30 PM on the 14th floor.
- 24-Hour Room Service:
  - Operational 24 hours daily. An 18% service charge plus a $6.50 delivery tray charge applies to all orders.

## 6. Surcharges, Extra Beds & Transportation Rates
- Rollaway extra bed: $55.00 per night for adults and teens.
- Baby cribs for infants under 2 years of age: Complimentary upon request (limit 1 per room).
- Overnight Valet Parking: $32.00 per vehicle per night with 24/7 unlimited in-and-out privileges.
- Airport Chauffeured Transfers:
  - BMW 5-Series Executive Sedan: $85.00 one-way.
  - Mercedes-Benz V-Class Luxury Passenger Van (up to 6 guests): $140.00 one-way.
- Mandatory Daily Resort Fee: $28.50 per room per night, plus 12.5% municipal occupancy tax.

## 7. Pet Policy & Restrictions
- Dogs and cats weighing under 15 kg are warmly welcomed exclusively in Garden Terrace Ground-Level rooms.
- A non-refundable deep-sanitization pet fee of $75.00 per stay applies.
- Maximum limit of 2 pets per room.
- Exotic animals, reptiles (including snakes and lizards), birds, and rodents are strictly prohibited on property.

## 8. Promotional Codes & Booking Discounts
- Direct Booking Promo Code: SUMMER2026 entitles the guest to a 15% discount on deluxe suites booked before July 1.
- Corporate Partner Preferred Rate Code: CORP-EXEC-88.
`;

interface TestCase {
  id: string;
  category: 'DATES' | 'PRICES' | 'CODES' | 'CONSTRAINTS' | 'COREFERENCE' | 'ANTI_HALLUCINATION';
  description: string;
  query: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expectedKeywords: string[];
  unexpectedKeywords?: string[];
  expectedConfidence?: 'HIGH' | 'MEDIUM' | 'FALLBACK';
  expectedCitationsCount?: { min: number; max: number };
}

const TEST_CASES: TestCase[] = [
  // 1. DATES & TIMEFRAMES
  {
    id: 'DATE-1',
    category: 'DATES',
    description: 'Pool winter maintenance closure dates',
    query: 'What exact dates is the rooftop infinity pool closed for winter maintenance?',
    expectedKeywords: ['december 15', 'january 10'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'DATE-2',
    category: 'DATES',
    description: 'Ramadan dining and Iftar/Suhoor schedule',
    query: 'What are the calendar dates for the Ramadan dining schedule and what time is Iftar served?',
    expectedKeywords: ['march 10', 'april 9', '6:45'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'DATE-3',
    category: 'DATES',
    description: 'Promotional voucher blackout dates',
    query: 'Can I redeem my gift certificate on New Year Eve or Christmas? What are the blackout dates?',
    expectedKeywords: ['december 24', 'january 2'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },

  // 2. TIMINGS & SCHEDULE CONSTRAINTS
  {
    id: 'TIME-1',
    category: 'DATES',
    description: 'Weekend vs weekday breakfast hours',
    query: 'What time is breakfast served on Sunday compared to Tuesday?',
    expectedKeywords: ['6:30', '10:30', '7:00', '11:30'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'TIME-2',
    category: 'CONSTRAINTS',
    description: 'Early check-in cost at 9:30 AM',
    query: 'If my flight lands early and I reach the hotel at 9:30 AM, will I be charged for early check-in and how much?',
    expectedKeywords: ['45'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },

  // 3. PRICES, RATES & PENALTIES
  {
    id: 'PRICE-1',
    category: 'PRICES',
    description: 'Rollaway bed and infant crib pricing',
    query: 'How much does an extra rollaway bed cost per night, and is there a fee for an infant baby crib?',
    expectedKeywords: ['55', 'complimentary'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'PRICE-2',
    category: 'PRICES',
    description: 'Airport luxury transfer rate by vehicle type',
    query: 'What are the airport transfer prices for a sedan versus a passenger van?',
    expectedKeywords: ['85', '140'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'PRICE-3',
    category: 'PRICES',
    description: 'Security deposit amount and refund window',
    query: 'What is the security deposit amount pre-authorized on check-in and how long does it take to get released?',
    expectedKeywords: ['250', '3', '5'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'PRICE-4',
    category: 'CONSTRAINTS',
    description: 'Cancellation 36 hours before arrival penalty',
    query: 'What is the cancellation penalty if I cancel 36 hours before check-in under the flexible policy?',
    expectedKeywords: ['50%'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },

  // 4. ALPHANUMERIC CODES & NETWORK CREDENTIALS
  {
    id: 'CODE-1',
    category: 'CODES',
    description: 'Wi-Fi SSID network name and exact password key',
    query: 'What is the guest Wi-Fi network name and password?',
    expectedKeywords: ['grandheritage_guest_5g', 'heritage@stay2026!'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'CODE-2',
    category: 'CODES',
    description: 'Summer direct promo code and suite discount',
    query: 'What is the promo code for the summer suite discount?',
    expectedKeywords: ['summer2026', '15%'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'CODE-3',
    category: 'CODES',
    description: 'Lost luggage policy reference code',
    query: 'Which reference code must I quote to security if I left my bag in the lobby?',
    expectedKeywords: ['sec-ref-902'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },

  // 5. MULTI-TURN CONVERSATIONAL COREFERENCE
  {
    id: 'COREF-1',
    category: 'COREFERENCE',
    description: 'Follow-up on pet sanitization fee and weight limit',
    query: 'Is it per day or per stay, and what is the maximum weight?',
    history: [
      { role: 'user', content: 'What is the pet policy fee?' },
      { role: 'assistant', content: 'A non-refundable pet sanitization fee of $75.00 per stay applies for pets.' },
    ],
    expectedKeywords: ['stay', '75', '15'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },
  {
    id: 'COREF-2',
    category: 'COREFERENCE',
    description: 'Follow-up on valet parking in-and-out privileges',
    query: 'Are there in-and-out privileges with that, and how much is it?',
    history: [
      { role: 'user', content: 'Do you offer parking for guests?' },
      { role: 'assistant', content: 'We offer overnight valet parking for $32.00 per vehicle per night.' },
    ],
    expectedKeywords: ['32', 'in-and-out'],
    expectedConfidence: 'HIGH',
    expectedCitationsCount: { min: 1, max: 3 },
  },

  // 6. ANTI-HALLUCINATION & RESTRICTION REFUSALS
  {
    id: 'GUARD-1',
    category: 'ANTI_HALLUCINATION',
    description: 'Prohibited exotic animals (pet snake/python)',
    query: 'Can I bring my pet python snake into my garden terrace room?',
    expectedKeywords: ['prohibited'],
    expectedConfidence: 'HIGH', // Grounded refusal
  },
  {
    id: 'GUARD-2',
    category: 'ANTI_HALLUCINATION',
    description: 'Non-existent service (Tesla Level 3 Supercharger)',
    query: 'Do you have Tesla Level 3 DC Superchargers in the underground parking garage?',
    expectedKeywords: ['not', 'front desk'],
    expectedConfidence: 'FALLBACK',
    expectedCitationsCount: { min: 0, max: 0 }, // Strict citation suppression
  },
  {
    id: 'GUARD-3',
    category: 'ANTI_HALLUCINATION',
    description: 'Non-existent payment method (Bitcoin cryptocurrency)',
    query: 'Can I pay for my room with Bitcoin or Ethereum cryptocurrency?',
    expectedKeywords: ['not', 'front desk'],
    expectedConfidence: 'FALLBACK',
    expectedCitationsCount: { min: 0, max: 0 },
  },
];

async function runDetailedRagStressTest() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       COMPREHENSIVE RAG STRESS TEST: DATES, PRICES, CODES & LOGIC          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  await mongoose.connect(env.MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  // Resolve or create test entities
  let hotel = await HotelAccount.findOne({ status: 'ACTIVE' });
  if (!hotel) {
    hotel = await HotelAccount.create({
      name: 'Grand Heritage Luxury Collection',
      slug: 'grand-heritage-stress-test',
      status: 'ACTIVE',
      contactEmail: 'contact@grandheritage.com',
      primaryAdminUserId: new mongoose.Types.ObjectId(),
    });
  }

  let property = await Property.findOne({ hotelAccountId: hotel._id });
  if (!property) {
    property = await Property.create({
      hotelAccountId: hotel._id,
      name: 'Grand Heritage Palace',
      slug: 'grand-heritage-palace-stress',
      description: 'Ultra-luxury palace property for RAG testing',
      propertyType: 'HOTEL',
      status: 'PUBLISHED',
      address: {
        street: '1 Royal Avenue',
        city: 'London',
        country: 'United Kingdom',
        postalCode: 'SW1A 1AA',
      },
    });
  }

  console.log(`🏨 Test Hotel Tenant: ${hotel.name} (${hotel._id})`);
  console.log(`🏰 Test Property: ${property.name} (${property._id})\n`);

  // Clean up any stale documents for this test property
  const staleDocs = await KnowledgeDocument.find({ propertyId: property._id });
  for (const doc of staleDocs) {
    await DocumentIngestionService.deleteDocument(doc._id.toString());
  }

  // Ingest comprehensive test policy
  console.log('📄 Ingesting comprehensive multi-condition policy document...');
  const buffer = Buffer.from(COMPREHENSIVE_HOTEL_POLICY_TEXT, 'utf-8');
  const ingestedDoc = await DocumentIngestionService.ingest({
    file: {
      buffer,
      originalname: 'Grand_Heritage_Master_Policy_2026.txt',
      mimetype: 'text/plain',
      size: buffer.length,
    },
    title: 'Grand Heritage Master Policy & Operations 2026',
    hotelAccountId: hotel._id,
    propertyId: property._id,
    uploadedBy: {
      userId: new mongoose.Types.ObjectId(),
      userRole: 'SUPER_ADMIN',
      userEmail: 'qa-stress@grandheritage.com',
    },
  });

  console.log(`✅ Ingestion Complete:`);
  console.log(`   Document ID: ${ingestedDoc._id}`);
  console.log(`   Tokens: ~${ingestedDoc.stats.totalTokens}`);
  console.log(`   Tier 1 (Large): ${ingestedDoc.stats.largeChunkCount}`);
  console.log(`   Tier 2 (Medium): ${ingestedDoc.stats.mediumChunkCount}`);
  console.log(`   Tier 3 (Small Vectors): ${ingestedDoc.stats.smallChunkCount}`);
  console.log(`   Pinecone Vectors: ${ingestedDoc.stats.vectorCount}\n`);

  // Run all test cases
  let passedCount = 0;
  let failedCount = 0;
  const resultsSummary: Array<{ id: string; category: string; passed: boolean; latency: number; reason?: string }> = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`──────────────────────────────────────────────────────────────────────────────`);
    console.log(`[TEST ${i + 1}/${TEST_CASES.length}] ${tc.id} (${tc.category}): ${tc.description}`);
    console.log(`Query: "${tc.query}"`);
    if (tc.history && tc.history.length > 0) {
      console.log(`History: [${tc.history.length} turns in context]`);
    }

    const startTime = Date.now();
    try {
      const response = await RagPipelineService.ask({
        query: tc.query,
        hotelAccountId: hotel._id.toString(),
        propertyId: property._id.toString(),
        propertyName: property.name,
        history: tc.history || [],
      });
      const duration = Date.now() - startTime;

      console.log(`   Response Route: ${response.route} | Confidence: ${response.confidence} | Latency: ${duration}ms`);
      console.log(`   Answer Preview: ${response.answer.slice(0, 160)}...`);
      console.log(`   Citations Attached: ${response.citations.length}`);
      response.citations.forEach((c, cIdx) => {
        console.log(`     (${cIdx + 1}) [${c.tier}] "${c.snippet.slice(0, 70)}..."`);
      });

      // Verification Checks
      const answerLower = response.answer.toLowerCase();
      const failures: string[] = [];

      // Keyword check
      for (const kw of tc.expectedKeywords) {
        if (!answerLower.includes(kw.toLowerCase())) {
          failures.push(`Missing expected keyword/phrase: "${kw}"`);
        }
      }

      // Unexpected keyword check
      if (tc.unexpectedKeywords) {
        for (const uk of tc.unexpectedKeywords) {
          if (answerLower.includes(uk.toLowerCase())) {
            failures.push(`Contains prohibited keyword: "${uk}"`);
          }
        }
      }

      // Confidence check
      if (tc.expectedConfidence && response.confidence !== tc.expectedConfidence) {
        failures.push(`Expected confidence ${tc.expectedConfidence}, got ${response.confidence}`);
      }

      // Citations count check
      if (tc.expectedCitationsCount) {
        if (response.citations.length < tc.expectedCitationsCount.min || response.citations.length > tc.expectedCitationsCount.max) {
          failures.push(
            `Expected between ${tc.expectedCitationsCount.min} and ${tc.expectedCitationsCount.max} citations, got ${response.citations.length}`
          );
        }
      }

      if (failures.length === 0) {
        console.log(`   >>> RESULT: ✅ PASSED`);
        passedCount++;
        resultsSummary.push({ id: tc.id, category: tc.category, passed: true, latency: duration });
      } else {
        console.log(`   >>> RESULT: ❌ FAILED`);
        failures.forEach((f) => console.log(`       - ${f}`));
        failedCount++;
        resultsSummary.push({ id: tc.id, category: tc.category, passed: false, latency: duration, reason: failures.join('; ') });
      }
    } catch (err: any) {
      console.log(`   >>> RESULT: 💥 EXCEPTION: ${err.message}`);
      failedCount++;
      resultsSummary.push({ id: tc.id, category: tc.category, passed: false, latency: Date.now() - startTime, reason: err.message });
    }
  }

  // Cleanup test documents
  console.log(`\n──────────────────────────────────────────────────────────────────────────────`);
  console.log(`🧹 Cleaning up test document from MongoDB and Pinecone...`);
  await DocumentIngestionService.deleteDocument(ingestedDoc._id.toString());
  const remainingChunks = await KnowledgeChunk.countDocuments({ documentId: ingestedDoc._id });
  console.log(`✅ Cleanup verified: ${remainingChunks} chunks remaining in MongoDB.\n`);

  // Final Summary Table
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      FINAL RAG RETRIEVAL TEST SCORECARD                    ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Tests Run:      ${TEST_CASES.length.toString().padEnd(52)}║`);
  console.log(`║ Passed:               ${passedCount.toString().padEnd(52)}║`);
  console.log(`║ Failed:               ${failedCount.toString().padEnd(52)}║`);
  console.log(`║ Success Rate:         ${((passedCount / TEST_CASES.length) * 100).toFixed(1)}%${''.padEnd(47)}║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  console.log('Category Breakdown:');
  const categories = ['DATES', 'PRICES', 'CODES', 'CONSTRAINTS', 'COREFERENCE', 'ANTI_HALLUCINATION'];
  for (const cat of categories) {
    const inCat = resultsSummary.filter((r) => r.category === cat);
    const catPassed = inCat.filter((r) => r.passed).length;
    const avgLatency = inCat.length > 0 ? (inCat.reduce((acc, r) => acc + r.latency, 0) / inCat.length).toFixed(0) : '0';
    console.log(`  • ${cat.padEnd(20)}: ${catPassed}/${inCat.length} passed (avg latency: ${avgLatency}ms)`);
  }

  await mongoose.disconnect();

  if (failedCount > 0) {
    console.error(`\n❌ Test suite completed with ${failedCount} failure(s).`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL RAG RETRIEVAL & GROUNDING TESTS PASSED WITH 100% SUCCESS!`);
    process.exit(0);
  }
}

runDetailedRagStressTest().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
