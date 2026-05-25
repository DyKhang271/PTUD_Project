# IUH Student Portal

Repository này chỉ chứa hệ thống **Student Portal**: cổng thông tin sinh viên, giảng viên, phụ huynh và quản trị viên. Phần Timetable đã được tách sang repository/nhánh `PTUD_Project_full_2_app`.

## Chức năng chính

- Đăng nhập theo vai trò: sinh viên, phụ huynh, giảng viên, quản trị viên.
- Xem hồ sơ, điểm, chương trình khung, thông báo và lịch học nội bộ của Student Portal.
- Quản trị sinh viên, giảng viên, phân công giảng dạy, thông báo và cấu hình hệ thống.
- Chatbot học vụ dùng tài liệu RAG trong `Student Portal/RAG_docx`.
- API nội bộ để module Timetable bên ngoài có thể đồng bộ dữ liệu khi cần.

## Yêu cầu môi trường

- Git
- Docker Desktop hoặc Docker Engine có Compose plugin
- `curl`

Các port cần trống:

| Port | Dịch vụ |
| --- | --- |
| `8080` | Student Portal frontend |
| `8000` | Student Portal API |
| `5432` | PostgreSQL |
| `11434` | Ollama API |

## Chạy nhanh

### Windows

```bat
setup.bat
```

### macOS / Linux

```bash
chmod +x setup.sh
./setup.sh
```

Script sẽ kiểm tra Docker, build image, khởi động database, backend, frontend và kiểm tra healthcheck.

## Chạy thủ công

```bash
docker compose up -d --build
```

Kiểm tra trạng thái:

```bash
docker compose ps
docker compose logs -f backend
```

## URL

| Hệ thống | URL |
| --- | --- |
| Student Portal | http://localhost:8080 |
| Student Portal API | http://localhost:8000 |
| Ollama API | http://localhost:11434 |

## Tài khoản demo

| Vai trò | Tài khoản | Mật khẩu |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| Giảng viên | `gvungdung` | `gvungdung` |
| Giảng viên | `gvaiml` | `gvaiml` |
| Sinh viên | `23630781` | `23630781` |
| Sinh viên | `23630761` | `23630761` |

Đăng nhập phụ huynh dùng tab phụ huynh:

| MSSV | Ngày sinh | SĐT |
| --- | --- | --- |
| `23630781` | `04/09/2005` | `0912360781` |
| `23630761` | `12/03/2005` | `0912360761` |

## Dừng và reset dữ liệu

Dừng container:

```bash
docker compose down
```

Reset sạch database và chạy lại:

```bash
docker compose down -v
docker compose up -d --build
```

Lưu ý: `docker compose down -v` sẽ xóa dữ liệu trong volume PostgreSQL và Ollama của project.

## Cấu trúc thư mục

```text
PTUD_Project_main/
├─ docker-compose.yml
├─ setup.bat
├─ setup.sh
├─ README.md
└─ Student Portal/
   ├─ backend/
   ├─ frontend/
   ├─ database/
   ├─ data_json/
   └─ RAG_docx/
```

## Ghi chú cho Timetable

Timetable đã được tách khỏi repo này. Nếu chạy Timetable riêng, hãy khởi động Student Portal trước để Timetable có thể gọi API tại `http://localhost:8000`.
