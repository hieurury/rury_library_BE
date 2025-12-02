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

// Middleware for staff authentication
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Token không được cung cấp'
        });
    }
    
    jwt.verify(token, process.env.SECRET_JWT_KEY || "your_secret_key", (err, decoded) => {
        if (err) {
            return res.status(403).json({
                status: 'error',
                message: 'Token không hợp lệ hoặc đã hết hạn'
            });
        }
        req.MSNV = decoded.MSNV; // Extract MSNV from token
        req.ChucVu = decoded.ChucVu;
        next();
    });
};

export { authenticateToken, verifyToken };
export default authenticateToken;