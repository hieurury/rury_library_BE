import express from 'express';
import authenticateToken from '../middleware/jwt.js';
import billController from '../controller/billController.js';

const billRouter = express.Router();

// VNPay return URL - KHÔNG cần authentication (VNPay gọi trực tiếp)
billRouter.get('/vnpay/return', billController.vnpayReturn);

// Tất cả routes khác đều cần authentication
billRouter.use(authenticateToken);

// POST - Tạo bill mới
billRouter.post('/create', billController.createBill);

// GET - Lấy bill theo mã
billRouter.get('/get/:MABILL', billController.getBillById);

// GET - Lấy tất cả bill của độc giả
billRouter.get('/docgia/:MADOCGIA', billController.getBillsByDocGia);

export default billRouter;