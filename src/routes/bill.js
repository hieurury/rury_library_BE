import express from 'express';
import authenticateToken from '../middleware/jwt.js';
import billController from '../controller/billController.js';

const billRouter = express.Router();

// VNPay return URL - KHÔNG cần authentication (VNPay gọi trực tiếp)

// Routes ADMIN - KHÔNG cần JWT (cho thủ thư sử dụng)
billRouter.get('/admin/pending-pickup', billController.getPendingPickupBills);
billRouter.post('/admin/confirm-pickup', billController.confirmPickup);

// Tất cả routes khác đều cần authentication (cho client web)
billRouter.use(authenticateToken);

// POST - Tạo bill mới
billRouter.post('/checkBill', billController.checkBillThanhToan);
billRouter.post('/checkBillPayPal', billController.checkBillPayPal);
billRouter.post('/create', billController.createBill);

// GET - Lấy bill theo mã
billRouter.get('/get/:MABILL', billController.getBillById);

// GET - Lấy tất cả bill của độc giả
billRouter.get('/docgia/:MADOCGIA', billController.getBillsByDocGia);

// POST - Hủy bill (chỉ cho phiếu waiting, chưa thanh toán)
billRouter.post('/cancel', billController.cancelBill);

export default billRouter;