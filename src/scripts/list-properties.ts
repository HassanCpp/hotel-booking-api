import mongoose from 'mongoose';
import { Property } from '../models/Property';
import { HotelAccount } from '../models/HotelAccount';
import { User } from '../models/User';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { env } from '../config/env';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB');

  const hotels = await HotelAccount.find({}).lean();
  console.log(`\n=== HOTELS (${hotels.length}) ===`);
  for (const h of hotels) {
    console.log(`- Hotel: ${h.name} | ID: ${h._id} | Slug: ${h.slug} | Status: ${h.status}`);
  }

  const properties = await Property.find({}).lean();
  console.log(`\n=== PROPERTIES (${properties.length}) ===`);
  for (const p of properties) {
    console.log(`- Property: "${p.name}" | ID: ${p._id} | Slug: ${p.slug} | City: ${p.address?.city} | Status: ${p.status} | HotelId: ${p.hotelAccountId}`);
  }

  const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' }).lean();
  console.log(`\n=== SUPER ADMIN ===`);
  console.log(`User ID: ${superAdmin?._id} | Email: ${superAdmin?.email}`);

  const existingDocs = await KnowledgeDocument.find({}).lean();
  console.log(`\n=== EXISTING KNOWLEDGE DOCUMENTS (${existingDocs.length}) ===`);
  for (const d of existingDocs) {
    console.log(`- Doc: "${d.title}" | ID: ${d._id} | PropertyId: ${d.propertyId} | IsGlobal: ${!d.propertyId} | Status: ${d.status}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
