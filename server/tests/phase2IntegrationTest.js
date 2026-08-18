const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Notification = require('../models/Notification');
const {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

const runPhase2Test = async () => {
  try {
    console.log('🔄 Connecting to MongoDB for Phase 2 Notification Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/edge_academy');
    console.log('✅ Connected to MongoDB');

    let engineer = await User.findOne({ role: 'engineer' });
    if (!engineer) {
      engineer = await User.create({
        fullName: 'Test Notification Engineer',
        email: `notif_eng_${Date.now()}@technonex.de`,
        password: 'hashedpassword',
        role: 'engineer',
      });
    }

    const mockRes = () => {
      let resData = null;
      let resStatus = 200;
      return {
        status: (code) => {
          resStatus = code;
          return {
            json: (data) => {
              resData = data;
              return data;
            },
          };
        },
        json: (data) => {
          resData = data;
          return data;
        },
        getData: () => resData,
        getStatus: () => resStatus,
      };
    };

    console.log('\n--- 🧪 TEST 1: Trigger Notification Creation (createNotification) ---');
    const notif1 = await createNotification({
      recipient_id: engineer._id,
      title: 'New Module Assigned',
      message: 'You have been assigned M1: Cable Types & Connectors.',
      type: 'assignment',
      link: '/engineer',
    });

    const notif2 = await createNotification({
      recipient_id: engineer._id,
      title: 'Weekly Review Quiz Ready',
      message: 'Your Weekly Review Quiz for this week is ready.',
      type: 'review_quiz',
      link: '/review-quiz',
    });

    if (notif1 && notif2) {
      console.log('✅ TEST 1 PASSED: Created 2 notifications successfully');
      console.log(`   Notif 1: "${notif1.title}", Notif 2: "${notif2.title}"`);
    } else {
      console.error('❌ TEST 1 FAILED: Notification creation failed');
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 2: Fetch Notifications (GET /api/v1/notifications) ---');
    const req2 = { user: engineer };
    const res2 = mockRes();
    await getUserNotifications(req2, res2);

    const getResult = res2.getData();
    if (res2.getStatus() === 200 && getResult.unreadCount >= 2 && getResult.notifications.length >= 2) {
      console.log('✅ TEST 2 PASSED: Fetched notifications & unread count');
      console.log(`   Unread Count: ${getResult.unreadCount}, Total Returned: ${getResult.notifications.length}`);
    } else {
      console.error('❌ TEST 2 FAILED:', res2.getStatus(), getResult);
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 3: Mark Single Notification Read (PUT /api/v1/notifications/:id/read) ---');
    const req3 = { user: engineer, params: { id: notif1._id } };
    const res3 = mockRes();
    await markAsRead(req3, res3);

    if (res3.getStatus() === 200 && res3.getData()?.notification?.is_read === true) {
      console.log('✅ TEST 3 PASSED: Marked single notification as read');
    } else {
      console.error('❌ TEST 3 FAILED:', res3.getStatus(), res3.getData());
      process.exit(1);
    }

    console.log('\n--- 🧪 TEST 4: Mark All Read (PUT /api/v1/notifications/mark-all-read) ---');
    const req4 = { user: engineer };
    const res4 = mockRes();
    await markAllAsRead(req4, res4);

    if (res4.getStatus() === 200) {
      console.log('✅ TEST 4 PASSED: Marked all notifications as read');
      console.log(`   Modified Count: ${res4.getData().modifiedCount}`);
    } else {
      console.error('❌ TEST 4 FAILED:', res4.getStatus(), res4.getData());
      process.exit(1);
    }

    console.log('\n🎉 ALL PHASE 2 NOTIFICATION TESTS PASSED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  }
};

runPhase2Test();
