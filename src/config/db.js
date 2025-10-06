import mongoose from "mongoose";
import BANSAOSACH from "../models/BanSaoSach.js";
import dotenv from "dotenv";
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ MongoDB connected");
        // Dev only: đồng bộ index
        if (process.env.NODE_ENV !== 'production') {
            
            await BANSAOSACH.syncIndexes();
        }
    } catch (error) {
        console.error("❗ MongoDB connection error:", error);
    }
}

export default connectDB;