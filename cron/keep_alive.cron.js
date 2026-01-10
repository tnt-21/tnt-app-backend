const cron = require('node-cron');
const axios = require('axios');

const initKeepAliveJob = () => {
    // Render free tier spins down after 15 minutes of inactivity.
    // We ping the server every 14 minutes to keep it active.
    cron.schedule('*/14 * * * *', async () => {
        const backendUrl = process.env.RENDER_EXTERNAL_URL || process.env.API_URL;
        
        if (!backendUrl) {
            console.log('⚠️ Keep-alive cron skipped: No RENDER_EXTERNAL_URL or API_URL environment variable set.');
            return;
        }

        console.log(`⏰ Sending keep-alive ping to ${backendUrl}...`);

        try {
            const response = await axios.get(`${backendUrl}/health`);
            console.log(`✅ Keep-alive ping successful: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.error('❌ Keep-alive ping failed:', error.message);
        }
    });

    console.log('📅 Keep-Alive Cron Job initialized (Schedule: Every 14 minutes)');
};

module.exports = {
    initKeepAliveJob
};
