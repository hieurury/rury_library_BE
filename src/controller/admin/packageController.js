import Package from '../../models/Package.js';
import Counter from '../../models/Counter.js';

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
        res.json({
            status: 'success',
            message: 'Lấy danh sách gói thành công',
            data: packages
        })
    } catch (error) {
        next(error);
    }
};

export default {
    createPackage,
    getAllPackages
}