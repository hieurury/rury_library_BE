import errorApi from "../middleware/errorApi.js";

const notFound = (req, res, next) => {
    return next(new errorApi("API not found", 404));
};

const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({
        status: "error",
        statusCode,
        message
    });
};

export { notFound, errorHandler };
