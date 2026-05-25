# IUH Timetable

Repository này chỉ chứa module **Timetable** trong thư mục `timetable/`. Student Portal đã được tách sang `PTUD_Project_main`.

Timetable vẫn dùng tài khoản, JWT và dữ liệu học vụ từ Student Portal, vì vậy hãy chạy `PTUD_Project_main` trước khi chạy repo này.

## Chức năng chính

- Xem thời khóa biểu, lịch thi và lịch học theo vai trò sinh viên.
- Quản lý lớp học phần, học kỳ, thời khóa biểu, lịch thi và chính sách điểm danh.
- Giảng viên xem lớp được phân công, mở phiên điểm danh và xem báo cáo điểm danh.
- Admin đồng bộ học phần, sinh viên, giảng viên và chương trình khung từ Student Portal.

## Yêu cầu môi trường

- Git
- Docker Desktop hoặc Docker Engine có Compose plugin
- `curl`
- Student Portal đang chạy tại `http://localhost:8000`

Các port cần trống:

| Port | Dịch vụ |
| --- | --- |
| `5174` | Timetable frontend |
| `8001` | Timetable API |
| `5433` | PostgreSQL của Timetable |

## Chạy nhanh

1. Chạy Student Portal trước:

```bash
cd ../PTUD_Project_main
docker compose up -d --build
```

2. Chạy Timetable:

### Windows

```bat
setup.bat
```

### macOS / Linux

```bash
chmod +x setup.sh
./setup.sh
```

Script sẽ kiểm tra Student Portal API, build Timetable, khởi động database/backend/frontend và seed dữ liệu demo từ Student Portal.

## Chạy thủ công

```bash
docker compose up -d --build
```

Seed dữ liệu demo sau khi backend đã chạy:

```bash
docker compose --profile bootstrap run --rm bootstrap-demo
```

Kiểm tra log:

```bash
docker compose ps
docker compose logs -f backend
```

## URL

| Hệ thống | URL |
| --- | --- |
| Timetable frontend | http://localhost:5174 |
| Timetable API | http://localhost:8001 |
| Student Portal API bên ngoài | http://localhost:8000 |

## Tài khoản demo

Timetable đăng nhập bằng tài khoản do Student Portal cấp:

| Vai trò | Tài khoản | Mật khẩu |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| Giảng viên | `gvungdung` | `gvungdung` |
| Giảng viên | `gvaiml` | `gvaiml` |
| Sinh viên | `23630781` | `23630781` |
| Sinh viên | `23630761` | `23630761` |

## Dừng và reset dữ liệu

Dừng container:

```bash
docker compose down
```

Reset database Timetable:

```bash
docker compose down -v
docker compose up -d --build
docker compose --profile bootstrap run --rm bootstrap-demo
```

Lưu ý: `docker compose down -v` chỉ xóa volume PostgreSQL của Timetable.

## Cấu trúc thư mục

```text
PTUD_Project_full_2_app/
├─ docker-compose.yml
├─ setup.bat
├─ setup.sh
├─ README.md
└─ timetable/
   ├─ app/
   ├─ frontend/
   ├─ alembic/
   ├─ docs/
   ├─ scripts/
   └─ tests/
```

## Cấu hình kết nối Student Portal

Mặc định backend Timetable gọi Student Portal qua:

```text
CORE_API_BASE_URL=http://host.docker.internal:8000
```

Frontend Timetable gọi API đăng nhập của Student Portal qua:

```text
VITE_PORTAL_API_BASE_URL=http://localhost:8000/api
```

Nếu Student Portal chạy ở host/port khác, tạo file `.env` ở root repo và ghi đè các biến trên.

## Dữ liệu mẫu

- File CSV gốc đã được đưa vào `timetable/app/seed_data/timetable_entries_HK2_2025_2026.csv`.
- File mẫu nhỏ dùng cho import nằm ở `timetable/app/seed_data/timetable_entries.sample.csv`.
