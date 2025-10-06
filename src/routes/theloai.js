import express from 'express';
import multer from 'multer';
import path from 'path';
import { upload } from '..//middleware/uploadFile.js';
const TheLoaiRouter = express.Router();

import theLoaiController from '../controller/theLoaiController.js'


TheLoaiRouter.post('/create', theLoaiController.createTheLoai);
TheLoaiRouter.post('/upload-icon', upload.single('icon'), theLoaiController.uploadCategoryIcon);
TheLoaiRouter.get('/all', theLoaiController.getAllCategories);

export default TheLoaiRouter;