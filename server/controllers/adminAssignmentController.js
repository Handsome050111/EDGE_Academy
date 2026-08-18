const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const Module = require('../models/Module');
const Track = require('../models/Track');
const Progress = require('../models/Progress');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');
const { notifyAssignment } = require('../services/notificationService');

// Helper to log audit actions
const logAudit = async ({ req, action, resourceType, resourceId, outcome = 'success', description, metadata = {} }) => {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role || 'Unknown',
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : undefined,
      outcome,
      description,
      metadata,
    });
  } catch (error) {
    console.error('AuditLog creation error:', error.message);
  }
};

// @desc    Assign module(s) or entire track to engineers or team with deadline
// @route   POST /api/v1/admin/assignments
// @access  Private/Admin/TeamLead
const createAssignments = async (req, res) => {
  try {
    const {
      module_id,
      moduleId,
      track_id,
      trackId,
      engineer_ids,
      engineerIds,
      team_id,
      teamId,
      team_lead_id,
      teamLeadId,
      deadline_at,
    } = req.body;

    const targetTrackId = track_id || trackId;
    const targetModuleId = module_id || moduleId;

    if (!targetTrackId && !targetModuleId) {
      return res.status(400).json({ message: 'Either track_id or module_id is required' });
    }

    let trackDoc = null;
    let targetModules = [];

    if (targetTrackId) {
      trackDoc = await Track.findById(targetTrackId);
      if (!trackDoc) {
        return res.status(404).json({ message: 'Target track not found' });
      }

      // Fetch all modules belonging to this track
      targetModules = await Module.find({
        $or: [{ track_id: trackDoc._id }, { trackId: trackDoc._id }],
        status: { $ne: 'archived' },
      }).sort({ display_order: 1, createdAt: 1 });

      if (targetModules.length === 0) {
        return res.status(400).json({ message: 'Selected track contains no modules to assign' });
      }
    } else {
      const moduleDoc = await Module.findById(targetModuleId);
      if (!moduleDoc) {
        return res.status(404).json({ message: 'Target module not found' });
      }
      targetModules = [moduleDoc];
    }

    // Role-based target engineers validation
    const isTeamLead = req.user?.role === 'TeamLead' || req.user?.role === 'team_lead';
    let targetEngineerIds = engineer_ids || engineerIds || [];
    const targetTeamId = team_id || teamId;
    const targetLeadId = team_lead_id || teamLeadId;

    if (isTeamLead) {
      const userTeamId = req.user.team_id?.toString();

      // If team lead specified a team_id, ensure it's their own team
      if (targetTeamId && userTeamId && targetTeamId.toString() !== userTeamId) {
        return res.status(403).json({ message: 'Cannot assign modules to another team' });
      }

      // If specific engineers were specified, ensure all belong to this team lead
      if (Array.isArray(targetEngineerIds) && targetEngineerIds.length > 0) {
        const targetUsers = await User.find({ _id: { $in: targetEngineerIds } }).select('team_id teamId team_lead_id');
        for (const u of targetUsers) {
          const uTeam = (u.team_id || u.teamId)?.toString();
          const uLead = u.team_lead_id?.toString();
          const isMemberOfLead = (userTeamId && uTeam === userTeamId) || (uLead === req.user._id.toString());
          if (!isMemberOfLead) {
            return res.status(403).json({ message: 'Cannot assign to engineers outside your team squad' });
          }
        }
      } else {
        // Entire team squad of this Team Lead
        const squadOr = [{ team_lead_id: req.user._id }];
        if (userTeamId) {
          squadOr.push({ team_id: userTeamId }, { teamId: userTeamId });
        }
        const squad = await User.find({
          role: { $in: ['engineer', 'Engineer'] },
          is_active: { $ne: false },
          deleted_at: null,
          $or: squadOr,
        }).select('_id');
        targetEngineerIds = squad.map((u) => u._id.toString());
      }
    } else {
      // Admin flow: resolve team lead / team targets if no direct engineer_ids
      if ((!targetEngineerIds || targetEngineerIds.length === 0) && (targetTeamId || targetLeadId)) {
        const orConditions = [];

        if (targetTeamId) {
          orConditions.push({ team_id: targetTeamId }, { teamId: targetTeamId });
        }

        if (targetLeadId) {
          orConditions.push({ team_lead_id: targetLeadId }, { teamLeadId: targetLeadId });
          const managedTeams = await Team.find({ lead_user_id: targetLeadId }).select('_id');
          if (managedTeams && managedTeams.length > 0) {
            const managedTeamIds = managedTeams.map((t) => t._id);
            orConditions.push({ team_id: { $in: managedTeamIds } });
          }
        }

        if (orConditions.length > 0) {
          const teamEngineers = await User.find({
            role: { $in: ['engineer', 'Engineer'] },
            is_active: { $ne: false },
            deleted_at: null,
            $or: orConditions,
          }).select('_id');

          targetEngineerIds = teamEngineers.map((u) => u._id.toString());
        }
      }
    }

    if (!Array.isArray(targetEngineerIds) || targetEngineerIds.length === 0) {
      return res.status(400).json({
        message: isTeamLead
          ? 'No active engineers were found in your team squad to assign.'
          : 'At least one engineer or a valid team with active engineers is required.',
      });
    }

    const createdAssignments = [];

    for (const engId of targetEngineerIds) {
      if (!mongoose.Types.ObjectId.isValid(engId)) continue;

      const existingUser = await User.findById(engId);
      if (!existingUser) continue;

      // If track is assigned, ensure progress record exists for the engineer
      if (trackDoc) {
        await Progress.findOneAndUpdate(
          { userId: existingUser._id, trackId: trackDoc._id },
          {
            $setOnInsert: {
              userId: existingUser._id,
              trackId: trackDoc._id,
              completedModules: [],
              isCompleted: false,
            },
          },
          { upsert: true, new: true }
        );
      }

      // Create / upsert assignments for each module
      for (const mod of targetModules) {
        const assignment = await Assignment.findOneAndUpdate(
          { module_id: mod._id, engineer_id: existingUser._id },
          {
            module_id: mod._id,
            engineer_id: existingUser._id,
            assigned_by: req.user._id,
            deadline_at: deadline_at ? new Date(deadline_at) : null,
            status: 'pending',
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        createdAssignments.push(assignment);
      }

      // Dispatch Dual Notification (In-App Bell + Email)
      await notifyAssignment({
        engineer: existingUser,
        assignedBy: req.user,
        itemType: trackDoc ? 'track' : 'module',
        itemTitle: trackDoc ? (trackDoc.name || trackDoc.title) : targetModules[0].title,
        deadline: deadline_at,
        moduleCount: targetModules.length,
      });
    }

    const itemLabel = trackDoc ? `track '${trackDoc.name || trackDoc.title}' (${targetModules.length} modules)` : `module '${targetModules[0].title}'`;

    await logAudit({
      req,
      action: 'CREATE_ASSIGNMENT',
      resourceType: 'Assignment',
      outcome: 'success',
      description: `Assigned ${itemLabel} to ${targetEngineerIds.length} engineer(s)`,
      metadata: {
        trackId: trackDoc?._id,
        moduleId: !trackDoc ? targetModules[0]._id : undefined,
        assignedCount: targetEngineerIds.length,
        totalAssignmentsCreated: createdAssignments.length,
        deadline_at,
      },
    });

    return res.status(201).json({
      message: `Successfully assigned ${itemLabel} to ${targetEngineerIds.length} engineer(s)`,
      createdCount: targetEngineerIds.length,
      totalAssignments: createdAssignments.length,
      assignments: createdAssignments,
    });
  } catch (error) {
    console.error('Error in createAssignments:', error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAssignments,
};
