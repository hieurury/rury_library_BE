import cron from 'node-cron';
import billController from '../controller/billController.js';
import BILL from '../models/BILL.js';
import TheoDoiMuonSach from '../models/THEODOIMUONSACH.js';
import BanSaoSach from '../models/BanSaoSach.js';
import { notifyBillCancelled } from '../utils/notificationHelper.js';

// Job hủy bills quá hạn thanh toán (> 3 ngày)
const cancelOverdueBills = async () => {
    try {
        const now = new Date();
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        // Tìm bills chưa thanh toán và quá 3 ngày
        const overdueBills = await BILL.find({
            TRANGTHAI: false,
            BIHUY: false,
            NGAYLAP: { $lt: threeDaysAgo }
        });
        
        if (overdueBills.length === 0) {
            console.log('🧹 [CANCEL] Không có bills quá hạn thanh toán');
            return 0;
        }
        
        let cancelledCount = 0;
        
        for (const bill of overdueBills) {
            // Lấy danh sách phiếu
            const phieuList = await TheoDoiMuonSach.find({
                MAPHIEU: { $in: bill.DANHSACHPHIEU },
                TINHTRANG: 'waiting'
            });
            
            if (phieuList.length > 0) {
                // Xóa các phiếu waiting
                await TheoDoiMuonSach.deleteMany({
                    MAPHIEU: { $in: phieuList.map(p => p.MAPHIEU) }
                });
                
                // Giải phóng các bản sao sách
                const maBanSaoList = phieuList.map(p => p.MA_BANSAO);
                await BanSaoSach.updateMany(
                    { MA_BANSAO: { $in: maBanSaoList } },
                    { TRANGTHAI: false }
                );
                
                // Đánh dấu bill bị hủy
                bill.BIHUY = true;
                await bill.save();
                
                // Tạo thông báo cho độc giả
                const soNgay = Math.ceil((now - new Date(bill.NGAYLAP)) / (1000 * 60 * 60 * 24));
                await notifyBillCancelled(bill.MADOCGIA, bill.MABILL, soNgay);
                
                cancelledCount++;
            }
        }
        
        console.log(`🧹 [CANCEL] Đã hủy ${cancelledCount} bills quá hạn thanh toán`);
        return cancelledCount;
    } catch (error) {
        console.error('❌ [CANCEL] Lỗi khi hủy bills quá hạn:', error);
        return 0;
    }
};

// Chạy mỗi ngày lúc 2:00 SA - Hủy bills quá 3 ngày chưa thanh toán
cron.schedule('0 2 * * *', async () => {
    console.log('🧹 [CRON] Running overdue bills cancellation job...');
    try {
        const cancelledCount = await cancelOverdueBills();
        if (cancelledCount > 0) {
            console.log(`✅ [CRON] Cancelled ${cancelledCount} overdue bills`);
        }
    } catch (error) {
        console.error('❌ [CRON] Overdue bill cancellation failed:', error);
    }
});

// Chạy ngay khi server khởi động
(async () => {
    console.log('🚀 [STARTUP] Running initial cleanup...');
    try {
        const deletedCount = await billController.cleanupExpiredBills();
        const cancelledCount = await cancelOverdueBills();
        console.log(`✅ [STARTUP] Initial cleanup completed:`);
        console.log(`   - Expired bills deleted: ${deletedCount}`);
        console.log(`   - Overdue bills cancelled: ${cancelledCount}`);
    } catch (error) {
        console.error('❌ [STARTUP] Initial cleanup failed:', error);
    }
})();

console.log('✅ Bill cleanup jobs scheduled');
console.log('   - Cleanup expired bills: Every hour');
console.log('   - Cancel overdue bills: Daily at 2:00 AM');
console.log('   - Initial cleanup: Running now...');

export default {};
