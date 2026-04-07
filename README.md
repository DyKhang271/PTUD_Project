# IUH Student Portal & AI Academic Assistant

Ứng dụng mô phỏng cổng thông tin sinh viên IUH với giao diện web hiện đại, hỗ trợ tra cứu hồ sơ, bảng điểm, chương trình khung và chatbot tư vấn học tập. Dự án hiện chạy theo mô hình frontend React + backend FastAPI, sử dụng dữ liệu JSON mẫu cho 2 sinh viên.

## Tính năng hiện có

- Dashboard hiển thị GPA tích lũy, tín chỉ đã đạt, tín chỉ còn lại và biểu đồ GPA các môn của kỳ trước.
- Hồ sơ sinh viên hiển thị đầy đủ thông tin cá nhân, liên hệ và tình trạng học tập.
- Bảng điểm theo từng học kỳ, có GPA học kỳ, GPA tích lũy và xuất PDF.
- Chương trình khung hiển thị theo học kỳ, phân biệt môn bắt buộc và tự chọn.
- Chế độ phụ huynh cho phép theo dõi hồ sơ và kết quả học tập của sinh viên.
- Chatbot hỗ trợ trả lời các câu hỏi học vụ cơ bản theo dữ liệu mock hiện tại.

## Dữ liệu hiện tại

- Dữ liệu sinh viên được đọc từ thư mục [data_json]
- Hiện có 2 hồ sơ:
  - `23630781` - `Trần Minh Khang` - `Khoa học máy tính`
  - `23630761` - `Lê Gia Huy` - `Khoa học dữ liệu`

## Công nghệ sử dụng

- Frontend: React, Vite, Axios, CSS Modules
- Backend: Python, FastAPI
- Xuất PDF: `jspdf`, `jspdf-autotable`

## Cấu trúc thư mục chính

- [frontend]: giao diện người dùng
- [backend]: API và lớp xử lý dữ liệu
- [data_json]: dữ liệu chương trình khung, transcript và thông tin sinh viên
- [RAG_docx]: tài liệu phục vụ hướng chatbot / RAG

## Cài đặt và chạy dự án

### 1. Chạy backend

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend mặc định chạy ở `http://localhost:8000`.

### 2. Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy ở `http://localhost:5173`.

## Tài khoản đăng nhập hiện tại

### Sinh viên

1. `23630781` / `23630781`
2. `23630761` / `23630761`

### Phụ huynh

1. `Trần Minh Khang` - MSSV `23630781` - ngày sinh `04/09/2005` - SĐT `0912360781`
2. `Lê Gia Huy` - MSSV `23630761` - ngày sinh `12/03/2005` - SĐT `0912360761`

Lưu ý: cần nhập đúng CAPTCHA trên màn hình đăng nhập.

## Ghi chú triển khai hiện tại

- Dự án chưa dùng cơ sở dữ liệu, toàn bộ dữ liệu đang lấy từ JSON.
- Thông báo và chatbot vẫn đang dùng mock data / mock response.
- Dữ liệu chương trình khung có các nhóm tự chọn; phần tổng tín chỉ trên UI được tính theo số tổng hợp chính thức trong hồ sơ sinh viên, không cộng toàn bộ mọi lựa chọn tự chọn.

## Nhóm phát triển

- Thành viên 1: Nguyễn Xuân Thiên (23630781)
- Thành viên 2: Nguyễn Bá Đức (23732881)
- Thành viên 3: Trần Duy Khang (23728961)
- Thành viên 4: Nguyễn Viết Minh (23724081)
- Thành viên 5: Hoàng Trọng Nghĩa (23630761)
