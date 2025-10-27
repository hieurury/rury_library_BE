import mongoose     from    "mongoose";
const { Schema }    =       mongoose;


const GOI = new Schema({
    MaGoi: { type: String, required: true },
    NgayDangKy: { type: Date, required: true, default: Date.now },
    NgayHetHan: { type: Date, required: true },
})

const FAVORITE = new Schema({
    MASACH: { type: String, required: true },
    NGAYTHEMSACH: { type: Date, required: true, default: Date.now },
})

const OPTIONS = new Schema({
    EMAIL_NOTIF: { type: Boolean, default: true },
});

const DOCGIA = new Schema({
    MADOCGIA: { type: String, required: true, unique: true },
    HOLOT: { type: String },
    TEN: { type: String, required: true },
    AVATAR: { type: String, default: '/user-imgs/default.png' },
    NGAYSINH: { type: Date, required: true },
    PHAI: { type: Boolean, required: true },
    DIACHI: { type: String },
    DIENTHOAI: { type: String, required: true, unique: true },
    EMAIL: { type: String, required: false, unique: true },
    PASSWORD: { type: String, required: true },
    GOI: { type: GOI, required: true },
    FAVORITES: { type: [FAVORITE], default: [] },
    OPTIONS: { type: OPTIONS, default: {} },
})

const model = mongoose.model('DOCGIA', DOCGIA);
export default model;