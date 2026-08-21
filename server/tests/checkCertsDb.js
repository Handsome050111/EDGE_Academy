/**
 * Read-only check for Certificate records and CertificateConfig in DB
 */
'use strict';
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');

async function checkCertificates() {
  await connectDB();
  const certs = await Certificate.find().lean();
  const config = await CertificateConfig.findOne().lean();
  console.log('=== CertificateConfig ===');
  console.log(config);
  console.log(`\n=== Total Certificate records in DB: ${certs.length} ===`);
  certs.forEach((c) => {
    console.log({
      _id: c._id,
      certificate_id: c.certificate_id,
      tier: c.tier,
      director_name: c.director_name,
      instructor_name: c.instructor_name,
      issued_at: c.issued_at,
    });
  });
  await mongoose.disconnect();
}

checkCertificates().catch((err) => {
  console.error(err);
  process.exit(1);
});
