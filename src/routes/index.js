import homeRouter from './home.js';
import TheLoaiRouter from './theloai.js';
import sachRouter from './sach.js';
//admin
import NhanVienRouter from './nhanvien.js';
import NhaXuatBanRouter from './nhaxuatban.js';
//error
import { notFound, errorHandler } from './error.js';
import { upload } from '../middleware/uploadFile.js';

const Router = (App) => {


    //user
    App.use('/', homeRouter);
    App.use('/the-loai', TheLoaiRouter);
    App.use('/sach', sachRouter);
    //admin
    App.use('/admin/account', NhanVienRouter);
    App.use('/admin/nha-xuat-ban', NhaXuatBanRouter);

    //error
    App.use(notFound);
    App.use(errorHandler);
}

export default Router;