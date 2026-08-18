const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  generateCertificate,
  verifyCertificate,
  renderPublicVerifyPage,
  getAllCertificates,
  getUserCertificates,
  downloadCertificatePdf,
  getCertificateConfig,
  updateCertificateConfig,
  uploadSignatures,
} = require('../controllers/certificateController');

router.post('/generate', protect, generateCertificate);
router.get('/my-certificates', protect, getUserCertificates);
router.get('/config', protect, getCertificateConfig);
router.put('/config', protect, authorize('Admin'), uploadSignatures, updateCertificateConfig);
router.get('/verify/all', getAllCertificates);
router.get('/verify/:certificate_id', verifyCertificate);
router.get('/:id/pdf', downloadCertificatePdf);
router.get('/download/:id', downloadCertificatePdf);

module.exports = router;

