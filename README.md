# Technonex EDGE Academy

> **Proprietary Operational Qualification & Field Engineer Certification Ecosystem**  
> Certifying deployment-ready field engineers for high-stakes enterprise IT infrastructure and live data center environments across EMEA.

---

## 🏗️ Architecture Overview

EDGE Academy is built on a high-concurrency **MERN Stack** (MongoDB, Express, React, Node.js) with Tailwind CSS, PWA support, and automated certificate generation.

- **Frontend (`/client`)**: React 18, Vite 5, Tailwind CSS, Lucide Icons, React Router v6, PWA Service Worker.
- **Backend (`/server`)**: Node.js, Express 5, Mongoose 9 (MongoDB Atlas), JWT Authentication, Helmet, Multer, Node-Cron, Resend Email Service, Puppeteer PDF rendering.

---

## 📂 Project Structure

```
EDGE Academy/
├── client/                     # Frontend Vite + React application
│   ├── public/                 # Static assets, branding, icons, manifest
│   ├── src/
│   │   ├── components/         # Reusable UI components & modals
│   │   ├── context/            # AuthContext, LanguageContext, NotificationContext
│   │   ├── pages/              # Landing, Learner, Admin, Verification, Auth
│   │   └── services/           # Axios API client & endpoints
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend Express REST API
│   ├── config/                 # MongoDB database connection
│   ├── controllers/            # Route controllers (Auth, Modules, Quiz, Admin, Certs)
│   ├── middleware/             # JWT Auth, Role Guards, Request Validation
│   ├── models/                 # Mongoose schemas (17 data models)
│   ├── routes/                 # Express API routes
│   ├── services/               # Cron jobs, Resend notification service
│   ├── templates/              # Official certificate HTML/CSS template
│   ├── tests/                  # Integration & Autocannon load testing suite
│   ├── uploads/                # Static storage (videos, attachments, certs)
│   └── server.js               # Express application entry point
│
└── README.md
```

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js >= 18.x
- MongoDB (local instance or MongoDB Atlas cluster URI)

### 2. Backend Setup
```bash
cd server
cp .env.example .env
# Configure your MONGO_URI, JWT_SECRET, and RESEND_API_KEY in server/.env

npm install
npm run seed      # Seeds initial curriculum tracks, modules, and admin user
npm run dev       # Starts server on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd client
cp .env.example .env
# Configure VITE_API_URL in client/.env (or leave default for local proxy)

npm install
npm run dev       # Starts Vite dev server on http://localhost:5173
```

---

## ⚡ Automated Load & Performance Testing

To execute the 75-concurrent user load test suite:
```bash
cd server
npm run test:load
```

---

## 🌐 Deployment Guidelines

### Backend (Railway / Render / AWS)
- Set Environment Variables: `PORT`, `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`, `FRONTEND_URL`, `RESEND_API_KEY`, `RESEND_FROM`.
- Start Command: `node server.js`

### Frontend (Vercel / Netlify / Cloudflare Pages)
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Set Environment Variable: `VITE_API_URL=https://your-backend-domain.com/api/v1`

---

## 📄 License
Proprietary & Confidential - Technonex GmbH. All rights reserved.
