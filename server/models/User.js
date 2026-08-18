const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    full_name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      alias: 'fullName',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Excludes password by default in queries
      alias: 'password',
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['engineer', 'team_lead', 'admin'],
        message: '{VALUE} is not a valid role',
      },
      default: 'engineer',
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      alias: 'teamId',
    },
    team_lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      alias: 'teamLeadId',
    },
    locale: {
      type: String,
      required: [true, 'Locale is required'],
      enum: {
        values: ['en', 'de'],
        message: '{VALUE} is not a valid locale',
      },
      default: 'en',
    },
    last_login_at: {
      type: Date,
      default: null,
    },
    email_verified_at: {
      type: Date,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
      alias: 'isActive',
    },
    deleted_at: {
      type: Date,
      default: null, // Soft delete / GDPR erasure as per Spec Section 5.1 & 10.3
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'deactivated', 'suspended'],
      default: 'active',
    },

    failed_login_attempts: {
      type: Number,
      default: 0,
    },
    lock_until: {
      type: Date,
      default: null,
    },
    invite_token: {
      type: String,
      default: null,
    },
    invite_token_expires: {
      type: Date,
      default: null,
    },
    reset_password_token: {
      type: String,
      default: null,
    },
    reset_password_expires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const bcrypt = require('bcryptjs');

// Automatically hash plain text passwords if passed directly
userSchema.pre('save', async function () {
  if (!this.isModified('password_hash')) return;
  if (
    typeof this.password_hash === 'string' &&
    !this.password_hash.startsWith('$2a$') &&
    !this.password_hash.startsWith('$2b$') &&
    !this.password_hash.startsWith('$2y$')
  ) {
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
  }
});

// Virtual property indicating whether the account is currently locked
userSchema.virtual('isLocked').get(function () {
  return Boolean(this.lock_until && this.lock_until > Date.now());
});

// Virtuals for backwards compatibility with createdAt/updatedAt
userSchema.virtual('createdAt').get(function () {
  return this.created_at;
});
userSchema.virtual('updatedAt').get(function () {
  return this.updated_at;
});

module.exports = mongoose.model('User', userSchema);
