const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
const notificationService = require('../services/notification.service');

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node test_push_notification.js <user_id>');
  process.exit(1);
}

async function testPush() {
  try {
    console.log(`Sending test notification to user: ${userId}`);
    
    // Check if user has tokens
    const tokens = await notificationService.getUserFCMTokens(userId);
    console.log(`Found ${tokens.length} FCM tokens for user`);
    
    if (tokens.length === 0) {
      console.warn('WARNING: User has no FCM tokens. Login with the Flutter app first!');
      process.exit(0);
    }

    const result = await notificationService.sendNotification(userId, {
      notification_type: 'booking_confirmation', // Changed to bypass preference check for testing
      title: 'Test Notification',
      message: 'This is a test notification from the backend script at ' + new Date().toLocaleTimeString(),
      delivery_method: 'push',
      priority: 'high'
    });

    console.log('Notification sent result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error sending notification:', error);
    process.exit(1);
  }
}

testPush();
