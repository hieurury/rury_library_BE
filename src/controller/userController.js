import DocGia   from "../models/DOCGIA.js";
import Counter  from "../models/Counter.js";
import Package  from "../models/Package.js";
import TheoDoiMuonSach from "../models/THEODOIMUONSACH.js";
import jwt      from "jsonwebtoken";
import dotenv   from "dotenv";
dotenv.config();

const generateAccountId = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: "accountId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return `M${String(counter.seq).padStart(6, '0')}`;
}

const register = async (req, res, next) => {
    const data = req.body;
    try {
        const MADOCGIA = await generateAccountId();
        const packages = await Package.findOne({ MaGoi: data.GOI, TrangThai: true });
        if(!packages) {
            const error = new Error("Gói đăng kí không tồn tại hoặc đã bị vô hiệu hóa.");
            return next(error);
        }
        const ThoiHanGoi = packages.ThoiHanGoi === -1 ? 1200 : packages.ThoiHanGoi; //nếu gói vô hạn thì cho 100 năm
        const newDocGia = new DocGia({ 
            MADOCGIA,
            HOLOT: data.HOLOT,
            TEN: data.TEN,
            NGAYSINH: data.NGAYSINH,
            PHAI: data.PHAI,
            DIACHI: data.DIACHI,
            DIENTHOAI: data.DIENTHOAI,
            EMAIL: data.EMAIL,
            PASSWORD: data.PASSWORD,
            GOI: {
                MaGoi: data.GOI,
                NgayDangKy: new Date(),
                NgayHetHan: new Date(new Date().setMonth(new Date().getMonth() + ThoiHanGoi))
            }
         });
        const savedDocGia = await newDocGia.save();
        if(!savedDocGia) {
            const error = new Error("Không thể tạo độc giả.");
            return next(error);
        }
        res.json({
            status: "success",
            message: "Tạo tài khoản thành công",
            data: savedDocGia
        })

    } catch (error) {
        return next(error);
    }
};


const login = async (req, res, next) => {
    const { DIENTHOAI, PASSWORD } = req.body;
    try {
        const docGia = await DocGia.findOne({ DIENTHOAI});
        if(!docGia) {
            const error = new Error("Số điện thoại chưa được đăng ký");
            return next(error);
        }
        if(docGia.PASSWORD !== PASSWORD) {
            const error = new Error("Mật khẩu không đúng");
            return next(error);
        }
        
        // Tạo JWT token
        const token = jwt.sign(
            { MADOCGIA: docGia.MADOCGIA, DIENTHOAI: docGia.DIENTHOAI },
            process.env.SECRET_JWT_KEY,
            { expiresIn: "7d" }
        );
        
        const resultData = {
            MADOCGIA: docGia.MADOCGIA,
            HOLOT: docGia.HOLOT,
            TEN: docGia.TEN,
            DIENTHOAI: docGia.DIENTHOAI,
            EMAIL: docGia.EMAIL,
        }
        res.json({
            status: "success",
            message: "Đăng nhập thành công",
            token,
            data: resultData
        });

    } catch (error) {
        return next(error);
    }
};


const getUserById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const docGia = await DocGia.findOne({ MADOCGIA: id });
        if(!docGia) {
            const error = new Error("Không tìm thấy độc giả");
            return next(error);
        }
        //lấy dữ liệu gói đăng kí
        const goi = await Package.findOne({ MaGoi: docGia.GOI.MaGoi });
        if(!goi) {
            const error = new Error("Không tìm thấy gói đăng kí");
            return next(error);
        }
        const resultData = {
            MADOCGIA: docGia.MADOCGIA,
            HOLOT: docGia.HOLOT,
            TEN: docGia.TEN,
            AVATAR: docGia.AVATAR,
            DIENTHOAI: docGia.DIENTHOAI,
            EMAIL: docGia.EMAIL,
            PHAI: docGia.PHAI,
            DIACHI: docGia.DIACHI,
            NGAYSINH: docGia.NGAYSINH,
            GOI: goi,
            FAVORITES: docGia.FAVORITES || [],
            OPTIONS: docGia.OPTIONS || { EMAIL_NOTIF: true }
        }
        res.json({
            status: "success",
            message: "Lấy thông tin độc giả thành công",
            data: resultData
        });

    } catch (error) {
        return next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        
        const allUsers = await DocGia.find();
        res.json({
            status: "success",
            message: "Lấy danh sách độc giả thành công",
            data: allUsers
        });
    } catch (error) {
        return next(error);
    }
};

//cập nhật gói
const subscribePackage = async (req, res, next) => {
    const { MADOCGIA, MaGoi } = req.body;
    try {
        const docGia = await DocGia.findOne({ MADOCGIA });
        if(!docGia) {
            const error = new Error("Độc giả không tồn tại.");
            return next(error);
        }
        const packages = await Package.findOne({ MaGoi: MaGoi, TrangThai: true });
        if(!packages) {
            const error = new Error("Gói đăng kí không tồn tại hoặc đã bị vô hiệu hóa.");
            return next(error);
        }
        const ThoiHanGoi = packages.ThoiHanGoi === -1 ? 1200 : packages.ThoiHanGoi; //nếu gói vô hạn thì cho 100 năm
        docGia.GOI = {
            MaGoi: MaGoi,
            NgayDangKy: new Date(),
            NgayHetHan: new Date(new Date().setMonth(new Date().getMonth() + ThoiHanGoi)),
        };
        await DocGia.updateOne({ MADOCGIA }, { GOI: docGia.GOI });
        res.json({
            status: "success",
            message: "Đăng ký gói thành công",
            data: docGia
        });
    } catch (error) {
        return next(error);
    }
};

//thêm sách yêu thích
const addFavorite = async (req, res, next) => {
    const { MADOCGIA, MASACH } = req.body;
    try {
        const docGia = await DocGia.findOne({ MADOCGIA });
        if(!docGia) {
            const error = new Error("Độc giả không tồn tại.");
            return next(error);
        }
        
        // Kiểm tra sách đã tồn tại trong favorites chưa
        const existingFavorite = docGia.FAVORITES.find(fav => fav.MASACH === MASACH);
        if(existingFavorite) {
            return res.json({
                status: "success",
                message: "Sách đã có trong danh sách yêu thích"
            });
        }
        
        // Thêm sách vào favorites
        docGia.FAVORITES.push({
            MASACH: MASACH,
            NGAYTHEMSACH: new Date()
        });
        
        await docGia.save();
        
        res.json({
            status: "success",
            message: "Đã thêm vào danh sách yêu thích",
            data: docGia.FAVORITES
        });
    } catch (error) {
        return next(error);
    }
};

//xóa sách yêu thích
const removeFavorite = async (req, res, next) => {
    const { MADOCGIA, MASACH } = req.body;
    try {
        const docGia = await DocGia.findOne({ MADOCGIA });
        if(!docGia) {
            const error = new Error("Độc giả không tồn tại.");
            return next(error);
        }
        
        // Xóa sách khỏi favorites
        docGia.FAVORITES = docGia.FAVORITES.filter(fav => fav.MASACH !== MASACH);
        
        await docGia.save();
        
        res.json({
            status: "success",
            message: "Đã xóa khỏi danh sách yêu thích",
            data: docGia.FAVORITES
        });
    } catch (error) {
        return next(error);
    }
};

//đếm số sách đang mượn (TINHTRANG = 'borrowing')
const getBorrowingCount = async (req, res, next) => {
    const { id } = req.params;
    try {
        const count = await TheoDoiMuonSach.countDocuments({ 
            MADOCGIA: id, 
            TINHTRANG: 'borrowing' 
        });
        
        res.json({
            status: "success",
            message: "Lấy số sách đang mượn thành công",
            data: { count }
        });
    } catch (error) {
        return next(error);
    }
};

// Cập nhật cài đặt email notification
const updateEmailNotification = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.user; // Từ JWT
        const { EMAIL_NOTIF } = req.body;
        
        if (typeof EMAIL_NOTIF !== 'boolean') {
            const error = new Error('EMAIL_NOTIF phải là boolean');
            error.status = 400;
            return next(error);
        }
        
        const docGia = await DocGia.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Cập nhật cài đặt
        if (!docGia.OPTIONS) {
            docGia.OPTIONS = {};
        }
        docGia.OPTIONS.EMAIL_NOTIF = EMAIL_NOTIF;
        await docGia.save();
        
        res.json({
            status: 'success',
            message: `Đã ${EMAIL_NOTIF ? 'bật' : 'tắt'} thông báo email`,
            data: {
                EMAIL_NOTIF: docGia.OPTIONS.EMAIL_NOTIF
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Lấy danh sách thông báo của user
const getNotifications = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.user; // Từ JWT
        
        const docGia = await DocGia.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Lấy notifications, sắp xếp theo ngày tạo mới nhất
        const notifications = (docGia.NOTIFICATIONS || [])
            .sort((a, b) => new Date(b.NGAYTAO) - new Date(a.NGAYTAO));
        
        // Đếm số thông báo chưa đọc
        const unreadCount = notifications.filter(n => !n.DAXEM).length;
        
        res.json({
            status: 'success',
            message: 'Lấy thông báo thành công',
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Đánh dấu thông báo đã đọc
const markNotificationAsRead = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.user; // Từ JWT
        const { notificationId } = req.body;
        
        if (!notificationId) {
            const error = new Error('notificationId không hợp lệ');
            error.status = 400;
            return next(error);
        }
        
        const docGia = await DocGia.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Tìm và cập nhật thông báo
        const notification = docGia.NOTIFICATIONS.id(notificationId);
        if (!notification) {
            const error = new Error('Thông báo không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        notification.DAXEM = true;
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Đã đánh dấu thông báo đã đọc',
            data: notification
        });
    } catch (error) {
        return next(error);
    }
};

// Đánh dấu tất cả thông báo đã đọc
const markAllNotificationsAsRead = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.user; // Từ JWT
        
        const docGia = await DocGia.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Đánh dấu tất cả thông báo đã đọc
        docGia.NOTIFICATIONS.forEach(notification => {
            notification.DAXEM = true;
        });
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Đã đánh dấu tất cả thông báo đã đọc'
        });
    } catch (error) {
        return next(error);
    }
};

// Xóa tất cả thông báo
const deleteAllNotifications = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.user; // Từ JWT
        
        const docGia = await DocGia.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Xóa tất cả thông báo
        docGia.NOTIFICATIONS = [];
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Đã xóa tất cả thông báo'
        });
    } catch (error) {
        return next(error);
    }
};

export default {
    register,
    login,
    getUserById,
    getAllUsers,
    subscribePackage,
    addFavorite,
    removeFavorite,
    getBorrowingCount,
    updateEmailNotification,
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteAllNotifications
}