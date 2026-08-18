const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Module = require('../models/Module');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');
const QuizAttempt = require('../models/QuizAttempt');
const AttemptResponse = require('../models/AttemptResponse');
const ConceptScore = require('../models/ConceptScore');
const Certificate = require('../models/Certificate');

// @desc    Get aggregate team dashboard report
// @route   GET /api/v1/admin/reports/team/:id
// @access  Private/Admin/TeamLead
const getTeamReport = async (req, res) => {
  try {
    let teamParam = req.params.id;
    const isTeamLead = req.user?.role === 'TeamLead' || req.user?.role === 'team_lead';

    let engineerFilter = {};

    if (isTeamLead) {
      const orClauses = [{ team_lead_id: req.user._id }];
      if (req.user.team_id) {
        orClauses.push({ team_id: req.user.team_id });
        orClauses.push({ teamId: req.user.team_id });
      }
      engineerFilter = {
        $or: orClauses,
        role: { $in: ['engineer', 'Engineer'] },
        is_active: { $ne: false },
        deleted_at: null,
      };
    } else if (teamParam !== 'all' && teamParam !== 'me') {
      if (!mongoose.Types.ObjectId.isValid(teamParam)) {
        return res.status(400).json({ message: 'Invalid team ID' });
      }
      engineerFilter = {
        $or: [
          { team_id: teamParam },
          { teamId: teamParam },
          { team_lead_id: teamParam },
        ],
        role: { $in: ['engineer', 'Engineer'] },
        is_active: { $ne: false },
        deleted_at: null,
      };
    } else {
      engineerFilter = {
        role: { $in: ['engineer', 'Engineer'] },
        is_active: { $ne: false },
        deleted_at: null,
      };
    }

    const teamEngineers = await User.find(engineerFilter).select('_id full_name fullName email role status is_active');
    const engineerIds = teamEngineers.map((e) => e._id);

    const assignments = await Assignment.find({ engineer_id: { $in: engineerIds } });
    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter((a) => a.status === 'completed').length;
    const activeAssignments = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
    const completionRate = totalAssignments > 0 ? Number(((completedAssignments / totalAssignments) * 100).toFixed(1)) : 0;

    const attempts = await QuizAttempt.find({
      $or: [{ engineer_id: { $in: engineerIds } }, { userId: { $in: engineerIds } }],
    });

    const totalScores = attempts.reduce((acc, curr) => acc + (curr.score_percent !== undefined ? curr.score_percent : (curr.scorePercentage || 0)), 0);
    const averageQuizScore = attempts.length > 0 ? Number((totalScores / attempts.length).toFixed(1)) : 0;

    const certificates = await Certificate.find({
      $or: [{ engineer_id: { $in: engineerIds } }, { userId: { $in: engineerIds } }],
      status: 'active',
    });

    const engineers = [];
    for (const eng of teamEngineers) {
      const userAssignments = assignments.filter(
        (a) => (a.engineer_id || a.engineerId)?.toString() === eng._id.toString()
      );
      const engCompleted = userAssignments.filter((a) => a.status === 'completed').length;
      const engActive = userAssignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
      const progress = userAssignments.length > 0 ? Math.round((engCompleted / userAssignments.length) * 100) : 0;

      const userCertificates = certificates.filter(
        (c) => (c.engineer_id || c.userId)?.toString() === eng._id.toString()
      ).length;

      const engAttempts = attempts.filter(
        (a) => (a.engineer_id || a.userId)?.toString() === eng._id.toString()
      );
      const engTotalScore = engAttempts.reduce((sum, a) => sum + (a.score_percent !== undefined ? a.score_percent : (a.scorePercentage || 0)), 0);
      const engAvgScore = engAttempts.length > 0 ? Number((engTotalScore / engAttempts.length).toFixed(1)) : null;

      const lowestConcept = await ConceptScore.findOne({
        $or: [{ engineer_id: eng._id }, { userId: eng._id }],
      }).sort({ accuracy: 1 });

      engineers.push({
        _id: eng._id,
        id: eng._id,
        fullName: eng.full_name || eng.fullName,
        name: eng.full_name || eng.fullName,
        email: eng.email,
        role: eng.role || 'engineer',
        status: eng.status || (eng.is_active !== false ? 'active' : 'deactivated'),
        progress,
        totalAssignedCount: userAssignments.length,
        completedModulesCount: engCompleted,
        activeAssignmentsCount: engActive,
        earnedCertificatesCount: userCertificates,
        averageQuizScore: engAvgScore,
        weakConcept: lowestConcept ? lowestConcept.concept_tag : 'N/A',
      });
    }

    return res.json({
      teamId: teamParam,
      totalEngineers: teamEngineers.length,
      totalAssignments,
      completedAssignments,
      activeAssignments,
      completionRate,
      averageQuizScore,
      earnedCertificatesTotal: certificates.length,
      engineers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get per-module completion & score breakdown report (team-scoped for Team Leads)
// @route   GET /api/v1/admin/reports/module/:id
// @access  Private/Admin/TeamLead
const getModuleReport = async (req, res) => {
  try {
    const moduleId = req.params.id;
    const moduleDoc = await Module.findById(moduleId);

    if (!moduleDoc) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const isTeamLead = req.user?.role === 'TeamLead' || req.user?.role === 'team_lead';
    let attemptsQuery = {
      $or: [{ module_id: moduleId }, { moduleId: moduleId }],
    };

    if (isTeamLead) {
      const orClauses = [{ team_lead_id: req.user._id }];
      if (req.user.team_id) {
        orClauses.push({ team_id: req.user.team_id }, { teamId: req.user.team_id });
      }
      const teamEngineers = await User.find({
        $or: orClauses,
        role: { $in: ['engineer', 'Engineer'] },
        is_active: { $ne: false },
        deleted_at: null,
      }).select('_id');
      const engineerIds = teamEngineers.map((e) => e._id);

      attemptsQuery = {
        $and: [
          { $or: [{ module_id: moduleId }, { moduleId: moduleId }] },
          { $or: [{ engineer_id: { $in: engineerIds } }, { userId: { $in: engineerIds } }] },
        ],
      };
    }

    const attempts = await QuizAttempt.find(attemptsQuery);

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((a) => a.passed).length;
    const passRate = totalAttempts > 0 ? Number(((passedAttempts / totalAttempts) * 100).toFixed(1)) : 0;

    const totalScoreSum = attempts.reduce((sum, a) => sum + (a.score_percent !== undefined ? a.score_percent : (a.scorePercentage || 0)), 0);
    const averageScore = totalAttempts > 0 ? Number((totalScoreSum / totalAttempts).toFixed(1)) : 0;

    const attemptIds = attempts.map((a) => a._id);
    const responses = await AttemptResponse.find({
      quiz_attempt_id: { $in: attemptIds },
      is_correct: false,
    }).populate('question_id');

    const questionMissCounts = {};
    responses.forEach((resp) => {
      const q = resp.question_id;
      if (q) {
        const qId = q._id.toString();
        if (!questionMissCounts[qId]) {
          questionMissCounts[qId] = {
            questionId: q._id,
            prompt: q.prompt,
            conceptTag: q.concept_tag,
            missCount: 0,
          };
        }
        questionMissCounts[qId].missCount += 1;
      }
    });

    const topMissedQuestions = Object.values(questionMissCounts)
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 5);

    return res.json({
      moduleId: moduleDoc._id,
      moduleTitle: moduleDoc.title,
      totalAttempts,
      passedAttempts,
      passRate,
      averageScore,
      topMissedQuestions,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get weak concept breakdown sorted by lowest accuracy (team-scoped for Team Leads)
// @route   GET /api/v1/admin/reports/weak-concepts
// @access  Private/Admin/TeamLead
const getWeakConceptsReport = async (req, res) => {
  try {
    const isTeamLead = req.user?.role === 'TeamLead' || req.user?.role === 'team_lead';
    let matchStage = null;

    if (isTeamLead) {
      const orClauses = [{ team_lead_id: req.user._id }];
      if (req.user.team_id) {
        orClauses.push({ team_id: req.user.team_id }, { teamId: req.user.team_id });
      }
      const teamEngineers = await User.find({
        role: { $in: ['engineer', 'Engineer'] },
        is_active: { $ne: false },
        deleted_at: null,
        $or: orClauses,
      }).select('_id');
      const engineerIds = teamEngineers.map((e) => e._id);

      if (engineerIds.length === 0) {
        return res.json({ totalConceptsTracked: 0, weakConcepts: [] });
      }

      matchStage = {
        $or: [
          { engineer_id: { $in: engineerIds } },
          { userId: { $in: engineerIds } },
        ],
      };
    }

    const pipeline = [];
    if (matchStage) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: '$concept_tag',
          totalCorrect: { $sum: '$correct_count' },
          totalAttempts: { $sum: '$total_count' },
          engineerCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          concept_tag: '$_id',
          totalCorrect: 1,
          totalAttempts: 1,
          engineerCount: 1,
          accuracyPercentage: {
            $cond: [
              { $gt: ['$totalAttempts', 0] },
              { $round: [{ $multiply: [{ $divide: ['$totalCorrect', '$totalAttempts'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { accuracyPercentage: 1 } }
    );

    const weakConcepts = await ConceptScore.aggregate(pipeline);

    return res.json({
      totalConceptsTracked: weakConcepts.length,
      weakConcepts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTeamReport,
  getModuleReport,
  getWeakConceptsReport,
};
