import SACH             from '../models/SACH.js';
import DOCGIA           from '../models/DOCGIA.js';
import NhanVien         from '../models/NhanVien.js';
import BanSaoSach       from '../models/BanSaoSach.js';
import Package          from '../models/Package.js';
import Counter          from '../models/Counter.js';
import TheoDoiMuonSach  from '../models/TheoDoiMuonSach.js';
import NHAXUATBAN       from '../models/NHAXUATBAN.js';
import TheLoai          from '../models/TheLoai.js';

const generateMaMuon = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'maMuonSach' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const seqNumber = counter.seq.toString().padStart(6, '0');
    return `PM${seqNumber}`;
};

const createMuonSachBulk = async (req, res, next) => {
    try {
        const { MANHANVIEN, MADOCGIA, LIST_MA_BANSAO } = req.body; // LIST_MA_BANSAO: [MA_BANSAO1, MA_BANSAO2, ...]
        
        // Lấy thông tin độc giả & gói
        const docGia = await DOCGIA.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        const packageInfo = await Package.findOne({ MaGoi: docGia.GOI.MaGoi });
        if (!packageInfo) {
            const error = new Error('Gói dịch vụ không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Validate: kiểm tra giới hạn mượn
        const sachMuonHienTai = await TheoDoiMuonSach.countDocuments({ 
            MADOCGIA, 
            TINHTRANG: 'borrowing' 
        });
        const soSachCanMuon = LIST_MA_BANSAO.length;
        const tongSachMuon = sachMuonHienTai + soSachCanMuon;
        
        if (tongSachMuon > packageInfo.SoSachToiDa) {
            const error = new Error(
                `Vượt quá giới hạn mượn. Hiện tại: ${sachMuonHienTai}, muốn thêm: ${soSachCanMuon}, tối đa: ${packageInfo.SoSachToiDa}`
            );
            error.status = 400;
            return next(error);
        }
        
        // Validate: kiểm tra tất cả bản sao có hợp lệ không
        const banSaoList = await BanSaoSach.find({ MA_BANSAO: { $in: LIST_MA_BANSAO } });
        if (banSaoList.length !== LIST_MA_BANSAO.length) {
            const error = new Error('Một số bản sao không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        const sachDangMuon = await TheoDoiMuonSach.find({ 
            MA_BANSAO: { $in: LIST_MA_BANSAO }, 
            TINHTRANG: 'borrowing' 
        });
        if (sachDangMuon.length > 0) {
            const error = new Error('Một số sách đang được mượn');
            error.status = 400;
            return next(error);
        }
        
        // Xử lý: tạo tất cả phiếu mượn
        const NGAYMUON = new Date();
        const NGAYHANTRA = new Date(NGAYMUON);
        NGAYHANTRA.setDate(NGAYHANTRA.getDate() + packageInfo.ThoiHanMuon);
        
        const newMuonSachList = await Promise.all(
            LIST_MA_BANSAO.map(async (MA_BANSAO) => {
                const MAPHIEU = await generateMaMuon();
                const sach = banSaoList.find(s => s.MA_BANSAO === MA_BANSAO);
                
                return new TheoDoiMuonSach({
                    MAPHIEU,
                    MANHANVIEN,
                    MADOCGIA,
                    MA_BANSAO,
                    NGAYMUON,
                    TINHTRANG: 'borrowing',
                    NGAYHANTRA,
                    TRANGTHAISACH: sach.TINHTRANG
                });
            })
        );
        
        await TheoDoiMuonSach.insertMany(newMuonSachList);
        
        // Cập nhật tình trạng sách
        await BanSaoSach.updateMany(
            { MA_BANSAO: { $in: LIST_MA_BANSAO } },
            { TRANGTHAI: true }
        );
        
        res.json({
            status: 'success',
            message: `Mượn ${LIST_MA_BANSAO.length} sách thành công`,
            data: newMuonSachList
        });
    } catch (error) {
        next(error);
    }
};


//lấy chi tiết thông tin mượn theo mã phiếu
const getPhieuMuonChiTiet = async (req, res, next) => {
    try {
        const { MAPHIEU } = req.params;
        const phieuMuon = await TheoDoiMuonSach.findOne({ MAPHIEU });
        if (!phieuMuon) {
            const error = new Error('Phiếu mượn không tồn tại');
            error.status = 404;
            return next(error);
        }
        //lấy thông tin chi tiết từng phần
        const [banSaoSach, docGia] = await Promise.all([
            BanSaoSach.findOne({ MA_BANSAO: phieuMuon.MA_BANSAO }),
            DOCGIA.findOne({ MADOCGIA: phieuMuon.MADOCGIA }),
        ]);
        //lấy thông tin nhân viện hoặc hệ thống cho mượn
        let nhanVien = null;
        if(phieuMuon.MANHANVIEN === 'system') {
            nhanVien = {
                MANHANVIEN: 'system',
                HoTenNV: 'Hệ thống',
                MoTa: 'Hệ thống tự động mượn sách'
            };
        } else {
            nhanVien = await NhanVien.findOne({ MANHANVIEN: phieuMuon.MANHANVIEN });
            if (!nhanVien) {
                const error = new Error('Nhân viên không tồn tại');
                error.status = 404;
                return next(error);
            }
        }
        
        if (!banSaoSach || !docGia) {
            const error = new Error('Thông tin chi tiết không tồn tại');
            error.status = 404;
            return next(error);
        }
        //lấy thông tin sách dựa vào bản sao
        const sach = await SACH.findOne({ MASACH: banSaoSach.MASACH });
        if (!sach) {
            const error = new Error('Sách không tồn tại');
            error.status = 404;
            return next(error);
        }
        const nhaXuatBan = await NHAXUATBAN.findOne({ MANXB: sach.MAXB });
        if (!nhaXuatBan) {
            const error = new Error('Nhà xuất bản không tồn tại');
            error.status = 404;
            return next(error);
        }
        const theLoai = await TheLoai.find({ MaLoai: { $in: sach.THELOAI } });
        if(theLoai.length === 0) {
            const error = new Error('Thể loại sách không tồn tại');
            error.status = 404;
            return next(error);
        }

        const result = {
            MAPHIEU: phieuMuon.MAPHIEU,
            NGAYMUON: phieuMuon.NGAYMUON,
            NGAYHANTRA: phieuMuon.NGAYHANTRA,
            NGAYTRA: phieuMuon.NGAYTRA,
            TINHTRANG: phieuMuon.TINHTRANG,
            TRANGTHAISACH: phieuMuon.TRANGTHAISACH,
            SACH: {
                MA_BANSAO: banSaoSach.MA_BANSAO,
                MASACH: banSaoSach.MASACH,
                TINHTRANG: banSaoSach.TINHTRANG,
                GHICHU: banSaoSach.GHICHU,
                TENSACH: sach.TENSACH,
                TACGIA: sach.TACGIA,
                MOTA: sach.MOTA,
                THELOAI: theLoai.map(tl => ({
                    MaLoai: tl.MaLoai,
                    TenLoai: tl.TenLoai
                })),
                DONGIA: sach.DONGIA,
                NAMXUATBAN: sach.NAMXUATBAN,
                NHAXUATBAN: {
                    MANXB: nhaXuatBan.MANXB,
                    TENNXB: nhaXuatBan.TENNXB,
                },
            },
            DOCGIA: {
                MADOCGIA: docGia.MADOCGIA,
                HOLOT: docGia.HOLOT,
                TEN: docGia.TEN,
                PHAI: docGia.PHAI,
                NGAYSINH: docGia.NGAYSINH,
                DIACHI: docGia.DIACHI,
                DIENTHOAI: docGia.DIENTHOAI
            }
        }
        

        res.json({
            status: 'success',
            message: 'Lấy thông tin phiếu mượn thành công',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const getSachMuonTheoMaDocGia = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.params;
        const sachMuon = await TheoDoiMuonSach.find({ MADOCGIA});
        res.json({
            status: 'success',
            message: 'Lấy thông tin sách mượn theo mã độc giả thành công',
            data: sachMuon
        });
    } catch (error) {
        next(error);
    }
};

const getAllMuonSach = async (req, res, next) => {
    try {
        const allMuonSach = await TheoDoiMuonSach.find();
        res.json({
            status: 'success',
            message: 'Lấy thông tin tất cả phiếu mượn thành công',
            data: allMuonSach
        });
    } catch (error) {
        next(error);
    }
};


const returnBook = async (req, res, next) => {
    try {
        const { LIST_MAPHIEU } = req.body;
        //kiểm tra các mã phiếu có tồn tại không
        if(!LIST_MAPHIEU || LIST_MAPHIEU.length === 0) {
            const error = new Error('Danh sách mã phiếu trống');
            error.status = 400;
            return next(error);
        }
        const NGAYTRA = new Date();
        await TheoDoiMuonSach.updateMany(
            { MAPHIEU: { $in: LIST_MAPHIEU } },
            { $set: { NGAYTRA, TINHTRANG: 'returned' } }
        );
        res.json({
            status: 'success',
            message: 'Trả sách thành công'
        });
    } catch (error) {
        next(error);
    }
};

export default {
    createMuonSachBulk,
    getPhieuMuonChiTiet,
    getSachMuonTheoMaDocGia,
    getAllMuonSach,
    returnBook
};