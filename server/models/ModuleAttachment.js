const mongoose = require('mongoose');

const moduleAttachmentSchema = new mongoose.Schema(
  {
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      alias: 'moduleId',
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    storage_path: {
      type: String,
      required: true,
    },
    file_type: {
      type: String,
      required: true,
    },
    file_size_bytes: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ModuleAttachment', moduleAttachmentSchema);
