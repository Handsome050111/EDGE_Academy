const Module = require('../models/Module');
const ModulePrerequisite = require('../models/ModulePrerequisite');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Assignment = require('../models/Assignment');
const Certificate = require('../models/Certificate');
const VideoProgress = require('../models/VideoProgress');
const { generateCertificate } = require('./certificateController');
const {
  shuffle,
  formatObfuscatedQuestions,
} = require('../utils/reviewEngine');

// @desc    Start a Topic Quiz
// @route   POST /api/v1/modules/:id/quiz/start
const startTopicQuiz = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const engineerId = req.user._id;

    const mod = await Module.findById(moduleId);
    if (!mod) {
      return res.status(404).json({ error: { message: 'Module not found' } });
    }

    // 1. PREREQUISITE VALIDATION & ADMIN ASSIGNMENT OVERRIDE (Spec Section 4.6 & 7.4)
    const prerequisites = await ModulePrerequisite.find({
      $or: [{ module_id: mod._id }, { moduleId: mod._id }],
    }).populate('prerequisite_module_id');

    if (prerequisites.length > 0) {
      // Check if an explicit Assignment exists for this engineer on this module (Admin override)
      const assignmentOverride = await Assignment.findOne({
        $or: [
          { engineer_id: engineerId, module_id: mod._id },
          { userId: engineerId, moduleId: mod._id },
        ],
      });

      if (!assignmentOverride) {
        const missingPrerequisites = [];

        for (const prereq of prerequisites) {
          const prereqId = prereq.prerequisite_module_id?._id || prereq.prerequisite_module_id;
          if (!prereqId) continue;

          // Check if prerequisite is completed via completed assignment or passed quiz attempt
          const completedAssign = await Assignment.findOne({
            $or: [
              { engineer_id: engineerId, module_id: prereqId, status: 'completed' },
              { userId: engineerId, moduleId: prereqId, status: 'completed' },
            ],
          });

          const passedAttempt = completedAssign
            ? true
            : await QuizAttempt.findOne({
                $or: [
                  { engineer_id: engineerId, module_id: prereqId, passed: true, status: 'completed' },
                  { userId: engineerId, moduleId: prereqId, passed: true, status: 'completed' },
                ],
              });

          if (!completedAssign && !passedAttempt) {
            const prereqDoc = prereq.prerequisite_module_id?.title
              ? prereq.prerequisite_module_id
              : await Module.findById(prereqId);

            missingPrerequisites.push({
              id: prereqId,
              title: prereqDoc ? prereqDoc.title : 'Prerequisite Module',
            });
          }
        }

        if (missingPrerequisites.length > 0) {
          return res.status(403).json({
            error: {
              code: 'PREREQUISITES_NOT_MET',
              message: 'You must complete all prerequisite modules before taking this quiz.',
              missing_prerequisites: missingPrerequisites,
            },
          });
        }
      }
    }

    // 2. VIDEO 95% WATCH GUARD (Spec Section 4.2)
    const videoProgress = await VideoProgress.findOne({
      $or: [
        { engineer_id: engineerId, module_id: moduleId },
        { userId: engineerId, moduleId: moduleId },
      ],
    });
    if (!videoProgress || videoProgress.percent_watched < 95) {
      return res.status(403).json({
        error: {
          code: 'VIDEO_INCOMPLETE',
          message: 'You must watch at least 95% of the video before taking the Topic Quiz.',
          percent_watched: videoProgress ? videoProgress.percent_watched : 0,
        },
      });
    }

    // 3. 15-MINUTE RETAKE COOLDOWN GUARD (Spec Section 4.2)
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
    const latestFailedAttempt = await QuizAttempt.findOne({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
      $or: [{ module_id: moduleId }, { moduleId: moduleId }],
      passed: false,
    }).sort({ completed_at: -1, completedAt: -1, updatedAt: -1, createdAt: -1 });

    if (latestFailedAttempt) {
      const attemptTime = latestFailedAttempt.completed_at || latestFailedAttempt.completedAt || latestFailedAttempt.updatedAt || latestFailedAttempt.createdAt;
      if (attemptTime) {
        const timeSinceFailedMs = Date.now() - new Date(attemptTime).getTime();
        if (timeSinceFailedMs < COOLDOWN_MS) {
          const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceFailedMs) / 1000);
          return res.status(429).json({
            error: {
              code: 'COOLDOWN_ACTIVE',
              message: `Retake cooldown active. Please wait ${Math.ceil(remainingSeconds / 60)} minute(s) before retaking the quiz.`,
              cooldown_remaining_seconds: remainingSeconds,
            },
          });
        }
      }
    }

    // 4. TOPIC QUIZ QUESTION SELECTION RULES (Spec Section 4.2)
    // Fetch all active questions for module
    const bank = await Question.find({
      $or: [{ module_id: mod._id }, { moduleId: mod._id }],
      is_active: true,
      deleted_at: null,
    });

    const quiz_question_count = mod.quiz_question_count || 6;
    let n = Math.min(bank.length, quiz_question_count);

    // Identify questions answered in the last 14 days by this engineer
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recentAttempts = await QuizAttempt.find({
      $or: [{ engineer_id: engineerId }, { userId: engineerId }],
      $or: [
        { completed_at: { $gte: fourteenDaysAgo } },
        { completedAt: { $gte: fourteenDaysAgo } },
        { createdAt: { $gte: fourteenDaysAgo } },
      ],
    }).select('_id');

    const recentAttemptIds = recentAttempts.map((a) => a._id);
    const recentResponses = await AttemptResponse.find({
      attempt_id: { $in: recentAttemptIds },
    }).select('question_id');
    const recentQuestionIds = new Set(recentResponses.map((r) => r.question_id.toString()));

    const unseenQuestions = bank.filter((q) => !recentQuestionIds.has(q._id.toString()));
    const recentQuestions = bank.filter((q) => recentQuestionIds.has(q._id.toString()));

    // Difficulty Balancing: 40% easy, 40% medium, 20% hard (when bank allows)
    let selectedQuestions = [];

    const partitionByDifficulty = (pool) => ({
      easy: pool.filter((q) => (q.difficulty || '').toLowerCase() === 'easy'),
      medium: pool.filter((q) => (q.difficulty || 'medium').toLowerCase() === 'medium'),
      hard: pool.filter((q) => (q.difficulty || '').toLowerCase() === 'hard'),
    });

    const unseenByDiff = partitionByDifficulty(unseenQuestions);
    const recentByDiff = partitionByDifficulty(recentQuestions);

    const targetEasy = Math.round(n * 0.4);
    const targetMedium = Math.round(n * 0.4);
    const targetHard = n - targetEasy - targetMedium;

    const pickFromPools = (diffKey, targetAmount) => {
      const fromUnseen = shuffle(unseenByDiff[diffKey]).slice(0, targetAmount);
      const needed = targetAmount - fromUnseen.length;
      const fromRecent = needed > 0 ? shuffle(recentByDiff[diffKey]).slice(0, needed) : [];
      return [...fromUnseen, ...fromRecent];
    };

    const pickedEasy = pickFromPools('easy', targetEasy);
    const pickedMed = pickFromPools('medium', targetMedium);
    const pickedHard = pickFromPools('hard', targetHard);

    selectedQuestions = [...pickedEasy, ...pickedMed, ...pickedHard];

    // If balanced selection fell short due to specific difficulty scarcity, fill from remaining
    if (selectedQuestions.length < n) {
      const pickedIds = new Set(selectedQuestions.map((q) => q._id.toString()));
      const remainingPool = shuffle([...unseenQuestions, ...recentQuestions]).filter(
        (q) => !pickedIds.has(q._id.toString())
      );
      selectedQuestions.push(...remainingPool.slice(0, n - selectedQuestions.length));
    }

    // Obfuscate questions: strip correct_option & explanation, shuffle options and questions
    const formattedQuestions = formatObfuscatedQuestions(selectedQuestions);

    const attempt = await QuizAttempt.create({
      engineer_id: engineerId,
      quiz_type: 'topic',
      module_id: mod._id,
      started_at: new Date(),
      status: 'in_progress',
    });

    res.json({ attempt_id: attempt._id, questions: formattedQuestions });
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

// @desc    Submit any Quiz Attempt (Topic or Review)
// @route   POST /api/v1/attempts/:id/submit
const submitQuizAttempt = async (req, res) => {
  try {
    const attemptId = req.params.id;
    const { answers } = req.body; // format: [{ question_id, selected_option, response_time_ms }]

    const attempt = await QuizAttempt.findById(attemptId);
    if (!attempt || attempt.completed_at || attempt.status === 'completed') {
      return res.status(400).json({ error: { message: 'Invalid or already submitted attempt' } });
    }

    let correctCount = 0;
    const responses = [];

    for (let i = 0; i < answers.length; i++) {
      const ans = answers[i];
      const q = await Question.findById(ans.question_id);
      if (!q) continue;

      const was_correct = q.correct_option === ans.selected_option;
      if (was_correct) correctCount++;

      responses.push({
        attempt_id: attempt._id,
        question_id: q._id,
        selected_option: ans.selected_option,
        was_correct,
        response_time_ms: ans.response_time_ms || 0,
        displayed_order: i + 1,
        // Include for immediate feedback payload
        correct_option: q.correct_option,
        explanation: q.explanation,
      });

      // Update concept scores
      let cScore = await ConceptScore.findOne({
        $or: [
          { engineer_id: attempt.engineer_id, concept_tag: q.concept_tag },
          { userId: attempt.engineer_id, concept_tag: q.concept_tag },
        ],
      });
      if (!cScore) {
        cScore = new ConceptScore({
          engineer_id: attempt.engineer_id,
          concept_tag: q.concept_tag,
          total_count: 0,
          correct_count: 0,
        });
      }
      cScore.total_count += 1;
      if (was_correct) cScore.correct_count += 1;
      await cScore.save();
    }

    await AttemptResponse.insertMany(
      responses.map((r) => ({
        attempt_id: r.attempt_id,
        question_id: r.question_id,
        selected_option: r.selected_option,
        was_correct: r.was_correct,
        response_time_ms: r.response_time_ms,
        displayed_order: r.displayed_order,
      }))
    );

    const score_percent = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    if (attempt.quiz_type === 'topic') {
      const mod = await Module.findById(attempt.module_id);
      attempt.passed = score_percent >= (mod?.pass_threshold || 80);

      // Update Assignment status if passed
      if (attempt.passed && mod) {
        await Assignment.updateOne(
          {
            $or: [
              { engineer_id: attempt.engineer_id, module_id: mod._id },
              { userId: attempt.engineer_id, moduleId: mod._id },
            ],
          },
          {
            $set: {
              status: 'completed',
              completed_at: new Date(),
            },
          }
        );

        // Check if all published modules in the track are completed for automatic certificate issuance
        const trackId = mod.track_id || mod.trackId;
        if (trackId) {
          try {
            // Find all active/published modules for this track
            const trackModules = await Module.find({
              $or: [{ track_id: trackId }, { trackId: trackId }],
              deleted_at: null,
              status: { $ne: 'archived' },
            }).select('_id tier');

            const trackModuleIds = trackModules.map((m) => m._id.toString());

            // Collect all passed module IDs for this engineer
            const passedAttempts = await QuizAttempt.distinct('module_id', {
              $or: [{ engineer_id: attempt.engineer_id }, { userId: attempt.engineer_id }],
              passed: true,
              module_id: { $in: trackModules.map((m) => m._id) },
            });

            const passedModuleSet = new Set([
              ...passedAttempts.map((id) => id.toString()),
              mod._id.toString(), // Current quiz attempt passed
            ]);

            // Include any assignments marked completed
            const completedAssignments = await Assignment.find({
              $or: [{ engineer_id: attempt.engineer_id }, { userId: attempt.engineer_id }],
              status: 'completed',
            }).select('module_id moduleId');

            completedAssignments.forEach((a) => {
              const mId = a.module_id || a.moduleId;
              if (mId) passedModuleSet.add(mId.toString());
            });

            const allTrackModulesCompleted =
              trackModuleIds.length > 0 &&
              trackModuleIds.every((mId) => passedModuleSet.has(mId));

            if (allTrackModulesCompleted) {
              const engId = attempt.engineer_id;
              const existingCert = await Certificate.findOne({
                $and: [
                  { $or: [{ engineer_id: engId }, { userId: engId }] },
                  { $or: [{ track_id: trackId }, { trackId: trackId }] },
                  { status: 'active' },
                ],
              });

              if (!existingCert) {
                console.log(`[CERTIFICATE] Triggering auto-issuance for engineer ${engId} on track ${trackId}`);
                await generateCertificate(engId, trackId, mod.tier || 'L1_CORE');
              }
            }
          } catch (certErr) {
            console.error('[CERTIFICATE_ERROR] Auto-issuance failed:', certErr);
          }
        }
      }
    } else {
      // Review quiz passing threshold is 80% (Spec Section 4.3)
      attempt.passed = score_percent >= 80;
    }

    attempt.score_percent = score_percent;
    attempt.scorePercentage = score_percent;
    attempt.status = 'completed';
    attempt.completed_at = new Date();
    await attempt.save();

    res.json({
      score_percent: attempt.score_percent,
      passed: attempt.passed,
      responses, // includes correct_option and explanation for immediate feedback
    });
  } catch (error) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
};

module.exports = {
  startTopicQuiz,
  submitQuizAttempt,
};