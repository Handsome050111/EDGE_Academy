/**
 * READ-ONLY INVESTIGATION SCRIPT
 * Purpose: Audit Module.tier distribution across Tracks in the live database
 * to detect conflicts before any tier architecture migration.
 *
 * SAFETY: No writes, no updates, no schema changes. Pure find() / aggregate() queries.
 */

'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// dotenvx auto-discovers .env from process.cwd() (server/) when run via: node tests/scratch/tierAuditReadOnly.js
dotenv.config();

// Use connectDB which sets DNS servers (8.8.8.8, 1.1.1.1) required for Atlas SRV on Windows
const connectDB = require('../../config/db');
const trackSchema = new mongoose.Schema({}, { strict: false });
const moduleSchema = new mongoose.Schema({}, { strict: false });
const userSchema = new mongoose.Schema({}, { strict: false });

const Track = mongoose.model('Track', trackSchema);
const Module = mongoose.model('Module', moduleSchema);
const User = mongoose.model('User', userSchema);

async function run() {
  await connectDB();

  const host = mongoose.connection.host;
  console.log(`\nConnected to MongoDB host: ${host}\n`);

  // ── 1. Fetch all tracks ──────────────────────────────────────────────────────
  const tracks = await Track.find({}).lean();
  console.log(`Total tracks found: ${tracks.length}\n`);

  if (tracks.length === 0) {
    console.log('No tracks in database. Stopping.');
    await mongoose.disconnect();
    return;
  }

  // ── 2. Fetch all non-deleted modules with their track_id and tier ─────────────
  const modules = await Module.find(
    { deleted_at: null },
    { _id: 1, title: 1, track_id: 1, trackId: 1, tier: 1, status: 1 }
  ).lean();

  console.log(`Total non-deleted modules found: ${modules.length}\n`);

  // ── 3. Group modules by track_id ──────────────────────────────────────────────
  const modulesByTrack = {};
  for (const mod of modules) {
    const tId = (mod.track_id || mod.trackId)?.toString();
    if (!tId) continue;
    if (!modulesByTrack[tId]) modulesByTrack[tId] = [];
    modulesByTrack[tId].push(mod);
  }

  // ── 4. Build report ───────────────────────────────────────────────────────────
  const COLUMN = {
    name: 42,
    id: 26,
    tiers: 36,
    count: 7,
    conflict: 9,
  };

  const pad = (s, n) => String(s ?? '').substring(0, n).padEnd(n);
  const hr = '─'.repeat(COLUMN.name + COLUMN.id + COLUMN.tiers + COLUMN.count + COLUMN.conflict + 8);

  console.log(hr);
  console.log(
    pad('Track Name', COLUMN.name) + ' | ' +
    pad('Track ID', COLUMN.id) + ' | ' +
    pad('Distinct Tiers', COLUMN.tiers) + ' | ' +
    pad('#Mods', COLUMN.count) + ' | ' +
    pad('Conflict', COLUMN.conflict)
  );
  console.log(hr);

  const conflicts = [];
  const noTierTracks = [];
  const trackResults = [];

  for (const track of tracks) {
    const tId = track._id.toString();
    const mods = modulesByTrack[tId] || [];
    const tierValues = [...new Set(mods.map(m => m.tier).filter(Boolean))];
    const allNull = mods.length > 0 && tierValues.length === 0;

    const isConflict = tierValues.length > 1;
    const hasNoTier = tierValues.length === 0;

    trackResults.push({
      track,
      mods,
      tierValues,
      isConflict,
      hasNoTier,
    });

    if (isConflict) conflicts.push({ track, mods, tierValues });
    if (hasNoTier) noTierTracks.push({ track, mods });

    console.log(
      pad(track.title || track.name || '(untitled)', COLUMN.name) + ' | ' +
      pad(tId, COLUMN.id) + ' | ' +
      pad(tierValues.length === 0 ? '(none set)' : tierValues.join(', '), COLUMN.tiers) + ' | ' +
      pad(mods.length, COLUMN.count) + ' | ' +
      pad(isConflict ? '⚠ YES' : 'No', COLUMN.conflict)
    );
  }

  console.log(hr);

  // ── 5. Conflict detail ────────────────────────────────────────────────────────
  if (conflicts.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`⚠  CONFLICTED TRACKS — Module-level tier breakdown`);
    console.log('═'.repeat(80));

    for (const { track, mods, tierValues } of conflicts) {
      console.log(`\nTrack: "${track.title || track.name}"  (${track._id})`);
      console.log(`  Distinct tier values found: ${tierValues.join(', ')}`);
      console.log(`  Modules (${mods.length}):`);
      const modHr = '  ' + '─'.repeat(74);
      console.log(modHr);
      const mPad = (s, n) => String(s ?? '').substring(0, n).padEnd(n);
      console.log(
        '  ' +
        mPad('Module Title', 48) + ' | ' +
        mPad('Tier', 16) + ' | ' +
        mPad('Status', 10)
      );
      console.log(modHr);
      for (const m of mods) {
        console.log(
          '  ' +
          mPad(m.title, 48) + ' | ' +
          mPad(m.tier ?? '(null)', 16) + ' | ' +
          mPad(m.status, 10)
        );
      }
      console.log(modHr);
    }
  } else {
    console.log('\n✅  No conflicted tracks found — all tracks have at most 1 distinct tier value across their modules.');
  }

  // ── 6. Tracks with zero tier set ──────────────────────────────────────────────
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📋  TRACKS WITH ZERO TIER SET ON ANY MODULE (${noTierTracks.length})`);
  console.log('═'.repeat(80));
  if (noTierTracks.length === 0) {
    console.log('  None — every track has at least one module with a tier value.');
  } else {
    for (const { track, mods } of noTierTracks) {
      console.log(`  • "${track.title || track.name}"  (${track._id})  —  ${mods.length} module(s)`);
    }
  }

  // ── 7. Data character assessment ─────────────────────────────────────────────
  console.log(`\n${'═'.repeat(80)}`);
  console.log('🔍  DATA CHARACTER ASSESSMENT');
  console.log('═'.repeat(80));

  // Sample users to gauge real vs test data
  const userSample = await User.find(
    {},
    { fullName: 1, email: 1, role: 1, created_at: 1, createdAt: 1 }
  ).sort({ createdAt: -1, created_at: -1 }).limit(8).lean();

  console.log(`\n  Sample of most-recently-created users (up to 8):`);
  for (const u of userSample) {
    const ts = u.createdAt || u.created_at;
    console.log(`  • ${String(u.fullName || '').padEnd(28)} ${String(u.email || '').padEnd(38)} [${u.role}]  created: ${ts ? new Date(ts).toISOString().slice(0, 10) : 'unknown'}`);
  }

  // Module title pattern check
  const seedPatternTitles = modules.filter(m =>
    /^module-\d+$/i.test(m.title) ||
    /^(part \d+|lesson \d+|module \d+)$/i.test(m.title) ||
    /test|demo|seed|dummy|placeholder/i.test(m.title)
  );

  console.log(`\n  Module title pattern indicators:`);
  console.log(`  Total modules: ${modules.length}`);
  console.log(`  Titles matching generic seed patterns (e.g. "Module-123", "Lesson 1"): ${seedPatternTitles.length}`);
  if (seedPatternTitles.length > 0) {
    seedPatternTitles.slice(0, 5).forEach(m => console.log(`    e.g. "${m.title}"`));
  }

  // Email domain check
  const emailDomains = [...new Set(userSample.map(u => u.email?.split('@')[1]).filter(Boolean))];
  console.log(`\n  Distinct email domains in user sample: ${emailDomains.join(', ')}`);

  console.log(`\n  ── Assessment ──`);
  const hasRealDomain = emailDomains.some(d => !['example.com', 'test.com', 'localhost'].includes(d));
  const hasGenericTitles = seedPatternTitles.length > modules.length * 0.5;

  if (hasRealDomain && !hasGenericTitles) {
    console.log('  Indicators suggest: LIKELY LIVE / UAT database with real or near-real data.');
    console.log('  (Real email domains detected; module titles appear human-authored.)');
  } else if (hasGenericTitles) {
    console.log('  Indicators suggest: LIKELY SEED / TEST database.');
    console.log('  (High proportion of auto-generated module title patterns detected.)');
  } else {
    console.log('  Indicators are mixed or insufficient to determine definitively.');
    console.log('  Email domains: ' + emailDomains.join(', '));
  }

  console.log('\n');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
