const Track = require('../models/Track');
const Progress = require('../models/Progress');

/**
 * Auto-enrolls an engineer into all published EDGE and CORE tracks by creating
 * Progress records (upsert — safe to call multiple times).
 *
 * Called at TWO hook points:
 *   1. adminUserController.createUser  — when admin directly creates an engineer
 *   2. authController.acceptInvite     — when an invited engineer accepts & activates
 *
 * Atomicity strategy: BEST-EFFORT with structured warning.
 * The calling function must NOT fail/rollback just because enrollment fails.
 * A missing Progress record is recoverable via the backfill endpoint; a failed user
 * creation is not.
 *
 * @param {import('mongoose').Types.ObjectId|string} userId  — the newly active engineer's _id
 * @returns {Promise<{ enrolled: string[], skipped: string[], error: string|null }>}
 */
async function autoEnrollEngineer(userId) {
  const result = { enrolled: [], skipped: [], error: null };

  try {
    // Find all published EDGE and CORE tracks, ordered by display_order
    const tracks = await Track.find({
      tier: { $in: ['EDGE', 'CORE'] },
      is_published: true,
      $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }],
    })
      .select('_id tier')
      .sort({ display_order: 1, created_at: 1 })
      .lean();

    if (tracks.length === 0) {
      console.warn(`[AutoEnroll] No published EDGE/CORE tracks found for user ${userId} — enrollment skipped. Run backfill after seeding tracks.`);
      result.error = 'NO_TRACKS_FOUND';
      return result;
    }

    for (const track of tracks) {
      try {
        const existing = await Progress.findOne({ userId, trackId: track._id }).lean();
        if (existing) {
          result.skipped.push(track._id.toString());
          continue;
        }

        await Progress.create({
          userId,
          trackId: track._id,
          completedModules: [],
          isCompleted: false,
        });

        result.enrolled.push(track._id.toString());
      } catch (trackErr) {
        // Duplicate key (race condition on concurrent requests) is safe to ignore
        if (trackErr.code === 11000) {
          result.skipped.push(track._id.toString());
        } else {
          console.warn(`[AutoEnroll] Failed to create Progress for user ${userId}, track ${track._id} (${track.tier}): ${trackErr.message}`);
          result.error = trackErr.message;
        }
      }
    }
  } catch (err) {
    console.error(`[AutoEnroll] Fatal error enrolling user ${userId}: ${err.message}`);
    result.error = err.message;
  }

  return result;
}

module.exports = { autoEnrollEngineer };
