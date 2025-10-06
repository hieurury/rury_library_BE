//import
import mongoose from "mongoose";
const { Schema } = mongoose;


//init
const NHAXUATBAN = new Schema({
    MANXB: {
        type: String,
        required: true,
        unique: true
    },
    TENNXB: {
        type: String,
        required: true
    },
    DIACHI: {
        type: String,
    },
})

//setup option


//export
const model = mongoose.model("NHAXUATBAN", NHAXUATBAN);
export default model;