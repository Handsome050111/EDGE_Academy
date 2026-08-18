const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Team = require('../models/Team');
const AuditLog = require('../models/AuditLog');
const { notifyTeamAssignment, notifyTeamLeadAssignment, notifyUserInvitation } = require('../services/notificationService');

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

// @desc    Direct user creation by Admin / Super Admin
// @route   POST /api/v1/admin/users
// @access  Private/Admin/SuperAdmin
const createUser = async (req, res) => {
  try {
    const { fullName, email, password, role, team_id, teamId, locale } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'fullName, email, and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser && !existingUser.deleted_at) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const formattedRole = String(role || 'engineer').toLowerCase().trim();
    const validRoles = ['engineer', 'team_lead', 'admin'];
    if (!validRoles.includes(formattedRole)) {
      return res.status(400).json({ message: `Invalid role '${role}'. Valid roles are: ${validRoles.join(', ')}` });
    }

    const effectiveTeamId = formattedRole === 'engineer' ? (team_id || teamId || null) : null;

    let user;
    if (existingUser && existingUser.deleted_at) {
      existingUser.full_name = fullName.trim();
      existingUser.password_hash = hashedPassword;
      existingUser.role = formattedRole;
      existingUser.team_id = effectiveTeamId;
      existingUser.team_lead_id = null;
      existingUser.locale = locale || 'en';
      existingUser.status = 'active';
      existingUser.is_active = true;
      existingUser.deleted_at = null;
      existingUser.lock_until = null;
      existingUser.failed_login_attempts = 0;
      existingUser.invite_token = null;
      existingUser.invite_token_expires = null;
      user = await existingUser.save();
    } else {
      user = await User.create({
        full_name: fullName.trim(),
        email: cleanEmail,
        password_hash: hashedPassword,
        role: formattedRole,
        team_id: effectiveTeamId,
        locale: locale || 'en',
        status: 'active',
        is_active: true,
        deleted_at: null,
      });
    }

    await logAudit({
      req,
      action: 'CREATE_USER',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Created user ${user.email} with role '${user.role}'`,
      metadata: { role: user.role, email: user.email },
    });

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        fullName: user.full_name || user.fullName,
        email: user.email,
        role: user.role,
        team_id: user.team_id,
        locale: user.locale,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Invite user by email
// @route   POST /api/v1/admin/users/invite
// @access  Private/Admin/SuperAdmin
const inviteUser = async (req, res) => {
  try {
    const { email, fullName, role, team_id, teamId, locale } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const formattedRole = String(role || 'engineer').toLowerCase().trim();
    const validRoles = ['engineer', 'team_lead', 'admin', 'super_admin'];
    if (!validRoles.includes(formattedRole)) {
      return res.status(400).json({ message: `Invalid role '${role}'` });
    }

    let user = await User.findOne({ email: cleanEmail });
    if (user && user.status === 'active' && !user.deleted_at) {
      return res.status(400).json({ message: 'User is already active and registered' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);

    const effectiveTeamId = formattedRole === 'engineer' ? (team_id || teamId || null) : null;

    if (user) {
      user.full_name = (fullName || user.full_name || user.fullName || cleanEmail.split('@')[0]).trim();
      user.role = formattedRole;
      user.team_id = effectiveTeamId;
      user.team_lead_id = null;
      user.invite_token = token;
      user.invite_token_expires = expiresAt;
      user.status = 'pending';
      user.is_active = true;
      user.deleted_at = null;
      user.lock_until = null;
      user.failed_login_attempts = 0;
      await user.save();
    } else {
      user = await User.create({
        full_name: (fullName || cleanEmail.split('@')[0]).trim(),
        email: cleanEmail,
        password_hash: dummyPassword,
        role: formattedRole,
        team_id: effectiveTeamId,
        locale: locale || 'en',
        status: 'pending',
        is_active: true,
        invite_token: token,
        invite_token_expires: expiresAt,
        deleted_at: null,
      });
    }


    const inviteLink = `/invite/accept?token=${token}`;

    // Dual Notification: in-app bell + Resend email dispatch
    await notifyUserInvitation({ user, token, isResend: false });

    await logAudit({
      req,
      action: 'INVITE_USER',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Invited user ${user.email} (Role: ${user.role})`,
      metadata: { invite_token: token, inviteLink },
    });

    return res.status(201).json({
      message: `Invitation generated successfully for ${user.email}`,
      invite_token: token,
      inviteLink,
      expiresAt,
      user: {
        _id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users list (strictly scoped to assigned team for Team Leads)
// @route   GET /api/v1/admin/users
// @access  Private/Admin/SuperAdmin/TeamLead
const getUsers = async (req, res) => {
  try {
    const isTeamLead = req.user?.role === 'TeamLead' || req.user?.role === 'team_lead';
    const andClauses = [];

    if (req.query.includeDeleted !== 'true') {
      andClauses.push({
        $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      });
    }

    if (isTeamLead) {
      const leadOr = [{ team_lead_id: req.user._id }];
      if (req.user.team_id) {
        leadOr.push({ team_id: req.user.team_id });
        leadOr.push({ teamId: req.user.team_id });
      }
      andClauses.push({ $or: leadOr });
      andClauses.push({ role: { $in: ['engineer', 'Engineer'] } });
    } else {
      if (req.query.role) andClauses.push({ role: req.query.role.toLowerCase() });
    }

    if (req.query.status) andClauses.push({ status: req.query.status });

    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: 'i' };
      andClauses.push({
        $or: [
          { full_name: searchRegex },
          { fullName: searchRegex },
          { email: searchRegex },
        ],
      });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};

    const users = await User.find(query)
      .populate('team_id', 'name region')
      .populate('team_lead_id', 'full_name fullName email role')
      .select('-password_hash -password')
      .sort({ created_at: -1, createdAt: -1 });
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Soft delete user (SuperAdmin only)
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/SuperAdmin
const softDeleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.user?._id && req.user._id.toString() === userId.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own active account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.deleted_at) {
      return res.status(400).json({ message: 'User is already deleted' });
    }

    user.deleted_at = new Date();
    user.is_active = false;
    user.isActive = false;
    user.status = 'deactivated';
    await user.save();

    await logAudit({
      req,
      action: 'DELETE_USER',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Soft-deleted user ${user.email} (Role: ${user.role})`,
      metadata: { email: user.email, role: user.role, deleted_at: user.deleted_at },
    });

    return res.json({
      message: `User '${user.full_name || user.fullName || user.email}' soft-deleted successfully`,
      user: {
        _id: user._id,
        fullName: user.fullName || user.full_name,
        email: user.email,
        role: user.role,
        deleted_at: user.deleted_at,
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


// @desc    Update user role (SuperAdmin only)
// @route   PUT /api/v1/admin/users/:id/role
// @access  Private/SuperAdmin
const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'role is required' });
    }

    const formattedRole = String(role).toLowerCase().trim();
    const validRoles = ['engineer', 'team_lead', 'admin'];
    if (!validRoles.includes(formattedRole)) {
      return res.status(400).json({ message: `Invalid role '${role}'. Valid roles are: ${validRoles.join(', ')}` });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousRole = user.role;
    user.role = formattedRole;
    await user.save();

    await logAudit({
      req,
      action: 'UPDATE_USER_ROLE',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Changed role for ${user.email} from '${previousRole}' to '${formattedRole}'`,
      metadata: { previousRole, newRole: formattedRole, email: user.email },
    });

    return res.json({
      message: `User role updated to '${formattedRole}'`,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Activate or deactivate user (SuperAdmin only)
// @route   PUT /api/v1/admin/users/:id/status
// @access  Private/SuperAdmin
const updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { isActive, is_active, status } = req.body || {};

    let activeFlag = null;
    if (typeof isActive === 'boolean') {
      activeFlag = isActive;
    } else if (typeof is_active === 'boolean') {
      activeFlag = is_active;
    } else if (status === 'deactivated' || status === 'inactive') {
      activeFlag = false;
    } else if (status === 'active') {
      activeFlag = true;
    }

    if (activeFlag === null) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'isActive (boolean) or status is required' } });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousStatus = user.is_active;
    user.is_active = activeFlag;
    user.isActive = activeFlag;
    user.status = activeFlag ? 'active' : 'deactivated';
    await user.save();


    await logAudit({
      req,
      action: 'UPDATE_USER_STATUS',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `${activeFlag ? 'Activated' : 'Deactivated'} user ${user.email}`,
      metadata: { previousActive: previousStatus, newActive: activeFlag, email: user.email },
    });


    return res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all teams
// @route   GET /api/v1/admin/teams
// @access  Private/Admin/SuperAdmin/TeamLead
const getTeams = async (req, res) => {
  try {
    const teams = await Team.find().populate('lead_user_id', 'full_name fullName email');
    return res.json(teams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all active Team Leads
// @route   GET /api/v1/admin/team-leads
// @access  Private/Admin/SuperAdmin/TeamLead
const getTeamLeads = async (req, res) => {
  try {
    const leads = await User.find({
      role: { $regex: /^team[-_ ]?lead$/i },
      $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
      is_active: { $ne: false },
    })
      .select('_id full_name fullName email role status is_active team_id')
      .populate('team_id', 'name region')
      .sort({ full_name: 1, fullName: 1, email: 1 });
    return res.json(leads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Assign or change an engineer's Team Lead
// @route   PUT /api/v1/admin/users/:id/team-lead
// @access  Private/Admin/SuperAdmin
const assignEngineerTeamLead = async (req, res) => {
  try {
    const userId = req.params.id;
    const { teamLeadId, team_lead_id, teamId, team_id } = req.body;
    const targetLeadId = teamLeadId !== undefined ? teamLeadId : (team_lead_id !== undefined ? team_lead_id : (teamId || team_id));

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role.toLowerCase() !== 'engineer') {
      return res.status(400).json({ message: 'Team Leads can only be assigned to users with the Engineer role' });
    }

    let teamLead = null;

    if (targetLeadId && targetLeadId !== 'null' && targetLeadId !== '') {
      // Find Team Lead User
      teamLead = await User.findOne({
        _id: targetLeadId,
        role: { $in: ['team_lead', 'TeamLead'] },
      });

      if (!teamLead) {
        // Fallback: check if target is a team ID
        const team = await Team.findById(targetLeadId).populate('lead_user_id', 'full_name fullName email role');
        if (team && team.lead_user_id) {
          teamLead = team.lead_user_id;
        }
      }

      if (!teamLead) {
        return res.status(404).json({ message: 'Target Team Lead not found' });
      }

      user.team_lead_id = teamLead._id;
      user.team_id = teamLead.team_id || null;
    } else {
      user.team_lead_id = null;
      user.team_id = null;
    }

    await user.save();

    await logAudit({
      req,
      action: teamLead ? 'ASSIGN_ENGINEER_TEAM_LEAD' : 'UNASSIGN_ENGINEER_TEAM_LEAD',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: teamLead
        ? `Assigned Team Lead '${teamLead.full_name || teamLead.fullName}' (${teamLead.email}) to engineer '${user.email}'`
        : `Removed Team Lead assignment from engineer '${user.email}'`,
      metadata: {
        engineer_id: user._id,
        team_lead_id: teamLead?._id || null,
        team_lead_email: teamLead?.email || null,
        email: user.email,
      },
    });

    // Dispatch dual in-app and email notifications
    if (teamLead) {
      await notifyTeamLeadAssignment({
        engineer: user,
        teamLead,
      });
    }

    const updatedUser = await User.findById(userId)
      .populate('team_id', 'name region')
      .populate('team_lead_id', 'full_name fullName email role')
      .select('-password_hash -password');

    return res.json({
      message: teamLead
        ? `Team Lead '${teamLead.full_name || teamLead.fullName}' assigned to engineer successfully`
        : 'Team Lead unassigned from engineer successfully',
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile fields (name, locale, team)
// @route   PUT /api/v1/admin/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { fullName, full_name, locale, team_id, teamId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedName = fullName || full_name;
    if (updatedName !== undefined) {
      user.full_name = updatedName.trim();
    }
    if (locale !== undefined) {
      user.locale = locale;
    }
    const newTeamId = team_id !== undefined ? team_id : teamId;
    if (newTeamId !== undefined) {
      user.team_id = newTeamId || null;
    }

    await user.save();

    await logAudit({
      req,
      action: 'UPDATE_USER',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Updated profile for ${user.email}`,
      metadata: { email: user.email },
    });

    const updatedUser = await User.findById(userId)
      .populate('team_id', 'name region')
      .populate('team_lead_id', 'full_name fullName email role')
      .select('-password_hash -password');

    return res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Resend invitation to a pending user
// @route   POST /api/v1/admin/users/:id/resend-invite
// @access  Private/Admin
const resendInvite = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.status === 'active' && !user.invite_token) {
      return res.status(400).json({ message: 'User is already active and registered. No invite to resend.' });
    }

    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    user.invite_token = token;
    user.invite_token_expires = expiresAt;
    user.status = 'pending';
    user.is_active = true;
    user.deleted_at = null;
    await user.save();

    const inviteLink = `/invite/accept?token=${token}`;

    // Dual Notification: in-app bell + Resend email dispatch
    await notifyUserInvitation({ user, token, isResend: true });

    await logAudit({
      req,
      action: 'RESEND_INVITE',
      resourceType: 'User',
      resourceId: user._id,
      outcome: 'success',
      description: `Resent invitation for ${user.email}`,
      metadata: { invite_token: token, inviteLink, expiresAt },
    });

    return res.json({
      message: `Invitation resent successfully to ${user.email}`,
      invite_token: token,
      inviteLink,
      expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createUser,
  inviteUser,
  getUsers,
  softDeleteUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  getTeams,
  getTeamLeads,
  assignEngineerTeamLead,
  assignUserTeam: assignEngineerTeamLead,
  resendInvite,
};
