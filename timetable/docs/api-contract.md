# Timetable MVP API Contract

Các API dưới đây là contract tối thiểu cho frontend MVP của `timetable`. Role được kiểm tra bằng JWT do chính backend `timetable` phát hành.

## 1. POST `/auth/login`
- Role: public
- Mục đích: đăng nhập bằng credential đang có ở Student Portal, sau đó `timetable` tự verify và phát JWT riêng.
- Request mẫu:

```json
{
  "role": "teacher",
  "username": "gvungdung",
  "password": "gvungdung"
}
```

- Response mẫu:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "external_id": "gvungdung",
    "role": "teacher",
    "full_name": "ThS. Nguyen Hoang Anh"
  }
}
```

- Lỗi có thể gặp:
  - `400`: role không hợp lệ hoặc thiếu trường
  - `401`: sai tài khoản/mật khẩu
  - `502`: không kết nối được Student Portal

## 2. GET `/student/timetable`
- Role: `student`
- Mục đích: lấy thời khóa biểu của sinh viên đăng nhập.
- Query:
  - `date_from` tùy chọn
  - `date_to` tùy chọn
- Response mẫu:

```json
[
  {
    "section_id": "b1f2...",
    "course_code": "4203001146",
    "course_name": "He co so du lieu",
    "section_code": "420300114601",
    "teacher_external_id": "gvaiml",
    "teacher_name": "TS. Tran Minh Quan",
    "timetable_entry_id": "d8c1...",
    "day_of_week": 2,
    "date": "2026-05-22",
    "start_time": "07:00:00",
    "end_time": "09:30:00",
    "room": "A2.01",
    "location": null,
    "session_type": "study",
    "note": null
  }
]
```

- Lỗi:
  - `401`: token không hợp lệ/hết hạn
  - `403`: role không phải student

## 3. GET `/student/exams`
- Role: `student`
- Mục đích: lấy lịch thi.
- Response mẫu:

```json
[
  {
    "id": "c9d3...",
    "section_id": "b1f2...",
    "exam_date": "2026-06-02",
    "start_time": "09:00:00",
    "end_time": "10:30:00",
    "room": "B3.04",
    "location": null,
    "exam_type": "final",
    "note": null,
    "created_at": "2026-05-14T00:18:00Z"
  }
]
```

## 4. GET `/student/attendance-history`
- Role: `student`
- Mục đích: lấy lịch sử điểm danh.
- Response mẫu:

```json
[
  {
    "session_id": "e6f4...",
    "section_id": "b1f2...",
    "course_code": "4203001146",
    "course_name": "He co so du lieu",
    "section_code": "420300114601",
    "session_date": "2026-05-20",
    "start_time": "07:00:00",
    "end_time": "09:30:00",
    "status": "present",
    "checkin_time": "2026-05-20T07:05:10Z",
    "method": "qr",
    "note": null
  }
]
```

## 5. GET `/teacher/sections`
- Role: `teacher`
- Mục đích: lấy danh sách lớp học phần giảng viên phụ trách.
- Response mẫu:

```json
[
  {
    "id": "b1f2...",
    "term_id": "a4c5...",
    "course_code": "4203001146",
    "course_name": "He co so du lieu",
    "section_code": "420300114601",
    "teacher_external_id": "gvaiml",
    "faculty": "Bo mon Tri tue nhan tao",
    "total_sessions": null,
    "status": "active",
    "created_at": "2026-05-14T00:18:00Z",
    "updated_at": "2026-05-14T00:18:00Z"
  }
]
```

## 6. POST `/teacher/attendance-sessions`
- Role: `teacher`
- Mục đích: tạo phiên điểm danh nháp cho một lớp học phần.
- Request mẫu:

```json
{
  "section_id": "b1f2...",
  "timetable_entry_id": "d8c1...",
  "session_date": "2026-05-22",
  "start_time": "07:00:00",
  "end_time": "09:30:00",
  "note": "Buoi hoc ly thuyet"
}
```

- Response mẫu:

```json
{
  "id": "e6f4...",
  "section_id": "b1f2...",
  "timetable_entry_id": "d8c1...",
  "session_date": "2026-05-22",
  "start_time": "07:00:00",
  "end_time": "09:30:00",
  "status": "draft",
  "checkin_expires_at": null,
  "created_by_external_id": "gvaiml",
  "created_at": "2026-05-22T07:00:00Z",
  "opened_at": null,
  "closed_at": null,
  "note": "Buoi hoc ly thuyet"
}
```

## 7. GET `/teacher/attendance-sessions/{id}`
- Role: `teacher`, `admin`
- Mục đích: lấy thông tin một phiên điểm danh.
- Lỗi:
  - `404`: không tìm thấy phiên
  - `403`: giảng viên không sở hữu lớp của phiên đó

## 8. PATCH `/teacher/attendance-sessions/{id}/close`
- Role: `teacher`
- Mục đích: đóng phiên điểm danh.
- Response: trả về `AttendanceSessionRead`.

## 9. GET `/teacher/attendance-sessions/{id}/records`
- Role: `teacher`, `admin`
- Mục đích: lấy danh sách bản ghi điểm danh của phiên.
- Response mẫu:

```json
[
  {
    "id": "f7a8...",
    "session_id": "e6f4...",
    "student_external_id": "23630781",
    "status": "late",
    "checkin_time": "2026-05-22T07:17:00Z",
    "method": "code",
    "device_info": null,
    "ip_address": "127.0.0.1",
    "note": null,
    "updated_by_external_id": "23630781",
    "updated_at": "2026-05-22T07:17:00Z",
    "full_name": "Nguyen Van A"
  }
]
```

## 10. PATCH `/teacher/attendance-records/{id}`
- Role: `teacher`, `admin`
- Mục đích: cập nhật trạng thái thủ công theo `record_id`.
- Request mẫu:

```json
{
  "status": "excused",
  "note": "Sinh vien xin phep"
}
```

- Lỗi:
  - `400`: trạng thái không hợp lệ
  - `404`: không tìm thấy record
  - `403`: không có quyền trên lớp học phần

## 11. GET `/admin/course-sections`
- Role: `admin`
- Mục đích: lấy danh sách lớp học phần.

## 12. POST `/admin/import`
- Role: `admin`
- Mục đích: import lớp học phần từ Student Portal.
- Request mẫu:

```json
{
  "term": "HK2 (2025 - 2026)",
  "class_name": null,
  "student_id": null,
  "limit": 100
}
```

## 13. GET `/admin/terms`
- Role: `admin`
- Mục đích: lấy danh sách học kỳ.

## 14. GET `/admin/policies`
- Role: `admin`
- Mục đích: lấy danh sách policy điểm danh.

## Ghi chú endpoint tương thích
- Backend vẫn giữ các endpoint gốc như `/teacher/me/sections`, `/teacher/sections/{section_id}/attendance-sessions`, `/student/me/...`
- Frontend MVP mới ưu tiên dùng các endpoint alias ngắn hơn để dễ đọc và dễ tài liệu hóa.
