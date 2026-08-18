const DEFAULT_REVIEW_MIN = 15;
const DEFAULT_REVIEW_MAX = 20;
const DEFAULT_PASSING_SCORE = 80;
const DEFAULT_STALE_DAYS = 60;

/**
 * Fisher-Yates array shuffle helper
 */
const shuffle = (array) => {
  const arr = [...array];
  let currentIndex = arr.length;
  let randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
};

/**
 * Calculates weights for Spaced Repetition Review Quiz as per Spec Section 4.3
 * 
 * Formula:
 *  - base_weight = (1.0 - concept_accuracy) + 0.2  (defaults to 0.5 accuracy if untested)
 *  - Recency Multiplier:
 *      days > 21: * 1.5
 *      7 <= days <= 21: * 1.0
 *      days < 7: * 0.3
 *  - final_weight = base_weight * multiplier
 */
const calculateQuestionWeights = ({
  questions = [],
  conceptScores = [],
  lastSeenMap = {}, // map of concept_tag -> days_since_seen or questionId -> days_since_seen
}) => {
  const conceptScoreMap = {};
  conceptScores.forEach((cs) => {
    const accuracy = cs.accuracy !== undefined ? cs.accuracy : (cs.total_count > 0 ? cs.correct_count / cs.total_count : 0.5);
    conceptScoreMap[cs.concept_tag] = accuracy;
  });

  return questions.map((q) => {
    const conceptTag = q.concept_tag || q.conceptTag;
    const accuracy = conceptScoreMap[conceptTag] !== undefined ? conceptScoreMap[conceptTag] : 0.5;
    const baseWeight = (1.0 - accuracy) + 0.2;

    // Determine days since seen (default 30 if never seen)
    let daysSinceSeen = 30;
    if (conceptTag && lastSeenMap[conceptTag] !== undefined) {
      daysSinceSeen = lastSeenMap[conceptTag];
    } else if (q._id && lastSeenMap[q._id.toString()] !== undefined) {
      daysSinceSeen = lastSeenMap[q._id.toString()];
    }

    let recencyMultiplier = 1.0;
    if (daysSinceSeen > 21) {
      recencyMultiplier = 1.5;
    } else if (daysSinceSeen < 7) {
      recencyMultiplier = 0.3;
    }

    const finalWeight = baseWeight * recencyMultiplier;

    return {
      question: q,
      baseWeight,
      recencyMultiplier,
      weight: Math.max(0.01, finalWeight),
      conceptTag,
      daysSinceSeen,
    };
  });
};

/**
 * Weighted Random Sampling Without Replacement (Efraimidis & Spirakis Algorithm)
 * with Concept Diversity Cap (max 3 questions per concept_tag)
 */
const weightedSampleWithoutReplacement = (
  weightedItems = [],
  targetCount = DEFAULT_REVIEW_MAX,
  maxPerConcept = 3
) => {
  if (weightedItems.length === 0) return [];

  // Compute stochastic priority key: k_i = u_i^(1/w_i) where u_i in (0, 1)
  const keyedItems = weightedItems.map((item) => {
    const u = Math.max(0.00001, Math.min(0.99999, Math.random()));
    const key = Math.pow(u, 1.0 / item.weight);
    return { ...item, key };
  });

  // Sort descending by key
  keyedItems.sort((a, b) => b.key - a.key);

  const selected = [];
  const conceptCounts = {};

  // First pass: apply maxPerConcept constraint
  for (const item of keyedItems) {
    if (selected.length >= targetCount) break;
    const tag = item.conceptTag || 'general';
    const currentCount = conceptCounts[tag] || 0;

    if (currentCount < maxPerConcept) {
      selected.push(item.question);
      conceptCounts[tag] = currentCount + 1;
    }
  }

  // Second pass: if targetCount not reached due to constraint, backfill
  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((q) => q._id.toString()));
    for (const item of keyedItems) {
      if (selected.length >= targetCount) break;
      if (!selectedIds.has(item.question._id.toString())) {
        selected.push(item.question);
        selectedIds.add(item.question._id.toString());
      }
    }
  }

  return selected;
};

/**
 * Strips correct_option & explanation and shuffles options (A/B/C/D) & question order
 */
const formatObfuscatedQuestions = (questions = []) => {
  const formatted = questions.map((q) => {
    const options = shuffle([
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d },
    ]);

    return {
      id: q._id,
      question_text: q.question_text || q.questionText,
      options,
      concept_tag: q.concept_tag || q.conceptTag,
      difficulty: q.difficulty || 'medium',
    };
  });

  return shuffle(formatted);
};

/**
 * Evaluates whether an engineer is eligible for a weekly review quiz
 */
const shouldGenerateReview = ({
  completedModulesCount = 0,
  lastReviewAt,
  isActive = true,
  lastLoginAt,
}) => {
  if (!isActive) return false;

  if (lastLoginAt) {
    const lastLogin = new Date(lastLoginAt);
    const now = new Date();
    const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin > DEFAULT_STALE_DAYS) return false;
  }

  if (!lastReviewAt) return completedModulesCount >= 3;

  const lastReview = new Date(lastReviewAt);
  const now = new Date();
  const daysSinceReview = (now - lastReview) / (1000 * 60 * 60 * 24);

  return daysSinceReview >= 7;
};

const buildReviewQuestions = ({
  questions = [],
  weakConcepts = [],
  completedModuleIds = [],
  recentAttempts = [],
  reviewCount = DEFAULT_REVIEW_MAX,
}) => {
  const sorted = [...questions].sort((a, b) => {
    const aWeak = weakConcepts.includes(a.concept_tag || a.conceptTag);
    const bWeak = weakConcepts.includes(b.concept_tag || b.conceptTag);
    if (aWeak && !bWeak) return -1;
    if (!aWeak && bWeak) return 1;
    const aRecent = recentAttempts.some((ra) => (ra.questionId || ra.question_id) === (a._id || a.id));
    const bRecent = recentAttempts.some((ra) => (ra.questionId || ra.question_id) === (b._id || b.id));
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    return 0;
  });
  return sorted.slice(0, reviewCount);
};

module.exports = {
  DEFAULT_REVIEW_MIN,
  DEFAULT_REVIEW_MAX,
  DEFAULT_PASSING_SCORE,
  DEFAULT_STALE_DAYS,
  shuffle,
  calculateQuestionWeights,
  weightedSampleWithoutReplacement,
  formatObfuscatedQuestions,
  shouldGenerateReview,
  buildReviewQuestions,
};
