import DocGia from "../models/DOCGIA.js";
import Counter from "../models/Counter.js";
import Package from "../models/Package.js";

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
            DIENTHOAI: docGia.DIENTHOAI,
            EMAIL: docGia.EMAIL,
            GOI: goi
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

export default {
    register,
    login,
    getUserById
}