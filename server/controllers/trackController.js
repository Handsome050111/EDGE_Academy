const Track = require('../models/Track');
const Module = require('../models/Module');
const AuditLog = require('../models/AuditLog');

// @desc    Get all active tracks with populated modules
// @route   GET /api/tracks
// @access  Private (All authenticated users)
const getTracks = async (req, res) => {
  try {
    const tracks = await Track.find()
      .populate({
        path: 'modules',
        match: { status: { $ne: 'archived' }, deleted_at: null },
      })
      .sort({ display_order: 1, created_at: -1 });

    const allModules = await Module.find({
      status: { $ne: 'archived' },
      deleted_at: null,
    }).sort({ display_order: 1, created_at: 1 });

    const tracksWithModules = tracks.map((track) => {
      const trackObj = track.toObject();
      const trackIdStr = track._id.toString();

      const matchingModules = allModules.filter((m) => {
        const mTrackId = (m.track_id?._id || m.track_id || m.trackId?._id || m.trackId)?.toString();
        return mTrackId === trackIdStr;
      });

      const existingModIds = new Set((trackObj.modules || []).map((m) => (m._id || m).toString()));
      const combinedModules = [...(trackObj.modules || [])];

      matchingModules.forEach((m) => {
        if (!existingModIds.has(m._id.toString())) {
          combinedModules.push(m);
          existingModIds.add(m._id.toString());
        }
      });

      trackObj.modules = combinedModules;
      return trackObj;
    });

    res.json(tracksWithModules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single track by ID with populated modules
// @route   GET /api/tracks/:id
// @access  Private (All authenticated users)
const getTrackById = async (req, res) => {
  try {
    const track = await Track.findById(req.params.id).populate({
      path: 'modules',
      match: { status: { $ne: 'archived' }, deleted_at: null },
    });
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const trackObj = track.toObject();
    const trackIdStr = track._id.toString();

    const matchingModules = await Module.find({
      $or: [{ track_id: track._id }, { trackId: track._id }],
      status: { $ne: 'archived' },
      deleted_at: null,
    }).sort({ display_order: 1, created_at: 1 });

    const existingModIds = new Set((trackObj.modules || []).map((m) => (m._id || m).toString()));
    const combinedModules = [...(trackObj.modules || [])];

    matchingModules.forEach((m) => {
      if (!existingModIds.has(m._id.toString())) {
        combinedModules.push(m);
        existingModIds.add(m._id.toString());
      }
    });

    trackObj.modules = combinedModules;
    res.json(trackObj);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new track
// @route   POST /api/tracks
// @access  Private/Admin/SuperAdmin
const createTrack = async (req, res) => {
  try {
    const { name, title, description, slug, code, is_published, isPublished, icon, display_order, displayOrder } = req.body;

    const trackName = name || title;
    if (!trackName || !trackName.trim()) {
      return res.status(400).json({ message: 'Track name is required.' });
    }

    const trackSlug = (slug || code || trackName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()).trim();

    const track = new Track({
      name: trackName.trim(),
      slug: trackSlug,
      description: description ? description.trim() : '',
      icon: icon || null,
      is_published: is_published !== undefined ? is_published : (isPublished !== undefined ? isPublished : true),
      display_order: display_order || displayOrder || 0,
      modules: [],
    });

    const createdTrack = await track.save();

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'CREATE_TRACK',
        entity: 'Track',
        entity_id: createdTrack._id,
        details: { name: createdTrack.name, slug: createdTrack.slug },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      }).catch(() => {});
    }

    res.status(201).json(createdTrack);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a track
// @route   PUT /api/tracks/:id
// @access  Private/Admin/SuperAdmin
const updateTrack = async (req, res) => {
  try {
    const { name, title, description, slug, code, is_published, isPublished, icon, display_order, displayOrder } = req.body;

    const track = await Track.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    if (name || title) track.name = (name || title).trim();
    if (slug || code) track.slug = (slug || code).trim().toUpperCase();
    if (description !== undefined) track.description = description.trim();
    if (icon !== undefined) track.icon = icon;
    if (is_published !== undefined) track.is_published = is_published;
    else if (isPublished !== undefined) track.is_published = isPublished;
    if (display_order !== undefined) track.display_order = display_order;
    else if (displayOrder !== undefined) track.display_order = displayOrder;

    const updatedTrack = await track.save();

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'UPDATE_TRACK',
        entity: 'Track',
        entity_id: updatedTrack._id,
        details: { name: updatedTrack.name, slug: updatedTrack.slug },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      }).catch(() => {});
    }

    res.json(updatedTrack);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a track
// @route   DELETE /api/tracks/:id
// @access  Private/Admin/SuperAdmin
const deleteTrack = async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Delete or cascade modules attached to this track
    await Module.deleteMany({
      $or: [{ track_id: track._id }, { trackId: track._id }],
    });

    await track.deleteOne();

    // Log Audit Event
    if (req.user) {
      await AuditLog.create({
        user_id: req.user._id,
        action: 'DELETE_TRACK',
        entity: 'Track',
        entity_id: track._id,
        details: { name: track.name, slug: track.slug },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      }).catch(() => {});
    }

    res.json({ message: 'Track and associated modules deleted successfully' });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTracks,
  getTrackById,
  createTrack,
  updateTrack,
  deleteTrack,
};