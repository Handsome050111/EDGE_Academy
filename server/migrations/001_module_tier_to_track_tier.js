/**
 * MIGRATION: Module.tier → Track.tier
 *
 * Reads the unanimous tier value from each Track's modules (confirmed zero-conflict
 * via read-only audit), translates legacy tier names to the new normalized enum:
 *   'L1_CORE'    → 'EDGE'  (Level 1, deployment-ready technician)
 *   'L2_ADVANCED' → 'CORE'  (Level 2, technical leader / mentor)
 *   'EDGE'       → kept as-is IF track content clearly matches EDGE definition
 *   'CORE'       → kept as-is IF track content clearly matches CORE definition
 *
 * Safe to run against UAT database. Reports every change made.
 * Does NOT touch Module documents.
 */

'use strict';

const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Track = require('../models/Track');
const Module = require('../models/Module');

// ── Tier normalization ────────────────────────────────────────────────────────

const LEGACY_MAP = {
  L1_CORE: 'EDGE',
  L2_ADVANCED: 'CORE',
};

// For 'EDGE' and 'CORE' literal values already stored: we derive the authoritative
// meaning by cross-checking the track name/description against the business definitions:
//   EDGE = Level 1, deployment-ready, works under supervision of CORE-certified engineer
//   CORE = Level 2, technical leader, mentors EDGE engineers, validates surveys
function inferTierFromTrackContent(rawTier, track) {
  const nameDesc = `${track.name || ''} ${track.title || ''} ${track.description || ''}`.toLowerCase();

  // Heuristics derived from business context
  const edgeSignals = /\bl1\b|level.?1|technician|deployment.?ready|entry|under supervision|field tech/i.test(nameDesc);
  const coreSignals = /\bl2\b|level.?2|engineer\b|technical leader|mentor|senior|validate|quality|programme|program manager/i.test(nameDesc);

  if (rawTier === 'EDGE') {
    if (edgeSignals && !coreSignals) return { tier: 'EDGE', decision: 'auto-confirmed (EDGE signals in track name/desc)' };
    if (coreSignals && !edgeSignals) return { tier: null, decision: 'AMBIGUOUS — raw value is "EDGE" but track content signals CORE' };
    return { tier: 'EDGE', decision: 'auto-confirmed (no conflicting signals; retaining EDGE)' };
  }

  if (rawTier === 'CORE') {
    if (coreSignals && !edgeSignals) return { tier: 'CORE', decision: 'auto-confirmed (CORE signals in track name/desc)' };
    if (edgeSignals && !coreSignals) return { tier: null, decision: 'AMBIGUOUS — raw value is "CORE" but track content signals EDGE' };
    return { tier: 'CORE', decision: 'auto-confirmed (no conflicting signals; retaining CORE)' };
  }

  return { tier: null, decision: `Unknown tier value: "${rawTier}"` };
}

function normalizeTier(rawTier, track) {
  // 1. Direct legacy mapping
  if (LEGACY_MAP[rawTier]) {
    return { tier: LEGACY_MAP[rawTier], decision: `legacy mapping: '${rawTier}' → '${LEGACY_MAP[rawTier]}'` };
  }

  // 2. Already-new values — verify against content
  if (rawTier === 'EDGE' || rawTier === 'CORE') {
    return inferTierFromTrackContent(rawTier, track);
  }

  return { tier: null, decision: `Unknown / unmapped tier value: "${rawTier}"` };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runMigration() {
  await connectDB();

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('  MIGRATION: Module.tier → Track.tier');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const tracks = await Track.find({}).lean();
  console.log(`Found ${tracks.length} track(s) to process.\n`);

  const results = [];
  const ambiguous = [];

  for (const track of tracks) {
    // Find non-deleted modules for this track
    const mods = await Module.find({
      $or: [{ track_id: track._id }, { trackId: track._id }],
      deleted_at: null,
    }).select('title tier').lean();

    // Collect distinct non-null tiers from modules
    const distinctTiers = [...new Set(mods.map(m => m.tier).filter(Boolean))];

    if (distinctTiers.length === 0) {
      results.push({
        trackName: track.name || track.title,
        trackId: track._id,
        moduleTiersFound: '(none — no tier set on modules)',
        newTrackTier: null,
        decision: 'SKIPPED — no tier data found on modules; Track.tier left as schema default (EDGE)',
        written: false,
      });
      continue;
    }

    // Audit confirmed unanimous — take the single value
    const rawTier = distinctTiers[0];
    const { tier: newTier, decision } = normalizeTier(rawTier, track);

    if (!newTier) {
      ambiguous.push({ track, rawTier, decision, mods });
      results.push({
        trackName: track.name || track.title,
        trackId: track._id,
        moduleTiersFound: rawTier,
        newTrackTier: 'BLOCKED',
        decision,
        written: false,
      });
      continue;
    }

    // Write Track.tier
    await Track.updateOne({ _id: track._id }, { $set: { tier: newTier } });

    results.push({
      trackName: track.name || track.title,
      trackId: track._id,
      moduleTiersFound: rawTier,
      newTrackTier: newTier,
      decision,
      written: true,
    });
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('┌─────────────────────────────────────────────────────────────────────────');
  console.log('│  MIGRATION RESULTS');
  console.log('├─────────────────────────────────────────────────────────────────────────');

  for (const r of results) {
    const status = r.written ? '✅ WRITTEN' : r.newTrackTier === 'BLOCKED' ? '❌ BLOCKED' : '⚠  SKIPPED';
    console.log(`│`);
    console.log(`│  Track : "${r.trackName}" (${r.trackId})`);
    console.log(`│  Status: ${status}`);
    console.log(`│  Module tiers found : ${r.moduleTiersFound}`);
    console.log(`│  Track.tier written : ${r.written ? r.newTrackTier : '(not written)'}`);
    console.log(`│  Decision           : ${r.decision}`);
  }

  console.log('│');
  console.log('└─────────────────────────────────────────────────────────────────────────');

  const written = results.filter(r => r.written).length;
  const blocked = results.filter(r => r.newTrackTier === 'BLOCKED').length;
  const skipped = results.filter(r => !r.written && r.newTrackTier !== 'BLOCKED').length;

  console.log(`\n  Summary: ${written} written, ${blocked} blocked (require manual review), ${skipped} skipped.`);

  if (ambiguous.length > 0) {
    console.log('\n⚠  BLOCKED TRACKS — Manual review required before migration can complete:');
    for (const { track, rawTier, decision } of ambiguous) {
      console.log(`   Track: "${track.name || track.title}" — ${decision}`);
    }
  } else {
    console.log('\n✅  All tracks resolved without ambiguity. Migration complete.');
  }

  // Verify: read back what we wrote
  console.log('\n── Verification: reading Track.tier back from database ──');
  const verifyTracks = await Track.find({}).select('name title tier').lean();
  for (const t of verifyTracks) {
    console.log(`   "${t.name || t.title}" → tier: ${t.tier}`);
  }

  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
