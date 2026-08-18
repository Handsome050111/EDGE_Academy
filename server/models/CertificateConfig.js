const mongoose = require('mongoose');

const certificateConfigSchema = new mongoose.Schema(
  {
    director_name: {
      type: String,
      default: 'Anya Sharma',
    },
    director_title: {
      type: String,
      default: 'Director, Technonex EDGE Academy',
    },
    director_signature_url: {
      type: String,
      default: null,
    },
    instructor_name: {
      type: String,
      default: 'James Chen',
    },
    instructor_title: {
      type: String,
      default: 'Lead Instructor',
    },
    instructor_signature_url: {
      type: String,
      default: null,
    },
    organization_name: {
      type: String,
      default: 'TECHNONEX EDGE ACADEMY',
    },
    seal_title: {
      type: String,
      default: 'TECHNONEX EDGE CERTIFIED',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CertificateConfig', certificateConfigSchema);
