import express          from    "express";
import authenticateToken from "../middleware/jwt.js";
const userRouter        =       express.Router();

import userController   from    "../controller/userController.js";


//POST

userRouter.post("/register", userController.register);
userRouter.post("/login", userController.login);

userRouter.get("/admin/all", userController.getAllUsers);
userRouter.put("/admin/subscribe-package", userController.subscribePackage);
//xác thực hết dưới này
userRouter.use(authenticateToken);
//GET
userRouter.get("/get/:id", userController.getUserById);
export default userRouter;