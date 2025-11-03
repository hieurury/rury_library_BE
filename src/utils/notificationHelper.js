import DOCGIA from '../models/DOCGIA.js';

/**
 * Tạo thông báo mới cho độc giả
 * @param {String} MADOCGIA - Mã độc giả
 * @param {String} LABEL - Nhãn thông báo (success, info, warning, error)
 * @param {String} NOIDUNG - Nội dung thông báo
 * @returns {Promise<Boolean>} - Thành công hay thất bại
 */
const createNotification = async (MADOCGIA, LABEL, NOIDUNG) => {
    try {
        const docGia = await DOCGIA.findOne({ MADOCGIA });
        if (!docGia) {
            console.error(`❌ Không tìm thấy độc giả ${MADOCGIA}`);
            return false;
        }

        const newNotification = {
            LABEL,
            NOIDUNG,
            NGAYTAO: new Date(),
            DAXEM: false
        };

        docGia.NOTIFICATIONS.push(newNotification);
        await docGia.save();

        console.log(`✅ Đã tạo thông báo cho ${MADOCGIA}: ${LABEL} - ${NOIDUNG}`);
        return true;
    } catch (error) {
        console.error(`❌ Lỗi tạo thông báo cho ${MADOCGIA}:`, error);
        return false;
    }
};

/**
 * Thông báo đăng ký tài khoản thành công
 */
const notifyRegistrationSuccess = async (MADOCGIA, TEN) => {
    const LABEL = 'success';
    const NOIDUNG = `Chào mừng ${TEN} đến với Thư viện Rury! Tài khoản của bạn đã được kích hoạt thành công.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo mượn sách thành công
 */
const notifyBorrowSuccess = async (MADOCGIA, MABILL, soSach, tongTien) => {
    const LABEL = 'info';
    const NOIDUNG = `Bạn đã tạo đơn mượn ${soSach} quyển sách (Bill ${MABILL}) với tổng giá trị ${tongTien.toLocaleString()} đ. Vui lòng đến thư viện để lấy sách.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo đã lấy sách thành công
 */
const notifyPickupSuccess = async (MADOCGIA, soSach, ngayHanTra) => {
    const LABEL = 'success';
    const hanTraFormatted = new Date(ngayHanTra).toLocaleDateString('vi-VN');
    const NOIDUNG = `Bạn đã lấy ${soSach} quyển sách thành công. Vui lòng trả sách trước ngày ${hanTraFormatted}.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo sắp đến hạn trả sách (còn 2 ngày)
 */
const notifyDueSoon = async (MADOCGIA, tenSach, ngayHanTra) => {
    const LABEL = 'warning';
    const hanTraFormatted = new Date(ngayHanTra).toLocaleDateString('vi-VN');
    const NOIDUNG = `Sách "${tenSach}" sắp đến hạn trả vào ngày ${hanTraFormatted}. Vui lòng chuẩn bị trả sách đúng hạn.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo trễ hạn trả sách
 */
const notifyOverdue = async (MADOCGIA, tenSach, soNgayTre, phiTre) => {
    const LABEL = 'error';
    const NOIDUNG = `Sách "${tenSach}" đã quá hạn trả ${soNgayTre} ngày. Phí trễ hạn: ${phiTre.toLocaleString()} đ. Vui lòng trả sách ngay để tránh bị khóa tài khoản.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo trả sách thành công
 */
const notifyReturnSuccess = async (MADOCGIA, soSach, tongPhi) => {
    const LABEL = 'success';
    let NOIDUNG = `Bạn đã trả ${soSach} quyển sách thành công.`;
    if (tongPhi > 0) {
        NOIDUNG += ` Tổng phí phạt: ${tongPhi.toLocaleString()} đ.`;
    } else {
        NOIDUNG += ` Cảm ơn bạn đã trả sách đúng hạn!`;
    }
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo tài khoản bị khóa tạm thời
 */
const notifyAccountLocked = async (MADOCGIA, soViPham, ngayMoKhoa) => {
    const LABEL = 'error';
    const ngayMoKhoaFormatted = new Date(ngayMoKhoa).toLocaleDateString('vi-VN');
    const NOIDUNG = `Tài khoản của bạn đã bị khóa tạm thời do ${soViPham} vi phạm. Tài khoản sẽ được mở khóa vào ngày ${ngayMoKhoaFormatted}.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo tài khoản bị khóa vĩnh viễn
 */
const notifyAccountPermanentlyLocked = async (MADOCGIA, soViPham) => {
    const LABEL = 'error';
    const NOIDUNG = `Tài khoản của bạn đã bị khóa vĩnh viễn do ${soViPham} vi phạm nghiêm trọng. Vui lòng liên hệ thư viện để được hỗ trợ.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo bill bị hủy do quá hạn thanh toán
 */
const notifyBillCancelled = async (MADOCGIA, MABILL, soNgay) => {
    const LABEL = 'warning';
    const NOIDUNG = `Đơn mượn sách ${MABILL} đã bị hủy do quá ${soNgay} ngày chưa thanh toán/lấy sách. Vui lòng tạo đơn mới nếu vẫn muốn mượn.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

/**
 * Thông báo hoàn tiền khi hủy bill
 */
const notifyRefund = async (MADOCGIA, MABILL, soTien) => {
    const LABEL = 'success';
    const NOIDUNG = `Bạn đã hủy đơn mượn sách ${MABILL} thành công. Số tiền ${soTien.toLocaleString()} đ sẽ được hoàn trả trong vòng 3-5 ngày làm việc.`;
    return await createNotification(MADOCGIA, LABEL, NOIDUNG);
};

export {
    createNotification,
    notifyRegistrationSuccess,
    notifyBorrowSuccess,
    notifyPickupSuccess,
    notifyDueSoon,
    notifyOverdue,
    notifyReturnSuccess,
    notifyAccountLocked,
    notifyAccountPermanentlyLocked,
    notifyBillCancelled,
    notifyRefund
};
