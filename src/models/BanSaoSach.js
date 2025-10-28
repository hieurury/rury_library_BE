import mongoose from "mongoose";
const { Schema } = mongoose;

const BANSAOSACH = new Schema({
    MASACH: {
        type: String,
        required: true,
        index: true
    },
    MA_BANSAO: {
        type: String,
        required: true,
        unique: true
    },
    TRANGTHAI: {
        type: Boolean,
        default: false
    },
    TINHTRANG: {
        type: String,
        default: "new",
        enum: ["new", "old"]
    },
    GHICHU: {
        type: String
    },
    // SOFT LOCK: Lưu MABILL đang chờ thanh toán (chưa confirm)
    // Tránh 2 user cùng chọn 1 sách trong lúc 1 user đang chờ thanh toán
    PENDING_BILL: {
        type: String,
        default: null,
        index: true
    }
});

const model = mongoose.model("BANSAOSACH", BANSAOSACH);
export default model;