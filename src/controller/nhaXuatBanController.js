import NHAXUATBAN from '../models/NHAXUATBAN.js';
import Counter from "../models/Counter.js"
import SACH from '../models/SACH.js';
import BanSaoSach from '../models/BanSaoSach.js';

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

//GET: /nha-xuat-ban/all-with-stats
const getAllNhaXuatBanWithStats = async (req, res, next) => {
    try {
        const NhaXuatBans = await NHAXUATBAN.find();
        
        // Thêm số sách cho mỗi NXB
        const nxbWithStats = await Promise.all(NhaXuatBans.map(async (nxb) => {
            const bookCount = await SACH.countDocuments({ MAXB: nxb.MANXB });
            return {
                ...nxb.toObject(),
                BookCount: bookCount
            };
        }));
        
        res.json({
            status: "success",
            message: "Lấy danh sách nhà xuất bản thành công",
            data: nxbWithStats
        });
    } catch (error) {
        next(error);
    }
}

//PUT: /nha-xuat-ban/update/:id
const updateNhaXuatBan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = req.body;
        
        const updated = await NHAXUATBAN.findOneAndUpdate(
            { MANXB: id },
            { TENNXB: data.TenNXB, DIACHI: data.DiaChi },
            { new: true }
        );
        
        if (!updated) {
            return res.status(404).json({
                status: "error",
                message: "Không tìm thấy nhà xuất bản"
            });
        }
        
        res.json({
            status: "success",
            message: "Cập nhật nhà xuất bản thành công",
            data: updated
        });
    } catch (error) {
        next(error);
    }
}

//DELETE: /nha-xuat-ban/delete/:id
const deleteNhaXuatBan = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const nxb = await NHAXUATBAN.findOne({ MANXB: id });
        if (!nxb) {
            return res.status(404).json({
                status: "error",
                message: "Không tìm thấy nhà xuất bản"
            });
        }
        
        // Lấy tất cả sách của NXB này
        const books = await SACH.find({ MAXB: id });
        const bookMASACHs = books.map(b => b.MASACH);
        
        // Kiểm tra có bản sao nào đang được mượn không
        const borrowedCount = await BanSaoSach.countDocuments({ 
            MASACH: { $in: bookMASACHs }, 
            TRANGTHAI: true 
        });
        
        if (borrowedCount > 0) {
            // Còn sách đang được mượn -> chỉ ẩn NXB và các sách
            nxb.TINHTRANG = false;
            await nxb.save();
            
            // Ẩn tất cả sách của NXB này
            await SACH.updateMany({ MAXB: id }, { TINHTRANG: false });
            
            return res.json({
                status: 'warning',
                message: `NXB đã được ẩn vì còn ${borrowedCount} bản sao đang được mượn`,
                hidden: true
            });
        } else {
            // Không có sách nào đang mượn
            if (nxb.TINHTRANG === false) {
                // NXB đã bị ẩn -> xóa vĩnh viễn NXB và tất cả sách
                // Xóa bản sao của tất cả sách thuộc NXB
                await BanSaoSach.deleteMany({ MASACH: { $in: bookMASACHs } });
                // Xóa tất cả sách thuộc NXB
                await SACH.deleteMany({ MAXB: id });
                // Xóa NXB
                await NHAXUATBAN.findOneAndDelete({ MANXB: id });
                
                return res.json({
                    status: 'success',
                    message: `Đã xóa vĩnh viễn NXB và ${books.length} đầu sách`,
                    deleted: true
                });
            } else {
                // NXB đang hoạt động, không ai mượn -> ẩn trước
                nxb.TINHTRANG = false;
                await nxb.save();
                await SACH.updateMany({ MAXB: id }, { TINHTRANG: false });
                
                return res.json({
                    status: 'warning',
                    message: `NXB đã được ẩn cùng ${books.length} đầu sách. Xóa lần nữa để xóa vĩnh viễn.`,
                    hidden: true
                });
            }
        }
    } catch (error) {
        next(error);
    }
}

// Kích hoạt lại NXB đã bị ẩn
const activateNhaXuatBan = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const nxb = await NHAXUATBAN.findOne({ MANXB: id });
        if (!nxb) {
            return res.status(404).json({
                status: "error",
                message: "Không tìm thấy nhà xuất bản"
            });
        }
        
        if (nxb.TINHTRANG === true) {
            return res.status(400).json({
                status: 'error',
                message: 'NXB này đang hoạt động'
            });
        }
        
        // Kích hoạt lại NXB
        nxb.TINHTRANG = true;
        await nxb.save();
        
        // Kích hoạt lại tất cả sách của NXB
        await SACH.updateMany({ MAXB: id }, { TINHTRANG: true });
        
        res.json({
            status: 'success',
            message: 'Kích hoạt NXB và các sách liên quan thành công',
            data: nxb
        });
    } catch (error) {
        next(error);
    }
}

export default {
    createNhaXuatBan,
    getAllNhaXuatBan,
    getAllNhaXuatBanWithStats,
    updateNhaXuatBan,
    deleteNhaXuatBan,
    activateNhaXuatBan
}