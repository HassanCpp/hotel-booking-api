import mongoose from 'mongoose';
import { Property } from '../models/Property';
import { RagPipelineService } from '../services/ai/rag-pipeline.service';
import { env } from '../config/env';

interface BenchmarkCase {
  category: 'GLOBAL_POLICY' | 'PROPERTY_SPECIFIC' | 'CROSS_PROPERTY_COMPARISON';
  propertySlug?: string;
  query: string;
  expectedKeywords: string[];
}

const BENCHMARK_CASES: BenchmarkCase[] = [
  // 1. Super Admin Global Policies
  {
    category: 'GLOBAL_POLICY',
    query: 'What is the platform cancellation policy if I cancel 30 hours before check-in, and what happens if I cancel 50 hours before?',
    expectedKeywords: ['48', '50%', '100%', 'refund', 'penalty'],
  },
  {
    category: 'GLOBAL_POLICY',
    query: 'What promo codes are available on the platform, what discount do they give, and are there minimum night requirements?',
    expectedKeywords: ['SUMMER2026', '15%', 'WINTERLUXE2026', '20%'],
  },
  {
    category: 'GLOBAL_POLICY',
    query: 'What identification documents do Pakistani citizens and foreign international guests need to present at check-in?',
    expectedKeywords: ['CNIC', 'Passport', 'visa'],
  },

  // 2. Property Specific Deep Facts
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'milli-dorms',
    query: 'What is the Wi-Fi network SSID and password at Milli Dorms, and what time are quiet hours?',
    expectedKeywords: ['MilliDorms_FiberHighSpeed', 'MilliPod2026!', '23:00'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'milli-resort',
    query: 'What is the pet policy at Milli Resort? What is the nightly pet fee and deposit amount?',
    expectedKeywords: ['PKR 3,500', '10,000', '20kg'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'grand-heritage-mall-road',
    query: 'Tell me about High Tea at The Grand Heritage Mall Road. What time is it served and what is the price?',
    expectedKeywords: ['High Tea', '16:00', '18:30', '2,850'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'shinjuku-zen-modern-ryokan',
    query: 'What are the onsen bathing rules, hours, and tattoo policy at Shinjuku Zen Ryokan?',
    expectedKeywords: ['onsen', 'tattoo', 'hinoki', 'tatami'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'skardu-celestial-stargazing-resort',
    query: 'What kind of telescope does the Skardu Celestial observatory have, and when are the guided stargazing sessions?',
    expectedKeywords: ['telescope', 'Meade', '21:00', '23:30'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'burj-vista-sky-penthouse',
    query: 'What chauffeur cars and airport transfers are available at Burj Vista Sky Penthouse in Dubai and what do they cost?',
    expectedKeywords: ['Rolls-Royce', 'AED 1,200', 'Maybach'],
  },
  {
    category: 'PROPERTY_SPECIFIC',
    propertySlug: 'hunza-serai-mountain-glamping',
    query: 'How is heating provided in the geodesic domes at Hunza Serai, and what kind of internet do they have?',
    expectedKeywords: ['Starlink', 'Bukhari', 'apricot wood'],
  },
];

async function runBenchmark() {
  console.log('Connecting to MongoDB for Retrieval Benchmark...');
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected.\n');

  console.log('========================================================================');
  console.log('STARTING RAG RETRIEVAL & GROUNDING QUALITY BENCHMARK (10 EVAL CASES)');
  console.log('========================================================================\n');

  let passed = 0;
  let total = BENCHMARK_CASES.length;

  for (let i = 0; i < total; i++) {
    const testCase = BENCHMARK_CASES[i];
    console.log(`[Test ${i + 1}/${total}] [${testCase.category}]`);
    console.log(`Query: "${testCase.query}"`);

    let targetProp = null;
    if (testCase.propertySlug) {
      targetProp = await Property.findOne({ slug: testCase.propertySlug }).lean();
      if (!targetProp) {
        console.error(`Property with slug "${testCase.propertySlug}" not found!`);
      } else {
        console.log(`Property Context: ${targetProp.name} (ID: ${targetProp._id})`);
      }
    } else {
      console.log(`Property Context: Platform Wide Master`);
    }

    const startTime = Date.now();
    try {
      const result = await RagPipelineService.ask({
        query: testCase.query,
        propertyId: targetProp ? targetProp._id.toString() : undefined,
        hotelAccountId: targetProp?.hotelAccountId ? targetProp.hotelAccountId.toString() : undefined,
        propertyName: targetProp ? targetProp.name : 'All Marketplace Stays',
      });
      const latency = Date.now() - startTime;

      console.log(`Answer:\n${result.answer}`);
      console.log(`Confidence: ${result.confidence} | Citations: ${result.citations.length} | Latency: ${latency}ms`);

      // Check keywords
      const lowerAnswer = result.answer.toLowerCase();
      const matchedKeywords = testCase.expectedKeywords.filter((kw) =>
        lowerAnswer.includes(kw.toLowerCase())
      );
      const matchScore = (matchedKeywords.length / testCase.expectedKeywords.length) * 100;

      console.log(`Keyword Match: ${matchedKeywords.length}/${testCase.expectedKeywords.length} (${matchedKeywords.join(', ')})`);

      if (matchedKeywords.length > 0 && result.confidence !== 'FALLBACK') {
        console.log(`Result: PASS \u2705\n`);
        passed++;
      } else {
        console.log(`Result: FAIL \u274c\n`);
      }
    } catch (err: any) {
      console.error(`ERROR running test case:`, err.message || err);
      console.log(`Result: FAIL \u274c\n`);
    }
  }

  console.log('========================================================================');
  console.log(`BENCHMARK SUMMARY: ${passed}/${total} (${Math.round((passed / total) * 100)}%) TESTS PASSED`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
