# IUH Student Portal + Timetable

Nhánh `main` chứa đầy đủ 2 hệ thống chạy chung bằng Docker Compose:

- **Student Portal**: cổng thông tin sinh viên, phụ huynh, giảng viên và quản trị viên.
- **Timetable**: module thời khóa biểu, lịch thi, lớp học phần và điểm danh.

Nhánh `full_2_app` chỉ giữ riêng module `timetable/` để nộp hoặc chạy tách riêng khi cần.

## Chức năng chính

### Student Portal

- Đăng nhập theo vai trò: sinh viên, phụ huynh, giảng viên, quản trị viên.
- Xem hồ sơ, điểm, chương trình khung, thông báo và lịch học nội bộ.
- Quản trị sinh viên, giảng viên, phân công giảng dạy, thông báo và cấu hình hệ thống.
- Chatbot học vụ dùng tài liệu RAG trong `Student Portal/RAG_docx`.
- Cung cấp API nội bộ cho Timetable đồng bộ dữ liệu.

### Timetable

- Sinh viên xem thời khóa biểu, lịch thi và lịch học theo tuần.
- Giảng viên xem lớp học phần, mở phiên điểm danh và xem báo cáo điểm danh.
- Admin quản lý học kỳ, lớp học phần, thời khóa biểu, lịch thi, chính sách điểm danh.
- Đồng bộ học phần, sinh viên, giảng viên và chương trình khung từ Student Portal.

## Yêu cầu môi trường

- Git
- Docker Desktop hoặc Docker Engine có Compose plugin
- `curl`

Khuyến nghị RAM 8 GB trở lên. Nếu dùng chatbot AI với Ollama/model lớn thì nên có 16 GB.

Các port cần trống:

| Port | Dịch vụ |
| --- | --- |
| `8080` | Student Portal frontend |
| `8000` | Student Portal API |
| `5174` | Timetable frontend |
| `8001` | Timetable API |
| `5432` | PostgreSQL của Student Portal |
| `5433` | PostgreSQL của Timetable |
| `11434` | Ollama API |

Model chatbot mặc định là [`qwen2.5:3b-instruct`](https://ollama.com/library/qwen2.5:3b-instruct) theo thư viện chính thức của Ollama. Model này hỗ trợ tiếng Việt và có kích thước khoảng 1.9 GB.

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

Script sẽ:

- kiểm tra Docker và Docker Compose;
- build và chạy Student Portal;
- build và chạy Timetable;
- chạy migration cho Timetable;
- kiểm tra API/frontend của cả 2 hệ thống;
- tự tải model Ollama `qwen2.5:3b-instruct` nếu máy chưa có;
- seed dữ liệu demo Timetable từ Student Portal.

## Chạy thủ công

```bash
docker compose up -d --build
```

Seed dữ liệu demo Timetable:

```bash
docker compose --profile bootstrap run --rm bootstrap-demo
```

Kiểm tra trạng thái:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f timetable-backend
```

## URL

| Hệ thống | URL |
| --- | --- |
| Student Portal | http://localhost:8080 |
| Student Portal API | http://localhost:8000 |
| Timetable | http://localhost:5174 |
| Timetable API | http://localhost:8001 |
| Ollama API | http://localhost:11434 |

## Tài khoản demo

Timetable dùng chung tài khoản/JWT do Student Portal cấp.

| Vai trò | Tài khoản | Mật khẩu |
| --- | --- | --- |
| Admin | `admin` | `admin` |
| Giảng viên | `gvungdung` | `gvungdung` |
| Giảng viên | `gvaiml` | `gvaiml` |
| Sinh viên | `23630781` | `23630781` |
| Sinh viên | `23630761` | `23630761` |

Đăng nhập phụ huynh dùng tab phụ huynh ở Student Portal:

| MSSV | Ngày sinh | SĐT |
| --- | --- | --- |
| `23630781` | `04/09/2005` | `0912360781` |
| `23630761` | `12/03/2005` | `0912360761` |

## Dừng và reset dữ liệu

Dừng toàn bộ container:

```bash
docker compose down
```

Reset sạch database và chạy lại:

```bash
docker compose down -v
docker compose up -d --build
docker compose --profile bootstrap run --rm bootstrap-demo
```

Lưu ý: `docker compose down -v` sẽ xóa dữ liệu trong volume PostgreSQL và Ollama của project.

## Kiểm tra chatbot AI / Ollama

Kiểm tra model đã có trong Ollama:

```bash
docker compose exec ollama ollama list
```

Nếu cần tải lại model thủ công:

```bash
docker compose exec ollama ollama pull qwen2.5:3b-instruct
```

Backend Student Portal dùng biến:

```text
OLLAMA_MODEL=qwen2.5:3b-instruct
```

## Chạy không cần Ollama

Nếu máy yếu hoặc không cần chatbot AI, có thể chạy các service chính:

```bash
docker compose up -d --build postgres backend frontend timetable-postgres timetable-backend timetable-frontend
```

Chatbot vẫn có fallback, nhưng phần gọi model Ollama có thể không hoạt động nếu service Ollama không chạy.

## Cấu trúc project

```text
PTUD_Project/
├─ docker-compose.yml
├─ setup.bat
├─ setup.sh
├─ README.md
├─ Student Portal/
│  ├─ backend/
│  ├─ frontend/
│  ├─ database/
│  ├─ data_json/
│  └─ RAG_docx/
└─ timetable/
   ├─ app/
   ├─ frontend/
   ├─ alembic/
   ├─ docs/
   ├─ scripts/
   └─ tests/
```

## Ghi chú vận hành

- Student Portal dùng `INTERNAL_API_KEY=dev-internal-secret`.
- Timetable dùng `CORE_API_KEY=dev-internal-secret` để gọi API nội bộ của Student Portal.
- JWT secret được đồng bộ qua `PORTAL_JWT_SECRET=student-portal-dev-secret`.
- Timetable backend chạy `alembic upgrade head` mỗi lần container khởi động.
- Service `bootstrap-demo` đăng nhập admin và seed dữ liệu demo Timetable cho 2 sinh viên mẫu.

## Chạy riêng từng module

Nếu cần debug riêng Timetable, có thể vào thư mục:

```bash
cd timetable
docker compose up -d --build
```

Khi chạy cách này, Student Portal phải đang chạy bên ngoài tại `http://localhost:8000`.

## Triển khai Đám mây trực tuyến (Cloud Deployment)

Hệ thống hỗ trợ cấu hình triển khai hoàn toàn miễn phí trên các nền tảng đám mây tự động:
- **Tầng dữ liệu (Database)**: PostgreSQL trên [Neon.tech](https://neon.tech/) (hoặc Supabase).
- **Tầng API / Backend**: [Render.com](https://render.com/) (Web Services miễn phí).
- **Tầng Giao diện (Frontend)**: [Vercel.com](https://vercel.com/) (React/Vite).

Sử dụng tệp cấu hình [render.yaml](file:///d:/Tailieuhoc/Nam_3/PTUD/project/PTUD_Project_main/render.yaml) để tự động hóa việc khởi tạo dịch vụ trên Render thông qua chức năng Blueprint.

### 1. Cấu hình Cơ sở dữ liệu (Neon DB)
Đăng ký tài khoản Neon.tech, tạo Project PostgreSQL 16 và nhận chuỗi kết nối (`Connection String`):
`postgresql://neondb_owner:password@host.neon.tech/neondb?sslmode=require`

### 2. Triển khai Backend APIs trên Render.com
Sử dụng Render Blueprint hoặc thiết lập thủ công:
- **Student Portal API (`ptud-student-portal-api`)**:
  - Root Directory: `Student Portal/backend`
  - Runtime: `Python`, Build Command: `pip install -r requirements.txt`, Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Các biến môi trường bắt buộc:
    - `DATABASE_URL`: *(Chuỗi kết nối Neon DB)*
    - `PORTAL_JWT_SECRET`: `student-portal-dev-secret`
    - `INTERNAL_API_KEY`: `dev-internal-secret`
    - `ALLOWED_ORIGINS`: `*`
- **Timetable API (`ptud-timetable-api`)**:
  - Root Directory: `timetable`
  - Runtime: `Python`, Build Command: `pip install -r requirements.txt && pip install python-multipart`, Start Command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Các biến môi trường bắt buộc:
    - `DATABASE_URL`: *(Chuỗi kết nối Neon DB, khuyên dùng tên DB/schema riêng)*
    - `CORE_API_BASE_URL`: *(URL của Student Portal API trên Render)*
    - `CORE_API_KEY`: `dev-internal-secret`
    - `PORTAL_JWT_SECRET`: `student-portal-dev-secret`
    - `ALLOWED_ORIGINS`: `*`

### 3. Triển khai Frontends trên Vercel.com
Liên kết với kho chứa GitHub và import dự án:
- **Student Portal Frontend**:
  - Root Directory: `Student Portal/frontend`, Framework Preset: `Vite`
  - Biến môi trường: `VITE_API_BASE_URL` = `https://[PORTAL-API-URL-ON-RENDER]/api`
- **Timetable Frontend**:
  - Root Directory: `timetable/frontend`, Framework Preset: `Vite`
  - Biến môi trường: 
    - `VITE_TIMETABLE_API_BASE_URL` = `https://[TIMETABLE-API-URL-ON-RENDER]`
    - `VITE_PORTAL_API_BASE_URL` = `https://[PORTAL-API-URL-ON-RENDER]/api`

### 4. Cấu hình Chatbot Cloud AI
Để chatbot RAG hoạt động tối ưu trên máy chủ free mà không cần Ollama cục bộ, khai báo thêm các biến môi trường sau cho Student Portal API trên Render:
- `CHATBOT_AI_ENABLED` = `1`
- `CHATBOT_AI_PROVIDER` = `openai-compatible`
- `OPENAI_API_KEY` = *(Mã API của bạn, ví dụ từ OpenAI hoặc Groq)*
- `OPENAI_BASE_URL` = `https://api.openai.com/v1` (Hoặc URL Groq)
- `OPENAI_MODEL` = `gpt-4o-mini` (Hoặc model Groq bạn chọn)
