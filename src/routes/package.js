import express      from    'express';
const packageRouter =       express.Router();

import packageController from '../controller/admin/packageController.js';

packageRouter.post('/add', packageController.createPackage);
packageRouter.get('/all', packageController.getAllPackages);

export default packageRouter;