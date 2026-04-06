# Project Proposal

## THÔNG TIN

### Nhóm

-   Thành viên 1: Nguyễn Xuân Thiên -- 223630781
-   Thành viên 2: Nguyễn Bá Đức -- 23732881
-   Thành viên 3: Trần Duy Khang -- 23728961
-   Thành viên 4: Nguyễn Viết Minh -- 23724081
-   Thành viên 5: Hoàng Trọng Nghĩa -- 23630761

### Git

Git repository: `<link github repo tại đây>`{=html}

------------------------------------------------------------------------

# MÔ TẢ DỰ ÁN

## Ý tưởng

Hiện nay sinh viên thường gặp nhiều khó khăn khi tìm kiếm thông tin liên
quan đến chương trình đào tạo, môn học, điều kiện tiên quyết và lộ trình
học tập. Những thông tin này thường được cung cấp dưới dạng file PDF,
Excel hoặc website học vụ với cấu trúc phức tạp, khiến sinh viên mất
nhiều thời gian tra cứu.

Dự án này đề xuất xây dựng **Chatbot hỗ trợ sinh viên đăng ký học phần**
sử dụng công nghệ **AI và kiến trúc RAG (Retrieval-Augmented
Generation)**.

Hệ thống cho phép sinh viên đặt câu hỏi bằng ngôn ngữ tự nhiên như:

-   "Môn Trí tuệ nhân tạo có điều kiện tiên quyết không?"
-   "Học kỳ tới tôi nên đăng ký những môn nào?"
-   "Tôi còn thiếu bao nhiêu tín chỉ để tốt nghiệp?"

Chatbot sẽ:

-   Tìm kiếm thông tin trong cơ sở dữ liệu chương trình đào tạo
-   Phân tích ngữ nghĩa câu hỏi của sinh viên
-   Trả lời chính xác và cá nhân hóa theo **ngành, khóa và khoa của sinh
    viên**

So với các hệ thống tra cứu thông thường, hệ thống này có các ưu điểm:

-   Tra cứu thông tin **nhanh và trực quan bằng hội thoại**
-   Giảm thời gian tìm kiếm tài liệu học vụ
-   Câu trả lời **được cá nhân hóa theo hồ sơ sinh viên**
-   Có thể mở rộng thành **trợ lý học vụ thông minh**

------------------------------------------------------------------------

## Chi tiết

Hệ thống gồm hai thành phần chính:

### 1. Hệ thống Chatbot AI

Hệ thống chatbot sẽ sử dụng kiến trúc **RAG** để đảm bảo câu trả lời
chính xác.

Quy trình hoạt động:

1.  Tài liệu học vụ (PDF, Excel, Word) được thu thập.
2.  Hệ thống xử lý dữ liệu và chia nhỏ nội dung thành các đoạn văn bản.
3.  Các đoạn văn bản được chuyển thành vector bằng mô hình embedding.
4.  Vector được lưu vào **Vector Database**.
5.  Khi sinh viên đặt câu hỏi, hệ thống sẽ:
    -   Phân tích câu hỏi
    -   Tìm kiếm các đoạn tài liệu liên quan
    -   Gửi thông tin này vào mô hình AI để tạo câu trả lời.

### 2. Ứng dụng Web cho sinh viên

Ứng dụng web cho phép sinh viên:

-   Đăng ký và đăng nhập
-   Khai báo thông tin cá nhân (khoa, ngành, khóa học)
-   Đặt câu hỏi cho chatbot
-   Xem lịch sử hội thoại

Backend của hệ thống sẽ:

-   Quản lý tài khoản sinh viên
-   Lưu trữ lịch sử chat
-   Gửi yêu cầu đến hệ thống AI
-   Trả kết quả về cho giao diện người dùng

------------------------------------------------------------------------

# PHÂN TÍCH & THIẾT KẾ

## 1. Kiến trúc hệ thống

Hệ thống được thiết kế theo mô hình **Client -- Server -- AI Service**.

### Thành phần chính

1.  **Frontend**
    -   Giao diện web cho sinh viên
    -   Cho phép đăng nhập và chat với chatbot
2.  **Main Backend**
    -   Quản lý người dùng
    -   Quản lý lịch sử hội thoại
    -   Gửi yêu cầu đến AI module
3.  **AI Backend (RAG Engine)**
    -   Lưu trữ dữ liệu học vụ
    -   Tìm kiếm thông tin liên quan
    -   Sinh câu trả lời từ mô hình AI
4.  **Database**
    -   Lưu trữ tài khoản sinh viên
    -   Lưu trữ lịch sử chat
5.  **Vector Database**
    -   Lưu trữ dữ liệu embedding của tài liệu học vụ

------------------------------------------------------------------------

## 2. Thiết kế dữ liệu

### User Table

  | Field     | Type    | Description           |
|-----------|---------|-----------------------|
| id        | int     | ID người dùng         |
| name      | varchar | Tên sinh viên         |
| email     | varchar | Email                 |
| password  | varchar | Mật khẩu đã mã hóa    |
| khoa      | varchar | Khoa                  |
| nganh     | varchar | Ngành                 |
| khoa_hoc  | varchar | Khóa học              |

### Chat History Table

  | Field     | Type     | Description        |
|-----------|----------|--------------------|
| id        | int      | ID                 |
| user_id   | int      | ID sinh viên       |
| message   | text     | Nội dung câu hỏi   |
| response  | text     | Câu trả lời        |
| timestamp | datetime | Thời gian          |

------------------------------------------------------------------------

## 3. Luồng xử lý hệ thống

1.  Sinh viên đăng nhập vào hệ thống.
2.  Sinh viên nhập câu hỏi vào chatbot.
3.  Backend nhận câu hỏi và thông tin hồ sơ sinh viên.
4.  Backend gửi dữ liệu sang AI Module.
5.  AI Module tìm kiếm tài liệu liên quan trong Vector DB.
6.  AI Module gửi dữ liệu vào LLM để tạo câu trả lời.
7.  Backend nhận câu trả lời và hiển thị cho sinh viên.

------------------------------------------------------------------------

# KẾ HOẠCH

## MVP (Minimum Viable Product)

**Deadline: 12.04.2026**

Các chức năng chính của MVP:

1.  Đăng ký và đăng nhập tài khoản
2.  Lưu thông tin hồ sơ sinh viên
3.  Giao diện chatbot cơ bản
4.  Hệ thống RAG đơn giản để tra cứu thông tin môn học
5.  Trả lời câu hỏi về:
    -   môn học
    -   điều kiện tiên quyết
    -   chương trình đào tạo

### Kế hoạch kiểm thử

Các bước kiểm thử:

1.  **Unit Test**
    -   Kiểm tra API
    -   Kiểm tra truy vấn database
2.  **Integration Test**
    -   Kiểm tra kết nối Backend và AI Module
3.  **User Test**
    -   Cho sinh viên thử nghiệm chatbot
    -   Thu thập phản hồi

### Chức năng dự kiến cho Phase tiếp theo

-   Gợi ý lộ trình học tập
-   Gợi ý môn học phù hợp cho học kỳ tiếp theo
-   Hệ thống phân tích tiến độ học tập
-   Dashboard quản lý cho admin

------------------------------------------------------------------------

## Beta Version

Nội dung Beta:

-   Hoàn thiện giao diện chatbot
-   Cải thiện độ chính xác của RAG
-   Tối ưu tốc độ truy vấn

### Kết quả kiểm thử

-   Kiểm thử với nhiều loại câu hỏi
-   Đánh giá độ chính xác của chatbot
-   Ghi nhận lỗi và cải thiện hệ thống

### Báo cáo

-   Báo cáo kết quả test
-   Phân tích hiệu năng hệ thống
-   Đánh giá khả năng mở rộng


