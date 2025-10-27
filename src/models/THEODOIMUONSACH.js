import mongoose     from    "mongoose";
const { Schema }    =    mongoose;

const theoDoiMuonSach = new Schema({
    MAPHIEU: { type: String, required: true },
    MANHANVIEN: { type: String, default: 'system' }, //mã hệ thống
    MADOCGIA: { type: String, required: true },
    MA_BANSAO: { type: String, required: true },
    NGAYMUON: { type: Date, required: true },
    NGAYHANTRA: { type: Date, required: true },
    GIA: { type: Number, required: true },
    NGAYTRA: { type: Date, required: false },
    TRANGTHAISACH: { type: String, required: true },
    TINHTRANG: { type: String, required: true, enum: ['borrowing', 'returned'] },
});

// Kiểm tra nếu model đã tồn tại thì sử dụng lại, nếu chưa thì tạo mới
const model = mongoose.models.TheoDoiMuonSach || mongoose.model("TheoDoiMuonSach", theoDoiMuonSach);
export default model;