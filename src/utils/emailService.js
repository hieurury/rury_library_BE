import { createTransport } from 'nodemailer';
import dotenv from 'dotenv';
import DOCGIA from '../models/DOCGIA.js';

dotenv.config();

// Cấu hình transporter (tạm thời dùng config mẫu)
const transporter = createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

/**
 * Kiểm tra user có bật email notification không
 */
const checkEmailNotificationEnabled = async (MADOCGIA) => {
    try {
        const docGia = await DOCGIA.findOne({ MADOCGIA });
        if (!docGia || !docGia.EMAIL) {
            return false;
        }
        return docGia.OPTIONS?.EMAIL_NOTIF !== false; // Mặc định là true
    } catch (error) {
        console.error('Error checking email notification:', error);
        return false;
    }
};

/**
 * Gửi email
 */
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: `"Thư viện Rury" <${process.env.EMAIL_USER || 'noreply@library.com'}>`,
            to,
            subject,
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error sending email to ${to}:`, error);
        return false;
    }
};

/**
 * Template: Email đăng ký thành công
 */
const sendRegistrationEmail = async (MADOCGIA, email, hoTen) => {
    const enabled = await checkEmailNotificationEnabled(MADOCGIA);
    if (!enabled || !email) return false;

    const subject = 'Chào mừng bạn đến với Thư viện Rury!';
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4CAF50;">Chào mừng ${hoTen}!</h2>
                <p>Tài khoản của bạn đã được kích hoạt thành công tại <strong>Thư viện Rury</strong>.</p>
                <p><strong>Mã độc giả:</strong> ${MADOCGIA}</p>
                <p>Bạn có thể bắt đầu khám phá và mượn sách ngay bây giờ!</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Nếu bạn không muốn nhận email thông báo, vui lòng tắt tùy chọn trong Cài đặt tài khoản.
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Template: Email thông báo mượn sách
 */
const sendBorrowNotification = async (MADOCGIA, email, maBill, soSach, tongTien) => {
    const enabled = await checkEmailNotificationEnabled(MADOCGIA);
    if (!enabled || !email) return false;

    const subject = `Đơn mượn sách ${maBill} - Thư viện Rury`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #2196F3;">Đơn mượn sách của bạn</h2>
                <p>Bạn đã tạo đơn mượn sách thành công!</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Mã Bill:</strong> ${maBill}</p>
                    <p><strong>Số lượng:</strong> ${soSach} quyển</p>
                    <p><strong>Tổng tiền:</strong> ${tongTien.toLocaleString()} đ</p>
                </div>
                <p style="color: #FF9800;"><strong>⚠️ Lưu ý:</strong> Vui lòng đến thư viện để lấy sách trong vòng 3 ngày.</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Thư viện Rury - Nơi tri thức hội tụ
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Template: Email thông báo gần đến hạn trả
 */
const sendDueSoonNotification = async (MADOCGIA, email, tenSach, ngayHanTra) => {
    const enabled = await checkEmailNotificationEnabled(MADOCGIA);
    if (!enabled || !email) return false;

    const hanTraFormatted = new Date(ngayHanTra).toLocaleDateString('vi-VN');
    const subject = `Nhắc nhở: Sách sắp đến hạn trả - Thư viện Rury`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #FF9800;">Nhắc nhở trả sách</h2>
                <p>Sách của bạn sắp đến hạn trả:</p>
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF9800;">
                    <p><strong>Tên sách:</strong> ${tenSach}</p>
                    <p><strong>Hạn trả:</strong> ${hanTraFormatted}</p>
                </div>
                <p>Vui lòng chuẩn bị trả sách đúng hạn để tránh phí trễ hạn.</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Thư viện Rury - Nơi tri thức hội tụ
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Template: Email thông báo đã trả sách
 */
const sendReturnNotification = async (MADOCGIA, email, soSach, tongPhi) => {
    const enabled = await checkEmailNotificationEnabled(MADOCGIA);
    if (!enabled || !email) return false;

    const subject = `Xác nhận trả sách - Thư viện Rury`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4CAF50;">Trả sách thành công!</h2>
                <p>Bạn đã trả ${soSach} quyển sách thành công.</p>
                ${tongPhi > 0 ? `
                    <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
                        <p><strong>Tổng phí phạt:</strong> ${tongPhi.toLocaleString()} đ</p>
                        <p style="font-size: 12px; color: #666;">Phí trễ hạn và/hoặc mất sách</p>
                    </div>
                ` : `
                    <p style="color: #4CAF50;">✅ Cảm ơn bạn đã trả sách đúng hạn!</p>
                `}
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Thư viện Rury - Nơi tri thức hội tụ
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

export {
    sendRegistrationEmail,
    sendBorrowNotification,
    sendDueSoonNotification,
    sendReturnNotification
};
