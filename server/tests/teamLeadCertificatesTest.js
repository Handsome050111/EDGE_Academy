/**
 * Unit/Integration test for getAdminCertificates endpoint & squad scoping
 */
'use strict';

const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Track = require('../models/Track');
const Certificate = require('../models/Certificate');
const { getAdminCertificates } = require('../controllers/certificateController');

async function testScopedCertificates() {
  await connectDB();
  console.log('\n--- 🧪 TEST: TeamLead Scoped Certificate Endpoint ---\n');

  // 1. Find a TeamLead user
  const teamLead = await User.findOne({ role: { $in: ['TeamLead', 'team_lead'] } });
  console.log('TeamLead user:', teamLead ? `${teamLead.fullName || teamLead.email} (${teamLead._id})` : 'Not found');

  if (teamLead) {
    // Mock req and res for TeamLead
    const reqTL = {
      user: teamLead,
      query: { page: '1', limit: '10' },
    };
    let responseDataTL = null;
    const resTL = {
      status: (code) => ({
        json: (data) => { responseDataTL = { code, data }; },
      }),
      json: (data) => { responseDataTL = { code: 200, data }; },
    };

    await getAdminCertificates(reqTL, resTL);
    console.log('TeamLead certificates response total:', responseDataTL?.data?.total);
    console.log('TeamLead response structure keys:', Object.keys(responseDataTL?.data || {}));
    console.log('TeamLead certificates count:', responseDataTL?.data?.certificates?.length);
  }

  // 2. Find an Admin user
  const admin = await User.findOne({ role: { $in: ['admin', 'Admin'] } });
  console.log('\nAdmin user:', admin ? `${admin.fullName || admin.email} (${admin._id})` : 'Not found');

  if (admin) {
    const reqAdmin = {
      user: admin,
      query: { page: '1', limit: '10' },
    };
    let responseDataAdmin = null;
    const resAdmin = {
      status: (code) => ({
        json: (data) => { responseDataAdmin = { code, data }; },
      }),
      json: (data) => { responseDataAdmin = { code: 200, data }; },
    };

    await getAdminCertificates(reqAdmin, resAdmin);
    console.log('Admin certificates response total:', responseDataAdmin?.data?.total);
    console.log('Admin response structure keys:', Object.keys(responseDataAdmin?.data || {}));
    console.log('Admin certificates count:', responseDataAdmin?.data?.certificates?.length);
  }

  console.log('\n✅ getAdminCertificates tests completed successfully.\n');
  await mongoose.disconnect();
}

testScopedCertificates().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
