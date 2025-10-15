import homeRouter       from './home.js';
import TheLoaiRouter    from './theloai.js';
import sachRouter       from './sach.js';
import userRouter       from './user.js';
//admin
import NhanVienRouter   from './nhanvien.js';
import NhaXuatBanRouter from './nhaxuatban.js';
import packageRouter    from './package.js';
//error
import { 
    notFound, 
    errorHandler 
}                       from './error.js';

const Router = (App) => {


    //both
    App.use('/', homeRouter);
    App.use('/the-loai', TheLoaiRouter);
    App.use('/sach', sachRouter);
    App.use('/nha-xuat-ban', NhaXuatBanRouter);
    App.use('/user', userRouter);
    //admin
    App.use('/admin/account', NhanVienRouter);
    App.use('/admin/package', packageRouter);

    //error
    App.use(notFound);
    App.use(errorHandler);
}

export default Router;