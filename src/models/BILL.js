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
    BIHUY: { type: Boolean, default: false }, // bị huỷ do quá hạn thanh toán
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
    GOI: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

const model = mongoose.models.BILL || mongoose.model("BILL", BILL);
export default model;
