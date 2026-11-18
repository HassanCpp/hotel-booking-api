import dotenv from 'dotenv';
import path from 'path';

// Load backend .env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

async function testIntegrations() {
  console.log('========================================================');
  console.log('Testing Phase 8 AI Integrations (OpenAI & Pinecone)');
  console.log('========================================================\n');

  const openaiKey = process.env.OPENAI_API_KEY;
  const pineconeKey = process.env.PINECONE_API_KEY;
  const pineconeIndex = process.env.PINECONE_INDEX_NAME || 'hotel-knowledge';

  let hasError = false;

  // 1. Check Environment Variables
  console.log('1. Checking Environment Variables...');
  if (!openaiKey || openaiKey.includes('your-openai-api-key') || openaiKey.trim() === '') {
    console.error('❌ Missing or invalid OPENAI_API_KEY in backend/.env');
    hasError = true;
  } else {
    console.log(`✅ OPENAI_API_KEY found (starts with: ${openaiKey.substring(0, 7)}...)`);
  }

  if (!pineconeKey || pineconeKey.includes('your-pinecone-api-key') || pineconeKey.trim() === '') {
    console.error('❌ Missing or invalid PINECONE_API_KEY in backend/.env');
    hasError = true;
  } else {
    console.log(`✅ PINECONE_API_KEY found (starts with: ${pineconeKey.substring(0, 8)}...)`);
  }

  console.log(`✅ PINECONE_INDEX_NAME: "${pineconeIndex}"`);

  if (hasError) {
    console.log('\n⚠️ Please add your actual API keys to backend/.env and rerun this script.');
    process.exit(1);
  }

  // 2. Test OpenAI API Connection & Embedding
  console.log('\n2. Testing OpenAI API & Embedding Generation...');
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Serena Islamabad Hotel Deluxe Suite check-in at 2:00 PM.',
      dimensions: 1536,
    });

    const vector = embeddingResponse.data[0].embedding;
    console.log(`✅ OpenAI Embedding Successful! Generated vector with ${vector.length} dimensions.`);
  } catch (err: any) {
    console.error('❌ OpenAI API Connection Failed:', err.message || err);
    hasError = true;
  }

  // 3. Test Pinecone Connection & Index
  console.log('\n3. Testing Pinecone Client & Index Connection...');
  try {
    const pc = new Pinecone({ apiKey: pineconeKey! });
    const indexList = await pc.listIndexes();
    const existingIndexNames = (indexList.indexes || []).map((idx) => idx.name);

    console.log(`ℹ️ Available Pinecone Indexes: ${existingIndexNames.length > 0 ? existingIndexNames.join(', ') : 'None'}`);

    if (!existingIndexNames.includes(pineconeIndex)) {
      console.error(`❌ Index "${pineconeIndex}" not found in your Pinecone account.`);
      console.log(`   Please create an index named "${pineconeIndex}" in Pinecone console with 1536 dimensions.`);
      hasError = true;
    } else {
      const indexTarget = indexList.indexes?.find((idx) => idx.name === pineconeIndex);
      console.log(`✅ Found Pinecone Index: "${pineconeIndex}"`);
      console.log(`   Dimensions: ${indexTarget?.dimension} (Expected: 1536)`);
      console.log(`   Metric: ${indexTarget?.metric} (Expected: cosine)`);
      console.log(`   Status: ${indexTarget?.status?.state || 'Ready'}`);

      if (indexTarget?.dimension !== 1536) {
        console.warn(`⚠️ Warning: Index dimension is ${indexTarget?.dimension}, but text-embedding-3-small uses 1536.`);
      }

      // Check index stats
      const index = pc.index(pineconeIndex);
      const stats = await index.describeIndexStats();
      console.log(`✅ Connected to index successfully! Current record count: ${stats.totalRecordCount || 0}`);
    }
  } catch (err: any) {
    console.error('❌ Pinecone Connection Failed:', err.message || err);
    hasError = true;
  }

  console.log('\n========================================================');
  if (hasError) {
    console.log('❌ Integration test finished with errors.');
    process.exit(1);
  } else {
    console.log('🎉 ALL INTEGRATIONS VERIFIED! Ready for Phase 8 RAG Implementation.');
    console.log('========================================================');
    process.exit(0);
  }
}

testIntegrations();
