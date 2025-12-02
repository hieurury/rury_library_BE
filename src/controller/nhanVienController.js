
//import
import NhanVien from "../models/NhanVien.js"
import Counter from "../models/Counter.js"
import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";
import { generateOTP, sendStaffOTPEmail } from "../utils/emailService.js";
configDotenv();

//create method

//===================== TOOLS =====================//
//generate id
const generateMSNV = async (ChucVu) => {
    const counter = await Counter.findByIdAndUpdate(
        { _id: "MSNV" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    //kiểm tra lỗi quá số lượng mã
    if (counter.seq > 999) {
        throw new Error("Số lượng mã nhân viên đã vượt quá giới hạn cho phép");
    }
    //format MSNV
    const formatString = String(counter.seq).padStart(3, '0');
    //lấy năm hiện tại
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2); //lấy 2 số cuối
    //tạo mã
    const MSNV = `NV${year}${formatString}` + (ChucVu === "Admin" ? "A" : "");
    return MSNV;
}

//===================== CONTROLLERS =====================//

//POST: /admin/account/create-admin
const createAdmin = async (req, res, next) => {
    try {
        const MSNV = await generateMSNV("Admin");
        const data = req.body;

        //check secret key
        const secretKey = process.env.SECRET_MASTER_KEY;
        if(!data.secretKey) {
            const error = new Error("Để tạo tài khoản Admin, bạn cần có Master key!");
            return next(error);
        }
        if (data.secretKey !== secretKey) {
            const error = new Error("Khoá Master không chính xác! Hacker?");
            return next(error);
        }

        //check trùng lập dữ liệu
        const existingMSNV = await NhanVien.findOne({ MSNV: MSNV });
        if (existingMSNV) {
            const error = new Error("Mã nhân viên đã tồn tại!");
            return next(error);
        }
        const existingPhone = await NhanVien.findOne({ soDienThoai: data.soDienThoai });
        if (existingPhone) {
            const error = new Error("Số điện thoại đã được sử dụng!");
            return next(error);
        }

        //tạo mới
        const Admin = new NhanVien({
            MSNV: MSNV,
            HoTenNV: data.HoTenNV,
            ChucVu: "Admin",
            soDienThoai: data.soDienThoai,
            DiaChi: data.DiaChi,
            Password: data.Password
        });

        const adminSaved = await Admin.save();
        if(adminSaved) {
            res.status(201).json({ 
                message: "Tạo tài khoản Admin thành công!", 
                admin: adminSaved,
                status: 'success'
             });
        }

    } catch (err) {
        next(err);
    }
}


//POST: /admin/account/create
const createNhanVien = async (req, res, next) => {
    try {
        const MSNV = await generateMSNV(req.body.ChucVu);
        const data = req.body;

        //check trùng lập dữ liệu
        const existingMSNV = await NhanVien.findOne({ MSNV: MSNV });
        if (existingMSNV) {
            const error = new Error("Mã nhân viên đã tồn tại!");
            return next(error);
        }
        const existingPhone = await NhanVien.findOne({ soDienThoai: data.soDienThoai });
        if (existingPhone) {
            const error = new Error("Số điện thoại đã được sử dụng!");
            return next(error);
        }
        //tạo mới
        const NhanVienMoi = new NhanVien({
            MSNV: MSNV,
            HoTenNV: data.HoTenNV,
            ChucVu: 'Librarian',
            soDienThoai: data.soDienThoai,
            DiaChi: data.DiaChi,
            Password: data.Password
        });
        const nhanVienSaved = await NhanVienMoi.save();
        if(nhanVienSaved) {
            res.status(201).json({ 
                message: "Tạo tài khoản nhân viên thành công!", 
                nhanVien: nhanVienSaved,
                status: 'success'
             });
        }
    } catch (err) {
        next(err);
    }
}


//POST: /admin/account/login
const accountLogin = async (req, res, next) => {
    try {
        const { msnv, password } = req.body;

        // Kiểm tra thông tin đăng nhập
        const user = await NhanVien.findOne({ MSNV: msnv });
        if (!user) {
            return res.json({ message: "Mã nhân viên không đúng!", status: "error" });
        }

        const checkAccount = await NhanVien.findOne({ MSNV: msnv, Password: password });
        if (!checkAccount) {
            return res.json({ message: "Mật khẩu không đúng!", status: "error" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                MSNV: checkAccount.MSNV, 
                ChucVu: checkAccount.ChucVu 
            },
            process.env.SECRET_JWT_KEY || "your_secret_key",
            { expiresIn: '7d' }
        );

        // Đăng nhập thành công
        res.json({ 
            message: "Đăng nhập thành công!", 
            account: {
                MSNV: checkAccount.MSNV,
                HoTenNV: checkAccount.HoTenNV,
                ChucVu: checkAccount.ChucVu,
                soDienThoai: checkAccount.soDienThoai,
                DiaChi: checkAccount.DiaChi,
                Email: checkAccount.Email,
                GioiTinh: checkAccount.GioiTinh
            },
            token,
            status: "success" 
        });
    } catch (err) {
        next(err);
    }
}

//GET: /admin/account/all - Lấy tất cả nhân viên
const getAllNhanVien = async (req, res, next) => {
    try {
        const { masterkey } = req.headers;
        const secretMasterKey = process.env.SECRET_MASTER_KEY;
        
        let allNhanVien;
        let isMaster = false;
        
        // Kiểm tra master key
        if (masterkey && masterkey === secretMasterKey) {
            // Master có toàn quyền - lấy tất cả nhân viên
            allNhanVien = await NhanVien.find().select('-Password');
            isMaster = true;
        } else {
            // Admin thường - chỉ xem thủ thư
            allNhanVien = await NhanVien.find({ ChucVu: 'Librarian' }).select('-Password');
            isMaster = false;
        }
        
        res.json({
            status: 'success',
            message: 'Lấy danh sách nhân viên thành công',
            isMaster,
            data: allNhanVien
        });
    } catch (err) {
        next(err);
    }
}

//GET: /admin/account/:msnv - Lấy thông tin nhân viên theo MSNV
const getNhanVienById = async (req, res, next) => {
    try {
        const { msnv } = req.params;
        const nhanVien = await NhanVien.findOne({ MSNV: msnv }).select('-Password');
        
        if (!nhanVien) {
            const error = new Error("Nhân viên không tồn tại!");
            error.status = 404;
            return next(error);
        }

        res.json({
            status: 'success',
            message: 'Lấy thông tin nhân viên thành công',
            data: nhanVien
        });
    } catch (err) {
        next(err);
    }
}

//PUT: /admin/account/:msnv - Cập nhật thông tin nhân viên
const updateNhanVien = async (req, res, next) => {
    try {
        const { msnv } = req.params;
        const { HoTenNV, DiaChi, soDienThoai, Password } = req.body;
        const { masterKey } = req.headers;
        const secretMasterKey = process.env.SECRET_MASTER_KEY;

        const nhanVien = await NhanVien.findOne({ MSNV: msnv });
        if (!nhanVien) {
            const error = new Error("Nhân viên không tồn tại!");
            error.status = 404;
            return next(error);
        }

        // Kiểm tra quyền: chỉ Master mới được sửa Admin
        if (nhanVien.ChucVu === 'Admin') {
            if (!masterKey || masterKey !== secretMasterKey) {
                const error = new Error("Không có quyền chỉnh sửa thông tin Admin! Chỉ Master mới có quyền này.");
                error.status = 403;
                return next(error);
            }
        }

        // Kiểm tra số điện thoại trùng (nếu thay đổi)
        if (soDienThoai && soDienThoai !== nhanVien.soDienThoai) {
            const existingPhone = await NhanVien.findOne({ 
                soDienThoai, 
                MSNV: { $ne: msnv } 
            });
            if (existingPhone) {
                const error = new Error("Số điện thoại đã được sử dụng!");
                error.status = 400;
                return next(error);
            }
        }

        // Cập nhật thông tin
        if (HoTenNV) nhanVien.HoTenNV = HoTenNV;
        if (DiaChi) nhanVien.DiaChi = DiaChi;
        if (soDienThoai) nhanVien.soDienThoai = soDienThoai;
        if (Password) nhanVien.Password = Password;

        const updatedNhanVien = await nhanVien.save();
        
        res.json({
            status: 'success',
            message: 'Cập nhật nhân viên thành công',
            data: {
                MSNV: updatedNhanVien.MSNV,
                HoTenNV: updatedNhanVien.HoTenNV,
                ChucVu: updatedNhanVien.ChucVu,
                DiaChi: updatedNhanVien.DiaChi,
                soDienThoai: updatedNhanVien.soDienThoai
            }
        });
    } catch (err) {
        next(err);
    }
}

//DELETE: /admin/account/:msnv - Xóa nhân viên
const deleteNhanVien = async (req, res, next) => {
    try {
        const { msnv } = req.params;
        const { masterKey } = req.headers;
        const secretMasterKey = process.env.SECRET_MASTER_KEY;

        const nhanVien = await NhanVien.findOne({ MSNV: msnv });
        if (!nhanVien) {
            const error = new Error("Nhân viên không tồn tại!");
            error.status = 404;
            return next(error);
        }

        // Kiểm tra quyền: chỉ Master mới được xóa Admin
        if (nhanVien.ChucVu === 'Admin') {
            if (!masterKey || masterKey !== secretMasterKey) {
                const error = new Error("Không thể xóa tài khoản Admin! Chỉ Master mới có quyền này.");
                error.status = 403;
                return next(error);
            }
        }

        await NhanVien.deleteOne({ MSNV: msnv });

        res.json({
            status: 'success',
            message: 'Xóa nhân viên thành công'
        });
    } catch (err) {
        next(err);
    }
}

//GET: /admin/account/statistics - Thống kê nhân viên
const getStaffStatistics = async (req, res, next) => {
    try {
        const TheoDoiMuonSach = (await import('../models/THEODOIMUONSACH.js')).default;
        const { masterkey } = req.headers;
        const secretMasterKey = process.env.SECRET_MASTER_KEY;
        
        const isMaster = masterkey && masterkey === secretMasterKey;
        
        // Tổng số nhân viên - tùy theo quyền
        let totalStaff, totalAdmins, totalLibrarians, allStaff;
        
        if (isMaster) {
            // Master xem tất cả
            totalStaff = await NhanVien.countDocuments();
            totalAdmins = await NhanVien.countDocuments({ ChucVu: 'Admin' });
            totalLibrarians = await NhanVien.countDocuments({ ChucVu: 'Librarian' });
            allStaff = await NhanVien.find({ ChucVu: 'Librarian' }).select('-Password');
        } else {
            // Admin thường chỉ xem thủ thư
            totalStaff = await NhanVien.countDocuments({ ChucVu: 'Librarian' });
            totalAdmins = 0;
            totalLibrarians = await NhanVien.countDocuments({ ChucVu: 'Librarian' });
            allStaff = await NhanVien.find({ ChucVu: 'Librarian' }).select('-Password');
        }

        // Tổng số phiếu mượn
        const totalBorrows = await TheoDoiMuonSach.countDocuments();
        const systemBorrows = await TheoDoiMuonSach.countDocuments({ MANHANVIEN: 'system' });
        const staffBorrows = totalBorrows - systemBorrows;

        // Tỷ lệ phiếu mượn
        const staffBorrowRate = totalBorrows > 0 
            ? ((staffBorrows / totalBorrows) * 100).toFixed(2) 
            : 0;

        // Lấy thống kê phiếu mượn của từng thủ thư
        const staffBorrowStats = await Promise.all(
            allStaff.map(async (staff) => {
                const borrowCount = await TheoDoiMuonSach.countDocuments({ 
                    MANHANVIEN: staff.MSNV 
                });
                const borrowRate = totalBorrows > 0 
                    ? ((borrowCount / totalBorrows) * 100).toFixed(2) 
                    : 0;

                return {
                    MSNV: staff.MSNV,
                    HoTenNV: staff.HoTenNV,
                    borrowCount,
                    borrowRate: parseFloat(borrowRate)
                };
            })
        );

        res.json({
            status: 'success',
            message: 'Lấy thống kê nhân viên thành công',
            isMaster,
            data: {
                totalStaff,
                totalAdmins,
                totalLibrarians,
                totalBorrows,
                systemBorrows,
                staffBorrows,
                staffBorrowRate: parseFloat(staffBorrowRate),
                staffBorrowStats: staffBorrowStats.sort((a, b) => b.borrowCount - a.borrowCount)
            }
        });
    } catch (err) {
        next(err);
    }
}

//GET: /account/admin/profile - Get current staff profile
const getProfile = async (req, res, next) => {
    try {
        const MSNV = req.MSNV; // From JWT middleware
        const staff = await NhanVien.findOne({ MSNV }).select('-Password -OTP');
        
        if (!staff) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin nhân viên'
            });
        }

        res.status(200).json({
            status: 'success',
            data: staff
        });
    } catch (err) {
        next(err);
    }
};

//PUT: /account/admin/profile - Update staff profile
const updateProfile = async (req, res, next) => {
    try {
        const MSNV = req.MSNV; // From JWT middleware
        const { HoTenNV, DiaChi, soDienThoai, Email, GioiTinh } = req.body;

        // Check if phone/email already exists for another user
        if (soDienThoai) {
            const existingPhone = await NhanVien.findOne({ 
                soDienThoai, 
                MSNV: { $ne: MSNV } 
            });
            if (existingPhone) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Số điện thoại đã được sử dụng bởi nhân viên khác'
                });
            }
        }

        if (Email) {
            const existingEmail = await NhanVien.findOne({ 
                Email, 
                MSNV: { $ne: MSNV } 
            });
            if (existingEmail) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Email đã được sử dụng bởi nhân viên khác'
                });
            }
        }

        const updatedStaff = await NhanVien.findOneAndUpdate(
            { MSNV },
            { HoTenNV, DiaChi, soDienThoai, Email, GioiTinh },
            { new: true, runValidators: true }
        ).select('-Password -OTP');

        res.status(200).json({
            status: 'success',
            message: 'Cập nhật thông tin thành công',
            data: updatedStaff
        });
    } catch (err) {
        next(err);
    }
};

//PUT: /account/admin/change-password - Change password
const changePassword = async (req, res, next) => {
    try {
        const MSNV = req.MSNV; // From JWT middleware
        const { currentPassword, newPassword } = req.body;

        const staff = await NhanVien.findOne({ MSNV });
        if (!staff) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy nhân viên'
            });
        }

        // Verify current password
        if (staff.Password !== currentPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        // Update password
        staff.Password = newPassword;
        await staff.save();

        res.status(200).json({
            status: 'success',
            message: 'Đổi mật khẩu thành công'
        });
    } catch (err) {
        next(err);
    }
};

//POST: /account/admin/forgot-password - Request OTP for password reset
const forgotPassword = async (req, res, next) => {
    try {
        const { MSNV } = req.body;

        const staff = await NhanVien.findOne({ MSNV });
        if (!staff) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy mã nhân viên này'
            });
        }

        if (!staff.Email) {
            return res.status(400).json({
                status: 'error',
                message: 'Nhân viên chưa cập nhật email. Vui lòng liên hệ IT Support để được hỗ trợ.'
            });
        }

        // Generate OTP and set expiry (5 minutes)
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        staff.OTP = { code: otp, expiry };
        await staff.save();

        // Send OTP email
        await sendStaffOTPEmail(staff.Email, otp, staff.HoTenNV);

        res.status(200).json({
            status: 'success',
            message: `Mã OTP đã được gửi đến email ${staff.Email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`
        });
    } catch (err) {
        next(err);
    }
};

//POST: /account/admin/verify-otp - Verify OTP
const verifyOTP = async (req, res, next) => {
    try {
        const { MSNV, otp } = req.body;

        const staff = await NhanVien.findOne({ MSNV });
        if (!staff) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy mã nhân viên này'
            });
        }

        if (!staff.OTP || !staff.OTP.code) {
            return res.status(400).json({
                status: 'error',
                message: 'Chưa yêu cầu mã OTP. Vui lòng yêu cầu lại.'
            });
        }

        // Check if OTP expired
        if (new Date() > staff.OTP.expiry) {
            return res.status(400).json({
                status: 'error',
                message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.'
            });
        }

        // Check if OTP matches
        if (staff.OTP.code !== otp) {
            return res.status(400).json({
                status: 'error',
                message: 'Mã OTP không chính xác'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Xác thực OTP thành công'
        });
    } catch (err) {
        next(err);
    }
};

//POST: /account/admin/reset-password - Reset password after OTP verification
const resetPassword = async (req, res, next) => {
    try {
        const { MSNV, otp, newPassword } = req.body;

        const staff = await NhanVien.findOne({ MSNV });
        if (!staff) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy mã nhân viên này'
            });
        }

        // Verify OTP again
        if (!staff.OTP || staff.OTP.code !== otp || new Date() > staff.OTP.expiry) {
            return res.status(400).json({
                status: 'error',
                message: 'Mã OTP không hợp lệ hoặc đã hết hạn'
            });
        }

        // Update password and clear OTP
        staff.Password = newPassword;
        staff.OTP = undefined;
        await staff.save();

        res.status(200).json({
            status: 'success',
            message: 'Đặt lại mật khẩu thành công'
        });
    } catch (err) {
        next(err);
    }
};

//POST: /account/admin/master-recovery - Login using master key
const masterRecovery = async (req, res, next) => {
    try {
        const { masterKey } = req.body;

        const secretKey = process.env.SECRET_MASTER_KEY;
        if (!masterKey || masterKey !== secretKey) {
            return res.status(401).json({
                status: 'error',
                message: 'Master key không chính xác'
            });
        }

        // Find the master admin (first admin created)
        const masterAdmin = await NhanVien.findOne({ ChucVu: 'Admin' }).sort({ _id: 1 });
        if (!masterAdmin) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy tài khoản Master'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                MSNV: masterAdmin.MSNV, 
                ChucVu: masterAdmin.ChucVu 
            },
            process.env.SECRET_JWT_KEY || "your_secret_key",
            { expiresIn: '7d' }
        );

        // Return account info (same as login response)
        res.status(200).json({
            status: 'success',
            message: 'Đăng nhập bằng Master key thành công',
            account: {
                MSNV: masterAdmin.MSNV,
                HoTenNV: masterAdmin.HoTenNV,
                ChucVu: masterAdmin.ChucVu,
                soDienThoai: masterAdmin.soDienThoai,
                DiaChi: masterAdmin.DiaChi,
                Email: masterAdmin.Email,
                GioiTinh: masterAdmin.GioiTinh
            },
            token
        });
    } catch (err) {
        next(err);
    }
};

export default {
    createNhanVien,
    createAdmin,
    accountLogin,
    getAllNhanVien,
    getNhanVienById,
    updateNhanVien,
    deleteNhanVien,
    getStaffStatistics,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    verifyOTP,
    resetPassword,
    masterRecovery
}