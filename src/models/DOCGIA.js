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

const NOTIFICATION = new Schema({
    LABEL: { type: String, required: true },
    NOIDUNG: { type: String, required: true },
    NGAYTAO: { type: Date, required: true, default: Date.now },
    DAXEM: { type: Boolean, required: true, default: false },
})

const VIPHAM = new Schema({
    LOAI: { type: String, required: true, enum: ['delay', 'lost_book'] },
    NGAYVIPHAM: { type: Date, required: true, default: Date.now },
    TIENPHAT: { type: Number, required: true },
})

const DOCGIA = new Schema({
    MADOCGIA: { type: String, required: true, unique: true },
    HOLOT: { type: String },
    TEN: { type: String, required: true },
    AVATAR: { type: String, default: '/user-imgs/default-avatar.png' },
    NGAYSINH: { type: Date, required: true },
    PHAI: { type: Boolean, required: true },
    DIACHI: { type: String },
    DIENTHOAI: { type: String, required: true, unique: true },
    EMAIL: { type: String, required: false, unique: true },
    PASSWORD: { type: String, required: true },
    GOI: { type: GOI, required: true },
    FAVORITES: { type: [FAVORITE], default: [] },
    OPTIONS: { type: OPTIONS, default: {} },
    CACVIPHAM: { type: [VIPHAM], default: [] },
    TRANGTHAI: { type: Boolean, required: true, default: true },
    NGAYMOKHOA: { type: Date, required: false },
    NOTIFICATIONS: { type: [NOTIFICATION], default: [] }
})

const model = mongoose.model('DOCGIA', DOCGIA);
export default model;