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

// Tạo bill và các phiếu mượn
const createBill = async (req, res, next) => {
    try {
        const { MADOCGIA, LIST_MA_BANSAO, LOAITHANHTOAN } = req.body;
        
        // Validate đầu vào
        if (!LIST_MA_BANSAO || LIST_MA_BANSAO.length === 0) {
            const error = new Error('Danh sách bản sao trống');
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
        
        // Lấy thông tin bản sao và kiểm tra availability
        const banSaoList = [];
        const sachList = [];
        let tongTien = 0;
        
        for (const MA_BANSAO of LIST_MA_BANSAO) {
            const banSao = await BanSaoSach.findOne({ MA_BANSAO });
            
            if (!banSao) {
                const error = new Error(`Bản sao ${MA_BANSAO} không tồn tại`);
                error.status = 404;
                return next(error);
            }
            
            // Kiểm tra bản sao đã được mượn chưa
            if (banSao.TRANGTHAI === true) {
                const error = new Error(`Bản sao ${MA_BANSAO} đã được mượn`);
                error.status = 400;
                return next(error);
            }
            
            // Lấy thông tin sách
            const sach = await SACH.findOne({ MASACH: banSao.MASACH });
            if (!sach) {
                const error = new Error(`Sách ${banSao.MASACH} không tồn tại`);
                error.status = 404;
                return next(error);
            }
            
            banSaoList.push(banSao);
            sachList.push(sach);
            tongTien += sach.DONGIA || 0;
        }
        
        // Tính ngày mượn và hạn trả
        const NGAYMUON = new Date();
        const NGAYHANTRA = new Date(NGAYMUON);
        NGAYHANTRA.setDate(NGAYHANTRA.getDate() + packageInfo.ThoiHanMuon);
        
        // Tạo bill trước
        const MABILL = await generateMaBill();
        const newBill = new BILL({
            MABILL,
            MADOCGIA,
            DANHSACHPHIEU: [], // Sẽ được cập nhật sau khi thanh toán
            TONGTIEN: tongTien,
            TRANGTHAI: false, // Chưa thanh toán
            LOAITHANHTOAN: LOAITHANHTOAN || 'cash',
            NGAYLAP: NGAYMUON
        });
        
        await newBill.save();
        
        // LOGIC PHÂN BIỆT:
        // - CASH: Tạo phiếu mượn ngay, chờ thanh toán tại quầy (có thể rollback nếu không thanh toán)
        // - ONLINE: CHỈ tạo bill pending, KHÔNG LOCK sách, chờ callback VNPAY thành công mới tạo phiếu + lock sách
        
        if (LOAITHANHTOAN === 'cash') {
            // Thanh toán tiền mặt: Tạo phiếu mượn ngay + Lock sách
            const danhSachPhieu = [];
            const phieuMuonList = [];
            
            for (let i = 0; i < banSaoList.length; i++) {
                const MAPHIEU = await generateMaPhieu();
                const banSao = banSaoList[i];
                const sach = sachList[i];
                
                const phieuMuon = new TheoDoiMuonSach({
                    MAPHIEU,
                    MANHANVIEN: 'system',
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
            
            // Lưu phiếu mượn vào database
            await TheoDoiMuonSach.insertMany(phieuMuonList);
            
            // Cập nhật bill với danh sách phiếu
            newBill.DANHSACHPHIEU = danhSachPhieu;
            await newBill.save();
            
            // LOCK sách (cập nhật trạng thái bản sao)
            const maBanSaoList = banSaoList.map(bs => bs.MA_BANSAO);
            await BanSaoSach.updateMany(
                { MA_BANSAO: { $in: maBanSaoList } },
                { TRANGTHAI: true }
            );
            
            res.json({
                status: 'success',
                message: 'Tạo bill và phiếu mượn thành công. Vui lòng đến quầy thanh toán',
                data: {
                    bill: newBill,
                    phieuMuon: phieuMuonList.map(p => ({
                        MAPHIEU: p.MAPHIEU,
                        MA_BANSAO: p.MA_BANSAO,
                        GIA: p.GIA
                    }))
                }
            });
        } else {
            // Thanh toán online (VNPAY): CHỈ tạo bill pending
            // KHÔNG tạo phiếu, KHÔNG lock sách
            // Lưu thông tin bản sao vào bill để callback xử lý sau
            newBill.PENDING_BOOKS = LIST_MA_BANSAO; // Temporary field
            await newBill.save();
            
            // Tạo URL thanh toán VNPay
            const ipAddr = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress ||
                          '127.0.0.1';
            
            const orderInfo = `Thanh toan don muon sach ${MABILL}`;
            const paymentUrl = generatePaymentUrl(
                MABILL,
                tongTien,
                orderInfo,
                ipAddr
            );
            
            res.json({
                status: 'pending',
                message: 'Bill đã tạo. Vui lòng thanh toán qua VNPAY',
                data: {
                    bill: newBill,
                    requirePayment: true,
                    paymentUrl: paymentUrl
                }
            });
        }
    } catch (error) {
        next(error);
    }
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
        
        // Lấy thông tin các phiếu mượn
        const phieuMuonList = await TheoDoiMuonSach.find({
            MAPHIEU: { $in: bill.DANHSACHPHIEU }
        });
        
        // Lấy thông tin sách cho từng phiếu
        const phieuDetails = await Promise.all(
            phieuMuonList.map(async (phieu) => {
                const banSao = await BanSaoSach.findOne({ MA_BANSAO: phieu.MA_BANSAO });
                const sach = await SACH.findOne({ MASACH: banSao.MASACH });
                
                return {
                    MAPHIEU: phieu.MAPHIEU,
                    MA_BANSAO: phieu.MA_BANSAO,
                    NGAYMUON: phieu.NGAYMUON,
                    NGAYHANTRA: phieu.NGAYHANTRA,
                    GIA: phieu.GIA,
                    TINHTRANG: phieu.TINHTRANG,
                    SACH: {
                        MASACH: sach.MASACH,
                        TENSACH: sach.TENSACH,
                        TACGIA: sach.TACGIA,
                        HINHANH: sach.HINHANH
                    }
                };
            })
        );
        
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

// Cập nhật trạng thái thanh toán (cho VNPAY callback)
const updatePaymentStatus = async (req, res, next) => {
    try {
        const { MABILL, VNPAY_TRANSACTION_ID, responseCode } = req.body;
        
        const bill = await BILL.findOne({ MABILL });
        if (!bill) {
            const error = new Error('Bill không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        // Kiểm tra responseCode từ VNPAY (00 = thành công)
        if (responseCode !== '00') {
            return res.json({
                status: 'failed',
                message: 'Thanh toán không thành công',
                data: { bill, responseCode }
            });
        }
        
        // Nếu đã thanh toán rồi, không làm gì
        if (bill.TRANGTHAI === true) {
            return res.json({
                status: 'success',
                message: 'Bill đã được thanh toán trước đó',
                data: bill
            });
        }
        
        // LOGIC TẠO PHIẾU MƯỢN KHI VNPAY THÀNH CÔNG
        if (bill.LOAITHANHTOAN === 'online' && bill.PENDING_BOOKS && bill.PENDING_BOOKS.length > 0) {
            const MADOCGIA = bill.MADOCGIA;
            const LIST_MA_BANSAO = bill.PENDING_BOOKS;
            
            // Lấy thông tin gói
            const docGia = await DOCGIA.findOne({ MADOCGIA });
            const packageInfo = await Package.findOne({ MaGoi: docGia.GOI.MaGoi });
            
            // Lấy thông tin bản sao
            const banSaoList = [];
            const sachList = [];
            
            for (const MA_BANSAO of LIST_MA_BANSAO) {
                const banSao = await BanSaoSach.findOne({ MA_BANSAO });
                
                if (!banSao || banSao.TRANGTHAI === true) {
                    const error = new Error(`Bản sao ${MA_BANSAO} không khả dụng`);
                    error.status = 400;
                    return next(error);
                }
                
                const sach = await SACH.findOne({ MASACH: banSao.MASACH });
                if (!sach) continue;
                
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
                    MANHANVIEN: 'system',
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
            
            // Lưu phiếu mượn
            await TheoDoiMuonSach.insertMany(phieuMuonList);
            
            // Cập nhật bill
            bill.DANHSACHPHIEU = danhSachPhieu;
            bill.PENDING_BOOKS = []; // Clear pending books
            
            // Cập nhật trạng thái bản sao
            const maBanSaoList = banSaoList.map(bs => bs.MA_BANSAO);
            await BanSaoSach.updateMany(
                { MA_BANSAO: { $in: maBanSaoList } },
                { TRANGTHAI: true }
            );
        }
        
        // Cập nhật trạng thái thanh toán
        bill.TRANGTHAI = true;
        bill.NGAYTHANHTOAN = new Date();
        if (VNPAY_TRANSACTION_ID) {
            bill.VNPAY_TRANSACTION_ID = VNPAY_TRANSACTION_ID;
        }
        
        await bill.save();
        
        res.json({
            status: 'success',
            message: 'Thanh toán thành công, phiếu mượn đã được tạo',
            data: bill
        });
    } catch (error) {
        next(error);
    }
};

// Cập nhật thanh toán tiền mặt (tại quầy)
const confirmCashPayment = async (req, res, next) => {
    try {
        const { MABILL } = req.body;
        
        const bill = await BILL.findOne({ MABILL });
        if (!bill) {
            const error = new Error('Bill không tồn tại');
            error.status = 404;
            return next(error);
        }
        
        if (bill.LOAITHANHTOAN !== 'cash') {
            const error = new Error('Bill này không phải thanh toán tiền mặt');
            error.status = 400;
            return next(error);
        }
        
        bill.TRANGTHAI = true;
        bill.NGAYTHANHTOAN = new Date();
        await bill.save();
        
        res.json({
            status: 'success',
            message: 'Xác nhận thanh toán tiền mặt thành công',
            data: bill
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
            return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=error&message=Invalid signature`);
        }
        
        const { responseCode, billId, transactionNo } = verifyResult;
        
        if (responseCode === '00') {
            // Thanh toán thành công
            // Gọi updatePaymentStatus để tạo phiếu mượn
            const bill = await BILL.findOne({ MABILL: billId });
            
            if (!bill) {
                return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=error&message=Bill not found`);
            }
            
            // Nếu đã thanh toán rồi thì chỉ redirect
            if (bill.TRANGTHAI === true) {
                return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=success&billId=${billId}`);
            }
            
            // Tạo phiếu mượn và lock sách
            try {
                await createBorrowingRecordsFromPendingBill(bill, transactionNo);
                return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=success&billId=${billId}`);
            } catch (error) {
                console.error('Error creating borrowing records:', error);
                // Xóa bill nếu không tạo được phiếu mượn
                await BILL.deleteOne({ MABILL: billId });
                return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=error&message=${encodeURIComponent(error.message)}`);
            }
        } else {
            // Thanh toán thất bại - XÓA BILL
            console.log(`Payment failed for bill ${billId}, deleting bill...`);
            await BILL.deleteOne({ MABILL: billId });
            
            return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=failed&message=${encodeURIComponent(verifyResult.message || 'Thanh toán không thành công')}`);
        }
    } catch (error) {
        console.error('VNPay return error:', error);
        return res.redirect(`${process.env.CLIENT_URL}/vnpay/return?status=error&message=System error`);
    }
};

// Helper function: Tạo phiếu mượn từ pending bill (dùng cho VNPAY callback)
const createBorrowingRecordsFromPendingBill = async (bill, transactionNo) => {
    if (bill.LOAITHANHTOAN !== 'online' || !bill.PENDING_BOOKS || bill.PENDING_BOOKS.length === 0) {
        throw new Error('Bill không hợp lệ hoặc không có sách pending');
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
    
    // Kiểm tra và lấy thông tin bản sao
    const banSaoList = [];
    const sachList = [];
    
    for (const MA_BANSAO of LIST_MA_BANSAO) {
        const banSao = await BanSaoSach.findOne({ MA_BANSAO });
        
        if (!banSao) {
            throw new Error(`Bản sao ${MA_BANSAO} không tồn tại`);
        }
        
        // Kiểm tra sách có bị mượn trong lúc chờ thanh toán không
        if (banSao.TRANGTHAI === true) {
            throw new Error(`Bản sao ${MA_BANSAO} đã được mượn bởi người khác`);
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
            MANHANVIEN: 'system',
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
    
    // Lưu phiếu mượn
    await TheoDoiMuonSach.insertMany(phieuMuonList);
    
    // Cập nhật bill
    bill.DANHSACHPHIEU = danhSachPhieu;
    bill.PENDING_BOOKS = []; // Clear pending books
    bill.TRANGTHAI = true;
    bill.NGAYTHANHTOAN = new Date();
    bill.VNPAY_TRANSACTION_ID = transactionNo;
    await bill.save();
    
    // LOCK sách (cập nhật trạng thái bản sao)
    const maBanSaoList = banSaoList.map(bs => bs.MA_BANSAO);
    await BanSaoSach.updateMany(
        { MA_BANSAO: { $in: maBanSaoList } },
        { TRANGTHAI: true }
    );
    
    return bill;
};

export default {
    createBill,
    getBillById,
    getBillsByDocGia,
    updatePaymentStatus,
    confirmCashPayment,
    vnpayReturn
};
