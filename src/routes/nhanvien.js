import express from 'express';
import nhanVienController from '../controller/nhanVienController.js';
import { verifyToken } from '../middleware/jwt.js';

//init
const NhanVienRouter = express.Router();

//set routes
NhanVienRouter.post('/admin/create', nhanVienController.createNhanVien);
NhanVienRouter.post('/admin/create-admin', nhanVienController.createAdmin);
NhanVienRouter.post('/admin/login', nhanVienController.accountLogin);

// Profile management (requires authentication)
NhanVienRouter.get('/admin/profile', verifyToken, nhanVienController.getProfile);
NhanVienRouter.put('/admin/profile', verifyToken, nhanVienController.updateProfile);
NhanVienRouter.put('/admin/change-password', verifyToken, nhanVienController.changePassword);

// Password recovery (no authentication required)
NhanVienRouter.post('/admin/forgot-password', nhanVienController.forgotPassword);
NhanVienRouter.post('/admin/verify-otp', nhanVienController.verifyOTP);
NhanVienRouter.post('/admin/reset-password', nhanVienController.resetPassword);
NhanVienRouter.post('/admin/master-recovery', nhanVienController.masterRecovery);

// CRUD nhân viên
NhanVienRouter.get('/admin/all', nhanVienController.getAllNhanVien);
NhanVienRouter.get('/admin/statistics', nhanVienController.getStaffStatistics);
NhanVienRouter.get('/admin/:msnv', nhanVienController.getNhanVienById);
NhanVienRouter.put('/admin/:msnv', nhanVienController.updateNhanVien);
NhanVienRouter.delete('/admin/:msnv', nhanVienController.deleteNhanVien);

//export
export default NhanVienRouter;