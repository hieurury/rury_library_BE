import express      from    'express';
const packageRouter =       express.Router();

import packageController from '../controller/packageController.js';
import { uploadPackageBadge } from '../middleware/uploadFile.js';

packageRouter.post('/add', packageController.createPackage);
packageRouter.post('/upload-badge', uploadPackageBadge.single('badge'), packageController.uploadPackageBadge);
packageRouter.get('/all', packageController.getAllPackages);
packageRouter.put('/update/:id', packageController.updatePackage);
packageRouter.put('/activate/:id', packageController.activatePackage);
packageRouter.delete('/delete/:id', packageController.deletePackage);

export default packageRouter;