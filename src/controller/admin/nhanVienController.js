
//import
import NhanVien from "../../models/NhanVien.js"
import Counter from "../../models/Counter.js"
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

export default {
    createNhanVien,
    createAdmin,
    accountLogin
}