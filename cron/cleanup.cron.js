const cron = require('node-cron');
const attachmentService = require('../services/attachment.service');

const initCleanupJob = () => {
    // Run at 00:00 on Sunday (Every 7 days)
    cron.schedule('0 0 * * 0', async () => {
        console.log('--- Scheduled S3 Cleanup Task Started ---');
        console.log('Timestamp:', new Date().toISOString());

        try {
            const result = await attachmentService.cleanupOrphans();
            console.log(`--- Scheduled S3 Cleanup Task Completed ---`);
            console.log(`Deleted ${result.deletedCount} orphan files.`);
        } catch (error) {
            console.error('--- Scheduled S3 Cleanup Task Failed ---');
            console.error(error);
        }
    });

    console.log('S3 Cleanup Job Scheduled: Runs every Sunday at 00:00');
};

module.exports = {
    initCleanupJob
};
