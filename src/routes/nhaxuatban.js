import express from 'express';
import nhaXuatBanController from '../controller/nhaXuatBanController.js';

//init
const NhaXuatBanRouter = express.Router();

//set routes
NhaXuatBanRouter.get('/all', nhaXuatBanController.getAllNhaXuatBan);
NhaXuatBanRouter.get('/all-with-stats', nhaXuatBanController.getAllNhaXuatBanWithStats);
NhaXuatBanRouter.post('/admin/create', nhaXuatBanController.createNhaXuatBan);
NhaXuatBanRouter.put('/update/:id', nhaXuatBanController.updateNhaXuatBan);
NhaXuatBanRouter.put('/activate/:id', nhaXuatBanController.activateNhaXuatBan);
NhaXuatBanRouter.delete('/delete/:id', nhaXuatBanController.deleteNhaXuatBan);


//export
export default NhaXuatBanRouter;