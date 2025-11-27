
//import
import NhanVien from "../models/NhanVien.js"
import Counter from "../models/Counter.js"
import { configDotenv } from "dotenv";
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

        // Đăng nhập thành công
        res.json({ message: "Đăng nhập thành công!", account: checkAccount, status: "success" });
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

export default {
    createNhanVien,
    createAdmin,
    accountLogin,
    getAllNhanVien,
    getNhanVienById,
    updateNhanVien,
    deleteNhanVien,
    getStaffStatistics
}