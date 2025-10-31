import BILL from '../models/BILL.js';
import TheoDoiMuonSach from '../models/THEODOIMUONSACH.js';
import DOCGIA from '../models/DOCGIA.js';
import Package from '../models/Package.js';
import BanSaoSach from '../models/BanSaoSach.js';
import SACH from '../models/SACH.js';
import Counter from '../models/Counter.js';
import { generatePaymentUrl, verifyReturnUrl } from '../utils/vnpayService.js';

const generateMaBill = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'maBill' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const seqNumber = counter.seq.toString().padStart(6, '0');
    return `BILL${seqNumber}`;
};

const generateMaPhieu = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'maMuonSach' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const seqNumber = counter.seq.toString().padStart(6, '0');
    return `PM${seqNumber}`;
};

const generateMaGD = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'maGiaoDich' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    const seqNumber = counter.seq.toString().padStart(6, '0');
    return `GD${seqNumber}`;
};

// NGUYÊN TẮC:
// 1. VNPAY (online): KHÔNG tạo gì cho đến khi SUCCESS callback
// 2. CASH: CHỈ dùng cho thủ thư tạo trực tiếp tại quầy
//          Web client KHÔNG được phép tạo bill CASH
// ================================================

const checkBillThanhToan = async (req, res, next) => {
    try {
        const { MADOCGIA, LIST_MA_BANSAO, LOAITHANHTOAN } = req.body;
        
        // Validate đầu vào
        if (!LIST_MA_BANSAO || LIST_MA_BANSAO.length === 0) {
            const error = new Error('Danh sách bản sao trống');
            error.status = 400;
            return next(error);
        }
        
        // Web client CHỈ được phép dùng VNPAY (online)
        if (LOAITHANHTOAN !== 'online') {
            const error = new Error('Chỉ hỗ trợ thanh toán VNPAY (online) qua web');
            error.status = 400;
            return next(error);
        }
        
        // Lấy thông tin độc giả và gói
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
        
        // Kiểm tra gói có hết hạn không
        const now = new Date();
        const ngayHetHan = new Date(docGia.GOI.NgayHetHan);
        if (now > ngayHetHan) {
            const error = new Error('Gói dịch vụ đã hết hạn. Vui lòng gia hạn gói để tiếp tục mượn sách');
            error.status = 403;
            return next(error);
        }
        
        // Kiểm tra giới hạn mượn
        const sachMuonHienTai = await TheoDoiMuonSach.countDocuments({
            MADOCGIA,
            TINHTRANG: 'borrowing'
        });
        
        const tongSachMuon = sachMuonHienTai + LIST_MA_BANSAO.length;
        if (tongSachMuon > packageInfo.SoSachToiDa) {
            const error = new Error(
                `Vượt quá giới hạn mượn. Hiện tại: ${sachMuonHienTai}, muốn thêm: ${LIST_MA_BANSAO.length}, tối đa: ${packageInfo.SoSachToiDa}`
            );
            error.status = 400;
            return next(error);
        }
        
        // Validate tất cả bản sao
        let tongTien = 0;
        for (const MA_BANSAO of LIST_MA_BANSAO) {
            const banSao = await BanSaoSach.findOne({ MA_BANSAO });
            
            if (!banSao) {
                const error = new Error(`Bản sao ${MA_BANSAO} không tồn tại`);
                error.status = 404;
                return next(error);
            }
            
            // HARD LOCK: Sách đã được mượn (có phiếu mượn)
            if (banSao.TRANGTHAI === true) {
                const error = new Error(`Bản sao ${MA_BANSAO} đã được mượn`);
                error.status = 400;
                return next(error);
            }
            
            // SOFT LOCK: Sách đang chờ thanh toán của user khác
            if (banSao.PENDING_BILL && banSao.PENDING_BILL !== '') {
                const error = new Error(`Bản sao ${MA_BANSAO} đang được giữ chỗ bởi đơn khác. Vui lòng chọn bản sao khác.`);
                error.status = 400;
                return next(error);
            }
            
            const sach = await SACH.findOne({ MASACH: banSao.MASACH });
            if (!sach) {
                const error = new Error(`Sách ${banSao.MASACH} không tồn tại`);
                error.status = 404;
                return next(error);
            }
            
            tongTien += sach.DONGIA || 0;
        }
        
        const maGD = await generateMaGD();
        
        // Tạo URL thanh toán VNPay
        let ipAddr = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     '127.0.0.1';
        
        // VNPay chỉ hỗ trợ IPv4, chuyển IPv6 về IPv4
        if (ipAddr && ipAddr.includes('::')) {
            // IPv6 localhost → IPv4 localhost
            if (ipAddr === '::1' || ipAddr.startsWith('::ffff:')) {
                ipAddr = ipAddr.replace('::ffff:', '');
            } else {
                ipAddr = '127.0.0.1';
            }
        }
        
        // Lấy IP đầu tiên nếu có nhiều (x-forwarded-for)
        if (ipAddr && ipAddr.includes(',')) {
            ipAddr = ipAddr.split(',')[0].trim();
        }
        
        console.log('🌐 Client IP:', ipAddr);
        
        // VNPay KHÔNG hỗ trợ tiếng Việt có dấu trong orderInfo
        const orderInfo = `Thanh ${tongTien} VND cho giao dich - GDID: ${maGD}`;
        const paymentUrl = generatePaymentUrl(
            maGD,
            tongTien,
            orderInfo,
            ipAddr
        );
        
        res.json({
            requirePayment: true,
            paymentUrl: paymentUrl,
            expiresIn: '15 phút',
            warning: 'Bill sẽ tự động hủy nếu không thanh toán trong 15 phút. Sách chưa được lock.'
        });
        
    } catch (error) {
        next(error);
    }
};

const createBill = async (req, res, next) => {
    try {
        const { MADOCGIA, LIST_MA_BANSAO, LOAITHANHTOAN } = req.body;
        console.log(MADOCGIA, LIST_MA_BANSAO, LOAITHANHTOAN);
        if(!MADOCGIA || !LIST_MA_BANSAO || LIST_MA_BANSAO.length === 0 || !LOAITHANHTOAN) {
            const error = new Error('Thông tin thanh toán không hợp lệ!');
            error.status = 400;
            return next(error);
        }
        //kiểm tra và lấy thông tin độc giả + gói
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
        //validate và lấy thông tin bản sao
        let tongTien = 0;
        for (const MA_BANSAO of LIST_MA_BANSAO) {
            const banSao = await BanSaoSach.findOne({ MA_BANSAO });
            if (!banSao) {
                const error = new Error(`Bản sao ${MA_BANSAO} không tồn tại`);
                error.status = 404;
                return next(error);
            }  
            const sach = await SACH.findOne({ MASACH: banSao.MASACH });
            if (!sach) {
                const error = new Error(`Sách ${banSao.MASACH} không tồn tại`); 
                error.status = 404;
                return next(error);
            }
            if(banSao.TRANGTHAI === true) {
                const error = new Error(`Có lỗi xảy ra trong quá trình xử lí mượn sách`);
                error.status = 400;
                return next(error);
            }
            tongTien += sach.DONGIA || 0;
        }


        //tạo phiếu mượn cho tất cả bản sao ở trạng thái waiting
        // Tạo phiếu mượn cho tất cả bản sao ở trạng thái waiting
        const phieuMuonPromises = LIST_MA_BANSAO.map(async (MA_BANSAO) => {
            const MAPHIEU = await generateMaPhieu();
            const NGAYMUON = new Date();
            const NGAYHANTRA = new Date();
            // Ngày hạn trả tính theo gói
            NGAYHANTRA.setDate(NGAYHANTRA.getDate() + packageInfo.ThoiHanMuon);
            
            // Tìm giá sách
            const banSao = await BanSaoSach.findOne({ MA_BANSAO });
            const sach = await SACH.findOne({ MASACH: banSao.MASACH });
            
            // Tạo phiếu mượn
            const phieuMuon = new TheoDoiMuonSach({
                MAPHIEU,
                MADOCGIA,
                MA_BANSAO,
                NGAYMUON,
                NGAYHANTRA,
                GIA: sach.DONGIA || 0,
                TRANGTHAISACH: banSao.TINHTRANG,
                TINHTRANG: 'waiting'
            });
            
            // Lock sách (hard lock)
            await BanSaoSach.findOneAndUpdate(
                { MA_BANSAO },
                { TRANGTHAI: true }
            );
            
            // Lưu phiếu mượn
            await phieuMuon.save();
            
            console.log('✅ Created phiếu mượn:', MAPHIEU);
            
            return MAPHIEU;
        });

        // Chờ tất cả phiếu mượn được tạo xong
        const DANHSACHPHIEU = await Promise.all(phieuMuonPromises);

        console.log('📋 Danh sách phiếu:', DANHSACHPHIEU);

        const MABILL = await generateMaBill();
        //tạo bill mới
        const newBill = new BILL({
            MABILL,
            MADOCGIA,
            DANHSACHPHIEU,
            TONGTIEN: tongTien,
            TRANGTHAI: true,
            LOAITHANHTOAN,
            GOI: docGia.GOI.MaGoi
        });
        console.log(newBill);
        await newBill.save();

        res.json({
            status: 'success',
            message: 'Tạo bill thành công',
            data: newBill
        });
    } catch (error) {
        next(error);
    }
}

// Lấy thông tin bill theo mã
const getBillById = async (req, res, next) => {
    try {
        const { MABILL } = req.params;
        
        const bill = await BILL.findOne({ MABILL });
        if (!bill) {
            const error = new Error('Bill không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Lấy thông tin các phiếu mượn (nếu có)
        let phieuDetails = [];
        if (bill.DANHSACHPHIEU && bill.DANHSACHPHIEU.length > 0) {
            const phieuMuonList = await TheoDoiMuonSach.find({
                MAPHIEU: { $in: bill.DANHSACHPHIEU }
            });
            
            phieuDetails = await Promise.all(
                phieuMuonList.map(async (phieu) => {
                    const banSao = await BanSaoSach.findOne({ MA_BANSAO: phieu.MA_BANSAO });
                    const sach = banSao ? await SACH.findOne({ MASACH: banSao.MASACH }) : null;
                    
                    return {
                        MAPHIEU: phieu.MAPHIEU,
                        MA_BANSAO: phieu.MA_BANSAO,
                        NGAYMUON: phieu.NGAYMUON,
                        NGAYHANTRA: phieu.NGAYHANTRA,
                        GIA: phieu.GIA,
                        TINHTRANG: phieu.TINHTRANG,
                        SACH: sach ? {
                            MASACH: sach.MASACH,
                            TENSACH: sach.TENSACH,
                            TACGIA: sach.TACGIA,
                            HINHANH: sach.HINHANH
                        } : null
                    };
                })
            );
        }
        
        res.json({
            status: 'success',
            message: 'Lấy thông tin bill thành công',
            data: {
                ...bill.toObject(),
                PHIEUMUON: phieuDetails
            }
        });
    } catch (error) {
        next(error);
    }
};

// Lấy tất cả bill của độc giả
const getBillsByDocGia = async (req, res, next) => {
    try {
        const { MADOCGIA } = req.params;
        
        const bills = await BILL.find({ MADOCGIA }).sort({ NGAYLAP: -1 });
        
        res.json({
            status: 'success',
            message: 'Lấy danh sách bill thành công',
            data: bills
        });
    } catch (error) {
        next(error);
    }
};

// Lấy danh sách bills chờ xác nhận (CASH, chưa thanh toán, chưa hết hạn)

// Cleanup job: Xóa bills hết hạn (chạy định kỳ)
const cleanupExpiredBills = async () => {
    try {
        const now = new Date();
        
        // Tìm bills hết hạn
        const expiredBills = await BILL.find({
            TRANGTHAI: false,
            'METADATA.expiresAt': { $lt: now }
        });
        
        // Lấy danh sách MABILL
        const expiredBillIds = expiredBills.map(b => b.MABILL);
        
        if (expiredBillIds.length === 0) {
            console.log('🧹 Cleanup: Không có bills hết hạn');
            return 0;
        }
        
        // Clear soft lock cho các sách của bills hết hạn
        await BanSaoSach.updateMany(
            { PENDING_BILL: { $in: expiredBillIds } },
            { PENDING_BILL: null }
        );
        
        // Xóa bills hết hạn
        const result = await BILL.deleteMany({
            MABILL: { $in: expiredBillIds }
        });
        
        console.log(`🧹 Cleanup: Đã xóa ${result.deletedCount} bills hết hạn và clear soft lock`);
        return result.deletedCount;
    } catch (error) {
        console.error('❌ Error cleaning up expired bills:', error);
        throw error;
    }
};

export default {
    createBill,
    checkBillThanhToan,
    getBillById,
    getBillsByDocGia,
    cleanupExpiredBills
};
