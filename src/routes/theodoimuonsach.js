import express from 'express';
const theoDoiMuonSachRouter = express.Router();

import theoDoiMuonSachController from '../controller/theoDoiMuonSachController.js';

theoDoiMuonSachRouter.post('/add', theoDoiMuonSachController.createNewMuonSach);
theoDoiMuonSachRouter.get('/:MAPHIEU', theoDoiMuonSachController.getPhieuMuonChiTiet);
theoDoiMuonSachRouter.get('/user/:MADOCGIA', theoDoiMuonSachController.getSachMuonTheoMaDocGia);
//admin
theoDoiMuonSachRouter.get('/admin/all', theoDoiMuonSachController.getAllMuonSach);

export default theoDoiMuonSachRouter;