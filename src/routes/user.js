import express          from    "express";
import authenticateToken from "../middleware/jwt.js";
import { uploadFile } from "../middleware/uploadFile.js";
const userRouter        =       express.Router();

import userController   from    "../controller/userController.js";


//POST

userRouter.post("/register", userController.register);
userRouter.post("/login", userController.login);
userRouter.post("/forgot-password", userController.forgotPassword);
userRouter.post("/verify-otp", userController.verifyOTP);
userRouter.post("/reset-password", userController.resetPassword);

userRouter.get("/admin/all", userController.getAllUsers);
userRouter.get("/admin/statistics", userController.getUserStatistics);
userRouter.put("/admin/subscribe-package", userController.subscribePackage);
userRouter.put("/admin/lock/:id", userController.lockUser);
userRouter.put("/admin/unlock/:id", userController.unlockUser);
//xác thực hết dưới này
userRouter.use(authenticateToken);
//GET
userRouter.get("/get/:id", userController.getUserById);
userRouter.get("/borrowing-count/:id", userController.getBorrowingCount);
userRouter.get("/notifications", userController.getNotifications);
//POST
userRouter.post("/favorites/add", userController.addFavorite);
userRouter.post("/favorites/remove", userController.removeFavorite);
//PUT
userRouter.put("/settings/email-notification", userController.updateEmailNotification);
userRouter.put("/notifications/mark-read", userController.markNotificationAsRead);
userRouter.put("/notifications/mark-all-read", userController.markAllNotificationsAsRead);
userRouter.put("/update/:id", userController.updateUser);
//POST
userRouter.post("/upload-avatar/:id", uploadFile.single('avatar'), userController.uploadAvatar);
//DELETE
userRouter.delete("/notifications/delete-all", userController.deleteAllNotifications);

export default userRouter;