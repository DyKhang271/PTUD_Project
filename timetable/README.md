# Timetable

Module `timetable` là hệ thống thời khóa biểu và điểm danh tách riêng khỏi `Student Portal`, gồm:

- Backend FastAPI trong `app/`
- Frontend React + Vite trong `frontend/`
- Migration Alembic trong `alembic/`

## Phụ thuộc

`timetable` không chạy độc lập hoàn toàn. Backend cần gọi sang `Student Portal` để:

- đăng nhập sinh viên, giảng viên, admin
- xác thực identity
- lấy dữ liệu nguồn như sinh viên, giảng viên, lớp học phần

Trước khi chạy `timetable`, cần bảo đảm `Student Portal` backend đang chạy và truy cập được qua `CORE_API_BASE_URL`.

Mặc định repo gốc đang dùng:

- `Student Portal API`: `http://localhost:8000`
- `Timetable backend`: `http://localhost:8001`
- `Timetable frontend`: `http://localhost:5174`

## Cấu trúc thư mục

```text
timetable/
|-- app/
|-- frontend/
|-- alembic/
|-- docs/
|-- scripts/
|-- tests/
|-- docker-compose.yml
`-- README.md
```

## Chuẩn bị môi trường

Yêu cầu:

- Python 3.11+ hoặc 3.12
- Node.js 20+
- PostgreSQL 16+ hoặc tương thích

Tạo database:

```sql
CREATE DATABASE timetable;
```

Tạo file `.env` từ `.env.example`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:1307@localhost:5432/timetable
CORE_API_BASE_URL=http://localhost:8000
CORE_API_KEY=dev-internal-secret
SECRET_KEY=replace-with-a-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=240
CHECKIN_EXPIRE_MINUTES=15
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174,http://localhost:8080,http://127.0.0.1:8080
```

Giải thích nhanh:

- `DATABASE_URL`: database riêng của module `timetable`
- `CORE_API_BASE_URL`: URL backend của `Student Portal`
- `CORE_API_KEY`: key internal API phải khớp với `Student Portal`
- `ALLOWED_ORIGINS`: danh sách frontend được phép gọi backend

## Chạy backend local

Từ thư mục `timetable`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Kiểm tra nhanh:

- API root: `http://localhost:8001/`
- Swagger: `http://localhost:8001/docs`

## Chạy frontend local

Từ thư mục `timetable/frontend`:

```bash
npm install
set VITE_API_BASE_URL=http://127.0.0.1:8001
npm run dev
```

Frontend mặc định chạy ở:

```text
http://localhost:5174
```

Nếu muốn lưu cấu hình cố định, tạo file `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8001
```
2. Chạy backend `Student Portal`. 
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

## Thứ tự chạy khuyến nghị

1. Chạy PostgreSQL.
2. Chạy backend `Student Portal`.
3. Chạy `alembic upgrade head` cho `timetable`.
4. Chạy backend `timetable`.
5. Chạy frontend `timetable`.

Lệnh chạy backend `Student Portal` local:

```powershell
cd "..\Student Portal\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Nếu bước 2 chưa chạy, đăng nhập và các API đồng bộ dữ liệu từ core sẽ lỗi `502 Cannot connect to Student Portal`.

## Chạy nhanh bằng Docker Compose

Từ thư mục `timetable`:

```bash
docker compose up --build
```

Compose này sẽ bật:

- PostgreSQL của `timetable` trên `localhost:5433`
- Backend `timetable` trên `localhost:8001`
- Frontend `timetable` trên `localhost:5174`

Lưu ý:

- Trong Docker, `CORE_API_BASE_URL` đang trỏ tới `http://host.docker.internal:8000`
- Nghĩa là `Student Portal` cần chạy ở máy host tại cổng `8000`

## Tài khoản demo

Các tài khoản được xác thực qua `Student Portal`, ví dụ:

- Student: `23630781 / 23630781`
- Student: `23630761 / 23630761`
- Teacher: `gvungdung / gvungdung`
- Teacher: `gvaiml / gvaiml`
- Admin: `admin / admin`

## Một số lệnh hữu ích

Chạy migration mới nhất:

```bash
alembic upgrade head
```

Chạy frontend build:

```bash
cd frontend
npm run build
```

Chạy script test thủ công:

```bash
python scripts/manual_test_hard_schedule.py
```

## File liên quan

- API contract: `docs/api-contract.md`
- Ghi chú test: `tests/README.md`
- Ghi chú scripts: `scripts/README.md`
