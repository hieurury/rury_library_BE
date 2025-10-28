import express from 'express';
import authenticateToken from '../middleware/jwt.js';
import { 
    createBill, 
    getBillById, 
    getBillsByDocGia, 
    vnpayReturn 
} from '../controller/billController.js';

const billRouter = express.Router();

// VNPay return URL - KHÔNG cần authentication (VNPay gọi trực tiếp)
billRouter.get('/vnpay/return', vnpayReturn);

// Tất cả routes khác đều cần authentication
billRouter.use(authenticateToken);

// POST - Tạo bill mới
billRouter.post('/create', createBill);

// GET - Lấy bill theo mã
billRouter.get('/get/:MABILL', getBillById);

// GET - Lấy tất cả bill của độc giả
billRouter.get('/docgia/:MADOCGIA', getBillsByDocGia);

export default billRouter;