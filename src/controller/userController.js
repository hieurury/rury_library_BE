import DocGia   from "../models/DOCGIA.js";
import Counter  from "../models/Counter.js";
import Package  from "../models/Package.js";
import TheoDoiMuonSach from "../models/THEODOIMUONSACH.js";
import jwt      from "jsonwebtoken";
import dotenv   from "dotenv";
import { sendAccountLockedByAdminEmail, generateOTP, sendUserOTPEmail } from "../utils/emailService.js";
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
        
        // Kiểm tra trạng thái tài khoản
        if(!docGia.TRANGTHAI) {
            // Tài khoản bị khóa
            let errorMessage = "Tài khoản của bạn đã bị khóa";
            
            if(docGia.NGAYMOKHOA) {
                // Khóa tạm thời - kiểm tra xem đã hết hạn khóa chưa
                const now = new Date();
                const unlockDate = new Date(docGia.NGAYMOKHOA);
                
                if(now >= unlockDate) {
                    // Đã hết hạn khóa - tự động mở khóa
                    docGia.TRANGTHAI = true;
                    docGia.NGAYMOKHOA = null;
                    await docGia.save();
                } else {
                    // Vẫn còn trong thời gian khóa
                    const daysRemaining = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));
                    errorMessage = `Tài khoản của bạn đã bị khóa tạm thời. Sẽ được mở khóa vào ${unlockDate.toLocaleDateString('vi-VN')} (còn ${daysRemaining} ngày)`;
                    const error = new Error(errorMessage);
                    return next(error);
                }
            } else {
                // Khóa vĩnh viễn
                errorMessage = "Tài khoản của bạn đã bị khóa vĩnh viễn. Vui lòng liên hệ quản trị viên để biết thêm chi tiết";
                const error = new Error(errorMessage);
                return next(error);
            }
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
            AVATAR: docGia.AVATAR,
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

// Cập nhật thông tin người dùng
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { HOLOT, TEN, DIENTHOAI, EMAIL, DIACHI, NGAYSINH, PHAI, AVATAR } = req.body;
        
        const docGia = await DocGia.findOne({ MADOCGIA: id });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Kiểm tra số điện thoại đã tồn tại chưa (nếu thay đổi)
        if (DIENTHOAI && DIENTHOAI !== docGia.DIENTHOAI) {
            const existingPhone = await DocGia.findOne({ DIENTHOAI, MADOCGIA: { $ne: id } });
            if (existingPhone) {
                const error = new Error('Số điện thoại đã được sử dụng');
                error.status = 400;
                return next(error);
            }
        }
        
        // Kiểm tra email đã tồn tại chưa (nếu thay đổi)
        if (EMAIL && EMAIL !== docGia.EMAIL) {
            const existingEmail = await DocGia.findOne({ EMAIL, MADOCGIA: { $ne: id } });
            if (existingEmail) {
                const error = new Error('Email đã được sử dụng');
                error.status = 400;
                return next(error);
            }
        }
        
        // Cập nhật các trường nếu có
        if (HOLOT !== undefined) docGia.HOLOT = HOLOT;
        if (TEN !== undefined) docGia.TEN = TEN;
        if (DIENTHOAI !== undefined) docGia.DIENTHOAI = DIENTHOAI;
        if (EMAIL !== undefined) docGia.EMAIL = EMAIL;
        if (DIACHI !== undefined) docGia.DIACHI = DIACHI;
        if (NGAYSINH !== undefined) docGia.NGAYSINH = NGAYSINH;
        if (PHAI !== undefined) docGia.PHAI = PHAI;
        if (AVATAR !== undefined) docGia.AVATAR = AVATAR;
        
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Cập nhật thông tin thành công',
            data: {
                MADOCGIA: docGia.MADOCGIA,
                HOLOT: docGia.HOLOT,
                TEN: docGia.TEN,
                AVATAR: docGia.AVATAR,
                DIENTHOAI: docGia.DIENTHOAI,
                EMAIL: docGia.EMAIL,
                PHAI: docGia.PHAI,
                DIACHI: docGia.DIACHI,
                NGAYSINH: docGia.NGAYSINH
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Upload avatar
const uploadAvatar = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            const error = new Error('Không có file được tải lên');
            error.status = 400;
            return next(error);
        }
        
        const docGia = await DocGia.findOne({ MADOCGIA: id });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Đường dẫn file được lưu bởi multer (relative path)
        const avatarPath = req.file.path.replace(/\\/g, '/').replace('src/', '/');
        
        // Cập nhật avatar
        docGia.AVATAR = avatarPath;
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Upload avatar thành công',
            data: {
                AVATAR: avatarPath
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Khóa tài khoản người dùng
const lockUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason, duration } = req.body; // duration in days, 0 = permanent
        
        const docGia = await DocGia.findOne({ MADOCGIA: id });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        if (!docGia.TRANGTHAI) {
            const error = new Error('Tài khoản đã bị khóa');
            error.status = 400;
            return next(error);
        }
        
        // Khóa tài khoản
        docGia.TRANGTHAI = false;
        
        // Nếu có thời hạn khóa
        if (duration && duration > 0) {
            const unlockDate = new Date();
            unlockDate.setDate(unlockDate.getDate() + duration);
            docGia.NGAYMOKHOA = unlockDate;
        } else {
            docGia.NGAYMOKHOA = null; // Khóa vĩnh viễn
        }
        
        // Thêm thông báo cho người dùng
        docGia.NOTIFICATIONS.push({
            LABEL: 'Tài khoản bị khóa',
            NOIDUNG: reason || 'Tài khoản của bạn đã bị khóa do vi phạm quy định',
            NGAYTAO: new Date(),
            DAXEM: false
        });
        
        await docGia.save();
        
        // Gửi email thông báo khóa tài khoản bởi admin
        if (docGia.EMAIL) {
            const hoTen = `${docGia.HOLOT || ''} ${docGia.TEN}`.trim();
            const isPermanent = !duration || duration === 0;
            
            await sendAccountLockedByAdminEmail(
                docGia.EMAIL,
                hoTen,
                reason,
                duration || 0,
                isPermanent
            );
        }
        
        res.json({
            status: 'success',
            message: 'Khóa tài khoản thành công',
            data: {
                MADOCGIA: docGia.MADOCGIA,
                TRANGTHAI: docGia.TRANGTHAI,
                NGAYMOKHOA: docGia.NGAYMOKHOA
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Mở khóa tài khoản người dùng
const unlockUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const docGia = await DocGia.findOne({ MADOCGIA: id });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        if (docGia.TRANGTHAI) {
            const error = new Error('Tài khoản đang hoạt động');
            error.status = 400;
            return next(error);
        }
        
        // Mở khóa tài khoản
        docGia.TRANGTHAI = true;
        docGia.NGAYMOKHOA = null;
        
        // Thêm thông báo cho người dùng
        docGia.NOTIFICATIONS.push({
            LABEL: 'Tài khoản được mở khóa',
            NOIDUNG: 'Tài khoản của bạn đã được mở khóa. Vui lòng tuân thủ quy định để tránh bị khóa lại',
            NGAYTAO: new Date(),
            DAXEM: false
        });
        
        await docGia.save();
        
        res.json({
            status: 'success',
            message: 'Mở khóa tài khoản thành công',
            data: {
                MADOCGIA: docGia.MADOCGIA,
                TRANGTHAI: docGia.TRANGTHAI
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Lấy thống kê người dùng (cho admin)
const getUserStatistics = async (req, res, next) => {
    try {
        const totalUsers = await DocGia.countDocuments();
        const activeUsers = await DocGia.countDocuments({ TRANGTHAI: true });
        const lockedUsers = await DocGia.countDocuments({ TRANGTHAI: false });
        
        // Người dùng mới trong 30 ngày
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newUsers = await DocGia.countDocuments({
            'GOI.NgayDangKy': { $gte: thirtyDaysAgo }
        });
        
        // Người dùng có vi phạm
        const usersWithViolations = await DocGia.countDocuments({
            'CACVIPHAM.0': { $exists: true }
        });
        
        res.json({
            status: 'success',
            message: 'Lấy thống kê người dùng thành công',
            data: {
                totalUsers,
                activeUsers,
                lockedUsers,
                newUsers,
                usersWithViolations
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Gửi OTP để đặt lại mật khẩu
const forgotPassword = async (req, res, next) => {
    const { EMAIL } = req.body;
    try {
        const docGia = await DocGia.findOne({ EMAIL });
        if (!docGia) {
            const error = new Error("Email này chưa được đăng ký trong hệ thống");
            return next(error);
        }

        // Tạo OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

        // Lưu OTP vào database
        docGia.OTP = {
            code: otp,
            expiresAt: expiresAt
        };
        await docGia.save();

        // Gửi email OTP
        const userName = `${docGia.HOLOT} ${docGia.TEN}`;
        const emailSent = await sendUserOTPEmail(EMAIL, otp, userName);

        if (!emailSent) {
            const error = new Error("Không thể gửi email. Vui lòng thử lại sau");
            return next(error);
        }

        res.json({
            status: "success",
            message: "Mã OTP đã được gửi đến email của bạn"
        });
    } catch (error) {
        return next(error);
    }
};

// Xác thực OTP
const verifyOTP = async (req, res, next) => {
    const { EMAIL, OTP } = req.body;
    try {
        const docGia = await DocGia.findOne({ EMAIL });
        
        if (!docGia) {
            const error = new Error("Email không tồn tại trong hệ thống");
            return next(error);
        }

        if (!docGia.OTP || !docGia.OTP.code) {
            const error = new Error("OTP không tồn tại. Vui lòng yêu cầu mã mới");
            return next(error);
        }

        if (new Date() > new Date(docGia.OTP.expiresAt)) {
            // Xóa OTP hết hạn
            docGia.OTP = null;
            await docGia.save();
            const error = new Error("OTP đã hết hạn. Vui lòng yêu cầu mã mới");
            return next(error);
        }

        if (docGia.OTP.code !== OTP) {
            const error = new Error("Mã OTP không chính xác");
            return next(error);
        }

        // OTP hợp lệ - tạo token tạm thời để đặt lại mật khẩu
        const resetToken = jwt.sign(
            { EMAIL, MADOCGIA: docGia.MADOCGIA, purpose: 'reset_password' },
            process.env.SECRET_JWT_KEY,
            { expiresIn: '10m' }
        );

        res.json({
            status: "success",
            message: "Xác thực OTP thành công",
            resetToken
        });
    } catch (error) {
        return next(error);
    }
};

// Đặt lại mật khẩu
const resetPassword = async (req, res, next) => {
    const { resetToken, newPassword } = req.body;
    try {
        // Xác thực token
        const decoded = jwt.verify(resetToken, process.env.SECRET_JWT_KEY);
        
        if (decoded.purpose !== 'reset_password') {
            const error = new Error("Token không hợp lệ");
            return next(error);
        }

        // Cập nhật mật khẩu
        const docGia = await DocGia.findOne({ MADOCGIA: decoded.MADOCGIA });
        if (!docGia) {
            const error = new Error("Không tìm thấy tài khoản");
            return next(error);
        }

        docGia.PASSWORD = newPassword;
        docGia.OTP = null; // Xóa OTP sau khi đặt lại mật khẩu thành công
        await docGia.save();

        res.json({
            status: "success",
            message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại"
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            const err = new Error("Token không hợp lệ hoặc đã hết hạn");
            return next(err);
        }
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
    deleteAllNotifications,
    updateUser,
    uploadAvatar,
    lockUser,
    unlockUser,
    getUserStatistics,
    forgotPassword,
    verifyOTP,
    resetPassword
}