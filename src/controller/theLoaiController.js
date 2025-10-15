import TheLoai from '../models/TheLoai.js';
import SACH from '../models/SACH.js';
import Counter from '../models/Counter.js';

const generateMaLoai = async (TenLoai) => {
    const counter = await Counter.findByIdAndUpdate(
        { _id: "MALOAI" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const maloai = "L" + String(counter.seq).padStart(3, '0');
    //check trong db
    const existing = await TheLoai.findOne({ MaLoai: maloai });
    if (existing) {
        throw new Error("Mã loại đã tồn tại, vui lòng thử lại với tên khác");
    }
    return maloai;
}

//POST: /the-loai/create
const createTheLoai = async (req, res, next) => {
    try {
        const data = req.body;
        const MaLoai = await generateMaLoai(data.TenLoai);
        const newTheLoai = new TheLoai({
            MaLoai: MaLoai,
            TenLoai: data.TenLoai,
            MoTa: data.MoTa,
            Icon: data.Icon,
            Color: data.Color
        });
        const theLoaiSaved = await newTheLoai.save();
        if (!theLoaiSaved) {
            const error = new Error("Tạo thể loại không thành công, vui lòng thử lại sau!");
            return next(error);
        }
        res.json({
            status: "success",
            message: "Tạo thể loại thành công",
            data: theLoaiSaved
        });
    } catch (error) {
        next(error);
    }
}

//GET: /the-loai/all
const getAllCategories      =   async (req, res, next) => {
    try {
        const categories    =   await TheLoai.find();
        const books         =   await SACH.find();
        //thêm số lượng sách vào từng thể loại
        const finalCategories = categories.map(category => {
            const bookCount =   books.filter(book => book.THELOAI.includes(category.MaLoai)).length;
            return {
                ...category.toObject(),
                BookCount: bookCount
            };
        });
        res.json({
            status: "success",
            message: "Lấy danh sách thể loại thành công",
            data: finalCategories
        });
    } catch (error) {
        next(error);
    }
}

//POST: /the-loai/upload-icon
const uploadCategoryIcon = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error("Vui lòng chọn file để tải lên");
            return next(error);
        }
        
        //replace \\ thành /
        const customPath = req.file.path.replace(/\\/g, '/').replace('src/', '');
        res.json({
            status: "success",
            message: "Tải lên hình ảnh thể loại thành công",
            filePath: customPath
        });
    } catch (error) {
        next(error);
    }
}


export default {
    createTheLoai,
    uploadCategoryIcon,
    getAllCategories,
};