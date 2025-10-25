import express from 'express';
const sachRouter = express.Router();
import {uploadBooksImage} from '../middleware/uploadFile.js';
import sachController from '../controller/sachController.js';

//========================== ADMIN ==========================//
sachRouter.post('/admin/create', sachController.createSach);
sachRouter.post('/admin/upload-image', uploadBooksImage.single('image'), sachController.uploadBookImage);
sachRouter.delete('/admin/delete/:maSach', sachController.deleteBook);
sachRouter.put('/admin/update/:id', sachController.updateBook);
//========================== BOTH ==========================//
sachRouter.get('/all', sachController.getAllSach);
sachRouter.get('/top-books', sachController.getTopBooks);
sachRouter.get('/:id', sachController.getSachById);
sachRouter.get('/template/:id', sachController.getTemplateSach);


export default sachRouter;