const mongoose = require('mongoose');

const modulePrerequisiteSchema = new mongoose.Schema(
  {
    module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      alias: 'moduleId',
    },
    prerequisite_module_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      alias: 'prerequisiteModuleId',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Enforce UNIQUE(module_id, prerequisite_module_id) as per Spec Section 5.5
modulePrerequisiteSchema.index(
  { module_id: 1, prerequisite_module_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('ModulePrerequisite', modulePrerequisiteSchema);
