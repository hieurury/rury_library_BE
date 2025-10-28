import crypto from 'crypto';
import querystring from 'querystring';

// VNPay Configuration
const VNP_TMN_CODE = '7USBLE68';
const VNP_HASH_SECRET = 'IWAB74AZO8LFB7U9H10OZCCRDPG2ZDMM';
const VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
// VNPay sẽ redirect về server route này để xử lý kết quả thanh toán
const VNP_RETURN_URL = process.env.VNPAY_RETURN_URL || 'http://localhost:3000/bill/vnpay/return';

/**
 * Sắp xếp object theo thứ tự alphabet
 */
const sortObject = (obj) => {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
};

/**
 * Tạo chữ ký HMAC SHA512
 */
const createSignature = (data, secretKey) => {
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(data, 'utf-8')).digest('hex');
    return signed;
};

/**
 * Tạo URL thanh toán VNPay
 * @param {string} billId - Mã bill
 * @param {number} amount - Số tiền (VND)
 * @param {string} orderInfo - Thông tin đơn hàng
 * @param {string} ipAddr - IP address của khách hàng
 * @returns {string} URL thanh toán VNPay
 */
export const generatePaymentUrl = (billId, amount, orderInfo, ipAddr) => {
    try {
        const date = new Date();
        const createDate = date.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);
        const expireDate = new Date(date.getTime() + 15 * 60 * 1000) // 15 phút
            .toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);

        const vnpParams = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: VNP_TMN_CODE,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: billId,
            vnp_OrderInfo: orderInfo || `Thanh toan don hang ${billId}`,
            vnp_OrderType: 'other',
            vnp_Amount: amount * 100, // VNPay yêu cầu số tiền x 100
            vnp_ReturnUrl: VNP_RETURN_URL,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate,
            vnp_ExpireDate: expireDate
        };

        // Sắp xếp params theo alphabet
        const sortedParams = sortObject(vnpParams);

        // Tạo query string
        const signData = querystring.stringify(sortedParams, { encode: false });

        // Tạo secure hash
        const secureHash = createSignature(signData, VNP_HASH_SECRET);

        // Thêm secure hash vào params
        sortedParams.vnp_SecureHash = secureHash;

        // Tạo URL cuối cùng
        const paymentUrl = VNP_URL + '?' + querystring.stringify(sortedParams, { encode: false });

        return paymentUrl;
    } catch (error) {
        console.error('Error generating VNPay payment URL:', error);
        throw error;
    }
};

/**
 * Verify return URL từ VNPay
 * @param {object} vnpParams - Query params từ VNPay return URL
 * @returns {object} { isValid, responseCode, billId, amount, message }
 */
export const verifyReturnUrl = (vnpParams) => {
    try {
        const secureHash = vnpParams.vnp_SecureHash;

        // Xóa secure hash khỏi params để verify
        delete vnpParams.vnp_SecureHash;
        delete vnpParams.vnp_SecureHashType;

        // Sắp xếp params
        const sortedParams = sortObject(vnpParams);

        // Tạo sign data
        const signData = querystring.stringify(sortedParams, { encode: false });

        // Tính checksum
        const checkSum = createSignature(signData, VNP_HASH_SECRET);

        // Verify
        const isValid = secureHash === checkSum;

        return {
            isValid,
            responseCode: vnpParams.vnp_ResponseCode,
            billId: vnpParams.vnp_TxnRef,
            amount: parseInt(vnpParams.vnp_Amount) / 100,
            transactionNo: vnpParams.vnp_TransactionNo,
            bankCode: vnpParams.vnp_BankCode,
            cardType: vnpParams.vnp_CardType,
            payDate: vnpParams.vnp_PayDate,
            message: getResponseMessage(vnpParams.vnp_ResponseCode)
        };
    } catch (error) {
        console.error('Error verifying VNPay return URL:', error);
        return {
            isValid: false,
            message: 'Lỗi xác thực thanh toán'
        };
    }
};

/**
 * Verify IPN (Instant Payment Notification) từ VNPay
 * @param {object} vnpParams - Query params từ VNPay IPN
 * @returns {object} { isValid, responseCode, billId, amount, message }
 */
export const verifyIPN = (vnpParams) => {
    // IPN và return URL có cùng logic verify
    return verifyReturnUrl(vnpParams);
};

/**
 * Lấy message từ response code
 * @param {string} code - VNPay response code
 * @returns {string} Message
 */
const getResponseMessage = (code) => {
    const messages = {
        '00': 'Giao dịch thành công',
        '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
        '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
        '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
        '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
        '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
        '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
        '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
        '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
        '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
        '75': 'Ngân hàng thanh toán đang bảo trì.',
        '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
        '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)'
    };

    return messages[code] || 'Lỗi không xác định';
};

export default {
    generatePaymentUrl,
    verifyReturnUrl,
    verifyIPN,
    VNP_TMN_CODE,
    VNP_URL
};
