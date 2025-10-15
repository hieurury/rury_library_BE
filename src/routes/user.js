import express          from    "express";
const userRouter        =       express.Router();

import userController   from    "../controller/userController.js";

userRouter.post("/register", userController.createAccount);


export default userRouter;