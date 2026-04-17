# IUH Student Portal & AI Academic Assistant

Ung dung mo phong cong thong tin sinh vien IUH voi giao dien web, dashboard hoc tap, bang diem, chuong trinh khung, quan tri vien, giang vien va chatbot hoc vu.

## Cong nghe

- Frontend: React, Vite, Axios, CSS Modules
- Backend: FastAPI
- Database runtime: PostgreSQL
- Luu tru hoc vu: JSON payload duoc seed vao PostgreSQL (`JSONB`)
- Xuat PDF: `jspdf`, `jspdf-autotable`

## Cau truc thu muc

- `frontend/`: giao dien nguoi dung
- `backend/`: API FastAPI va logic nghiep vu
- `database/`: schema PostgreSQL va script lien quan
- `data_json/`: 2 file JSON sinh vien duoc seed vao database
- `RAG_docx/`: tai lieu phuc vu chatbot / RAG ve sau

## Cach chay nhanh bang Docker

Project nay duoc thiet ke de chay bang Docker voi 4 service mac dinh:

- `postgres`: database runtime
- `backend`: FastAPI, tu dong seed 2 file JSON vao DB neu DB dang rong
- `frontend`: Nginx phuc vu build React
- `ollama`: gateway Ollama cho chatbot AI, co the chay model local hoac cloud model cua Ollama

### Khoi dong lan dau

```bash
docker compose up --build
```

Truy cap:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Ollama API: `http://localhost:11434`

Database mac dinh:

- DB name: `student_portal`
- User: `postgres`
- Password: `postgres`

### Bat model cho chatbot AI

Mac dinh project da cau hinh chatbot dung model cloud `gemma4:31b-cloud` qua Ollama.

De cloud model hoat dong trong container `ollama`, ban can dang nhap Ollama ngay trong container de cap public key cho instance do. Lam 1 lan:

```bash
docker compose exec ollama ollama signin
```

Sau khi sign in xong, pull cloud model:

```bash
docker compose exec ollama ollama pull gemma4:31b-cloud
```

Sau khi pull xong, chatbot se tu dong dung AI + RAG. Neu chua sign in hoac model cloud chua san sang, chatbot van fallback an toan sang che do khong dung LLM.

Neu ban muon quay lai model local, chi can doi `OLLAMA_MODEL` trong [docker-compose.yml](/d:/PTUD_Project/docker-compose.yml) ve mot model local nhu `llama3.2:3b`, sau do:

```bash
docker compose up -d --build backend
docker compose exec ollama ollama pull llama3.2:3b
```

### Du lieu duoc nap vao DB nhu the nao

Khi `postgres` la volume moi va chua co du lieu runtime:

1. Backend doc 2 file JSON trong `data_json/`
2. Backend seed cac payload nay vao bang `student_raw_records`
3. Metadata runtime nhu account, teacher, config, schedule, notifications duoc luu vao bang `app_runtime_state`

Sau lan seed dau tien:

- backend khong con dung JSON lam nguon runtime nua
- moi lan load du lieu se doc tu PostgreSQL
- JSON chi con vai tro seed ban dau khi DB rong

### Chay lai sau khi sua code

Neu chi restart container voi code da duoc mount/built lai:

```bash
docker compose up -d
```

Neu ban vua sua code backend/frontend va muon build lai image:

```bash
docker compose up --build
```

Neu chi muon build lai mot service:

```bash
docker compose build backend
docker compose build frontend
docker compose up -d backend frontend
```

Neu ban vua doi module chatbot AI hoac config Ollama:

```bash
docker compose up -d ollama backend frontend
```

### Dung project

```bash
docker compose down
```

### Dung va xoa ca database volume

Lenh nay se xoa du lieu PostgreSQL hien tai. Lan chay sau, backend se seed lai 2 file JSON goc vao database.

```bash
docker compose down -v
docker compose up --build
```

## Chay local khong dung Docker

Neu muon chay tay, ban can tu khoi tao PostgreSQL truoc, sau do export `DATABASE_URL` cho backend.

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

## Mau CSV nhap diem

- Cac cot ho tro: `mssv`, `class_section_code`, `diem_thuong_ky_1`, `diem_thuong_ky_2`, `diem_thuc_hanh_1`, `diem_thuc_hanh_2`, `diem_qt`, `diem_gk`, `diem_ck`
- Neu co nhap cac cot `diem_thuong_ky_*` hoac `diem_thuc_hanh_*`, he thong se tu tinh `diem_qt`

## Tai khoan demo

### Sinh vien

1. `23630781` / `23630781`
2. `23630761` / `23630761`

### Quan tri vien

1. `admin` / `admin`

### Giang vien

1. `gvungdung` / `gvungdung`
2. `gvaiml` / `gvaiml`

### Phu huynh

1. `Tran Minh Khang` - MSSV `23630781` - ngay sinh `04/09/2005` - SDT `0912360781`
2. `Le Gia Huy` - MSSV `23630761` - ngay sinh `12/03/2005` - SDT `0912360761`

## Ghi chu

- Nguon du lieu runtime chinh hien tai la PostgreSQL, khong con phu thuoc vao `backend/storage/portal_state.json` khi chay bang Docker
- Hai file trong `data_json/` chi duoc dung de seed mot lan khi DB rong
- Sau khi seed, frontend va backend doc du lieu runtime tu PostgreSQL
- Chatbot AI uu tien lay du lieu hoc tap tu PostgreSQL va tai lieu quy che/chuong trinh khung tu `RAG_docx/`
- Neu dung cloud model cua Ollama, instance `ollama` trong Docker can duoc `ollama signin` truoc khi pull model
- Neu `ollama` chua chay, chua sign in, hoac chua pull model, chatbot van khong crash va se tra loi bang che do fallback
