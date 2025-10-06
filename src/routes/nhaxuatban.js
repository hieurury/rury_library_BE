import express from 'express';
import nhaXuatBanController from '../controller/admin/nhaXuatBanController.js';

//init
const NhaXuatBanRouter = express.Router();

//set routes
NhaXuatBanRouter.get('/', nhaXuatBanController.getAllNhaXuatBan);
NhaXuatBanRouter.post('/create', nhaXuatBanController.createNhaXuatBan);


//export
export default NhaXuatBanRouter;