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

// ================================================
// LOGIC MỚI - ĐƠN GIẢN HÓA
// ================================================
// NGUYÊN TẮC:
// 1. VNPAY (online): KHÔNG tạo gì cho đến khi SUCCESS callback
// 2. CASH: CHỈ dùng cho thủ thư tạo trực tiếp tại quầy
//          Web client KHÔNG được phép tạo bill CASH
// ================================================

const createBill = async (req, res, next) => {
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
        
        // Tạo MABILL
        const MABILL = await generateMaBill();
        
        // ============================================
        // CHỈ VNPAY - TẠO BILL PENDING
        // ============================================
        // KHÔNG tạo phiếu mượn, KHÔNG lock sách
        // Chỉ tạo phiếu + lock sách khi callback SUCCESS
        
        const newBill = new BILL({
            MABILL,
            MADOCGIA,
            DANHSACHPHIEU: [], // Trống, sẽ được tạo khi VNPAY success
            TONGTIEN: tongTien,
            TRANGTHAI: false, // Chưa thanh toán
            LOAITHANHTOAN: 'online',
            NGAYLAP: new Date(),
            PENDING_BOOKS: LIST_MA_BANSAO, // Lưu tạm để tạo phiếu sau khi thanh toán thành công
            METADATA: {
                packageInfo: {
                    ThoiHanMuon: packageInfo.ThoiHanMuon
                },
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 phút (timeout VNPAY)
            }
        });
        
        await newBill.save();
        
        // SOFT LOCK: Đánh dấu các bản sao đang chờ thanh toán
        await BanSaoSach.updateMany(
            { MA_BANSAO: { $in: LIST_MA_BANSAO } },
            { PENDING_BILL: MABILL }
        );
        
        // Tạo URL thanh toán VNPay
        const ipAddr = req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress ||
                      '127.0.0.1';
        
        const orderInfo = `Thanh toan muon sach ${MABILL}`;
        const paymentUrl = generatePaymentUrl(
            MABILL,
            tongTien,
            orderInfo,
            ipAddr
        );
        
        res.json({
                status: 'pending',
                message: 'Bill đã tạo. Vui lòng thanh toán qua VNPAY trong vòng 15 phút',
                data: {
                    bill: {
                        MABILL: newBill.MABILL,
                    TONGTIEN: newBill.TONGTIEN,
                    NGAYLAP: newBill.NGAYLAP,
                    SO_SACH: LIST_MA_BANSAO.length
                },
                requirePayment: true,
                paymentUrl: paymentUrl,
                expiresIn: '15 phút',
                warning: 'Bill sẽ tự động hủy nếu không thanh toán trong 15 phút. Sách chưa được lock.'
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// VNPay Return URL Handler (cho redirect từ VNPay về website)
const vnpayReturn = async (req, res, next) => {
    try {
        const vnpParams = req.query;
        
        // Verify chữ ký
        const verifyResult = verifyReturnUrl(vnpParams);
        
        if (!verifyResult.isValid) {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=error&message=${encodeURIComponent('Chữ ký không hợp lệ')}`);
        }
        
        const { responseCode, billId, transactionNo } = verifyResult;
        
        if (responseCode === '00') {
            // ========== THANH TOÁN THÀNH CÔNG ==========
            const bill = await BILL.findOne({ MABILL: billId });
            
            if (!bill) {
                console.error(`Bill ${billId} không tồn tại`);
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=error&message=${encodeURIComponent('Bill không tồn tại')}`);
            }
            
            // Nếu đã thanh toán rồi thì chỉ redirect success
            if (bill.TRANGTHAI === true) {
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=success&billId=${billId}`);
            }
            
            // TẠO PHIẾU MƯỢN VÀ LOCK SÁCH
            try {
                const result = await createBorrowingRecordsFromBill(bill, 'vnpay_system');
                
                // Cập nhật bill
                bill.TRANGTHAI = true;
                bill.NGAYTHANHTOAN = new Date();
                bill.VNPAY_TRANSACTION_ID = transactionNo;
                bill.DANHSACHPHIEU = result.danhSachPhieu;
                bill.PENDING_BOOKS = []; // Clear pending
                await bill.save();
                
                // CLEAR SOFT LOCK: Xóa PENDING_BILL khi thanh toán thành công
                await BanSaoSach.updateMany(
                    { PENDING_BILL: billId },
                    { PENDING_BILL: null }
                );
                
                console.log(`✅ VNPAY SUCCESS: Bill ${billId} đã thanh toán, phiếu mượn đã tạo`);
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=success&billId=${billId}`);
                
            } catch (error) {
                console.error(`❌ Error creating borrowing records for bill ${billId}:`, error);
                
                // ROLLBACK: Xóa bill và clear soft lock nếu không tạo được phiếu mượn
                await BILL.deleteOne({ MABILL: billId });
                await BanSaoSach.updateMany(
                    { PENDING_BILL: billId },
                    { PENDING_BILL: null }
                );
                console.log(`🗑️  Bill ${billId} đã bị xóa do lỗi tạo phiếu mượn`);
                
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=error&message=${encodeURIComponent('Lỗi xử lý phiếu mượn. Bill đã bị hủy.')}`);
            }
            
        } else {
            // ========== THANH TOÁN THẤT BẠI ==========
            // XÓA BILL NGAY LẬP TỨC VÀ CLEAR SOFT LOCK
            const deleteResult = await BILL.deleteOne({ MABILL: billId });
            
            if (deleteResult.deletedCount > 0) {
                // Clear soft lock cho các sách
                await BanSaoSach.updateMany(
                    { PENDING_BILL: billId },
                    { PENDING_BILL: null }
                );
                console.log(`🗑️  VNPAY FAILED: Bill ${billId} đã bị xóa (response code: ${responseCode})`);
            }
            
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=failed&message=${encodeURIComponent(verifyResult.message || 'Thanh toán không thành công')}`);
        }
    } catch (error) {
        console.error('❌ VNPay return error:', error);
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/vnpay/return?status=error&message=${encodeURIComponent('Lỗi hệ thống')}`);
    }
};

// Helper function: Tạo phiếu mượn từ bill
// Dùng cho cả CASH confirm và VNPAY callback
const createBorrowingRecordsFromBill = async (bill, manhanvien = 'system') => {
    if (!bill.PENDING_BOOKS || bill.PENDING_BOOKS.length === 0) {
        throw new Error('Bill không có sách pending');
    }
    
    const MADOCGIA = bill.MADOCGIA;
    const LIST_MA_BANSAO = bill.PENDING_BOOKS;
    
    // Lấy thông tin gói
    const docGia = await DOCGIA.findOne({ MADOCGIA });
    if (!docGia) {
        throw new Error('Độc giả không tồn tại');
    }
    
    const packageInfo = await Package.findOne({ MaGoi: docGia.GOI.MaGoi });
    if (!packageInfo) {
        throw new Error('Gói dịch vụ không tồn tại');
    }
    
    // Validate và lấy thông tin bản sao
    const banSaoList = [];
    const sachList = [];
    
    for (const MA_BANSAO of LIST_MA_BANSAO) {
        const banSao = await BanSaoSach.findOne({ MA_BANSAO });
        
        if (!banSao) {
            throw new Error(`Bản sao ${MA_BANSAO} không tồn tại`);
        }
        
        // HARD LOCK: Sách đã được mượn (có phiếu mượn)
        if (banSao.TRANGTHAI === true) {
            throw new Error(`Bản sao ${MA_BANSAO} đã được mượn bởi người khác. Vui lòng chọn bản sao khác.`);
        }
        
        // SOFT LOCK: Sách đang chờ thanh toán của đơn khác
        // (Cho phép nếu là cùng bill hiện tại)
        if (banSao.PENDING_BILL && banSao.PENDING_BILL !== bill.MABILL) {
            throw new Error(`Bản sao ${MA_BANSAO} đang được giữ chỗ bởi đơn khác. Vui lòng chọn bản sao khác.`);
        }
        
        const sach = await SACH.findOne({ MASACH: banSao.MASACH });
        if (!sach) {
            throw new Error(`Sách ${banSao.MASACH} không tồn tại`);
        }
        
        banSaoList.push(banSao);
        sachList.push(sach);
    }
    
    // Tạo phiếu mượn
    const NGAYMUON = new Date();
    const NGAYHANTRA = new Date(NGAYMUON);
    NGAYHANTRA.setDate(NGAYHANTRA.getDate() + packageInfo.ThoiHanMuon);
    
    const danhSachPhieu = [];
    const phieuMuonList = [];
    
    for (let i = 0; i < banSaoList.length; i++) {
        const MAPHIEU = await generateMaPhieu();
        const banSao = banSaoList[i];
        const sach = sachList[i];
        
        const phieuMuon = new TheoDoiMuonSach({
            MAPHIEU,
            MANHANVIEN: manhanvien,
            MADOCGIA,
            MA_BANSAO: banSao.MA_BANSAO,
            NGAYMUON,
            NGAYHANTRA,
            GIA: sach.DONGIA || 0,
            TRANGTHAISACH: banSao.TINHTRANG,
            TINHTRANG: 'borrowing'
        });
        
        phieuMuonList.push(phieuMuon);
        danhSachPhieu.push(MAPHIEU);
    }
    
    // ATOMIC: Lưu phiếu mượn + Lock sách cùng lúc
    await TheoDoiMuonSach.insertMany(phieuMuonList);
    
    const maBanSaoList = banSaoList.map(bs => bs.MA_BANSAO);
    await BanSaoSach.updateMany(
        { MA_BANSAO: { $in: maBanSaoList } },
        { TRANGTHAI: true }
    );
    
    return {
        danhSachPhieu,
        phieuMuonList: phieuMuonList.map(p => ({
            MAPHIEU: p.MAPHIEU,
            MA_BANSAO: p.MA_BANSAO,
            GIA: p.GIA,
            NGAYMUON: p.NGAYMUON,
            NGAYHANTRA: p.NGAYHANTRA
        }))
    };
};

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
    getBillById,
    getBillsByDocGia,
    vnpayReturn,
    cleanupExpiredBills
};
