import cron from 'node-cron';
import billController from '../controller/billController.js';

// Chạy mỗi giờ
cron.schedule('0 * * * *', async () => {
    console.log('🧹 [CRON] Running bill cleanup job...');
    try {
        const deletedCount = await billController.cleanupExpiredBills();
        if (deletedCount > 0) {
            console.log(`✅ [CRON] Cleanup completed: ${deletedCount} bills deleted`);
        }
    } catch (error) {
        console.error('❌ [CRON] Cleanup job failed:', error);
    }
});

console.log('✅ Bill cleanup job scheduled (every hour)');

export default {};
