# Database Guide

Thư mục `database/` hiện chỉ giữ phần cơ sở dữ liệu:
- schema PostgreSQL chuẩn hóa
- script import JSON vào PostgreSQL
- script import CSV vào PostgreSQL
- file phụ trợ cho bước khởi tạo dữ liệu

## 1) Cấu trúc thư mục

```text
database/
|-- __init__.py
|-- import_student_csv.py
|-- import_student_json.py
|-- README.md
|-- requirements.txt
`-- schema.sql
```

## 2) Cài dependencies

Từ root project:

```bash
pip install -r database/requirements.txt
```

Hoặc cài thủ công:

```bash
pip install psycopg2-binary
```

## 3) Tạo lại db PostgreSQL nếu chưa cài 


```bash
psql -h localhost -p 5432 -U postgres -d postgres -f database/schema.sql
```

## 4) Import dữ liệu JSON

### Import một file

```bash
python database/import_student_json.py --json data_json/thien_khmt_student_schema.json --host localhost --port 5432 --dbname postgres --user postgres --password postgres
```

### Import nhiều file

```bash
python database/import_student_json.py --json data_json/thien_khmt_student_schema.json data_json/nghia_khdl_student_schema.json --host localhost --port 5432 --dbname postgres --user postgres --password (postgres or mk cài postgre trên máy)
```

### Dùng biến môi trường

```bash
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=postgres
set PGUSER=postgres
set PGPASSWORD=postgres
python database/import_student_json.py --json data_json/thien_khmt_student_schema.json
```

## 5) Ghi chú


- Script import dùng `psycopg2` để ghi trực tiếp vào PostgreSQL.
- Thư mục này không còn chứa API hoặc FastAPI app.

## 6) Import dữ liệu CSV

Script CSV nhận 5 file, mỗi file tương ứng với 1 phần của payload JSON hiện tại. Có thể để nhiều sinh viên trong cùng bộ CSV, script sẽ nhóm theo `student_id`.

### Chạy lệnh

```bash
python database/import_student_csv.py \
  --students-csv data_csv/students.csv \
  --curriculum-summary-csv data_csv/curriculum_summary.csv \
  --curriculum-courses-csv data_csv/curriculum_courses.csv \
  --transcript-terms-csv data_csv/transcript_terms.csv \
  --transcript-courses-csv data_csv/transcript_courses.csv \
  --host localhost --port 5432 --dbname postgres --user postgres --password postgres
```

### Header bắt buộc

`students.csv`

```csv
schema_version,student_id,full_name,class_name,program_name,faculty,education_level,print_date
```

`curriculum_summary.csv`

```csv
student_id,total_required_credits,mandatory_credits,elective_credits,note
```

`curriculum_courses.csv`

```csv
student_id,semester,course_code,course_name,credits,lt_hours,th_hours,elective_group,group_required_credits,prerequisites_raw,passed_in_curriculum,course_type,is_excluded_from_gpa
```

`transcript_terms.csv`

```csv
student_id,term,gpa10_term,gpa4_term,gpa10_cumulative,gpa4_cumulative,registered_credits,earned_credits,passed_credits,outstanding_failed_credits,academic_standing_cumulative,academic_standing_term
```

`transcript_courses.csv`

```csv
student_id,term,class_section_code,course_name,credits,final_score,gpa4,letter,classification,status,midterm_scores
```

### Quy ước dữ liệu CSV

- `student_id` phải xuất hiện trước trong `students.csv`.
- `midterm_scores` trong `transcript_courses.csv` dùng `;` hoặc `|` để ngăn cách, ví dụ `7.5;8.0;9.0`.
- Các cột cho phép rỗng: `group_required_credits`, `prerequisites_raw`, `gpa10_term`, `gpa4_term`, `final_score`, `gpa4`, `letter`, `classification`, `status`, `academic_standing_term`, `midterm_scores`.
- Boolean chấp nhận các giá trị `true/false`, `1/0`, `yes/no`.


# 7) Đọc dữ liệu và chỉnh sửa dữ liệu trên db  
- Mở pgadmin 4 lên đăng nhập Severs -> postgresql -> postgres -> schemas -> tables -> view edit/ data