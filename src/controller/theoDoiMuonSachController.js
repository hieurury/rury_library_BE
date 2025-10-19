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

const createNewMuonSach = async (req, res, next) => {
    try {
        const { MANHANVIEN, MADOCGIA, MA_BANSAO } = req.body;
        console.log(`Yêu cầu mượn sách từ độc giả ${MADOCGIA} cho bản sao ${MA_BANSAO} bởi nhân viên ${MANHANVIEN}`);
        //kiểm tra bản sách đã bị mượn chưa
        const existingMuonSach = await TheoDoiMuonSach.findOne({ MA_BANSAO, TINHTRANG: 'borrowing' });
        if (existingMuonSach) {
            const error = new Error('Bản sao sách này đang được mượn và chưa trả.');
            error.status = 400;
            return next(error);
        }
        //lấy thông tin đọc giả
        const docGia = await DOCGIA.findOne({ MADOCGIA });
        if (!docGia) {
            const error = new Error('Độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        //lấy thông tin về gói đăng kí
        const packageInfo = await Package.findOne({ MaGoi: docGia.GOI.MaGoi });
        if (!packageInfo) {
            const error = new Error('Gói đăng ký của độc giả không tồn tại');
            error.status = 404;
            return next(error);
        }
        const sach = await BanSaoSach.findOne({ MA_BANSAO: MA_BANSAO });
        if (!sach) {
            const error = new Error('Sách không tồn tại');
            error.status = 404;
            return next(error);
        }
        //logic ngày hạn trả dựa trên gói cước
        const timeLimitOfPackage = packageInfo.ThoiHanMuon; //ngày
        const NGAYMUON = new Date();
        const NGAYHANTRA = new Date(NGAYMUON);
        NGAYHANTRA.setDate(NGAYHANTRA.getDate() + timeLimitOfPackage);
        const MAPHIEU = await generateMaMuon();
        const TINHTRANG = 'borrowing';
        const TRANGTHAISACH = sach.TINHTRANG;

        const newMuonSach = new TheoDoiMuonSach({
            MAPHIEU,
            MANHANVIEN,
            MADOCGIA,
            MA_BANSAO,
            NGAYMUON,
            TINHTRANG,
            NGAYHANTRA,
            TRANGTHAISACH
        });

        await newMuonSach.save();
        //cập nhật tình trạng sách
        await BanSaoSach.findOneAndUpdate(
            { MA_BANSAO },
            { TRANGTHAI: true }
        );
        res.json({
            status: 'success',
            message: 'Tạo phiếu mượn sách thành công',
            data: newMuonSach
        })
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
                GIOITINH: docGia.GIOITINH,
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
        const sachMuon = await TheoDoiMuonSach.find({ MADOCGIA, TINHTRANG: 'borrowing' });
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

export default {
    createNewMuonSach,
    getPhieuMuonChiTiet,
    getSachMuonTheoMaDocGia,
    getAllMuonSach
};