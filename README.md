# IUH Student Portal & AI Academic Assistant

Ứng dụng mô phỏng cổng thông tin sinh viên IUH với giao diện web hiện đại, hỗ trợ tra cứu hồ sơ, bảng điểm, chương trình khung, chatbot tư vấn học tập và không gian giảng viên để nhập, sửa điểm sinh viên.

## Tính năng chính

- Sinh viên xem dashboard, hồ sơ, bảng điểm, chương trình khung và xuất PDF.
- Phụ huynh đăng nhập theo thông tin xác thực của sinh viên để theo dõi kết quả học tập.
- Quản trị viên cấp tài khoản sinh viên mới và đổi mật khẩu.
- Giảng viên đăng nhập theo môn được phân công, xem danh sách sinh viên trong học phần, nhập điểm thường kỳ 1, thường kỳ 2, thực hành, QT/GK/CK, sửa điểm và import điểm hàng loạt bằng file CSV rồi lưu ngay vào file JSON cục bộ.

## Công nghệ sử dụng

- Frontend: React, Vite, Axios, CSS Modules
- Backend: Python, FastAPI
- Lưu trữ cục bộ: JSON file
- Xuất PDF: `jspdf`, `jspdf-autotable`

## Cấu trúc thư mục

- `frontend/`: giao diện người dùng
- `backend/`: API FastAPI, phân quyền và xử lý dữ liệu
- `backend/storage/`: file JSON runtime được tạo khi giáo viên lưu điểm hoặc admin cập nhật dữ liệu
- `data_json/`: dữ liệu sinh viên mẫu ban đầu
- `database/`: tài nguyên PostgreSQL cũ, không còn bắt buộc cho luồng hiện tại
- `RAG_docx/`: tài liệu phục vụ chatbot / RAG

## Cai dat va chay du an

Ban co 2 cach chay:

### Cach 1: Chay backend va frontend rieng

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Truy cap frontend: `http://localhost:5173`
API: `http://localhost:8000`

### Cach 2: Chay bang Docker

```bash
docker compose up --build
```

Truy cap frontend: `http://localhost:8080`
API: `http://localhost:8000`

Luu y: neu chay Docker thi frontend KHONG o cong 5173.

## Cách lưu dữ liệu mới

- Dữ liệu gốc vẫn được nạp từ `data_json/`.
- Khi giáo viên nhập/sửa điểm hoặc admin thêm sinh viên, đổi mật khẩu, backend sẽ tự tạo file:

```text
backend/storage/portal_state.json
```

- File này chứa toàn bộ dữ liệu runtime đã chỉnh sửa.
- Muốn reset về dữ liệu ban đầu, chỉ cần xóa file `backend/storage/portal_state.json` rồi chạy lại backend.

## Mau CSV nhap diem

- Cac cot ho tro: `mssv`, `class_section_code`, `diem_thuong_ky_1`, `diem_thuong_ky_2`, `diem_thuc_hanh_1`, `diem_thuc_hanh_2`, `diem_qt`, `diem_gk`, `diem_ck`.
- Giao vien co the tai mau CSV truc tiep trong man hinh dashboard giao vien.
- Neu co nhap cac cot `diem_thuong_ky_*` hoac `diem_thuc_hanh_*`, he thong se tu tinh `diem_qt` bang trung binh cac cot nay. Neu de trong, he thong se dung gia tri `diem_qt` duoc nhap truc tiep.

## Tài khoản demo

### Sinh viên

1. `23630781` / `23630781`
2. `23630761` / `23630761`

### Quản trị viên

1. `admin` / `admin`

### Giảng viên

1. `gvungdung` / `gvungdung`
2. `gvaiml` / `gvaiml`

### Phụ huynh

1. `Trần Minh Khang` - MSSV `23630781` - ngày sinh `04/09/2005` - SĐT `0912360781`
2. `Lê Gia Huy` - MSSV `23630761` - ngày sinh `12/03/2005` - SĐT `0912360761`

Lưu ý: cần nhập đúng CAPTCHA trên màn hình đăng nhập.

## Ghi chú triển khai
 
- Dữ liệu điểm giáo viên lưu trên máy cục bộ, phù hợp cho demo và đồ án chạy nhanh.
- Nếu muốn quay lại bản lưu trữ database sau này, có thể tách riêng một lớp persistence khác mà không cần đổi UI.

## Nhóm phát triển

- Thành viên 1: Nguyễn Xuân Thiên (23630781)
- Thành viên 2: Nguyễn Bá Đức (23732881)
- Thành viên 3: Trần Duy Khang (23728961)
- Thành viên 4: Nguyễn Việt Minh (23724081)
- Thành viên 5: Hoàng Trọng Nghĩa (23630761)


