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

const uploadCategoriesImage = multer({ storage: categoriesStorage });
const uploadBooksImage = multer({ storage: booksStorage });

export { uploadCategoriesImage, uploadBooksImage };