import SACH from '../models/SACH.js';
import Counter from '../models/Counter.js';
import BanSaoSach from '../models/BanSaoSach.js';   
import NHAXUTBAN from '../models/NHAXUATBAN.js';
import TheLoai from '../models/TheLoai.js';
import THEODOIMUONSACH from '../models/THEODOIMUONSACH.js';

// API: Lấy danh sách bản sao available của một sách
const getAvailableCopies = async (req, res, next) => {
    try {
        const { MASACH } = req.params;
        
        // Kiểm tra sách có tồn tại không
        const sach = await SACH.findOne({ MASACH });
        if (!sach) {
            const error = new Error('Sách không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Lấy tất cả bản sao available (TRANGTHAI = false)
        const availableCopies = await BanSaoSach.find({
            MASACH,
            TRANGTHAI: false // Chưa được mượn
        }).sort({ TINHTRANG: -1 }); // Ưu tiên 'new' trước 'old'
        
        res.json({
            status: 'success',
            message: 'Lấy danh sách bản sao thành công',
            data: {
                MASACH,
                TENSACH: sach.TENSACH,
                totalAvailable: availableCopies.length,
                copies: availableCopies.map(copy => ({
                    MA_BANSAO: copy.MA_BANSAO,
                    TINHTRANG: copy.TINHTRANG,
                    GHICHU: copy.GHICHU
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};


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

        // Kiểm tra sách có tồn tại không
        const sach = await SACH.findOne({ MASACH: maSach });
        if (!sach) {
            return res.status(404).json({
                status: "error",
                message: "Sách không tồn tại"
            });
        }

        // Kiểm tra có bản sao nào đang được mượn không (TRANGTHAI = true là đang được mượn)
        const borrowedCopies = await BanSaoSach.countDocuments({ 
            MASACH: maSach, 
            TRANGTHAI: true 
        });

        if (borrowedCopies > 0) {
            // Còn người mượn -> chỉ ẩn sách
            sach.TINHTRANG = false;
            await sach.save();
            return res.json({
                status: "warning",
                message: `Sách đã được ẩn vì còn ${borrowedCopies} bản sao đang được mượn`,
                hidden: true
            });
        }

        // Không có ai mượn
        if (sach.TINHTRANG === false) {
            // Sách đã bị ẩn -> xóa vĩnh viễn
            await SACH.findOneAndDelete({ MASACH: maSach });
            await BanSaoSach.deleteMany({ MASACH: maSach });
            return res.json({
                status: "success",
                message: "Xóa sách vĩnh viễn thành công",
                deleted: true
            });
        } else {
            // Sách đang hoạt động, không ai mượn -> ẩn trước
            sach.TINHTRANG = false;
            await sach.save();
            return res.json({
                status: "warning",
                message: "Sách đã được ẩn. Xóa lần nữa để xóa vĩnh viễn.",
                hidden: true
            });
        }
    } catch (error) {
        next(error);
    }
}

// Kích hoạt lại sách đã bị ẩn
const activateBook = async (req, res, next) => {
    try {
        const { maSach } = req.params;
        
        const sach = await SACH.findOne({ MASACH: maSach });
        if (!sach) {
            return res.status(404).json({
                status: "error",
                message: "Sách không tồn tại"
            });
        }
        
        if (sach.TINHTRANG === true) {
            return res.status(400).json({
                status: 'error',
                message: 'Sách này đang hoạt động'
            });
        }
        
        sach.TINHTRANG = true;
        await sach.save();
        
        res.json({
            status: 'success',
            message: 'Kích hoạt sách thành công',
            data: sach
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
        const customPath = req.file.path.replace(/\\/g, '/').replace('src/', '/');
        
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

const updateBook = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const updatedBook = await SACH.findOneAndUpdate({ MASACH: id }, data, { new: true });
        if (!updatedBook) {
            const error = new Error("Không tìm thấy sách");
            return next(error);
        }

        res.json({
            status: "success",
            message: "Cập nhật sách thành công",
            data: updatedBook
        });
    } catch (error) {
        next(error);
    }
}

//GET: /sach/top-books
const getTopBooks = async (req, res, next) => {
    // Tính số lượt mượn của từng sách
    // Lấy tất cả phiếu mượn -> tìm bản sao -> tìm sách -> đếm số lượt mượn
    try {
        // Lấy tất cả phiếu mượn
        const allBorrowRecords = await THEODOIMUONSACH.find();
        
        // Đếm số lượt mượn theo mã sách
        const bookBorrowCount = {};
        
        for (const record of allBorrowRecords) {
            // Tìm bản sao sách
            const banSao = await BanSaoSach.findOne({ MA_BANSAO: record.MA_BANSAO });
            
            if (banSao) {
                const maSach = banSao.MASACH;
                bookBorrowCount[maSach] = (bookBorrowCount[maSach] || 0) + 1;
            }
        }
        
        // Sắp xếp và lấy top 6 sách có nhiều lượt mượn nhất
        const topBookIds = Object.keys(bookBorrowCount)
            .sort((a, b) => bookBorrowCount[b] - bookBorrowCount[a])
            .slice(0, 6);
        
        // Lấy thông tin chi tiết sách
        const topBooks = await SACH.find({ MASACH: { $in: topBookIds } });
        
        // Populate thông tin NXB và thể loại cho mỗi sách
        const result = await Promise.all(topBooks.map(async (sach) => {
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
                BorrowCount: bookBorrowCount[sach.MASACH] || 0
            };
        }));
        
        // Sắp xếp lại theo số lượt mượn giảm dần
        result.sort((a, b) => b.BorrowCount - a.BorrowCount);
        
        res.json({
            status: "success",
            message: "Lấy danh sách sách hàng đầu thành công",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

// API: Tìm kiếm sách
const searchSach = async (req, res, next) => {
    try {
        const { q } = req.query;
        
        if (!q || !q.trim()) {
            return res.json({
                status: "success",
                message: "Vui lòng nhập từ khóa tìm kiếm",
                data: []
            });
        }

        const searchQuery = q.trim();
        
        // Tìm thể loại có tên khớp với từ khóa
        const matchingCategories = await TheLoai.find({
            TenLoai: { $regex: searchQuery, $options: 'i' }
        });
        const matchingCategoryIds = matchingCategories.map(cat => cat.MaLoai);
        
        // Tìm kiếm theo nhiều trường: tên sách, tác giả, mô tả, thể loại
        const sachList = await SACH.find({
            $or: [
                { TENSACH: { $regex: searchQuery, $options: 'i' } },
                { TACGIA: { $regex: searchQuery, $options: 'i' } },
                { MOTA: { $regex: searchQuery, $options: 'i' } },
                { THELOAI: { $in: matchingCategoryIds } }
            ]
        }).sort({ TENSACH: 1 });

        // Map data giống getAllSach để lấy đầy đủ thông tin NXB và TheLoai
        const results = await Promise.all(sachList.map(async (sach) => {
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
            message: `Tìm thấy ${results.length} kết quả cho "${searchQuery}"`,
            data: results
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
    activateBook,
    updateBook,
    getSachById,
    getTemplateSach,
    getTopBooks,
    getAvailableCopies,
    searchSach
}