const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const {
  createQuestion,
  updateQuestionWithVersioning,
  softDeleteQuestion,
  importQuestionsCSV,
  getModuleQuestionsAdmin,
} = require('../controllers/adminQuestionController');

const {
  uploadModuleVideo,
  uploadModuleThumbnail,
  getModuleAttachments,
  uploadModuleAttachment,
  deleteModuleAttachment,
  publishModule,
} = require('../controllers/adminModuleController');

const { createModule, updateModule } = require('../controllers/moduleController');

const { createAssignments, getAssignments } = require('../controllers/adminAssignmentController');

const {
  getTeamReport,
  getModuleReport,
  getWeakConceptsReport,
} = require('../controllers/adminReportController');

const {
  getAuditLogs,
  revokeCertificate,
} = require('../controllers/superAdminController');

const {
  getAdminCertificates,
} = require('../controllers/certificateController');

const {
  createUser,
  inviteUser,
  getUsers,
  softDeleteUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  getTeams,
  getTeamLeads,
  assignEngineerTeamLead,
  assignUserTeam,
  resendInvite,
  backfillEnrollments,
} = require('../controllers/adminUserController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const videoDir = path.join(uploadDir, 'videos');
const thumbnailDir = path.join(uploadDir, 'thumbnails');
const attachmentDir = path.join(uploadDir, 'attachments');

[uploadDir, videoDir, thumbnailDir, attachmentDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for CSV import
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Configure Multer for Video upload (MP4/WebM, up to 500MB)
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, videoDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

// Configure Multer for Thumbnail Image upload (PNG/JPG/WEBP, up to 10MB)
const thumbnailUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, thumbnailDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `thumb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, JPEG, WEBP) are allowed for thumbnails'));
    }
  },
});

// Configure Multer for Attachments (PDF/Images/DOCX, up to 20MB)
const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, attachmentDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `attach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Flexible middleware to handle CSV file uploaded as 'file' or 'csvFile'
const handleCsvUpload = (req, res, next) => {
  const multiUpload = csvUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'csvFile', maxCount: 1 },
  ]);

  multiUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (req.files) {
      req.file = req.files['file']?.[0] || req.files['csvFile']?.[0] || req.file;
    }
    next();
  });
};

// Flexible middleware to handle video upload
const handleVideoUpload = (req, res, next) => {
  const uploadSingle = videoUpload.single('video');
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Flexible middleware to handle thumbnail upload
const handleThumbnailUpload = (req, res, next) => {
  const uploadSingle = thumbnailUpload.single('thumbnail');
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Flexible middleware to handle attachment upload
const handleAttachmentUpload = (req, res, next) => {
  const uploadSingle = attachmentUpload.single('attachment');
  uploadSingle(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Protect and authorize base admin routes (Admin, TeamLead)
router.use(protect, authorize('Admin', 'TeamLead'));

// Teams and Team Leads Endpoints (Admin, TeamLead)
router.get('/teams', getTeams);
router.get('/team-leads', getTeamLeads);

// Question Management Endpoints (Admin only)
router.get('/modules/:id/questions', authorize('Admin'), getModuleQuestionsAdmin);
router.post('/modules/:id/questions', authorize('Admin'), createQuestion);
router.put('/questions/:id', authorize('Admin'), updateQuestionWithVersioning);
router.delete('/questions/:id', authorize('Admin'), softDeleteQuestion);
router.post('/questions/import', authorize('Admin'), handleCsvUpload, importQuestionsCSV);

// Module Management & Video/Attachment Endpoints (Admin only)
router.post('/modules', authorize('Admin'), createModule);
router.put('/modules/:id', authorize('Admin'), updateModule);
router.post('/modules/:id/video', authorize('Admin'), handleVideoUpload, uploadModuleVideo);
router.post('/modules/:id/thumbnail', authorize('Admin'), handleThumbnailUpload, uploadModuleThumbnail);
router.get('/modules/:id/attachments', getModuleAttachments);
router.post('/modules/:id/attachments', authorize('Admin'), handleAttachmentUpload, uploadModuleAttachment);
router.delete('/modules/:moduleId/attachments/:attachmentId', authorize('Admin'), deleteModuleAttachment);
router.post('/modules/:id/publish', authorize('Admin'), publishModule);

// Assignment Engine Endpoints (Admin, TeamLead)
router.get('/assignments', getAssignments);
router.post('/assignments', createAssignments);

// User Management & Invitations Endpoints (Admin only)
router.get('/users', getUsers);
router.post('/users', authorize('Admin'), createUser);
router.post('/users/invite', authorize('Admin'), inviteUser);
router.put('/users/:id', authorize('Admin'), updateUser);
router.put('/users/:id/role', authorize('Admin'), updateUserRole);
router.put('/users/:id/status', authorize('Admin'), updateUserStatus);
router.delete('/users/:id', authorize('Admin'), softDeleteUser);
router.put('/users/:id/team', authorize('Admin'), assignUserTeam);
router.put('/users/:id/team-lead', authorize('Admin'), assignEngineerTeamLead);
router.post('/users/:id/resend-invite', authorize('Admin'), resendInvite);
router.post('/backfill-enrollments', authorize('Admin'), backfillEnrollments);

// Reporting & Analytics Endpoints (Admin, TeamLead)
router.get('/reports/team/:id', getTeamReport);
router.get('/reports/module/:id', getModuleReport);
router.get('/reports/weak-concepts', getWeakConceptsReport);
router.get('/certificates', getAdminCertificates);

// Security & Governance Endpoints (Admin only)
router.get('/audit-log', authorize('Admin'), getAuditLogs);
router.post('/certificates/:id/revoke', authorize('Admin'), revokeCertificate);

module.exports = router;
