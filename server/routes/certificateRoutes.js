const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  generateCertificate,
  verifyCertificate,
  renderPublicVerifyPage,
  getAdminCertificates,
  getAllCertificates,
  getUserCertificates,
  downloadCertificatePdf,
  getCertificateConfig,
  updateCertificateConfig,
  uploadSignatures,
} = require('../controllers/certificateController');

router.get('/', protect, authorize('Admin', 'TeamLead'), getAdminCertificates);
router.post('/generate', protect, generateCertificate);
router.get('/my-certificates', protect, getUserCertificates);
router.get('/config', protect, getCertificateConfig);
router.put('/config', protect, authorize('Admin'), uploadSignatures, updateCertificateConfig);
// Admin-only: full certificate listing — was incorrectly public
router.get('/verify/all', protect, authorize('Admin'), getAllCertificates);
// Intentionally public: single-certificate verification for clients / system integrators
router.get('/verify/:certificate_id', verifyCertificate);
// Protected: ownership or Admin/TeamLead required — enforced inside the controller
router.get('/:id/pdf', protect, downloadCertificatePdf);
router.get('/download/:id', protect, downloadCertificatePdf);

module.exports = router;

