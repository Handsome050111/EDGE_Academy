/**
 * Shared module-completion helpers used across learner progress and certificate flows.
 * This file intentionally avoids derived UI-only state and computes completion from
 * the canonical sources of truth: assignments, track progress, and passed quiz attempts.
 */

function getCompletedModuleIds({ assignments = [], progressRecords = [], quizAttempts = [] } = {}) {
  const completed = new Set();

  for (const assignment of assignments || []) {
    const moduleId = assignment?.module_id || assignment?.moduleId;
    if (moduleId && assignment?.status === 'completed') {
      completed.add(moduleId.toString());
    }
  }

  for (const progress of progressRecords || []) {
    for (const entry of progress?.completedModules || []) {
      const moduleId = entry?.moduleId || entry?.module_id;
      if (moduleId) {
        completed.add(moduleId.toString());
      }
    }
  }

  for (const attempt of quizAttempts || []) {
    const moduleId = attempt?.module_id || attempt?.moduleId;
    if (moduleId && attempt?.passed === true && attempt?.status === 'completed') {
      completed.add(moduleId.toString());
    }
  }

  return [...completed];
}

module.exports = {
  getCompletedModuleIds,
};
