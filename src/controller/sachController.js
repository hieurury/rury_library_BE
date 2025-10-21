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

//POST: /sach/admin/create
const createSach = async (req, res, next) => {
    try {
        const data = req.body;
        console.log(data);
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
        const nxb = await NHAXUTBAN.findOne({ MANXB: data.MANXB });
        if(!nxb) {
            const error = new Error("Nhà xuất bản không tồn tại, vui lòng kiểm tra lại!");
            // error.statusCode = 400;
            return next(error);
        }
        //kiểm tra thể loại
        const invalidTheLoai = await Promise.all(data.THELOAI.map(async tl => {
            const theloai = await TheLoai.findOne({ MaLoai: tl });
            return !theloai;
        }));
        if(invalidTheLoai.includes(true)) {
            const error = new Error("Thể loại không hợp lệ, vui lòng kiểm tra lại!");
            // error.statusCode = 400;
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
            MAXB: data.MANXB,
            TACGIA: data.TACGIA,
            HINHANH: data.HINHANH,
            THELOAI: data.THELOAI || []
        })
        console.log(sachNew);
        
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

//DELETE: /sach/admin/delete/:maSach
const deleteBook = async (req, res, next) => {
    try {
        const { maSach } = req.params;

        // Xóa sách
        const sachDeleted = await SACH.findOneAndDelete({ MASACH: maSach });
        if (!sachDeleted) {
            const error = new Error("Sách không tồn tại");
            // error.statusCode = 404;
            return next(error);
        }

        // Xóa bản sao
        await BanSaoSach.deleteMany({ MASACH: maSach });

        res.json({
            status: "success",
            message: "Xóa sách thành công"
        });
    } catch (error) {
        next(error);
    }
}

const uploadBookImage = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error("Vui lòng chọn file để upload");
            error.statusCode = 400;
            return next(error);
        }
        //nếu có file thì trả về đường dẫn
        //replace \\ thành /
        const customPath = req.file.path.replace(/\\/g, '/').replace('src/', '');
        
        res.json({
            status: "success",
            message: "Tải ảnh sách thành công",
            imagePath: customPath
        });
    } catch (error) {
        next(error);
    }
}

// ===================== BOTH ===================== //
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
                MOTA: sach.MOTA,
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

const getSachById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const sach = await SACH.findOne({ MASACH: id });
        if(!sach) {
            const error = new Error("Không tìm thấy sách");
            return next(error);
        }
        const nxb = await NHAXUTBAN.findOne({ MANXB: sach.MAXB });
        const theloai = await TheLoai.find({ MaLoai: { $in: sach.THELOAI } });
        const result = {
            MASACH: sach.MASACH,
            TENSACH: sach.TENSACH,
            MOTA: sach.MOTA,
            DONGIA: sach.DONGIA,
            SOQUYEN: sach.SOQUYEN,
            NAMXUATBAN: sach.NAMXUATBAN,
            MAXB: nxb,
            TACGIA: sach.TACGIA,
            HINHANH: sach.HINHANH,
            THELOAI: theloai,
        };
        res.json({
            status: "success",
            message: "Lấy thông tin sách thành công",
            data: result
        })
    } catch (error) {
        next(error);
    }
}

const getTemplateSach = async (req, res, next) => {
    try {
        const book_id = req.params.id;
        
        const sach = await SACH.findOne({ MASACH: book_id });
        if(!sach) {
            const error = new Error("Không tìm thấy sách");
            return next(error);
        }
        const banSaoSach = await BanSaoSach.find({ MASACH: book_id });

        return res.json({
            status: 'success',
            message: 'Lấy thông tin sách thành công',
            data: banSaoSach
        });
    } catch (error) {
        next(error);
    }
}

export default {
    createSach,
    getAllSach,
    uploadBookImage,
    deleteBook,
    getSachById,
    getTemplateSach
}