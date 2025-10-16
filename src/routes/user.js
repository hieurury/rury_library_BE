import express          from    "express";
const userRouter        =       express.Router();

import userController   from    "../controller/userController.js";

//GET
userRouter.get("/get/:id", userController.getUserById);

//POST

userRouter.post("/register", userController.register);
userRouter.post("/login", userController.login);


export default userRouter;