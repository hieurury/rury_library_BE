import NHAXUATBAN from '../models/NHAXUATBAN.js';
import Counter from "../models/Counter.js"

const generateMaNXB = async (TENNXB) => {
    const counter = await Counter.findByIdAndUpdate(
        { _id: "MANXB" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const maNXB = "NXB" + String(counter.seq).padStart(3, '0');
    return maNXB;
}

const createNhaXuatBan = async (req, res, next) => {
    try {
        const data = req.body;
        console.log(data);
        //generate MANXB
        const MANXB = await generateMaNXB(data.TenNXB);

        const newNhaXuatBan = new NHAXUATBAN({
            MANXB: MANXB,
            TENNXB: data.TenNXB,
            DIACHI: data.DiaChi
        });
        const NhaXuatBanSaved = await newNhaXuatBan.save();
        if(!NhaXuatBanSaved) {
            const error = new Error("Tạo nhà xuất bản không thành công, vui lòng thử lại sau!");
            return next(error);
        }
        res.json({
            status: "success",
            message: "Tạo nhà xuất bản thành công",
            NhaXuatBan: NhaXuatBanSaved
        })
    } catch (error) {
        next(error);
    }
}

//GET: /admin/nha-xuat-ban/
const getAllNhaXuatBan = async (req, res, next) => {
    try {
        const NhaXuatBans = await NHAXUATBAN.find();
        res.json({
            status: "success",
            message: "Lấy danh sách nhà xuất bản thành công",
            data: NhaXuatBans
        });
    } catch (error) {
        next(error);
    }
}

export default {
    createNhaXuatBan,
    getAllNhaXuatBan
}