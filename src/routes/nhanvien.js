import express from 'express';
import nhanVienController from '../controller/nhanVienController.js';

//init
const NhanVienRouter = express.Router();

//set routes
NhanVienRouter.post('/admin/create', nhanVienController.createNhanVien);
NhanVienRouter.post('/admin/create-admin', nhanVienController.createAdmin);
NhanVienRouter.post('/admin/login', nhanVienController.accountLogin);


//export
export default NhanVienRouter;