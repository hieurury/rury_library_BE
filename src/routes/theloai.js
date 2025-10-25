import express from 'express';
import { uploadCategoriesImage } from '../middleware/uploadFile.js';
const TheLoaiRouter = express.Router();

import theLoaiController from '../controller/theLoaiController.js'


TheLoaiRouter.post('/create', theLoaiController.createTheLoai);
TheLoaiRouter.post('/upload-icon', uploadCategoriesImage.single('icon'), theLoaiController.uploadCategoryIcon);
TheLoaiRouter.get('/all', theLoaiController.getAllCategories);
TheLoaiRouter.get('/top-categories', theLoaiController.getTopCategories);

export default TheLoaiRouter;