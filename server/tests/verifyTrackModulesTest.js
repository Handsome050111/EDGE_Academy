const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Track = require('../models/Track');
const Module = require('../models/Module');
const { getTracks } = require('../controllers/trackController');
const { getModules } = require('../controllers/moduleController');

const testTracksAndModules = async () => {
  try {
    await connectDB();
    console.log('Testing Track and Module retrieval for Team Lead...\n');

    const mockRes = () => {
      const res = {
        statusCode: 200,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };
      return res;
    };

    // 1. Test getTracks
    const reqTracks = { query: {} };
    const resTracks = mockRes();
    await getTracks(reqTracks, resTracks);
    assert.strictEqual(resTracks.statusCode, 200);
    console.log(`✓ GET /tracks returned ${resTracks.data.length} track(s):`);

    resTracks.data.forEach((track) => {
      console.log(`  - Track: "${track.name || track.title}" (ID: ${track._id})`);
      console.log(`    Modules count: ${track.modules ? track.modules.length : 0}`);
      if (track.modules && track.modules.length > 0) {
        track.modules.forEach((mod, idx) => {
          console.log(`      [${idx + 1}] "${mod.title}" (ID: ${mod._id})`);
        });
      }
      assert(track.modules && track.modules.length > 0, 'Track must contain populated modules');
    });

    // 2. Test getModules
    const reqMods = { query: {} };
    const resMods = mockRes();
    await getModules(reqMods, resMods);
    assert.strictEqual(resMods.statusCode, 200);
    console.log(`\n✓ GET /modules returned ${resMods.data.length} module(s):`);
    resMods.data.forEach((mod) => {
      console.log(`  - Module: "${mod.title}" (Track: "${mod.track_id?.name || mod.track_id?.title || 'None'}")`);
    });
    assert(resMods.data.length >= 2, 'Should return at least 2 modules');

    console.log('\n===================================================================');
    console.log('🎉 ALL TRACK AND MODULE RETRIEVAL TESTS PASSED 100%');
    console.log('===================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testTracksAndModules();
