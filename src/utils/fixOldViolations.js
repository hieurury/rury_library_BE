// Script để cập nhật các vi phạm cũ không có MAPHIEUMUON
// Chạy 1 lần để fix dữ liệu cũ: node src/utils/fixOldViolations.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import DOCGIA from '../models/DOCGIA.js';

dotenv.config();

const fixOldViolations = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Tìm tất cả độc giả có vi phạm
        const docGiaList = await DOCGIA.find({
            'CACVIPHAM.0': { $exists: true }
        });

        console.log(`📋 Tìm thấy ${docGiaList.length} độc giả có vi phạm`);

        let updatedCount = 0;
        
        for (const docGia of docGiaList) {
            let needUpdate = false;
            
            for (let i = 0; i < docGia.CACVIPHAM.length; i++) {
                if (!docGia.CACVIPHAM[i].MAPHIEUMUON) {
                    docGia.CACVIPHAM[i].MAPHIEUMUON = 'UNKNOWN_LEGACY';
                    needUpdate = true;
                }
            }
            
            if (needUpdate) {
                await docGia.save();
                updatedCount++;
                console.log(`✅ Đã cập nhật ${docGia.MADOCGIA}`);
            }
        }

        console.log(`\n🎉 Hoàn tất! Đã cập nhật ${updatedCount} độc giả.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error);
        process.exit(1);
    }
};

fixOldViolations();
