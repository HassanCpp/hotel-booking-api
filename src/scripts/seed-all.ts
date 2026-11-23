import { spawnSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

console.log('========================================================================');
console.log('🏨 MASTER SEED PIPELINE: INITIALIZING FULL PLATFORM DATA & KNOWLEDGE');
console.log('========================================================================\n');

const scripts = [
  { name: '1. Base Database & Super Admin Seed', file: 'src/scripts/seed.ts' },
  { name: '2. Expanded 20 Domestic & International Properties', file: 'src/scripts/seed-expanded-properties.ts' },
  { name: '3. Featured Destinations & Marketplace Curation', file: 'src/scripts/seed-curation.ts' },
  { name: '4. Comprehensive Knowledge Base & Pinecone Vector Embeddings', file: 'src/scripts/seed-comprehensive-knowledge.ts' },
];

const backendRoot = path.resolve(__dirname, '../../');

for (const step of scripts) {
  console.log(`\n>>> EXECUTING: ${step.name} (${step.file})`);
  console.log('------------------------------------------------------------------------');
  
  const result = spawnSync('npx', ['tsx', step.file], {
    cwd: backendRoot,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n❌ Step failed with exit code ${result.status}: ${step.name}`);
    process.exit(result.status || 1);
  }
}

console.log('\n========================================================================');
console.log('🎉 MASTER SEEDING PIPELINE COMPLETED SUCCESSFULLY!');
console.log('All users, hotel accounts, 20 properties, inventory, policies, and');
console.log('vectorized knowledge manuals are fully populated in MongoDB & Pinecone.');
console.log('========================================================================\n');
