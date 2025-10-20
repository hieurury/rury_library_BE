import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Lấy token từ "Bearer TOKEN"
    
    if (!token) {
        const error = new Error("Token không được cung cấp");
        return next(error);
    }
    
    jwt.verify(token, process.env.SECRET_JWT_KEY || "your_secret_key", (err, user) => {
        if (err) {
            const error = new Error("Token không hợp lệ hoặc đã hết hạn");
            return next(error);
        }
        req.user = user; // Lưu thông tin user vào request
        next();
    });
};

export default authenticateToken;