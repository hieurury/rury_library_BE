import SACH from '../models/SACH.js';
import Counter from '../models/Counter.js';
import BanSaoSach from '../models/BanSaoSach.js';   
import NHAXUTBAN from '../models/NHAXUATBAN.js';
import TheLoai from '../models/TheLoai.js';


//========================= ADMIN =========================//
//create ma sach
const generateMaSach = async () => {
    const counter = await Counter.findByIdAndUpdate(
        { _id: "MASACH" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    if(counter.seq > 99999) {
        throw new Error("Số lượng mã sách đã vượt quá giới hạn cho phép");
    }
    const format = String(counter.seq).padStart(3, '0');
    const maSach = "S" + format;
    return maSach;
}
//create mã bản sao sách
const generateMaBanSao = async (MASACH, MA_DA_CO) => {
    //mã bản sao sẽ là mã sách + 3 số ngẫu nhiên

    //lập tạo mã  để tránh trùng mã
    while(true) {
        const randomNum = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        const maBanSao = MASACH + 'T' + randomNum;
        if(!MA_DA_CO.includes(maBanSao)) {
            return maBanSao;
        }
    }
}

//POST: /admin/sach/create
const createSach = async (req, res, next) => {
    try {
        const data = req.body;
        //generate MASACH
        const MASACH = await generateMaSach();
        const SOLUONG = data.SOQUYEN;

        const MA_DA_CO = []; //tráng trùng mã
        //tạo bản sao
        const BANSAO = Array.from({ length: SOLUONG }, async () => {
            const maBanSao = await generateMaBanSao(MASACH, MA_DA_CO);
            //lưu mã đã tạo để tránh trùng
            MA_DA_CO.push(maBanSao);
            return {
                MASACH: MASACH,
                MA_BANSAO: maBanSao
            };
        });

        //kiểm tra nhà xuất bản
        const nxb = await NHAXUTBAN.findOne({ MANXB: data.MAXB });
        if(!nxb) {
            const error = new Error("Nhà xuất bản không tồn tại, vui lòng kiểm tra lại!");
            error.statusCode = 400;
            return next(error);
        }
        //kiểm tra thể loại
        const invalidTheLoai = await Promise.all(data.THELOAI.map(async tl => {
            const theloai = await TheLoai.findOne({ MaLoai: tl });
            return !theloai;
        }));
        if(invalidTheLoai.includes(true)) {
            const error = new Error("Thể loại không hợp lệ, vui lòng kiểm tra lại!");
            error.statusCode = 400;
            return next(error);
        }

        //tẹo sách
        const sachNew = new SACH({
            MASACH: MASACH,
            TENSACH: data.TENSACH,
            MOTA: data.MOTA || "",
            DONGIA: data.DONGIA,
            SOQUYEN: SOLUONG,
            NAMXUATBAN: data.NAMXUATBAN,
            MAXB: data.MAXB,
            TACGIA: data.TACGIA,
            HINHANH: data.HINHANH,
            THELOAI: data.THELOAI || []
        })
        
        //kiem tra lưu
        const sachSaved = await sachNew.save();
        if(!sachSaved) {
            const error = new Error("Tạo sách không thành công, vui lòng thử lại sau!");
            return next(error);
        }
        const banSaoSaved = await BanSaoSach.insertMany(await Promise.all(BANSAO));
        if(!banSaoSaved) {
            const error = new Error("Tạo bản sao sách không thành công, vui lòng thử lại sau!");
            return next(error);
        }

        //response
        res.json({
            status: "success",
            message: "Tạo sách thành công",
            data: {
                sach: sachSaved,
                banSao: banSaoSaved
            }
        })
    } catch (error) {
        next(error);
    }
}


//GET: /sach/all
const getAllSach = async (req, res, next) => {
    try {
        const sachList = await SACH.find();
        const result = await Promise.all(sachList.map( async (sach) => {
            const nxb = await NHAXUTBAN.findOne({ MANXB: sach.MAXB });
            const theloai = await TheLoai.find({ MaLoai: { $in: sach.THELOAI } });
            return {
                MASACH: sach.MASACH,
                TENSACH: sach.TENSACH,
                DONGIA: sach.DONGIA,
                SOQUYEN: sach.SOQUYEN,
                NAMXUATBAN: sach.NAMXUATBAN,
                MAXB: nxb,
                TACGIA: sach.TACGIA,
                HINHANH: sach.HINHANH,
                THELOAI: theloai,
            };
        }));
        res.json({
            status: "success",
            message: "Lấy danh sách sách thành công",
            data: result
        })
    } catch (error) {
        next(error);
    }
}

export default {
    createSach,
    getAllSach
}