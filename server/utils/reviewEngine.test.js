const assert = require('assert');
const { buildReviewQuestions, shouldGenerateReview } = require('./reviewEngine');

const questions = [
  { _id: 'q1', concept_tag: 'routing', difficulty: 'easy' },
  { _id: 'q2', concept_tag: 'switching', difficulty: 'hard' },
  { _id: 'q3', concept_tag: 'security', difficulty: 'medium' },
];

const review = buildReviewQuestions({
  questions,
  weakConcepts: ['routing'],
  completedModuleIds: ['module-1'],
  recentAttempts: [{ questionId: 'q3', isCorrect: false }],
  reviewCount: 3,
});

assert.strictEqual(review[0]._id, 'q1');
assert.strictEqual(review[1]._id, 'q3');
assert.strictEqual(shouldGenerateReview({ completedModulesCount: 3, lastReviewAt: '2024-01-01' }), true);

console.log('review engine tests passed');
