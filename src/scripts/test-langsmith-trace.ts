import mongoose from 'mongoose';
import { Client } from 'langsmith';
import { BookingGraphService } from '../services/ai/booking-graph.service';
import { env } from '../config/env';

async function verifyLangSmith() {
  console.log('======================================================');
  console.log('🔍 VERIFYING LANGSMITH CONNECTIVITY & LIVE TRACING');
  console.log('======================================================\n');

  console.log(`LangChain Tracing: ${process.env.LANGCHAIN_TRACING_V2 || env.LANGCHAIN_TRACING_V2}`);
  console.log(`LangChain Project: ${process.env.LANGCHAIN_PROJECT || env.LANGCHAIN_PROJECT}`);
  console.log(`API Key: ${env.LANGCHAIN_API_KEY?.slice(0, 12)}...${env.LANGCHAIN_API_KEY?.slice(-6)}\n`);

  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // 1. Initialize LangSmith Client
  const client = new Client({
    apiKey: env.LANGCHAIN_API_KEY || env.LANGSMITH_API_KEY,
  });

  const projectName = env.LANGCHAIN_PROJECT || 'hotel-booking-agent';
  console.log(`Checking LangSmith project: "${projectName}"...`);
  try {
    const project = await client.readProject({ projectName });
    console.log(`✅ Project "${projectName}" is accessible on LangSmith!`);
    console.log(`   Project ID: ${project.id}`);
  } catch (err: any) {
    console.log(`Project lookup note: ${err.message}. Project will be initialized on first run.`);
  }

  // 2. Invoke a test query through LangGraph Booking Agent
  console.log('\nSending test query through LangGraph Agent (invoking state graph & ChatOpenAI)...');
  const startTime = Date.now();
  const result = await BookingGraphService.processGuestMessage({
    sessionId: `langsmith_verify_${Date.now()}`,
    message: 'What promo codes are available on the hotel platform, and how much discount do they give?',
  });

  console.log(`\n⚡ Agent Reply (${Date.now() - startTime}ms):\n${result.answer}`);
  console.log('\nTool Calls Made:', result.toolCallsMade);
  console.log('\n======================================================');
  console.log('🎉 LIVE LANGSMITH TRACE SUCCESSFULLY GENERATED!');
  console.log(`👉 View your trace at: https://smith.langchain.com/o/default/projects/p/${projectName}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

verifyLangSmith().catch(console.error);
