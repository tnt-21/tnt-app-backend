const cron = require('node-cron');
const petService = require('../services/pet.service');

const initPetLifeStageJob = () => {
    // Run at midnight every day
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Starting Daily Pet Life Stage Update Job...');
        const startTime = Date.now();

        try {
            const result = await petService.updateAllPetLifeStages();
            const duration = Date.now() - startTime;
            
            console.log(`✅ Daily Pet Life Stage Update Job Completed in ${duration}ms`);
            console.log(`📊 Updated ${result.updated_count} pets to new life stages.`);
        } catch (error) {
            console.error('❌ Error in Daily Pet Life Stage Update Job:', error);
        }
    });

    console.log('📅 Pet Life Stage Cron Job initialized (Schedule: Midnight Daily)');
};

module.exports = {
    initPetLifeStageJob
};
