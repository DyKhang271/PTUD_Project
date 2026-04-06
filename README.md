# IUH Student Portal & AI Academic Assistant 🎓

Chào mừng đến với **Cổng thông tin Sinh viên IUH**, một giải pháp phần mềm toàn diện kết hợp cùng hệ thống **Trợ lý Ảo AI (Chatbot)**, được thiết kế nhằm mang lại trải nghiệm quản lý học tập tối ưu, trực quan và cá nhân hóa cho sinh viên.

---

## 🌟 Dự án mang lại giá trị gì cho Sinh Viên?

Hiện nay, sinh viên thường phải đối mặt với khó khăn khi tra cứu thông tin học vụ qua các website phức tạp hoặc các file Excel/PDF khô khan. Cổng thông tin (Student Portal) này được thiết kế theo hướng hiện đại nhằm giải quyết bài toán đó, cung cấp hai luồng tiện ích chính: **Quản lý Học vụ Trực quan** và **Tư vấn Học vụ Thông minh bằng AI**.

### 1. Hệ thống Quản lý Học vụ Trực quan
Ứng dụng Web Portal cung cấp đầy đủ các nhu cầu theo dõi học tập một cách dễ nhìn, dễ tiếp cận nhất:
- **Trang chủ (Dashboard) thông minh**: Theo dõi nhanh điểm GPA, tiến độ hoàn thành tín chỉ, số tín chỉ còn nợ. Lịch học được hiển thị to, rõ ràng, phân rạch ròi theo ca Sáng/Chiều giúp chuẩn bị tốt nhất cho ngày học mới.
- **Tiện ích Thông báo**: Hệ thống thu thập và sắp xếp các thông báo theo độ quan trọng, nhắc nhở sinh viên đóng học phí hay đăng ký môn học tránh trễ hạn.
- **Hồ sơ Cá nhân**: Nơi lưu giữ thông tin sinh viên, khoa, khóa học, và phương thức liên lạc.
- **Theo dõi Điểm số & Chương trình khung**: Liệt kê trực quan các môn đã học, môn chưa học, giúp sinh viên nhận thức được vị trí trong lộ trình tiến tới tốt nghiệp.
- **Cổng Phụ Huynh**: Hỗ trợ phụ huynh có tài khoản riêng để theo dõi tiến độ của con em mình (chỉ xem được Hồ sơ, Lịch học và Điểm số, bảo mật an toàn bằng hệ thống CAPTCHA).

---

### 2. Trợ lý Học vụ AI - Chatbot Đăng ký học phần (Core Feature)
Mỗi sinh viên sẽ được trang bị một chatbot AI đồng hành suốt quá trình học. Xây dựng dựa trên kiến trúc **RAG (Retrieval-Augmented Generation)**, chatbot là "chuyên gia" cung cấp tư vấn dựa vào kho dữ liệu quy chế thật của nhà trường:
* **Tra cứu bằng Ngôn ngữ Tự nhiên**: Sinh viên có thể hỏi trực tiếp như nhắn tin với người thật:
  - *"Môn Trí tuệ nhân tạo có điều kiện tiên quyết không?"*
  - *"Học kỳ tới tôi nên đăng ký những môn nào để kịp tiến độ?"*
  - *"Tôi còn thiếu bao nhiêu tín chỉ tự chọn để đủ điều kiện làm khóa luận?"*
* **Tư vấn Cá nhân hóa**: AI đọc cấu hình của chính SV đó (thuộc khóa nào, khoa nào, ngành gì) và tự động khoanh vùng câu trả lời chính xác và cá nhân hóa nhất, tránh việc sinh viên xem nhầm quy chế của khoa khác.
* **Tự động trích xuất thông tin gốc**: Giảm đến 90% thời gian lục lọi các file PDF, Excel của phòng Đào tạo. 

> Thay vì tự mình bơi trong ma trận "Môn học trước", "Môn song hành", sinh viên chỉ việc hỏi và nhận câu trả lời cùng gợi ý lộ trình học tập tức thì.

---

## 🏗 Kiến trúc & Công nghệ

Dự án phát triển theo mô hình **Client – Server – AI Service**, đáp ứng tốc độ cao và mở rộng dễ dàng:

- **Frontend (Tương tác Sinh viên)**:
  - **React.js + Vite**: Cung cấp giao diện SPA (Single Page Application) mượt mà, phản hồi ngay lập tức.
  - **CSS Modules / Glassmorphism**: Thiết kế UI sang trọng, hiện đại không bị trùng lặp, hiệu ứng đẹp mắt trên mọi thiết bị (Responsive).
- **Backend (Quản lý Data & Giao tiếp AI)**:
  - **Python / FastAPI**: Xử lý logic nghiệp vụ, quản lý phiên làm việc, chuẩn bị triển khai hiệu năng cao.
- **AI Core (Hệ thống RAG)**:
  - Vector Database lưu trữ các Embedding của tài liệu chương trình đào tạo nhà trường.
  - LLM Module đảm nhiệm xử lý ngôn ngữ tự nhiên, phân tích ngữ nghĩa và sinh câu trả lời mượt mà, thông minh.

---

## 🚀 Hướng dẫn Cài đặt & Chạy (Development)

Dự án hiện đang chạy mô phỏng Mock Data (chưa cần Database SQL để test) ở cả 2 phần: Frontend và Backend.

### 1. Khởi chạy Backend (Port 8000)
Mở terminal và trỏ vào thư mục `backend/`:
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Khởi chạy Frontend (Port 5173)
Mở terminal và trỏ vào thư mục `frontend/`:
```bash
cd frontend
npm install
npm run dev
```

### 3. Đăng nhập hệ thống (Demo)
Truy cập `http://localhost:5173`. Tài khoản cấp sẵn:
- **Tab Sinh viên**:
  - MSSV: `21110001` | Mật khẩu: `123456`
- **Tab Phụ huynh**:
  - Tên: `Nguyễn Văn An` | MSSV: `21110001` | Ngày sinh: `15/03/2003` | SĐT: `0901234567`

*(Lưu ý điền đúng mã CAPTCHA hiển thị trên màn hình)*

---

## 👥 Đội ngũ Phát triển
- **Thành viên 1**: Nguyễn Xuân Thiên (223630781)
- **Thành viên 2**: Nguyễn Bá Đức (23732881)
- **Thành viên 3**: Trần Duy Khang (23728961)
- **Thành viên 4**: Nguyễn Viết Minh (23724081)
- **Thành viên 5**: Hoàng Trọng Nghĩa (23630761)