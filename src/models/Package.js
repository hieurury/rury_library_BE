import mongoose         from    "mongoose";
const { Schema }        =       mongoose;

const Package = new Schema({
    MaGoi: { type: String, required: true, unique: true },
    TenGoi: { type: String, required: true, unique: true },
    SoSachToiDa: { type: Number, required: true },
    ThoiHanMuon: { type: Number, required: true },
    Gia: { type: Number, required: true },
    QuyenLoi: { type: Array, required: true },
    ThoiHanGoi: { type: Number, required: true },
    TrangThai: { type: Boolean, default: true },
    HuyHieu: { type: String, default: '/public/imgs/default/white-book-mark.svg' }
}, { timestamps: true });

const model = mongoose.model('Package', Package);
export default model;