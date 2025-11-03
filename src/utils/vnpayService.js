import crypto from 'crypto';

// === VNPay Configuration ===
const VNP_TMN_CODE = process.env.VNP_TMN_CODE?.trim();
const VNP_HASH_SECRET = process.env.VNP_HASH_SECRET?.trim();
const VNP_URL = process.env.VNP_URL?.trim() || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNP_RETURN_URL = process.env.VNPAY_RETURN_URL?.trim();

// === Validate configuration ===
if (!VNP_TMN_CODE || !VNP_HASH_SECRET || !VNP_RETURN_URL) {
    throw new Error('VNPay configuration incomplete. Please check your .env file');
}

// === Helpers ===
const formatDateVNPay = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return (
        date.getFullYear() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
};

const sortObject = (obj) => {
    const sorted = {};
    const str = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
    }
    return sorted;
};

const createSignature = (signData) => {
    // ✅ VNPay yêu cầu: hash = HMAC_SHA512(secretKey + signData)
    const hmac = crypto.createHmac('sha512', VNP_HASH_SECRET);
    return hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
};

const buildQueryString = (params) => {
    // Build query string từ sorted params
    // Không cần encode thêm vì sortObject đã encode rồi
    return Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join('&');
};

// === Generate Payment URL ===
export const generatePaymentUrl = (billId, amount, orderInfo, ipAddr) => {
    try {
        const now = new Date();
        const vnDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const createDate = formatDateVNPay(vnDate);
        const expireDate = formatDateVNPay(new Date(vnDate.getTime() + 15 * 60 * 1000));

        const sanitizedBillId = String(billId).replace(/[^a-zA-Z0-9]/g, '');
        const sanitizedAmount = Math.abs(Math.floor(Number(amount)));
        const sanitizedOrderInfo = (orderInfo || `Thanh toan don hang ${sanitizedBillId}`)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D');

        const vnpParams = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: VNP_TMN_CODE,
            vnp_Amount: sanitizedAmount * 100,
            vnp_CurrCode: 'VND',
            vnp_TxnRef: sanitizedBillId,
            vnp_OrderInfo: sanitizedOrderInfo,
            vnp_OrderType: 'other',
            vnp_Locale: 'vn',
            vnp_ReturnUrl: VNP_RETURN_URL,
            vnp_IpAddr: ipAddr || '127.0.0.1',
            vnp_CreateDate: createDate,
            vnp_ExpireDate: expireDate
        };

        const sortedParams = sortObject(vnpParams);
        
        // Tạo signData để hash (không encode vì sortObject đã encode)
        const signData = buildQueryString(sortedParams);
        
        // Hash với HMAC SHA512
        const secureHash = createSignature(signData);
        
        // Thêm hash vào params
        sortedParams.vnp_SecureHash = secureHash;
        
        // Build URL cuối cùng (sortObject đã encode, chỉ cần nối lại)
        const paymentUrl = `${VNP_URL}?${buildQueryString(sortedParams)}`;

        return paymentUrl;
    } catch (err) {
        console.error('❌ Error generating VNPay URL:', err);
        throw err;
    }
};

// === Verify return URL / IPN ===
export const verifyReturnUrl = (vnpParams) => {
    try {
        const secureHash = vnpParams.vnp_SecureHash;
        const clone = { ...vnpParams };
        delete clone.vnp_SecureHash;
        delete clone.vnp_SecureHashType;

        // Sort và encode params (giống khi tạo)
        const sortedClone = sortObject(clone);
        const signData = buildQueryString(sortedClone);
        
        const checkHash = createSignature(signData);
        
        const isValid = secureHash === checkHash;
        
        return {
            isValid,
            responseCode: vnpParams.vnp_ResponseCode,
            billId: vnpParams.vnp_TxnRef,
            amount: parseInt(vnpParams.vnp_Amount) / 100,
            transactionNo: vnpParams.vnp_TransactionNo,
            message: getResponseMessage(vnpParams.vnp_ResponseCode)
        };
    } catch (e) {
        console.error('❌ Error verifying VNPay return URL:', e);
        return { isValid: false, message: 'Lỗi xác thực' };
    }
};

export const verifyIPN = verifyReturnUrl;

const getResponseMessage = (code) => {
    const messages = {
        '00': 'Giao dịch thành công',
        '24': 'Khách hàng hủy giao dịch',
        '51': 'Tài khoản không đủ số dư',
        '99': 'Lỗi không xác định'
    };
    return messages[code] || 'Không xác định';
};

export default { generatePaymentUrl, verifyReturnUrl, verifyIPN };
