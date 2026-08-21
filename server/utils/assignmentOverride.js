const Assignment = require('../models/Assignment');

/**
 * Checks whether an active (pending or in_progress) Assignment record exists for a
 * given engineer+module pair. Used as the SINGLE shared override gate that
 * simultaneously bypasses:
 *   (a) ModulePrerequisite sequential checks (existing logic in startTopicQuiz)
 *   (b) Track-level CORE-requires-EDGE checks (new logic in startTopicQuiz)
 *
 * A COMPLETED assignment does NOT act as an override — the engineer already finished
 * the module, so no lock-bypass is needed or appropriate.
 *
 * @param {import('mongoose').Types.ObjectId|string} engineerId
 * @param {import('mongoose').Types.ObjectId|string} moduleId
 * @returns {Promise<boolean>}  true = override applies, skip all prerequisite/track-lock checks
 */
async function hasAssignmentOverride(engineerId, moduleId) {
  const assignment = await Assignment.findOne({
    $and: [
      { $or: [{ engineer_id: engineerId }, { userId: engineerId }] },
      { $or: [{ module_id: moduleId }, { moduleId: moduleId }] },
      { status: { $in: ['pending', 'in_progress'] } },
    ],
  }).lean();
  return Boolean(assignment);
}

module.exports = { hasAssignmentOverride };
