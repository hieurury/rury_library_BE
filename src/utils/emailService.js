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

/**
 * Template: Email thông báo tài khoản bị khóa do vi phạm chính sách
 */
const sendAccountLockedByViolationEmail = async (email, hoTen, soViPham, ngayMoKhoa, isPermanent = false) => {
    if (!email) return false;

    const subject = isPermanent 
        ? `⚠️ Tài khoản bị khóa vĩnh viễn - Thư viện Rury`
        : `⚠️ Tài khoản bị khóa tạm thời - Thư viện Rury`;
    
    const ngayMoKhoaFormatted = ngayMoKhoa ? new Date(ngayMoKhoa).toLocaleDateString('vi-VN') : '';
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #f44336;">⚠️ Cảnh báo: Tài khoản bị khóa</h2>
                <p>Xin chào <strong>${hoTen}</strong>,</p>
                <p>Tài khoản của bạn tại Thư viện Rury đã bị khóa do vi phạm chính sách sử dụng.</p>
                
                <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
                    <p><strong>Lý do:</strong> Vi phạm chính sách mượn/trả sách</p>
                    <p><strong>Số lần vi phạm:</strong> ${soViPham} lần</p>
                    ${isPermanent ? `
                        <p><strong>Loại khóa:</strong> <span style="color: #d32f2f;">Vĩnh viễn</span></p>
                        <p style="color: #d32f2f; font-weight: bold;">Tài khoản của bạn đã bị khóa vĩnh viễn.</p>
                    ` : `
                        <p><strong>Loại khóa:</strong> Tạm thời</p>
                        <p><strong>Ngày mở khóa:</strong> ${ngayMoKhoaFormatted}</p>
                    `}
                </div>

                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800;">
                    <p><strong>Các hành vi vi phạm bao gồm:</strong></p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Trả sách quá hạn</li>
                        <li>Làm mất hoặc hư hỏng sách</li>
                        <li>Vi phạm quy định thư viện khác</li>
                    </ul>
                </div>

                ${isPermanent ? `
                    <p>Để được xem xét mở khóa tài khoản, vui lòng liên hệ với chúng tôi qua email: 
                    <a href="mailto:${process.env.EMAIL_USER || 'support@library.com'}" style="color: #2196F3;">
                        ${process.env.EMAIL_USER || 'support@library.com'}
                    </a></p>
                ` : `
                    <p>Tài khoản của bạn sẽ được tự động mở khóa vào ngày <strong>${ngayMoKhoaFormatted}</strong>.</p>
                    <p style="color: #ff9800;">⚠️ Lưu ý: Nếu tiếp tục vi phạm, tài khoản có thể bị khóa vĩnh viễn.</p>
                `}

                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Thư viện Rury - Nơi tri thức hội tụ<br>
                    Email hỗ trợ: ${process.env.EMAIL_USER || 'support@library.com'}
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Template: Email thông báo tài khoản bị quản trị viên khóa
 */
const sendAccountLockedByAdminEmail = async (email, hoTen, reason, duration, isPermanent = false) => {
    if (!email) return false;

    const subject = `⚠️ Tài khoản bị khóa - Thư viện Rury`;
    
    const ngayMoKhoa = duration > 0 ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
    const ngayMoKhoaFormatted = ngayMoKhoa ? ngayMoKhoa.toLocaleDateString('vi-VN') : '';
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #f44336;">⚠️ Thông báo: Tài khoản bị khóa</h2>
                <p>Xin chào <strong>${hoTen}</strong>,</p>
                <p>Tài khoản của bạn tại Thư viện Rury đã bị khóa bởi quản trị viên.</p>
                
                <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f44336;">
                    <p><strong>Lý do khóa:</strong></p>
                    <p style="white-space: pre-wrap;">${reason || 'Phát hiện một số hoạt động tình nghi của bạn đối với hệ thống thư viện'}</p>
                    ${isPermanent ? `
                        <p style="margin-top: 15px;"><strong>Loại khóa:</strong> <span style="color: #d32f2f;">Vĩnh viễn</span></p>
                    ` : `
                        <p style="margin-top: 15px;"><strong>Loại khóa:</strong> Tạm thời</p>
                        <p><strong>Thời gian khóa:</strong> ${duration} ngày</p>
                        <p><strong>Ngày mở khóa:</strong> ${ngayMoKhoaFormatted}</p>
                    `}
                </div>

                <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3;">
                    <p><strong>📧 Cần hỗ trợ hoặc có ý kiến phản hồi?</strong></p>
                    <p>Nếu bạn cho rằng đây là một sự nhầm lẫn hoặc muốn khiếu nại về quyết định này, 
                    vui lòng liên hệ với chúng tôi qua email:</p>
                    <p style="text-align: center; margin: 15px 0;">
                        <a href="mailto:${process.env.EMAIL_USER || 'support@library.com'}?subject=Khiếu nại khóa tài khoản - ${hoTen}" 
                           style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Gửi email phản hồi
                        </a>
                    </p>
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        Hoặc gửi trực tiếp đến: ${process.env.EMAIL_USER || 'support@library.com'}
                    </p>
                </div>

                ${!isPermanent ? `
                    <p>Tài khoản của bạn sẽ được tự động mở khóa vào ngày <strong>${ngayMoKhoaFormatted}</strong>.</p>
                ` : ''}

                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">
                    Thư viện Rury - Nơi tri thức hội tụ<br>
                    Email hỗ trợ: ${process.env.EMAIL_USER || 'support@library.com'}
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP email for staff password reset
 */
const sendStaffOTPEmail = async (email, otp, staffName) => {
    const subject = 'Mã OTP đặt lại mật khẩu - Rury Library';
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #4F46E5;">Đặt lại mật khẩu tài khoản nhân viên</h2>
                <p>Xin chào <strong>${staffName}</strong>,</p>
                <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản nhân viên tại Rury Library.</p>
                <p>Mã OTP của bạn là:</p>
                <div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="color: #EF4444;"><strong>⚠️ Lưu ý:</strong> Mã OTP này sẽ hết hiệu lực sau <strong>5 phút</strong>.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này và liên hệ bộ phận IT ngay lập tức.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 12px;">
                    Email này được gửi tự động từ hệ thống Rury Library.<br>
                    Nếu có thắc mắc, vui lòng liên hệ IT Support: ${process.env.EMAIL_USER || 'support@library.com'}
                </p>
            </div>
        </div>
    `;

    return await sendEmail(email, subject, htmlContent);
};

/**
 * Send OTP email for user password reset
 */
const sendUserOTPEmail = async (email, otp, userName) => {
    const subject = 'Mã OTP đặt lại mật khẩu - Thư viện Rury';
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
                <h2 style="color: #880888;">Đặt lại mật khẩu tài khoản</h2>
                <p>Xin chào <strong>${userName}</strong>,</p>
                <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản độc giả tại Thư viện Rury.</p>
                <p>Mã OTP của bạn là:</p>
                <div style="background-color: #F3F4F6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #880888; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="color: #EF4444;"><strong>⚠️ Lưu ý:</strong> Mã OTP này sẽ hết hiệu lực sau <strong>5 phút</strong>.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;">
                <p style="color: #6B7280; font-size: 12px;">
                    Email này được gửi tự động từ hệ thống Thư viện Rury.<br>
                    Nếu có thắc mắc, vui lòng liên hệ: ${process.env.EMAIL_USER || 'support@library.com'}
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
    sendReturnNotification,
    sendAccountLockedByViolationEmail,
    sendAccountLockedByAdminEmail,
    generateOTP,
    sendStaffOTPEmail,
    sendUserOTPEmail
};
