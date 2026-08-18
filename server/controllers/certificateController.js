const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const multer = require('multer');
const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');
const CertificateConfig = require('../models/CertificateConfig');
const Track = require('../models/Track');
const User = require('../models/User');
const Module = require('../models/Module');
const QuizAttempt = require('../models/QuizAttempt');
const Assignment = require('../models/Assignment');
const { notifyCertificateIssued } = require('../services/notificationService');

// Multer storage for uploaded signatures
const signatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/signatures');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const signatureFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|svg\+xml|svg/;
  const mimetype = allowed.test(file.mimetype);
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  if (mimetype || extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files (PNG, JPG, SVG, WEBP) are allowed for signatures'));
};

const uploadSignatures = multer({
  storage: signatureStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: signatureFilter,
}).fields([
  { name: 'director_signature', maxCount: 1 },
  { name: 'instructor_signature', maxCount: 1 },
]);

const validateCertificateEligibility = (completedAssignmentsCount, requiredModulesCount) => {
  if (requiredModulesCount === 0) return { valid: false, errors: ['Track has no modules'] };
  if (completedAssignmentsCount < requiredModulesCount) return { valid: false, errors: ['Certificate requires all required modules to be completed.'] };
  return { valid: true, errors: [] };
};

const generateCertificate = async (engineer_id, track_id, tier = 'CORE') => {
  try {
    const track = await Track.findById(track_id);
    const user = await User.findById(engineer_id);

    if (!track || !user) throw new Error('Track or user not found');

    const engineerObjId = mongoose.Types.ObjectId.isValid(engineer_id) ? new mongoose.Types.ObjectId(engineer_id) : engineer_id;
    const trackObjId = mongoose.Types.ObjectId.isValid(track_id) ? new mongoose.Types.ObjectId(track_id) : track_id;

    // Check if active certificate already generated for this track and engineer
    let existingCert = await Certificate.findOne({
      $and: [
        { $or: [{ engineer_id: engineerObjId }, { userId: engineerObjId }] },
        { $or: [{ track_id: trackObjId }, { trackId: trackObjId }] },
        { status: 'active' },
      ],
    });
    if (existingCert) {
      return existingCert;
    }

    // Load admin certificate template configuration
    let config = await CertificateConfig.findOne();
    if (!config) {
      config = await CertificateConfig.create({});
    }

    const certCount = await Certificate.countDocuments();
    let currentSeq = certCount + 1;

    // Extract engineer initials safely (e.g. "Alex Lee Smith" -> "ALS", "John Doe" -> "JD", "alex.smith@email.com" -> "AS")
    const rawName = (user.fullName || user.full_name || user.name || (user.email ? user.email.split('@')[0] : 'ENG')).trim();
    const nameParts = rawName.split(/[\s._-]+/).filter(Boolean);
    let initials = '';
    if (nameParts.length === 0) {
      initials = 'ENG';
    } else if (nameParts.length === 1) {
      initials = nameParts[0].substring(0, 2).toUpperCase();
      if (initials.length < 2) initials = (initials + 'X').toUpperCase();
    } else {
      initials = nameParts.map((p) => p[0]).join('').toUpperCase().substring(0, 4);
    }
    const currentYear = new Date().getFullYear();
    const formattedSeq = String(currentSeq).padStart(2, '0');
    let certificate_id = `TNX-${currentYear}-${initials}-${formattedSeq}`;

    // Enforce uniqueness with collision avoidance loop
    let collision = await Certificate.findOne({ certificate_id });
    while (collision) {
      currentSeq++;
      certificate_id = `TNX-${currentYear}-${initials}-${String(currentSeq).padStart(2, '0')}`;
      collision = await Certificate.findOne({ certificate_id });
    }

    const outputDir = path.join(__dirname, '../uploads/certificates');
    const pdfPath = path.join(outputDir, `${certificate_id}.pdf`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const recipientName = user.fullName || user.full_name || user.name || 'Technonex Engineer';
    let resolvedTier = 'L1_CORE';
    if (tier === 'EDGE' || tier === 'L2_ADVANCED' || track.tier === 'EDGE' || track.tier === 'L2_ADVANCED') {
      resolvedTier = 'L2_ADVANCED';
    } else if (tier === 'CORE' || tier === 'L1_CORE' || track.tier === 'CORE' || track.tier === 'L1_CORE') {
      resolvedTier = 'L1_CORE';
    }
    const tierDisplay = (resolvedTier === 'L2_ADVANCED' || resolvedTier === 'EDGE') ? 'EDGE' : 'CORE';
    const dateFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Load official Technonex logo from public folder
    let logoBase64 = '';
    const possibleLogoPaths = [
      path.join(__dirname, '../public/logo.png'),
      path.join(__dirname, '../../client/public/logo.png'),
    ];
    for (const p of possibleLogoPaths) {
      if (fs.existsSync(p)) {
        try {
          logoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
          break;
        } catch (e) {
          console.error('Error reading logo file from ' + p, e);
        }
      }
    }

    // Convert signature images to Base64 data URLs for Puppeteer embedding
    let directorSigBase64 = '';
    if (config.director_signature_url) {
      const sigFilePath = path.join(__dirname, '..', config.director_signature_url.replace(/^\//, ''));
      if (fs.existsSync(sigFilePath)) {
        try {
          const ext = path.extname(sigFilePath).toLowerCase().replace('.', '');
          const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          directorSigBase64 = `data:${mime};base64,${fs.readFileSync(sigFilePath).toString('base64')}`;
        } catch (e) {
          console.error('Error reading director signature image from ' + sigFilePath, e);
        }
      }
    }

    let instructorSigBase64 = '';
    if (config.instructor_signature_url) {
      const sigFilePath = path.join(__dirname, '..', config.instructor_signature_url.replace(/^\//, ''));
      if (fs.existsSync(sigFilePath)) {
        try {
          const ext = path.extname(sigFilePath).toLowerCase().replace('.', '');
          const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          instructorSigBase64 = `data:${mime};base64,${fs.readFileSync(sigFilePath).toString('base64')}`;
        } catch (e) {
          console.error('Error reading instructor signature image from ' + sigFilePath, e);
        }
      }
    }

    // Pixel-perfect HTML/CSS template matching VerificationPage.jsx specification
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Inter:wght@400;500;600;700&family=Montserrat:wght@500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 landscape;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 297mm;
            height: 210mm;
            background: #FFFFFF;
            font-family: 'Inter', sans-serif;
            color: #0F172A;
            overflow: hidden;
            position: relative;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cert-frame-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
          }
          .cert-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 297mm;
            height: 210mm;
            padding: 15mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            z-index: 10;
          }
          .header-row {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding-left: 2mm;
          }
          .cert-logo-img {
            height: 36px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
            display: block;
          }
          .technonex-logo {
            font-family: 'Montserrat', sans-serif;
            font-weight: 900;
            font-size: 22px;
            letter-spacing: 1.5px;
            color: #0A2540;
            text-transform: uppercase;
          }
          .technonex-logo span {
            color: #0A2540;
          }
          .technonex-logo .logo-x {
            color: #0A2540;
            position: relative;
          }
          .title-section {
            text-align: center;
            margin-top: 0px;
          }
          .track-title {
            font-family: 'Montserrat', sans-serif;
            font-size: 26px;
            font-weight: 900;
            color: #0A2540;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            line-height: 1.15;
          }
          .ecosystem-subtitle {
            font-family: 'Montserrat', sans-serif;
            font-size: 11px;
            font-weight: 700;
            color: #B58D3D;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 4px;
          }
          .recipient-section {
            text-align: center;
            margin-top: 2px;
          }
          .recipient-name {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 34px;
            font-weight: 700;
            color: #0A1C30;
            letter-spacing: 0.5px;
            line-height: 1.2;
          }
          .gold-divider {
            width: 320px;
            height: 2px;
            background: #C59B27;
            margin: 8px auto 0 auto;
          }
          .body-section {
            text-align: center;
            max-width: 620px;
            margin: 0 auto;
          }
          .citation-text {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            line-height: 1.6;
            color: #334155;
            font-weight: 400;
          }
          .citation-text strong {
            color: #0F172A;
            font-weight: 600;
          }
          .issued-by {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: #0A2540;
            margin-top: 6px;
          }
          .bottom-section {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            padding: 0 4mm 0 4mm;
            position: relative;
          }
          .signatures-group {
            display: flex;
            align-items: flex-end;
            gap: 32mm;
          }
          .signature-block {
            text-align: left;
            min-width: 140px;
          }
          .signature-img-wrapper {
            height: 38px;
            display: flex;
            align-items: flex-end;
            border-bottom: 1px solid #CBD5E1;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .signature-img {
            max-height: 36px;
            max-width: 150px;
            object-fit: contain;
            display: block;
          }
          .signature-script {
            font-family: 'Dancing Script', cursive;
            font-size: 24px;
            font-weight: 700;
            color: #0A2540;
            border-bottom: 1px solid #CBD5E1;
            padding-bottom: 2px;
            margin-bottom: 4px;
            min-width: 130px;
            line-height: 1;
            font-style: italic;
          }
          .signature-name {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            font-weight: 700;
            color: #0F172A;
            margin-top: 2px;
          }
          .signature-title {
            font-family: 'Inter', sans-serif;
            font-size: 9.5px;
            font-weight: 500;
            color: #64748B;
            margin-top: 1px;
          }
          .seal-container {
            position: absolute;
            bottom: 35px;
            right: 40px;
            width: 92px;
            height: 92px;
            z-index: 20;
          }
          .footer-meta {
            text-align: center;
            margin-top: 20px;
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            color: #64748B;
            letter-spacing: 0.2px;
          }
        </style>
      </head>
      <body>
        <!-- Decorative Vector Frame with Beveled Corner Accents -->
        <svg class="cert-frame-svg" viewBox="0 0 1122 794" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Outer Chamfered Border -->
          <path d="M 52,26 L 1070,26 L 1096,52 L 1096,742 L 1070,768 L 52,768 L 26,742 L 26,52 Z" stroke="#0A2540" stroke-width="2.5" />
          <!-- Inner Chamfered Border -->
          <path d="M 56,34 L 1066,34 L 1088,56 L 1088,738 L 1066,760 L 56,760 L 34,738 L 34,56 Z" stroke="#0A2540" stroke-width="1" />
          <!-- Corner Accent Brackets -->
          <!-- Top Left -->
          <path d="M 26,52 L 44,52 M 52,26 L 52,44 M 34,56 L 48,48 L 56,34" stroke="#0A2540" stroke-width="1" />
          <!-- Top Right -->
          <path d="M 1096,52 L 1078,52 M 1070,26 L 1070,44 M 1088,56 L 1074,48 L 1066,34" stroke="#0A2540" stroke-width="1" />
          <!-- Bottom Left -->
          <path d="M 26,742 L 44,742 M 52,768 L 52,750 M 34,738 L 48,746 L 56,760" stroke="#0A2540" stroke-width="1" />
          <!-- Bottom Right -->
          <path d="M 1096,742 L 1078,742 M 1070,768 L 1070,750 M 1088,738 L 1074,746 L 1066,760" stroke="#0A2540" stroke-width="1" />
        </svg>

        <div class="cert-container">
          <!-- Top Left Official Technonex Logo -->
          <div class="header-row">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Technonex Logo" class="cert-logo-img" />` : `
            <div class="technonex-logo">
              TECHNO<span>NE</span><span class="logo-x">X</span>
            </div>`}
          </div>

          <!-- Curriculum Track Title & Subtitle -->
          <div class="title-section">
            <h1 class="track-title">${track.title}</h1>
            <div class="ecosystem-subtitle">Engineering Development & Growth Ecosystem</div>
          </div>

          <!-- Recipient Name & Gold Divider -->
          <div class="recipient-section">
            <div class="recipient-name">${recipientName}</div>
            <div class="gold-divider"></div>
          </div>

          <!-- Official Citation Text -->
          <div class="body-section">
            <p class="citation-text">
              This certificate is proudly awarded to <strong>${recipientName}</strong> in recognition of successful completion and proficiency demonstrated within the <strong>${tierDisplay}</strong> program. This achievement verifies the acquisition of skills and knowledge required for excellence in engineering and development.
            </p>
            <div class="issued-by">Issued by Technonex EDGE Academy</div>
          </div>

          <!-- Signatures & Embossed Medallion -->
          <div class="bottom-section">
            <div class="signatures-group">
              <div class="signature-block">
                ${directorSigBase64 ? `
                  <div class="signature-img-wrapper">
                    <img src="${directorSigBase64}" alt="${config.director_name}" class="signature-img" />
                  </div>
                ` : `
                  <div class="signature-script">${config.director_name}</div>
                `}
                <div class="signature-name">${config.director_name}</div>
                <div class="signature-title">${config.director_title || 'Director, Technonex EDGE Academy'}</div>
              </div>

              <div class="signature-block">
                ${instructorSigBase64 ? `
                  <div class="signature-img-wrapper">
                    <img src="${instructorSigBase64}" alt="${config.instructor_name}" class="signature-img" />
                  </div>
                ` : `
                  <div class="signature-script">${config.instructor_name}</div>
                `}
                <div class="signature-name">${config.instructor_name}</div>
                <div class="signature-title">${config.instructor_title || 'Lead Instructor'}</div>
              </div>
            </div>
          </div>

          <!-- Embossed Gold Medallion Seal -->
          <div class="seal-container">
            <svg viewBox="0 0 160 160" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="goldGrad" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                  <stop offset="0%" stop-color="#FDF0CD" />
                  <stop offset="35%" stop-color="#D4AF37" />
                  <stop offset="70%" stop-color="#B8860B" />
                  <stop offset="100%" stop-color="#8C6510" />
                </radialGradient>
                <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFF2B2" />
                  <stop offset="50%" stop-color="#B8860B" />
                  <stop offset="100%" stop-color="#5B3D06" />
                </linearGradient>
                <path id="topArc" d="M 40 78 A 42 42 0 0 1 120 78" fill="none" />
                <path id="bottomArc" d="M 40 82 A 42 42 0 0 0 120 82" fill="none" />
              </defs>
              <circle cx="80" cy="80" r="76" fill="url(#goldGrad)" stroke="url(#goldRim)" stroke-width="2" />
              <circle cx="80" cy="80" r="72" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6" stroke-dasharray="2 2" />
              <circle cx="80" cy="80" r="62" fill="url(#goldGrad)" stroke="#784F07" stroke-width="1.2" />
              <circle cx="80" cy="80" r="58" fill="none" stroke="#FFF0B0" stroke-width="1" opacity="0.7" />

              <!-- Text Around Top Arc -->
              <text font-family="'Montserrat', sans-serif" font-size="8.5" font-weight="800" fill="#543605" letter-spacing="2">
                <textPath href="#topArc" startOffset="50%" text-anchor="middle">TECHNONEX</textPath>
              </text>

              <!-- Center Large EDGE Text -->
              <text x="80" y="86" font-family="'Montserrat', sans-serif" font-size="20" font-weight="900" fill="#422903" text-anchor="middle" letter-spacing="1.5">EDGE</text>

              <!-- Text Around Bottom Arc -->
              <text font-family="'Montserrat', sans-serif" font-size="8.5" font-weight="800" fill="#543605" letter-spacing="2">
                <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">CERTIFIED</textPath>
              </text>
            </svg>
          </div>

          <!-- Centered Footer Metadata -->
          <div class="footer-meta">
            Date issued: ${dateFormatted} &nbsp;|&nbsp; Certificate ID: ${certificate_id}
          </div>
        </div>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });
    await page.close().catch(() => {});
    await browser.close().catch(() => {});

    const certificate = await Certificate.create({
      certificate_id,
      engineer_id,
      track_id,
      tier: tierDisplay,
      issued_at: new Date(),
      pdf_storage_path: `/uploads/certificates/${certificate_id}.pdf`,
      director_name: config.director_name,
      director_signature_url: config.director_signature_url || null,
      instructor_name: config.instructor_name,
      instructor_signature_url: config.instructor_signature_url || null,
      status: 'active',
    });

    // Dispatch dual notifications (in-app + email with PDF attachment)
    await notifyCertificateIssued({ engineer: user, certificate, track }).catch((err) => {
      console.error('[Certificate] Failed to dispatch issuance notification:', err.message);
    });

    return certificate;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
};

const verifyCertificate = async (req, res) => {
  try {
    const certIdParam = req.params.certificate_id || req.params.certificateId;
    if (!certIdParam) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Certificate ID is required' } });
    }

    const query = {
      $or: [
        { certificate_id: certIdParam.toUpperCase() },
        ...(mongoose.Types.ObjectId.isValid(certIdParam) ? [{ _id: certIdParam }] : []),
      ],
    };

    const certificate = await Certificate.findOne(query)
      .populate('engineer_id', 'full_name fullName email')
      .populate('track_id', 'name title slug code');

    if (!certificate) {
      return res.status(404).json({
        valid: false,
        error: {
          code: 'CERTIFICATE_NOT_FOUND',
          message: 'Certificate not found or invalid certificate ID',
        },
      });
    }

    const engineerName = certificate.engineer_id?.full_name || certificate.engineer_id?.fullName || 'Technonex Engineer';
    const trackName = certificate.track_id?.name || certificate.track_id?.title || 'EDGE Track';

    // Canonical payload as per Spec Section 6.5 & 8.4
    return res.json({
      valid: certificate.status === 'active',
      certificate_id: certificate.certificate_id,
      engineer_name: engineerName,
      track: trackName,
      tier: certificate.tier,
      issued_at: certificate.issued_at,
      status: certificate.status,
      verification_url: `https://academy.technonex.de/verify/${certificate.certificate_id}`,
      director_name: certificate.director_name,
      director_signature_url: certificate.director_signature_url || null,
      instructor_name: certificate.instructor_name,
      instructor_signature_url: certificate.instructor_signature_url || null,
      revoked_at: certificate.revoked_at || null,
      revocation_reason: certificate.revocation_reason || null,
      certificate: certificate,
    });
  } catch (error) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Render public certificate verification page HTML
// @route   GET /verify/:certificate_id
// @access  Public
const renderPublicVerifyPage = async (req, res) => {
  try {
    const certIdParam = req.params.certificate_id || req.params.certificateId;
    const query = {
      $or: [
        { certificate_id: certIdParam.toUpperCase() },
        ...(mongoose.Types.ObjectId.isValid(certIdParam) ? [{ _id: certIdParam }] : []),
      ],
    };

    const certificate = await Certificate.findOne(query)
      .populate('engineer_id', 'full_name fullName email')
      .populate('track_id', 'name title slug code');

    if (!certificate) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Certificate Not Found - Technonex EDGE Academy</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0B1120; color: #F1F5F9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 40px; text-align: center; max-width: 480px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            .badge-invalid { color: #EF4444; width: 48px; height: 48px; margin: 0 auto 16px; }
            h1 { font-size: 24px; margin: 0 0 12px; }
            p { color: #94A3B8; font-size: 14px; margin: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <svg class="badge-invalid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1>Certificate Not Found</h1>
            <p>The certificate with ID <strong>${certIdParam}</strong> was not found or is invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const engineerName = certificate.engineer_id?.full_name || certificate.engineer_id?.fullName || 'Technonex Engineer';
    const trackName = certificate.track_id?.name || certificate.track_id?.title || 'EDGE Track';
    const isValid = certificate.status === 'active';
    const issuedFormatted = certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

    let verifyLogoBase64 = '';
    const possibleLogoPaths = [
      path.join(__dirname, '../public/logo.png'),
      path.join(__dirname, '../../client/public/logo.png'),
    ];
    for (const p of possibleLogoPaths) {
      if (fs.existsSync(p)) {
        try {
          verifyLogoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
          break;
        } catch (e) {}
      }
    }

    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Certificate Verification - ${certificate.certificate_id} - Technonex</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #0B1120; color: #F1F5F9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1E293B; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 100%; max-width: 540px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #F8FAFC; }
          .logo span { color: #38BDF8; }
          .logo-img { height: 38px; max-width: 200px; object-fit: contain; margin: 0 auto 10px auto; display: block; }
          .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 16px; }
          .status-valid { background: rgba(34, 197, 94, 0.15); color: #4ADE80; border: 1px solid #22C55E; }
          .status-revoked { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid #EF4444; }
          .info-group { margin-top: 24px; border-top: 1px solid #334155; padding-top: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
          .info-label { color: #94A3B8; font-weight: 500; }
          .info-value { color: #F8FAFC; font-weight: 600; text-align: right; }
          .cert-id { font-family: monospace; font-size: 13px; color: #38BDF8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            ${verifyLogoBase64 ? `<img src="${verifyLogoBase64}" alt="Technonex" class="logo-img" />` : `<div class="logo">TECHNO<span>NEX</span> EDGE ACADEMY</div>`}
            <div class="status-badge ${isValid ? 'status-valid' : 'status-revoked'}">
              ${isValid ? 'Official Authentic Certificate' : 'Certificate Revoked'}
            </div>
          </div>
          <div class="info-group">
            <div class="info-row"><span class="info-label">Certificate ID:</span><span class="info-value cert-id">${certificate.certificate_id}</span></div>
            <div class="info-row"><span class="info-label">Recipient:</span><span class="info-value">${engineerName}</span></div>
            <div class="info-row"><span class="info-label">Curriculum Track:</span><span class="info-value">${trackName}</span></div>
            <div class="info-row"><span class="info-label">Tier:</span><span class="info-value">${certificate.tier}</span></div>
            <div class="info-row"><span class="info-label">Issued Date:</span><span class="info-value">${issuedFormatted}</span></div>
            <div class="info-row"><span class="info-label">Status:</span><span class="info-value">${certificate.status.toUpperCase()}</span></div>
            ${certificate.revocation_reason ? `<div class="info-row"><span class="info-label">Revocation Reason:</span><span class="info-value" style="color:#F87171;">${certificate.revocation_reason}</span></div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    return res.status(500).send('Server Error');
  }
};

const getAllCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('engineer_id', 'full_name fullName email')
      .populate('track_id', 'name title slug code')
      .sort({ createdAt: -1 });
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserCertificates = async (req, res) => {
  try {
    const engineer_id = req.user._id;

    // Auto-reconciliation / backfill: Check all published tracks to see if the engineer completed any track that hasn't received a certificate yet
    try {
      const tracks = await Track.find({
        $or: [{ is_published: true }, { isPublished: true }],
        deleted_at: null,
      });

      for (const track of tracks) {
        const trackModules = await Module.find({
          $or: [{ track_id: track._id }, { trackId: track._id }],
          deleted_at: null,
          status: { $ne: 'archived' },
        }).select('_id tier');

        if (trackModules.length === 0) continue;

        const engineerObjId = mongoose.Types.ObjectId.isValid(engineer_id) ? new mongoose.Types.ObjectId(engineer_id) : engineer_id;
        const trackObjId = mongoose.Types.ObjectId.isValid(track._id) ? new mongoose.Types.ObjectId(track._id) : track._id;

        // Check if active certificate already exists
        const existingCert = await Certificate.findOne({
          $and: [
            { $or: [{ engineer_id: engineerObjId }, { userId: engineerObjId }] },
            { $or: [{ track_id: trackObjId }, { trackId: trackObjId }] },
            { status: 'active' },
          ],
        });

        if (!existingCert) {
          const trackModuleIds = trackModules.map((m) => m._id.toString());
          const passedAttempts = await QuizAttempt.distinct('module_id', {
            $or: [{ engineer_id: engineerObjId }, { userId: engineerObjId }],
            passed: true,
            module_id: { $in: trackModules.map((m) => m._id) },
          });

          const passedModuleSet = new Set(passedAttempts.map((id) => id.toString()));

          const completedAssignments = await Assignment.find({
            $or: [{ engineer_id: engineerObjId }, { userId: engineerObjId }],
            status: 'completed',
          }).select('module_id moduleId');

          completedAssignments.forEach((a) => {
            const mId = a.module_id || a.moduleId;
            if (mId) passedModuleSet.add(mId.toString());
          });

          const isFullyCompleted = trackModuleIds.every((mId) => passedModuleSet.has(mId));
          if (isFullyCompleted) {
            console.log(`[CERTIFICATE] Auto-reconciling missing certificate for engineer ${engineer_id} on track ${track._id}`);
            await generateCertificate(engineer_id, track._id, track.tier || trackModules[0]?.tier || 'L1_CORE');
          }
        }
      }
    } catch (reconcileErr) {
      console.error('[CERTIFICATE] Reconciliation error in getUserCertificates:', reconcileErr.message);
    }

    const certificates = await Certificate.find({
      $or: [{ engineer_id }, { userId: engineer_id }],
    }).populate('track_id', 'name title slug code');
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Download Certificate PDF with Revocation Guard (Spec Section 8.4)
// @route   GET /api/v1/certificates/:id/pdf
// @access  Private
const downloadCertificatePdf = async (req, res) => {
  try {
    const certParam = (req.params.id || req.params.certificateId || '').trim();
    if (!certParam) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Certificate ID is required' } });
    }

    const query = {
      $or: [
        ...(mongoose.Types.ObjectId.isValid(certParam) ? [{ _id: certParam }] : []),
        { certificate_id: certParam.toUpperCase() },
      ],
    };

    const certificate = await Certificate.findOne(query);

    if (!certificate) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Certificate not found' } });
    }

    // Spec Section 8.4: Revoked Certificate Guard
    if (certificate.status === 'revoked') {
      return res.status(403).json({
        error: {
          code: 'CERTIFICATE_REVOKED',
          message: 'Engineers cannot re-download a revoked certificate PDF.',
          certificate_id: certificate.certificate_id,
          revoked_at: certificate.revoked_at,
          revocation_reason: certificate.revocation_reason,
        },
      });
    }

    let pdfPath = path.join(__dirname, '..', certificate.pdf_storage_path);
    
    // Auto re-generate if PDF file is missing on disk
    if (!fs.existsSync(pdfPath)) {
      try {
        await generateCertificate(certificate.engineer_id, certificate.track_id, certificate.tier);
      } catch (genErr) {
        console.error('Error auto re-generating PDF:', genErr);
      }
    }

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'PDF file could not be located or generated.' } });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificate_id}.pdf"`);
    res.download(pdfPath, `${certificate.certificate_id}.pdf`);
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// Admin Certificate Configuration APIs
const getCertificateConfig = async (req, res) => {
  try {
    let config = await CertificateConfig.findOne();
    if (!config) {
      config = await CertificateConfig.create({});
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCertificateConfig = async (req, res) => {
  try {
    const {
      director_name,
      director_title,
      instructor_name,
      instructor_title,
      organization_name,
      seal_title,
      remove_director_signature,
      remove_instructor_signature,
      director_signature_url,
      instructor_signature_url,
    } = req.body;

    let config = await CertificateConfig.findOne();
    if (!config) {
      config = new CertificateConfig();
    }

    if (director_name !== undefined) config.director_name = director_name.trim();
    if (director_title !== undefined) config.director_title = director_title.trim();
    if (instructor_name !== undefined) config.instructor_name = instructor_name.trim();
    if (instructor_title !== undefined) config.instructor_title = instructor_title.trim();
    if (organization_name !== undefined) config.organization_name = organization_name.trim();
    if (seal_title !== undefined) config.seal_title = seal_title.trim();

    // Handle Director Signature Upload / Removal
    if (req.files?.director_signature && req.files.director_signature.length > 0) {
      config.director_signature_url = `/uploads/signatures/${req.files.director_signature[0].filename}`;
    } else if (remove_director_signature === 'true' || remove_director_signature === true || director_signature_url === '') {
      config.director_signature_url = null;
    }

    // Handle Instructor Signature Upload / Removal
    if (req.files?.instructor_signature && req.files.instructor_signature.length > 0) {
      config.instructor_signature_url = `/uploads/signatures/${req.files.instructor_signature[0].filename}`;
    } else if (remove_instructor_signature === 'true' || remove_instructor_signature === true || instructor_signature_url === '') {
      config.instructor_signature_url = null;
    }

    await config.save();
    res.json({ message: 'Certificate template configuration saved successfully', config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateCertificate,
  verifyCertificate,
  renderPublicVerifyPage,
  validateCertificateEligibility,
  getAllCertificates,
  getUserCertificates,
  downloadCertificatePdf,
  getCertificateConfig,
  updateCertificateConfig,
  uploadSignatures,
};

