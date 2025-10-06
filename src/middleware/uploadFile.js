import multer from "multer";
import path from "path";

  //multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public/imgs/categories-imgs');
  },
  //tên file là tên gốc
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

export { upload };