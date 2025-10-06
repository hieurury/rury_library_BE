import express from 'express';
const sachRouter = express.Router();

import sachController from '../controller/sachController.js';

//========================== ADMIN ==========================//
sachRouter.post('/create', sachController.createSach);


//========================== BOTH ==========================//
sachRouter.get('/all', sachController.getAllSach);

export default sachRouter;