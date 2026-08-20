// Quick raw check - bypass Mongoose model to confirm what's in MongoDB
'use strict';
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');

async function check() {
  await connectDB();
  const db = mongoose.connection.db;
  const tracks = await db.collection('tracks').find({}, { projection: { name: 1, tier: 1, slug: 1 } }).toArray();
  console.log('Raw MongoDB tracks.tier:');
  for (const t of tracks) {
    console.log(`  "${t.name}" [${t.slug}] → tier in MongoDB: ${JSON.stringify(t.tier)}`);
  }
  await mongoose.disconnect();
}
check().catch(console.error);
