const assert = require('assert');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Module = require('../models/Module');
const Track = require('../models/Track');
const ModuleAttachment = require('../models/ModuleAttachment');
const {
  uploadModuleVideo,
  uploadModuleThumbnail,
  getModuleAttachments,
  uploadModuleAttachment,
  deleteModuleAttachment,
} = require('../controllers/adminModuleController');
const { getModuleById } = require('../controllers/moduleController');

const testVideoThumbnailAttachment = async () => {
  try {
    await connectDB();
    console.log('Testing Video Duration Calculation, PC Thumbnail Upload & Admin Attachment Management...\n');

    // Helper mock response
    const mockRes = () => {
      const res = {
        statusCode: 200,
        data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };
      return res;
    };

    // 1. Create a test track and module
    const testTrack = await Track.create({
      name: 'Fiber Testing Track',
      slug: `FIBER-${Date.now()}`,
      description: 'Track for testing media uploads',
      is_published: true,
    });

    const testModule = await Module.create({
      track_id: testTrack._id,
      title: 'M1: OTDR Field Splicing',
      slug: `module-test-${Date.now()}`,
      description: 'Splicing module test',
      tier: 'L1_CORE',
      video_duration_sec: 0,
      pass_threshold: 80,
    });

    // -------------------------------------------------------------
    // TEST 1: Video Upload & Exact Duration Calculation
    // -------------------------------------------------------------
    const reqVideo = {
      params: { id: testModule._id },
      body: {
        videoUrl: '/uploads/videos/sample_video.mp4',
        video_provider_id: 'sample_video.mp4',
        video_duration_sec: '284', // 4 mins 44 secs
      },
    };
    const resVideo = mockRes();
    await uploadModuleVideo(reqVideo, resVideo);

    assert.strictEqual(resVideo.statusCode, 200);
    assert.strictEqual(resVideo.data.video_duration_sec, 284);
    assert.strictEqual(resVideo.data.estimated_minutes, 5); // Math.round(284 / 60) = 5 mins

    const updatedModule1 = await Module.findById(testModule._id);
    assert.strictEqual(updatedModule1.video_duration_sec, 284);
    assert.strictEqual(updatedModule1.estimated_minutes, 5);
    console.log('✓ TEST 1 Passed: Video duration (284s) saved and estimated minutes (5 mins) computed accurately');

    // -------------------------------------------------------------
    // TEST 2: Custom PC Image Thumbnail Upload
    // -------------------------------------------------------------
    const reqThumb = {
      params: { id: testModule._id },
      file: {
        filename: `thumb_${Date.now()}.png`,
      },
    };
    const resThumb = mockRes();
    await uploadModuleThumbnail(reqThumb, resThumb);

    assert.strictEqual(resThumb.statusCode, 200);
    assert(resThumb.data.thumbnail_url.includes('/uploads/thumbnails/thumb_'));

    const updatedModule2 = await Module.findById(testModule._id);
    assert.strictEqual(updatedModule2.thumbnail_url, resThumb.data.thumbnail_url);
    console.log(`✓ TEST 2 Passed: Custom thumbnail (${updatedModule2.thumbnail_url}) uploaded and attached to module`);

    // -------------------------------------------------------------
    // TEST 3: Attachment Upload
    // -------------------------------------------------------------
    // Create dummy attachment file in uploads/attachments
    const dummyAttachName = `attach_test_${Date.now()}.pdf`;
    const dummyAttachPath = path.join(__dirname, '../uploads/attachments', dummyAttachName);
    fs.writeFileSync(dummyAttachPath, '%PDF-1.4 dummy content');

    const reqAttach = {
      params: { id: testModule._id },
      file: {
        filename: dummyAttachName,
        originalname: 'Fiber_Splicing_Field_Manual.pdf',
        mimetype: 'application/pdf',
        size: 1048576, // 1 MB
      },
    };
    const resAttach = mockRes();
    await uploadModuleAttachment(reqAttach, resAttach);

    assert.strictEqual(resAttach.statusCode, 201);
    assert.strictEqual(resAttach.data.attachment.filename, 'Fiber_Splicing_Field_Manual.pdf');
    assert.strictEqual(resAttach.data.attachment.file_size_bytes, 1048576);
    const createdAttachmentId = resAttach.data.attachment._id;
    console.log('✓ TEST 3 Passed: Attachment uploaded and saved with exact filename & file size');

    // -------------------------------------------------------------
    // TEST 4: Get Module Attachments & getModuleById
    // -------------------------------------------------------------
    const reqGetAttach = { params: { id: testModule._id } };
    const resGetAttach = mockRes();
    await getModuleAttachments(reqGetAttach, resGetAttach);

    assert.strictEqual(resGetAttach.statusCode, 200);
    assert(Array.isArray(resGetAttach.data));
    assert.strictEqual(resGetAttach.data.length, 1);
    assert.strictEqual(resGetAttach.data[0].filename, 'Fiber_Splicing_Field_Manual.pdf');

    // Test getModuleById endpoint also populates attachments
    const reqModById = { params: { id: testModule._id } };
    const resModById = mockRes();
    await getModuleById(reqModById, resModById);
    assert.strictEqual(resModById.statusCode, 200);
    assert(Array.isArray(resModById.data.attachments));
    assert.strictEqual(resModById.data.attachments.length, 1);
    console.log('✓ TEST 4 Passed: Attachments returned in both getModuleAttachments and getModuleById');

    // -------------------------------------------------------------
    // TEST 5: Delete Attachment & File Cleanup
    // -------------------------------------------------------------
    const reqDeleteAttach = {
      params: {
        moduleId: testModule._id,
        attachmentId: createdAttachmentId,
      },
    };
    const resDeleteAttach = mockRes();
    await deleteModuleAttachment(reqDeleteAttach, resDeleteAttach);

    assert.strictEqual(resDeleteAttach.statusCode, 200);

    const checkAttach = await ModuleAttachment.findById(createdAttachmentId);
    assert.strictEqual(checkAttach, null, 'Attachment record must be removed');
    assert.strictEqual(fs.existsSync(dummyAttachPath), false, 'Physical attachment file on disk must be deleted');
    console.log('✓ TEST 5 Passed: Attachment deleted from DB and physical file removed from disk');

    // Clean up
    await Module.deleteOne({ _id: testModule._id });
    await Track.deleteOne({ _id: testTrack._id });

    console.log('\n===================================================================');
    console.log('🎉 ALL VIDEO, THUMBNAIL & ATTACHMENT TESTS PASSED 100%');
    console.log('===================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
};

testVideoThumbnailAttachment();
