import mongoose from "mongoose";
const { Schema } = mongoose;

//init
const TheLoai = new Schema({
    MaLoai: { type: String, required: true },
    TenLoai: { type: String, required: true },
    MoTa: { type: String, required: false },
    Icon: { type: String, default: 'public/imgs/categories-imgs/book.svg' },
    Color: { type: String, default: '#4E3603' }
}, { timestamps: true })

const model = mongoose.model("TheLoai", TheLoai);
export default model;