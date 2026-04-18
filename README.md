# IUH Student Portal & AI Academic Assistant

Ứng dụng mô phỏng cổng thông tin sinh viên IUH với giao diện web, dashboard học tập, bảng điểm, chương trình khung, quản trị viên, giảng viên và chatbot học vụ.

## Công nghệ

- Frontend: React, Vite, Axios, CSS Modules
- Backend: FastAPI
- Database runtime: PostgreSQL
- Lưu trữ học vụ: JSON payload được seed vào PostgreSQL (`JSONB`)
- Xuất PDF: `jspdf`, `jspdf-autotable`

## Cấu trúc thư mục

- `frontend/`: giao diện người dùng
- `backend/`: API FastAPI và logic nghiệp vụ
- `database/`: schema PostgreSQL và script liên quan
- `data_json/`: 2 file JSON sinh viên được seed vào database
- `RAG_docx/`: tài liệu phục vụ chatbot / RAG về sau

## Cách chạy nhanh bằng Docker

Project này được thiết kế để chạy bằng Docker với 4 service mặc định:

- `postgres`: database runtime
- `backend`: FastAPI, tự động seed 2 file JSON vào DB nếu DB đang rỗng
- `frontend`: Nginx phục vụ build React
- `ollama`: gateway Ollama cho chatbot AI, có thể chạy model local hoặc cloud model của Ollama

### Khởi động lần đầu

```bash
docker compose up --build
```

Truy cập:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Ollama API: `http://localhost:11434`

Database mặc định:

- DB name: `student_portal`
- User: `postgres`
- Password: `postgres`

### Bật model cho chatbot AI

Mặc định project đã cấu hình chatbot dùng model cloud `gemma4:31b-cloud` qua Ollama.

Để cloud model hoạt động trong container `ollama`, bạn cần đăng nhập Ollama ngay trong container để cấp public key cho instance đó. Làm 1 lần:

```bash
docker compose exec ollama ollama signin
```

Sau khi sign in xong, pull cloud model:

```bash
docker compose exec ollama ollama pull gemma4:31b-cloud
```

Sau khi pull xong, chatbot sẽ tự động dùng AI + RAG. Nếu chưa sign in hoặc model cloud chưa sẵn sàng, chatbot vẫn fallback an toàn sang chế độ không dùng LLM.

Nếu bạn muốn quay lại model local, chỉ cần đổi `OLLAMA_MODEL` trong [docker-compose.yml](/d:/PTUD_Project/docker-compose.yml) về một model local như `llama3.2:3b`, sau đó:

```bash
docker compose up -d --build backend
docker compose exec ollama ollama pull llama3.2:3b
```

### Dữ liệu được nạp vào DB như thế nào

Khi `postgres` là volume mới và chưa có dữ liệu runtime:

1. Backend đọc 2 file JSON trong `data_json/`
2. Backend seed các payload này vào bảng `student_raw_records`
3. Metadata runtime như account, teacher, config, schedule, notifications được lưu vào bảng `app_runtime_state`

Sau lần seed đầu tiên:

- backend không còn dùng JSON làm nguồn runtime nữa
- mỗi lần load dữ liệu sẽ đọc từ PostgreSQL
- JSON chỉ còn vai trò seed ban đầu khi DB rỗng

### Chạy lại sau khi sửa code

Nếu chỉ restart container với code đã được mount/built lại:

```bash
docker compose up -d
```

Nếu bạn vừa sửa code backend/frontend và muốn build lại image:

```bash
docker compose up --build
```

Nếu chỉ muốn build lại một service:

```bash
docker compose build backend
docker compose build frontend
docker compose up -d backend frontend
```

Nếu bạn vừa đổi module chatbot AI hoặc config Ollama:

```bash
docker compose up -d ollama backend frontend
```

### Dừng project

```bash
docker compose down
```

### Dừng và xoá cả database volume

Lệnh này sẽ xoá dữ liệu PostgreSQL hiện tại. Lần chạy sau, backend sẽ seed lại 2 file JSON gốc vào database.

```bash
docker compose down -v
docker compose up --build
```

## Chạy local không dùng Docker

Nếu muốn chạy tay, bạn cần tự khởi tạo PostgreSQL trước, sau đó export `DATABASE_URL` cho backend.

Backend:

```bash
cd backend
python -m pip install -r requirements.txt
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/student_portal
set OLLAMA_BASE_URL=http://localhost:11434
set OLLAMA_MODEL=gemma4:31b-cloud
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Mẫu CSV nhập điểm

- Các cột hỗ trợ: `mssv`, `class_section_code`, `diem_thuong_ky_1`, `diem_thuong_ky_2`, `diem_thuc_hanh_1`, `diem_thuc_hanh_2`, `diem_qt`, `diem_gk`, `diem_ck`
- Nếu có nhập các cột `diem_thuong_ky_*` hoặc `diem_thuc_hanh_*`, hệ thống sẽ tự tính `diem_qt`

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

## Ghi chú

- Nguồn dữ liệu runtime chính hiện tại là PostgreSQL, không còn phụ thuộc vào `backend/storage/portal_state.json` khi chạy bằng Docker
- Hai file trong `data_json/` chỉ được dùng để seed một lần khi DB rỗng
- Sau khi seed, frontend và backend đọc dữ liệu runtime từ PostgreSQL
- Chatbot AI ưu tiên lấy dữ liệu học tập từ PostgreSQL và tài liệu quy chế/chương trình khung từ `RAG_docx/`
- Nếu dùng cloud model của Ollama, instance `ollama` trong Docker cần được `ollama signin` trước khi pull model
- Nếu `ollama` chưa chạy, chưa sign in, hoặc chưa pull model, chatbot vẫn không crash và sẽ trả lời bằng chế độ fallback
