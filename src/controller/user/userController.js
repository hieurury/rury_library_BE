import DocGia from "../../model/User";

const createAccount = async (req, res, next) => {
    const data = req.body;
    try {
        if(!data.email) {
            return next(new errorApi("Email is required", 400));
        }
        if(!data.password) {
            return next(new errorApi("Password is required", 400));
        }
        const userChecking = await DocGia.findOne({ email: data.email });
        if (userChecking) {
            return next(new errorApi("Email already exists", 400));
        }

        const newUser = new DocGia(data);
        await newUser.save();
        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            user: newUser,
        });
    } catch (error) {
        return next(error);
    }
};


export default {
    createAccount,
}