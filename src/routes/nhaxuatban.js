import express from 'express';
import nhaXuatBanController from '../controller/admin/nhaXuatBanController.js';

//init
const NhaXuatBanRouter = express.Router();

//set routes
NhaXuatBanRouter.get('/all', nhaXuatBanController.getAllNhaXuatBan);
NhaXuatBanRouter.post('/admin/create', nhaXuatBanController.createNhaXuatBan);


//export
export default NhaXuatBanRouter;