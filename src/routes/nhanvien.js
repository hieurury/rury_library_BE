import express from 'express';
import nhanVienController from '../controller/admin/nhanVienController.js';

//init
const NhanVienRouter = express.Router();

//set routes
NhanVienRouter.post('/create', nhanVienController.createNhanVien);
NhanVienRouter.post('/create-admin', nhanVienController.createAdmin);
NhanVienRouter.post('/login', nhanVienController.accountLogin);


//export
export default NhanVienRouter;