const express = require('express');
const router = express.Router();
const {
  createModule,
  getModules,
  getModuleById,
  updateModule,
  deleteModule,
} = require('../controllers/moduleController');
const { protect, optionalProtect, authorize } = require('../middleware/authMiddleware');

router
  .route('/')
  .post(protect, authorize('Admin'), createModule)
  .get(optionalProtect, getModules);

router
  .route('/:id')
  .get(optionalProtect, getModuleById)
  .put(protect, authorize('Admin'), updateModule)
  .delete(protect, authorize('Admin'), deleteModule);

module.exports = router;