/**
 * S3 Cleanup Script
 * Run this script via cron (e.g., daily) to remove orphan files from S3.
 */

require('dotenv').config();
const attachmentService = require('../services/attachment.service');
const { pool } = require('../config/database');

async function main() {
  console.log('--- S3 Cleanup Task Started ---');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const result = await attachmentService.cleanupOrphans();
    console.log(`--- S3 Cleanup Task Completed Successfully ---`);
    console.log(`Deleted ${result.deletedCount} orphan files.`);
  } catch (error) {
    console.error('--- S3 Cleanup Task Failed ---');
    console.error(error);
    process.exit(1);
  } finally {
    // Close DB pool to allow process to exit
    await pool.end();
  }
}

main();
