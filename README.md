# IUH Student Portal + Timetable

Repository nay gom 2 he thong chay cung nhau de mo phong cong thong tin hoc vu va quan ly thoi khoa bieu:

- **Student Portal**: cong thong tin sinh vien/giao vien/phu huynh, cung cap dashboard, diem, chuong trinh khung, thong bao, chatbot AI va API noi bo cho module khac.
- **Timetable**: he thong thoi khoa bieu va diem danh, su dung JWT do Student Portal cap va dong bo du lieu hoc phan/sinh vien/giao vien tu Student Portal.

## Tong quan he thong

### Student Portal

- **Backend** (`Student Portal/backend`): FastAPI, xu ly dang nhap, diem, chuong trinh khung, chatbot, API noi bo cho Timetable.
- **Frontend** (`Student Portal/frontend`): React + Vite, giao dien cho sinh vien, giao vien, quan tri va phu huynh.
- **Database** (`Student Portal/database`): PostgreSQL, luu du lieu runtime va schema khoi tao.
- **Muc dich**: lam he thong trung tam cho tai khoan, du lieu hoc vu va chatbot.

### Timetable

- **Backend** (`timetable/app`): FastAPI + SQLAlchemy + Alembic, quan ly hoc ky, hoc phan, lich hoc, diem danh.
- **Frontend** (`timetable/frontend`): React + Vite, giao dien xem thoi khoa bieu va quan tri import du lieu.
- **Database** (`timetable` + Postgres): luu hoc ky, course section, timetable entries, attendance sessions/records.
- **Muc dich**: cung cap module thoi khoa bieu/doc lap nhung van lien thong voi Student Portal.

## Yeu cau moi truong

- Git
- Docker
- Docker Compose (`docker compose`)
- RAM khuyen nghi:
  - Toi thieu: 8 GB
  - Khuyen nghi: 16 GB neu chay them Ollama/model lon
- Cac port can trong:
  - `5432` - Student Portal PostgreSQL
  - `5433` - Timetable PostgreSQL
  - `8000` - Student Portal API
  - `8001` - Timetable API
  - `8080` - Student Portal frontend
  - `5174` - Timetable frontend
  - `11434` - Ollama API neu dung AI

## Huong dan cai dat va chay du an

Repository da duoc bo sung `docker-compose.yml` o thu muc goc va script setup de giang vien co the clone repo va chay ngay.

### 1. Clone repository

```bash
git clone <repo-url>
cd PTUD_Project_c38355d
```

### 2. Chay script tu dong

#### Linux / macOS

```bash
chmod +x setup.sh
./setup.sh
```

#### Windows

```bat
setup.bat
```

### 3. Script se tu dong lam gi

- kiem tra Docker va Docker Compose
- build toan bo container
- khoi dong 2 database
- khoi dong Student Portal backend/frontend
- khoi dong Timetable backend/frontend
- chay Alembic migration cho Timetable
- khoi tao/seed du lieu Student Portal vao PostgreSQL khi DB rong
- tu dong seed du lieu demo cho Timetable tu Student Portal, kem sample timetable va attendance

Sau khi script chay xong, website co the truy cap ngay tren may local.

## URL sau khi chay

- Student Portal frontend: [http://localhost:8080](http://localhost:8080)
- Student Portal API: [http://localhost:8000](http://localhost:8000)
- Timetable frontend: [http://localhost:5174](http://localhost:5174)
- Timetable API: [http://localhost:8001](http://localhost:8001)
- Ollama API: [http://localhost:11434](http://localhost:11434)

## Tai khoan test

Timetable dang dung cung tai khoan/JWT voi Student Portal, vi vay co the dang nhap bang cung credential ben duoi.

| Role | Username/Email | Password | Mo ta quyen |
| --- | --- | --- | --- |
| Admin | `admin` | `admin` | Quan tri Student Portal, co the vao trang admin va seed/import du lieu cho Timetable |
| Teacher | `gvungdung` | `gvungdung` | Giao vien bo mon Phat trien ung dung, xem du lieu giang day va diem danh |
| Teacher | `gvaiml` | `gvaiml` | Giao vien bo mon AI/ML, xem du lieu giang day va diem danh |
| Student | `23630781` | `23630781` | Tai khoan sinh vien demo, xem dashboard, diem, chuong trinh khung, timetable |
| Student | `23630761` | `23630761` | Tai khoan sinh vien demo thu hai, dung de doi chieu du lieu |

Du lieu tren duoc lay tu source hien co:

- `Student Portal/backend/student_data_store.py`
- `Student Portal/backend/routers/auth.py`
- `timetable/app/services/auth_service.py`

## Dung he thong

Chay tai thu muc goc repository:

```bash
docker compose down
```

## Reset du lieu

Lenh duoi day se xoa ca 2 volume Postgres, khoi tao lai DB va tu dong seed lai du lieu demo nho service bootstrap:

```bash
docker compose down -v
docker compose up --build
```

Neu muon chay nen, co the dung:

```bash
docker compose up -d --build
```

## Luu y khi chay AI / Ollama

Mac dinh compose se khoi dong them service `ollama` de Student Portal chatbot co the goi LLM.

### Neu model qua lon

Trong `docker-compose.yml`, bien `OLLAMA_MODEL` dang de `gemma4:31b-cloud`. Neu may khong du tai nguyen, co the doi sang model nhe hon, vi du:

- `llama3.2:3b`
- `qwen2.5:3b`

Sau do chay lai:

```bash
docker compose up -d --build
```

### Neu chua co model

Sau khi he thong da len, pull model bang lenh:

```bash
docker compose exec ollama ollama pull gemma4:31b-cloud
```

Neu dung model nhe hon, thay ten model tuong ung:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

### Neu khong can AI

Backend Student Portal co fallback an toan khi Ollama khong san sang. Co the bo qua service AI bang cach chi chay cac service can thiet:

```bash
docker compose up -d --build postgres backend frontend timetable-postgres timetable-backend timetable-frontend bootstrap-demo
```

Khi do chatbot van mo duoc, nhung phan LLM se fallback thay vi goi model.

## Ghi chu van hanh

- `docker-compose.yml` o root da cau hinh lai `depends_on`, `healthcheck`, secret/env va ket noi giua 2 he thong de `docker compose up --build` chay on dinh.
- Student Portal su dung `INTERNAL_API_KEY=dev-internal-secret`.
- Timetable su dung `CORE_API_KEY=dev-internal-secret` de goi API noi bo cua Student Portal.
- JWT secret dang duoc dong bo qua `PORTAL_JWT_SECRET=student-portal-dev-secret`.
- Timetable backend duoc migrate bang `alembic upgrade head` moi lan container khoi dong.
- Service `bootstrap-demo` tu dong login bang tai khoan admin va seed du lieu Timetable cho 2 sinh vien demo.

## Chay tung module de debug

Neu can debug rieng tung module, cac file compose cu van con trong:

- `Student Portal/docker-compose.yml`
- `timetable/docker-compose.yml`

Tuy nhien, de demo cho giang vien, nen uu tien chay bang `docker-compose.yml` o thu muc goc hoac `setup.sh` / `setup.bat`.
