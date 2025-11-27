import express from 'express';
import nhanVienController from '../controller/nhanVienController.js';

//init
const NhanVienRouter = express.Router();

//set routes
NhanVienRouter.post('/admin/create', nhanVienController.createNhanVien);
NhanVienRouter.post('/admin/create-admin', nhanVienController.createAdmin);
NhanVienRouter.post('/admin/login', nhanVienController.accountLogin);

// CRUD nhân viên
NhanVienRouter.get('/admin/all', nhanVienController.getAllNhanVien);
NhanVienRouter.get('/admin/statistics', nhanVienController.getStaffStatistics);
NhanVienRouter.get('/admin/:msnv', nhanVienController.getNhanVienById);
NhanVienRouter.put('/admin/:msnv', nhanVienController.updateNhanVien);
NhanVienRouter.delete('/admin/:msnv', nhanVienController.deleteNhanVien);

//export
export default NhanVienRouter;