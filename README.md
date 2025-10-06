# DỰ ÁN WEBSITE QUẢN LÝ THƯ VIỆN - SERVER

## Giới thiệu

Server hỗ trợ các API về những dịch vụ liên quan đến quá trình quản lý cũng như các hoạt động của trang web. Được xây dựng trên nền tảng Nodejs & ExpressJS giúp tối ưu hiệu suất và tốc độ truyền tải cũng như đi theo xu hướng công nghệ.

## Công nghệ sử dụng

1. ***Nodejs (javascript)***: Môi trường chạy javascript (javascript runtime). Chịu trách nhiệm chính cho logic của server.

2. ***ExpressJS***: Framework nổi tiếng cho Nodejs, chịu trách nhiệm phân luồng, chia route cũng như các truy vấn http/https,....

3. ***MongoDB***: Sử dụng CSDL NoSQL MongoDB với thư viện Mongoose với các truy vấn ORM đơn giản và dễ hiểu.

4. ***Multer***: Một middleware cho ExpressJS dùng để xử lý các truy vấn dữ liệu liên quan đến multipart/form-data là dữ liệu upload về file.

---

Tổng quát
|Công nghệ|Phiên bản|
|---|---|
|NodeJs|23.11.0|
|ExpressJS|5.1.0|
|Mongoose|8.18.1|
|Multer|2.0.2|


## Cấu trúc dự án

-[server](/src/server.js) - chịu trách nhiệm chính cho các logic phân luồng và đồng bộ dữ liệu cũng như khởi chạy dự án.

- [router](/src/routes/index.js) - chịu trách nhiệm phân trang cũng như chia route cho từng loại dữ liệu

- [models](/src/models) - chịu trách nhiệm tạo các khung (Schema) cho các collection trong database

- [cotrollers](/src/controller) - chịu trách nhiệm chứa các logic liên quan đến việc xử lí truy vấn dữ liệu giữa Client - Server


## Kết quả đạt được

Về logic:

    Hỗ trợ đầy đủ các loại truy xuất Rest API. Đảm bảo tối ưu về hiệu xuất với các truy xuất rõ ràng và tối giản cho hệ thống.

Về kỹ thuật:

    Có các khâu hậu kì xử lí lỗi, phân loại lỗi và các status message cụ thể đảm bảo tính mạch lạc và dễ hiểu của dữ liệu.
