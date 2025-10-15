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

const createAccount = async (req, res, next) => {
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


export default {
    createAccount,
}