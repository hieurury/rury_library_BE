import mongoose from "mongoose";
const { Schema } = mongoose;

const BILL = new Schema({
    MABILL: {
        type: String,
        required: true,
        unique: true
    },
    MADOCGIA: {
        type: String,
        required: true,
        index: true
    },
    DANHSACHPHIEU: [{
        type: String,
        required: true
    }],
    TONGTIEN: {
        type: Number,
        required: true,
        min: 0
    },
    TRANGTHAI: {
        type: Boolean,
        required: true,
        default: false // false: chưa thanh toán, true: đã thanh toán
    },
    LOAITHANHTOAN: {
        type: String,
        required: true,
        enum: ['cash', 'online'], // cash: tiền mặt, online: chuyển khoản VNPAY
        default: 'cash'
    },
    NGAYLAP: {
        type: Date,
        required: true,
        default: Date.now
    },
    NGAYTHANHTOAN: {
        type: Date,
        required: false
    },
    VNPAY_TRANSACTION_ID: {
        type: String,
        required: false
    },
    PENDING_BOOKS: [{
        type: String,
        required: false
    }] // Lưu tạm danh sách MA_BANSAO khi chờ thanh toán VNPAY (chỉ dùng cho online payment)
}, {
    timestamps: true
});

const model = mongoose.models.BILL || mongoose.model("BILL", BILL);
export default model;
