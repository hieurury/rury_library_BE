import mongoose from "mongoose";
const { Schema } = mongoose;




//init
const SACH = new Schema({
    MASACH: {
        type: String,
        required: true,
        unique: true
    },
    TENSACH: {
        type: String,
        required: true
    },
    MOTA: {
        type: String,
        required: false,
        default: ""
    },
    HINHANH: {
        type: String,
        required: true
    },
    THELOAI: {
        type: [String],
        default: []
    },
    DONGIA: {
        type: Number,
        required: true
    },
    SOQUYEN: {
        type: Number,
        default: 1
    },
    NAMXUATBAN: {
        type: Number,
        required: false
    },
    MAXB: {
        type: String,
        required: true
    },
    TACGIA: {
        type: String,
        required: true
    }
}, { timestamps: true })

const model = mongoose.model("SACH", SACH);
export default model;