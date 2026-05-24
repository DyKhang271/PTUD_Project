# IUH Student Portal + Timetable

Project gồm 2 hệ thống chạy cùng nhau bằng Docker Compose:

- **Student Portal**: cổng thông tin sinh viên/giảng viên/phụ huynh/quản trị, quản lý điểm, chương trình đào tạo, thông báo và chatbot học vụ.
- **Timetable**: hệ thống thời khóa biểu, lịch thi và điểm danh. Timetable dùng tài khoản/JWT do Student Portal cấp và đồng bộ dữ liệu sinh viên, học phần, giảng viên từ Student Portal.

Hướng dẫn này ưu tiên cách chạy bằng Docker để có thể chạy lại trên laptop/máy tính mới mà không cần cài riêng Python, Node.js hay PostgreSQL.

## 1. Yêu cầu máy

Cài trước:

- **Git**
- **Docker Desktop** hoặc Docker Engine có Compose plugin
- **curl**

Khuyến nghị:

- RAM tối thiểu 8 GB, khuyến nghị 16 GB nếu bật Ollama/chatbot AI.
- Còn trống ít nhất 8-10 GB ổ đĩa cho image, volume và dependency.
- Docker Desktop phải đang chạy trước khi chạy lệnh.

Các port cần trống:

| Port | Dịch vụ |
| --- | --- |
| `8080` | Student Portal frontend |
| `8000` | Student Portal API |
| `5174` | Timetable frontend |
| `8001` | Timetable API |
| `5432` | Student Portal PostgreSQL |
| `5433` | Timetable PostgreSQL |
| `11434` | Ollama API |

Nếu máy đang có PostgreSQL, Node dev server hoặc app khác chiếm các port trên, hãy tắt app đó hoặc đổi port trong `docker-compose.yml`.

## 2. Clone project

```bash
git clone <repo-url>
cd PTUD_Project
```

Nếu thư mục sau khi clone có tên khác, chỉ cần `cd` vào đúng thư mục chứa file `docker-compose.yml`.

Không đổi tên các thư mục con như `Student Portal` hoặc `timetable` vì Docker Compose đang tham chiếu đúng các đường dẫn này.

## 3. Cách chạy nhanh

### Windows

Mở PowerShell hoặc Command Prompt tại thư mục gốc project:

```bat
setup.bat
```

### macOS / Linux

```bash
chmod +x setup.sh
./setup.sh
```

Script sẽ tự kiểm tra Docker, build image, chạy database, backend, frontend, migrate Timetable DB và seed dữ liệu demo.

## 4. Cách chạy thủ công bằng Docker Compose

Nếu không dùng script:

```bash
docker compose up -d --build
```

Xem trạng thái container:

```bash
docker compose ps
```

Xem log khi có lỗi:

```bash
docker compose logs -f
```

Xem log riêng backend:

```bash
docker compose logs -f backend
docker compose logs -f timetable-backend
```

## 5. URL sau khi chạy

| Hệ thống | URL |
| --- | --- |
| Student Portal | http://localhost:8080 |
| Student Portal API | http://localhost:8000 |
| Timetable | http://localhost:5174 |
| Timetable API | http://localhost:8001 |
| Ollama | http://localhost:11434 |

Nên đợi `docker compose ps` hiển thị các service chính ở trạng thái `healthy` trước khi test.

## 6. Tài khoản demo

Timetable dùng chung tài khoản đăng nhập với Student Portal.

| Vai trò | Tài khoản | Mật khẩu | Ghi chú |
| --- | --- | --- | --- |
| Admin | `admin` | `admin` | Quản trị Student Portal và Timetable |
| Giảng viên | `gvungdung` | `gvungdung` | Có lớp học phần được phân công |
| Giảng viên | `gvaiml` | `gvaiml` | Có lớp học phần được phân công |
| Sinh viên | `23630781` | `23630781` | Sinh viên demo |
| Sinh viên | `23630761` | `23630761` | Sinh viên demo |

Thông tin phụ huynh dùng tab đăng nhập phụ huynh ở Student Portal:

| MSSV | Ngày sinh | SĐT |
| --- | --- | --- |
| `23630781` | `04/09/2005` | `0912360781` |
| `23630761` | `12/03/2005` | `0912360761` |

## 7. Seed dữ liệu demo

Service `bootstrap-demo` tự chạy sau khi `backend` và `timetable-backend` healthy. Service này:

- đăng nhập bằng tài khoản admin của Student Portal;
- lấy học kỳ mới nhất từ dữ liệu Student Portal;
- seed course sections, sinh viên, giảng viên, lịch học mẫu và điểm danh mẫu vào Timetable.

Kiểm tra log seed:

```bash
docker compose logs bootstrap-demo
```

Chạy lại seed nếu cần:

```bash
docker compose up -d --force-recreate bootstrap-demo
```

## 8. Dừng, rebuild, reset dữ liệu

Dừng toàn bộ container:

```bash
docker compose down
```

Rebuild và chạy lại:

```bash
docker compose up -d --build
```

Reset sạch database và seed lại từ đầu:

```bash
docker compose down -v
docker compose up -d --build
```

Lưu ý: `docker compose down -v` sẽ xóa dữ liệu trong các volume PostgreSQL và Ollama của project.

## 9. Chạy không cần AI/Ollama

Mặc định Compose có service `ollama` để phục vụ chatbot AI. Nếu máy yếu hoặc không cần chatbot AI, có thể chạy các service chính:

```bash
docker compose up -d --build postgres backend frontend timetable-postgres timetable-backend timetable-frontend bootstrap-demo
```

Chatbot vẫn có fallback theo dữ liệu hệ thống/RAG tùy câu hỏi, nhưng phần gọi model Ollama có thể không hoạt động nếu Ollama/model chưa sẵn sàng.

Nếu muốn dùng Ollama đầy đủ, pull model sau khi container lên:

```bash
docker compose exec ollama ollama pull gemma4:31b-cloud
```

Nếu máy không đủ tài nguyên cho model lớn, đổi `OLLAMA_MODEL` trong `docker-compose.yml` sang model nhẹ hơn, ví dụ:

- `llama3.2:3b`
- `qwen2.5:3b`

Sau đó chạy lại:

```bash
docker compose up -d --build
```

## 10. Kiểm tra nhanh sau khi chạy

```bash
docker compose ps
docker compose logs --tail=80 bootstrap-demo
```

Test nhanh trên trình duyệt:

1. Mở Student Portal: http://localhost:8080
2. Đăng nhập sinh viên `23630781 / 23630781`
3. Mở Timetable: http://localhost:5174
4. Đăng nhập giảng viên `gvungdung / gvungdung`
5. Kiểm tra trang lớp học phần/điểm danh của giảng viên.

## 11. Cấu trúc project

```text
PTUD_Project/
├─ docker-compose.yml              # Compose chạy full hệ thống
├─ setup.bat                       # Script chạy nhanh trên Windows
├─ setup.sh                        # Script chạy nhanh trên macOS/Linux
├─ bootstrap_demo.py               # Seed dữ liệu demo Timetable từ Student Portal
├─ Student Portal/
│  ├─ backend/                     # FastAPI Student Portal
│  ├─ frontend/                    # React/Vite Student Portal
│  ├─ database/                    # Schema PostgreSQL
│  ├─ data_json/                   # Dữ liệu sinh viên demo
│  └─ RAG_docx/                    # Tài liệu RAG cho chatbot
└─ timetable/
   ├─ app/                         # FastAPI Timetable
   ├─ frontend/                    # React/Vite Timetable
   ├─ alembic/                     # Migration Timetable DB
   └─ docs/                        # Tài liệu API/contract
```

## 12. Lệnh build/test thường dùng

Student Portal frontend:

```bash
cd "Student Portal/frontend"
npm run lint
npm run build
```

Student Portal backend:

```bash
cd "Student Portal"
python -m compileall backend
```

Timetable frontend trong Docker:

```bash
docker compose exec -T timetable-frontend npm run build
```

Timetable backend:

```bash
cd timetable
python -m compileall app
```

## 13. Lỗi thường gặp

### Docker daemon is not running

Mở Docker Desktop, chờ Docker báo running rồi chạy lại `setup.bat`, `setup.sh` hoặc `docker compose up -d --build`.

### Port already allocated

Một ứng dụng khác đang chiếm port. Kiểm tra và tắt ứng dụng đó, hoặc đổi mapping port trong `docker-compose.yml`.

Ví dụ đổi Student Portal frontend từ `8080` sang `8088`:

```yaml
ports:
  - "8088:80"
```

### Timetable frontend lâu lên ở lần đầu

Container `timetable-frontend` chạy `npm ci` ở lần đầu nên có thể mất vài phút. Xem log:

```bash
docker compose logs -f timetable-frontend
```

### Chatbot trả lời chậm hoặc lỗi model

Kiểm tra Ollama:

```bash
docker compose ps ollama
docker compose logs -f ollama
```

Nếu chưa pull model:

```bash
docker compose exec ollama ollama pull gemma4:31b-cloud
```

### Muốn làm sạch hoàn toàn để chạy lại từ đầu

```bash
docker compose down -v
docker compose up -d --build
```

## 14. Ghi chú môi trường

Các biến quan trọng đã được cấu hình sẵn trong `docker-compose.yml`:

- `DATABASE_URL` cho Student Portal PostgreSQL và Timetable PostgreSQL.
- `INTERNAL_API_KEY=dev-internal-secret` ở Student Portal.
- `CORE_API_KEY=dev-internal-secret` ở Timetable để gọi API nội bộ của Student Portal.
- `PORTAL_JWT_SECRET=student-portal-dev-secret` dùng chung để xác thực JWT.
- `RAG_DOCUMENTS_DIR=/rag_docs` để mount tài liệu `.docx` cho chatbot.

Với mục đích demo/local development, chỉ cần Docker Compose ở thư mục gốc là đủ.
