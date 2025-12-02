//import
import mongoose from "mongoose";
const { Schema } = mongoose;


//init
const NhanVien = new Schema({
    MSNV: {
        type: String,
        required: true,
        unique: true
    },
    HoTenNV: {
        type: String,
        required: true
    },
    Password: {
        type: String,
        required: true
    },
    ChucVu: {
        type: String,
        enum: ["Admin", "Librarian"],
        required: true
    },
    DiaChi: {
        type: String,
    },
    soDienThoai: {
        type: String,
        unique: true,
        required: true
    },
    Email: {
        type: String,
        unique: true,
        sparse: true // Allows null values while maintaining uniqueness
    },
    GioiTinh: {
        type: String,
        enum: ["Nam", "Nữ", "Khác"],
    },
    OTP: {
        code: String,
        expiry: Date
    }
})


//export
const model = mongoose.model("NhanVien", NhanVien);
export default model;