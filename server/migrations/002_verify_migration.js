/**
 * READ-ONLY verification script:
 * 1. Confirm Track.tier is now properly set post-migration
 * 2. Inspect existing Certificate documents for their tier values
 * 3. Report any legacy tier values (L1_CORE, L2_ADVANCED) on existing certs
 */
'use strict';

const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Track = require('../models/Track');
const Certificate = require('../models/Certificate');

async function verify() {
  await connectDB();
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  POST-MIGRATION VERIFICATION');
  console.log('══════════════════════════════════════════════════════\n');

  // 1. Track.tier
  const tracks = await Track.find({}).select('name title tier slug').lean();
  console.log('Track.tier values after migration:');
  console.log('───────────────────────────────────────────────────');
  for (const t of tracks) {
    console.log(`  "${t.name || t.title}" [${t.slug}] → tier: ${t.tier || '(undefined — schema may not have loaded yet)'}`);
  }
  console.log();

  // 2. Certificate tier values
  const certs = await Certificate.find({}).select('certificate_id tier track_id status').lean();
  console.log(`Certificate documents found: ${certs.length}`);
  if (certs.length === 0) {
    console.log('  (No certificates exist yet.)');
  } else {
    const tierGroups = {};
    for (const c of certs) {
      const t = c.tier || 'null';
      if (!tierGroups[t]) tierGroups[t] = [];
      tierGroups[t].push(c.certificate_id);
    }
    console.log('\n  Tier distribution in existing Certificate documents:');
    for (const [tier, ids] of Object.entries(tierGroups)) {
      const isLegacy = ['L1_CORE', 'L2_ADVANCED'].includes(tier);
      console.log(`  ${isLegacy ? '⚠ LEGACY' : '✅ NEW   '} tier="${tier}" — ${ids.length} cert(s): ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);
    }

    const legacyCount = certs.filter(c => ['L1_CORE', 'L2_ADVANCED'].includes(c.tier)).length;
    if (legacyCount > 0) {
      console.log(`\n  ⚠  ${legacyCount} certificate(s) still carry legacy tier values.`);
      console.log('  DECISION REQUIRED: Normalize existing cert.tier values, or retain for historical accuracy?');
    } else {
      console.log('\n  ✅  All certificates carry new normalized tier values (EDGE / CORE).');
    }
  }

  console.log();
  await mongoose.disconnect();
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
