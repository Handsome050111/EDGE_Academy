const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Track = require('../models/Track');
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

    const assignments = await Assignment.find({
      $or: [
        { engineer_id: { $in: engineerIds } },
        { userId: { $in: engineerIds } },
      ],
    });
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

// @desc    Get system-wide aggregated admin overview report
// @route   GET /api/v1/admin/reports/overview
// @access  Private/Admin
const getAdminOverview = async (req, res) => {
  try {
    const [
      allUsers,
      allTracks,
      allModules,
      totalQuestions,
      allAssignments,
      allAttempts,
      allCertificates,
      weakConcepts,
    ] = await Promise.all([
      // 1. Users (no teams queried)
      User.find({ deleted_at: null }).select('role is_active status deleted_at').lean(),

      // 2. Tracks with modules
      Track.find({ deleted_at: null }).select('_id title name tier description is_published').lean(),

      // 3. Modules
      Module.find({ deleted_at: null }).select('_id track_id trackId status pass_threshold').lean(),

      // 4. Questions count
      Question.countDocuments({ deleted_at: null }),

      // 5. Assignments
      Assignment.find({}).select('status engineer_id userId module_id moduleId').lean(),

      // 6. Quiz Attempts
      QuizAttempt.find({ status: 'completed' }).select('passed score_percent scorePercentage engineer_id userId module_id moduleId').lean(),

      // 7. Certificates
      Certificate.find({}).select('tier status engineer_id userId track_id trackId').lean(),

      // 8. Organization Weak Concepts
      ConceptScore.aggregate([
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
        { $match: { totalAttempts: { $gt: 0 } } },
        { $sort: { accuracyPercentage: 1 } },
        { $limit: 6 },
      ]),
    ]);

    // Compute Workforce Metrics (engineers, team leads, admins, active/deactivated)
    let engineersCount = 0;
    let teamLeadsCount = 0;
    let adminsCount = 0;
    let activeUsersCount = 0;
    let deactivatedUsersCount = 0;

    for (const u of allUsers) {
      const roleStr = String(u.role || '').toLowerCase();
      if (roleStr === 'engineer') engineersCount++;
      else if (roleStr === 'team_lead' || roleStr === 'teamlead') teamLeadsCount++;
      else if (roleStr === 'admin') adminsCount++;

      const isActive = u.is_active !== false && u.status !== 'deactivated';
      if (isActive) activeUsersCount++;
      else deactivatedUsersCount++;
    }

    // Compute Curriculum Metrics
    let publishedModulesCount = 0;
    let draftModulesCount = 0;
    let archivedModulesCount = 0;

    for (const m of allModules) {
      const s = m.status || 'draft';
      if (s === 'published') publishedModulesCount++;
      else if (s === 'draft') draftModulesCount++;
      else if (s === 'archived') archivedModulesCount++;
    }

    // Compute Assignment Velocity (no overdue)
    const totalAssignments = allAssignments.length;
    let completedAssignments = 0;
    let inProgressAssignments = 0;
    let pendingAssignments = 0;

    for (const a of allAssignments) {
      if (a.status === 'completed') completedAssignments++;
      else if (a.status === 'in_progress') inProgressAssignments++;
      else pendingAssignments++;
    }
    const assignmentCompletionRate = totalAssignments > 0
      ? Number(((completedAssignments / totalAssignments) * 100).toFixed(1))
      : 0;

    // Compute Quiz Mastery Metrics
    const totalQuizAttempts = allAttempts.length;
    let passedAttemptsCount = 0;
    let totalScoreSum = 0;

    for (const qa of allAttempts) {
      if (qa.passed) passedAttemptsCount++;
      const s = qa.score_percent !== undefined ? qa.score_percent : (qa.scorePercentage || 0);
      totalScoreSum += s;
    }
    const failedAttemptsCount = totalQuizAttempts - passedAttemptsCount;
    const globalPassRate = totalQuizAttempts > 0
      ? Number(((passedAttemptsCount / totalQuizAttempts) * 100).toFixed(1))
      : 0;
    const averageQuizScore = totalQuizAttempts > 0
      ? Number((totalScoreSum / totalQuizAttempts).toFixed(1))
      : 0;

    // Compute Certificate Governance Metrics
    let activeCertsCount = 0;
    let edgeCertsCount = 0;
    let coreCertsCount = 0;
    let revokedCertsCount = 0;

    for (const c of allCertificates) {
      if (c.status === 'active') {
        activeCertsCount++;
        const tierStr = String(c.tier || '').toUpperCase();
        if (tierStr === 'CORE' || tierStr === 'L2_ADVANCED') coreCertsCount++;
        else edgeCertsCount++;
      } else if (c.status === 'revoked') {
        revokedCertsCount++;
      }
    }

    // Compute Track-Level Health Breakdown
    const tracksHealth = allTracks.map((tr) => {
      const trIdStr = tr._id.toString();
      const trackMods = allModules.filter(
        (m) => (m.track_id || m.trackId)?.toString() === trIdStr && m.status === 'published'
      );
      const trackModIds = new Set(trackMods.map((m) => m._id.toString()));

      // Count distinct engineers enrolled via assignments
      const enrolledEngineers = new Set();
      const completedEngineers = new Set();

      for (const a of allAssignments) {
        const mId = (a.module_id || a.moduleId)?.toString();
        if (trackModIds.has(mId)) {
          const engId = (a.engineer_id || a.userId)?.toString();
          if (engId) enrolledEngineers.add(engId);
        }
      }

      // Count certified engineers for this track
      for (const c of allCertificates) {
        const tId = (c.track_id || c.trackId)?.toString();
        if (tId === trIdStr && c.status === 'active') {
          const engId = (c.engineer_id || c.userId)?.toString();
          if (engId) completedEngineers.add(engId);
        }
      }

      const enrolledCount = enrolledEngineers.size;
      const completedCount = completedEngineers.size;
      const trackCompletionRate = enrolledCount > 0
        ? Math.min(100, Math.round((completedCount / enrolledCount) * 100))
        : (completedCount > 0 ? 100 : 0);

      return {
        _id: tr._id,
        title: tr.title || tr.name,
        tier: tr.tier || 'EDGE',
        description: tr.description || '',
        publishedModulesCount: trackMods.length,
        enrolledEngineersCount: enrolledCount,
        completedEngineersCount: completedCount,
        completionRate: trackCompletionRate,
      };
    });

    return res.json({
      workforce: {
        totalUsers: allUsers.length,
        engineers: engineersCount,
        teamLeads: teamLeadsCount,
        admins: adminsCount,
        activeUsers: activeUsersCount,
        deactivatedUsers: deactivatedUsersCount,
      },
      curriculum: {
        totalTracks: allTracks.length,
        totalModules: allModules.length,
        publishedModules: publishedModulesCount,
        draftModules: draftModulesCount,
        archivedModules: archivedModulesCount,
        totalQuestions,
      },
      assignments: {
        total: totalAssignments,
        completed: completedAssignments,
        inProgress: inProgressAssignments,
        pending: pendingAssignments,
        completionRate: assignmentCompletionRate,
      },
      quizzes: {
        totalAttempts: totalQuizAttempts,
        passedAttempts: passedAttemptsCount,
        failedAttempts: failedAttemptsCount,
        passRate: globalPassRate,
        averageScore: averageQuizScore,
      },
      certificates: {
        totalActive: activeCertsCount,
        edgeCertificates: edgeCertsCount,
        coreCertificates: coreCertsCount,
        revokedCertificates: revokedCertsCount,
      },
      tracksHealth,
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
  getAdminOverview,
};

