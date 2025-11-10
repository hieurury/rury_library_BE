import multer from "multer";
import path from "path";

  //multer
const categoriesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public/imgs/categories-imgs');
  },
  //tên file là tên gốc
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const booksStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public/imgs/books-imgs');
  },
  //tên file là tên gốc
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const packageBadgeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public/imgs/badges');
  },
  //tên file là tên gốc
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

// Storage cho avatar người dùng
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public/imgs/user-imgs');
  },
  filename: function (req, file, cb) {
    // Tạo tên file unique: userId_timestamp_originalname
    const userId = req.params.id || 'user';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${userId}_${timestamp}_${basename}${ext}`);
  }
});

const uploadCategoriesImage = multer({ storage: categoriesStorage });
const uploadBooksImage = multer({ storage: booksStorage });
const uploadPackageBadge = multer({ storage: packageBadgeStorage });
const uploadFile = multer({ storage: avatarStorage });

export { uploadCategoriesImage, uploadBooksImage, uploadPackageBadge, uploadFile };