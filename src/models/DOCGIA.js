import mongoose     from    "mongoose";
const { Schema }    =       mongoose;


const GOI = new Schema({
    MaGoi: { type: String, required: true },
    NgayDangKy: { type: Date, required: true, default: Date.now },
    NgayHetHan: { type: Date, required: true },
})

const DOCGIA = new Schema({
    MADOCGIA: { type: String, required: true, unique: true },
    HOLOT: { type: String },
    TEN: { type: String, required: true },
    NGAYSINH: { type: Date, required: true },
    PHAI: { type: Boolean, required: true },
    DIACHI: { type: String },
    DIENTHOAI: { type: String, required: true, unique: true },
    EMAIL: { type: String, required: false, unique: true },
    PASSWORD: { type: String, required: true },
    GOI: { type: GOI, required: true },
})

const model = mongoose.model('DOCGIA', DOCGIA);
export default model;