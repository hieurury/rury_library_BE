//import
import mongoose from "mongoose";
const { Schema } = mongoose;


//init
const Counter = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 }
})


//export
const model = mongoose.model("Counter", Counter);
export default model;