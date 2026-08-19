const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');

// Require Models
require('./models/Module');
require('./models/Track');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const trackRoutes = require('./routes/trackRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const quizRoutes = require('./routes/quizRoutes');
const progressRoutes = require('./routes/progressRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const userRoutes = require('./routes/userRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const videoRoutes = require('./routes/videoRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Import Error Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Import Cron Services
const { initCronJobs } = require('./services/cronService');

connectDB().then(() => {
  initCronJobs();
});

const app = express();

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors()); // Enable CORS
app.use(express.json());

// Serve uploaded video, attachment static files, and public assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rate Limiting for Auth Routes as per Spec Section 10.1 (60 requests/minute per IP)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication requests from this IP, please try again in a minute.',
    },
  },
});

const { verifyCertificate, renderPublicVerifyPage } = require('./controllers/certificateController');

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', authLimiter, userRoutes);
app.use('/api/v1/me', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tracks', trackRoutes);
app.use('/api/v1/modules', moduleRoutes);
app.use('/api/v1', quizRoutes); // handles /modules/:id/quiz/start, /attempts/:id/submit, /review-quiz/start
app.use('/api/v1/progress', progressRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1', videoRoutes); // handles /modules/:id/video-progress

// Canonical Public Verification Endpoints (Spec Section 6.5 & 8.4)
app.get('/api/v1/verify/:certificate_id', verifyCertificate);
app.get('/verify/:certificate_id', renderPublicVerifyPage);

// Base Route
app.get('/', (req, res) => {
  res.send('EDGE Academy API is running securely...');
});


// Error Handling Middleware (Must be registered after routes)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});