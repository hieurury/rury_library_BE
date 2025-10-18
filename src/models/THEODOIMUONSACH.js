import mongoose     from    "mongoose";
const { Schema }    =    mongoose;

const theoDoiMuonSach = new Schema({
    MAPHIEU: { type: String, required: true },
    MANHANVIEN: { type: String, default: 'system' }, //mã hệ thống
    MADOCGIA: { type: String, required: true },
    MA_BANSAO: { type: String, required: true },
    NGAYMUON: { type: Date, required: true },
    NGAYHANTRA: { type: Date, required: true },
    NGAYTRA: { type: Date, required: false },
    TRANGTHAISACH: { type: String, required: true },
    TINHTRANG: { type: String, required: true, enum: ['borrowing', 'returned'] },
});

const model = mongoose.model("TheoDoiMuonSach", theoDoiMuonSach);
export default model;