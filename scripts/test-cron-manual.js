const { pool } = require('../config/database');
const petService = require('../services/pet.service');

const runTest = async () => {
    try {
        console.log('🧪 Starting Life Stage Update Test');
        
        // This is a manual test script that runs the update function directly
        // In a real scenario, we would assert database states, but here we will just run it
        // and check for lack of errors and valid output.
        
        const initialResult = await petService.updateAllPetLifeStages();
        console.log('✅ Update Function Execution Successful');
        console.log('📊 Result:', initialResult);
        
    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await pool.end();
    }
};

runTest();
