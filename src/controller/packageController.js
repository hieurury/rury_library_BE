import Package from '../models/Package.js';
import Counter from '../models/Counter.js';
import DOCGIA from '../models/DOCGIA.js';

const generateMaGoi = async () => {
    const counter = await Counter.findOneAndUpdate(
        { _id: 'packageId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return `PG${String(counter.seq).padStart(3, '0')}`; // Format: PG0001, PG0002, ...
}

    const createPackage = async (req, res, next) => {
        try {
            const data = req.body;
            //tạo mã gói tự động    
            const maGoi = await generateMaGoi();

            const lowerCaseName = data.TenGoi.toLowerCase();
            // Check for case-insensitive duplicate TenGoi
            const existingPackage = await Package.findOne({ TenGoi: { $regex: new RegExp(`^${lowerCaseName}$`, 'i') } });
            if (existingPackage) {
                return res.status(400).json({ message: 'Tên gói này đã có rồi, hãy tạo một gói mới' });
            }
            //tao gói mới
            const newPackage = new Package({ ...data, MaGoi: maGoi });
            await newPackage.save();

            res.status(201).json({ message: 'Tạo gói thành công', package: newPackage });
        } catch (error) {
            next(error);
        }
    };


const getAllPackages = async (req, res, next) => {
    try {
        const packages = await Package.find({TrangThai: true});
        
        // Thêm số lượng người đăng ký cho mỗi gói
        const packagesWithCount = await Promise.all(packages.map(async (pkg) => {
            const subscriberCount = await DOCGIA.countDocuments({ 'GOI.MaGoi': pkg.MaGoi });
            return {
                ...pkg.toObject(),
                SubscriberCount: subscriberCount
            };
        }));
        
        res.json({
            status: 'success',
            message: 'Lấy danh sách gói thành công',
            data: packagesWithCount
        })
    } catch (error) {
        next(error);
    }
};

const updatePackage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = req.body;
        
        // Kiểm tra nếu thay đổi tên gói, phải unique
        if (data.TenGoi) {
            const lowerCaseName = data.TenGoi.toLowerCase();
            const existingPackage = await Package.findOne({ 
                TenGoi: { $regex: new RegExp(`^${lowerCaseName}$`, 'i') },
                _id: { $ne: id }
            });
            if (existingPackage) {
                return res.status(400).json({ 
                    status: 'error',
                    message: 'Tên gói này đã tồn tại' 
                });
            }
        }
        
        const updatedPackage = await Package.findByIdAndUpdate(id, data, { new: true });
        
        if (!updatedPackage) {
            return res.status(404).json({ 
                status: 'error',
                message: 'Không tìm thấy gói' 
            });
        }
        
        res.json({
            status: 'success',
            message: 'Cập nhật gói thành công',
            data: updatedPackage
        });
    } catch (error) {
        next(error);
    }
};

const deletePackage = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Kiểm tra xem có người đang sử dụng gói không
        const pkg = await Package.findById(id);
        if (!pkg) {
            return res.status(404).json({ 
                status: 'error',
                message: 'Không tìm thấy gói' 
            });
        }
        
        const subscriberCount = await DOCGIA.countDocuments({ 'GOI.MaGoi': pkg.MaGoi });
        
        if (subscriberCount > 0) {
            // Nếu còn người dùng, chỉ ẩn gói
            pkg.TrangThai = false;
            await pkg.save();
            return res.json({
                status: 'warning',
                message: `Gói đã được ẩn vì còn ${subscriberCount} người đang sử dụng`,
                hidden: true
            });
        } else {
            // Nếu không có ai dùng, xóa hẳn
            await Package.findByIdAndDelete(id);
            return res.json({
                status: 'success',
                message: 'Xóa gói thành công',
                deleted: true
            });
        }
    } catch (error) {
        next(error);
    }
};

const uploadPackageBadge = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                status: 'error',
                message: 'Không có file nào được tải lên' 
            });
        }
        const badgePath = `/public/imgs/badges/${req.file.filename}`;
        res.json({
            status: 'success',
            message: 'Tải huy hiệu thành công',
            badgePath: badgePath
        });
    } catch (error) {
        next(error);
    }
};

export default {
    createPackage,
    getAllPackages,
    uploadPackageBadge,
    updatePackage,
    deletePackage
}