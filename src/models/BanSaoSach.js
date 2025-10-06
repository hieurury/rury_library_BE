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
    }
});

const model = mongoose.model("BANSAOSACH", BANSAOSACH);
export default model;