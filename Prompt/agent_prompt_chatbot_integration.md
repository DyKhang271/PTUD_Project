# Agent Prompt - Tích hợp và nâng cấp AI Chatbot học vụ cho IUH Student Portal

> **Mục tiêu:** Nâng cấp chatbot học vụ trong project hiện tại thành trợ lý AI dùng Ollama + RAG, có khả năng trả lời dựa trên dữ liệu học tập của sinh viên trong PostgreSQL và tài liệu học vụ/chương trình khung trong `RAG_docx`, đồng thời không làm hỏng các chức năng đang chạy của hệ thống.

---

## 1. Bối cảnh project hiện tại

Bạn đang làm việc trong một project portal sinh viên có đặc điểm sau:

- Frontend dùng `React + Vite`
- Backend dùng `FastAPI`
- Dữ liệu học tập của sinh viên được lưu trong `PostgreSQL`
- Tài liệu phục vụ RAG nằm trong thư mục `RAG_docx/`
- Chatbot đã có sẵn ở mức cơ bản và cần được nâng cấp, không phải làm lại từ đầu

Các file/tài nguyên cần đặc biệt lưu ý:

- Backend chatbot hiện có: `backend/routers/chatbot.py`
- Frontend chatbot hiện có: `frontend/src/components/Chatbot/Chatbot.jsx`
- API client hiện có: `frontend/src/services/api.js`
- Tài liệu quy chế học vụ: `RAG_docx/Quy_che_Hoc_vu_IUH.docx`
- Chương trình khung ngành Khoa học máy tính: file có chuỗi `KHMT`
- Chương trình khung ngành Khoa học dữ liệu: file có chuỗi `KHDL`

Ánh xạ ngành sang tài liệu chương trình khung:

- `Khoa học máy tính` -> ưu tiên file chứa `KHMT`
- `Khoa học dữ liệu` -> ưu tiên file chứa `KHDL`

Ví dụ với repo hiện tại:

- `RAG_docx/Thien_KHMT_CtrKhung.pdf` -> dùng cho ngành `Khoa học máy tính`
- `RAG_docx/Nghia_KHDL_CtrKhung.pdf` -> dùng cho ngành `Khoa học dữ liệu`

---

## 2. Nhiệm vụ của bạn

Bạn là AI coding agent. Hãy:

1. Khảo sát code hiện tại trước khi sửa.
2. Nâng cấp chatbot đang có thành chatbot học vụ dùng AI.
3. Tích hợp chatbot AI vào đúng kiến trúc hiện tại của project.
4. Truy xuất dữ liệu từ đúng nguồn:
   - `PostgreSQL` cho dữ liệu học tập, điểm số, tín chỉ, tiến độ học tập
   - `RAG_docx/` cho quy chế học vụ và chương trình khung
5. Giữ tương thích với frontend/backend hiện có nếu có thể.
6. Không phá vỡ login, dashboard, bảng điểm, chương trình khung, teacher, admin.

---

## 3. Nguyên tắc bắt buộc

### 3.1 Không được giả định sai về nguồn dữ liệu

- **Phải coi PostgreSQL là nguồn dữ liệu học tập chính của sinh viên**
- **Không được viết prompt hay code theo giả định dữ liệu học tập đang chạy hoàn toàn bằng JSON**
- Có thể trong repo tồn tại file JSON để import/seed/mock, nhưng khi xây chatbot học vụ thì nguồn dữ liệu học tập cần ưu tiên là PostgreSQL

### 3.2 Không được làm lại chatbot từ đầu nếu không cần

- Chatbot hiện đã có UI và API cơ bản
- Ưu tiên nâng cấp trên nền đang có
- Chỉ thay đổi contract API khi thật sự cần, và nếu thay đổi thì phải cập nhật frontend tương ứng

### 3.3 Không được bịa thông tin

- Chỉ trả lời dựa trên:
  - dữ liệu truy xuất từ PostgreSQL
  - tài liệu trong `RAG_docx/`
- Nếu không tìm thấy dữ liệu hoặc tài liệu liên quan, phải nói rõ là chưa đủ thông tin

### 3.4 Phải có fallback an toàn

Nếu Ollama chưa chạy, model chưa pull, vector store chưa sẵn sàng, hoặc truy xuất lỗi:

- Chatbot không được crash
- API không được vỡ
- Cần có fallback hợp lý:
  - quay về chatbot rule-based cũ, hoặc
  - trả lời thông báo thân thiện rằng hệ thống AI tạm thời chưa sẵn sàng

---

## 4. Bước 0 - Khảo sát repo trước khi code

Trước khi viết code, bạn phải đọc code thực tế để xác nhận:

- frontend đang gọi chatbot qua hàm nào
- endpoint chatbot hiện tại là gì
- request/response hiện tại ra sao
- router chatbot đang được gắn vào `FastAPI` như thế nào
- auth hiện tại đang lấy thông tin user ra sao
- backend hiện đang truy cập PostgreSQL theo cách nào
- schema/bảng dữ liệu học tập nào đã có trong PostgreSQL

Khi khảo sát, hãy ưu tiên tìm:

- nơi cấu hình database connection
- nơi định nghĩa schema hoặc script tạo bảng PostgreSQL
- nơi import dữ liệu từ JSON/CSV vào PostgreSQL
- các API đang dùng để lấy điểm, chương trình khung, hồ sơ sinh viên

Nếu trong repo có nhiều nguồn dữ liệu, hãy ưu tiên nguồn đang được project xác nhận dùng thật cho nghiệp vụ học tập là PostgreSQL.

---

## 5. Hướng kiến trúc phù hợp cho project này

Không dùng prompt/kiến trúc kiểu mẫu quá chung chung. Hãy bám cấu trúc repo hiện có.

Một cấu trúc hợp lý để thêm module chatbot AI là:

```text
backend/
  chatbot/
    __init__.py
    settings.py
    system_prompt.py
    documents.py
    retriever.py
    db_retriever.py
    student_context.py
    llm_client.py
    service.py
    history.py
  routers/
    chatbot.py
```

Ý nghĩa:

- `settings.py`: cấu hình Ollama, model, vector store, đường dẫn tài liệu
- `system_prompt.py`: system prompt học vụ
- `documents.py`: đọc file `.docx` và `.pdf` trong `RAG_docx/`
- `retriever.py`: truy xuất tài liệu RAG
- `db_retriever.py`: truy xuất dữ liệu học tập từ PostgreSQL
- `student_context.py`: chuẩn hóa dữ liệu sinh viên thành context đưa vào prompt
- `llm_client.py`: gọi Ollama
- `service.py`: điều phối toàn bộ pipeline chatbot
- `history.py`: quản lý lịch sử hội thoại nếu cần

Nếu repo đã có nơi phù hợp hơn thì được quyền điều chỉnh, nhưng phải giữ code dễ hiểu và dễ bảo trì.

---

## 6. Quy tắc truy xuất dữ liệu

### 6.1 Dữ liệu từ PostgreSQL

Chatbot phải có khả năng truy xuất các thông tin như:

- hồ sơ sinh viên
- điểm theo học kỳ
- GPA tích lũy
- tín chỉ đã đạt, đang học, còn thiếu
- tiến độ học tập
- thông tin liên quan đến xét tốt nghiệp nếu dữ liệu hiện có cho phép suy ra

Ưu tiên tái sử dụng:

- model, query, service, helper, hoặc API đã có trong project
- schema PostgreSQL đã được định nghĩa trong thư mục `database/`

Không được hardcode dữ liệu học tập nếu đã có thể lấy từ database thật.

### 6.2 Dữ liệu từ RAG_docx

Tài liệu trong `RAG_docx/` là nguồn cho:

- quy chế học vụ
- điều kiện học vụ
- bảo lưu, cảnh báo, điều kiện xét tốt nghiệp theo văn bản
- chương trình khung theo ngành

Khi câu hỏi liên quan chương trình khung, phải ưu tiên chọn tài liệu đúng theo ngành:

- Nếu sinh viên thuộc `Khoa học máy tính` -> ưu tiên file `KHMT`
- Nếu sinh viên thuộc `Khoa học dữ liệu` -> ưu tiên file `KHDL`

Nếu chưa xác định được ngành của sinh viên:

- cố gắng lấy từ PostgreSQL trước
- nếu vẫn chưa có, hỏi lại hoặc trả lời kèm cảnh báo rằng chưa xác định được ngành để chọn đúng chương trình khung

---

## 7. Quy tắc tích hợp backend

Hãy nâng cấp `backend/routers/chatbot.py` theo tinh thần:

1. Tận dụng router hiện có.
2. Ưu tiên giữ nguyên endpoint hiện tại nếu frontend đang dùng ổn định.
3. Nếu cần mở rộng request thì vẫn giữ backward compatibility.
4. Tách logic AI/RAG/database khỏi router, không nhồi toàn bộ vào file router.

Ví dụ request có thể mở rộng thành:

```json
{
  "message": "Em còn bao nhiêu tín chỉ để tốt nghiệp?",
  "student_id": "23630781",
  "role": "student",
  "session_id": "optional"
}
```

Ví dụ response nên tương thích ngược:

```json
{
  "reply": "Bạn còn 49 tín chỉ cần hoàn thành để đủ khối lượng chương trình.",
  "sources": [
    "PostgreSQL: student_progress",
    "RAG_docx/Thien_KHMT_CtrKhung.pdf"
  ],
  "intent": "tot_nghiep"
}
```

Yêu cầu:

- vẫn có trường `reply`
- có thể bổ sung `sources`, `intent`, `has_context`, `metadata`
- không đổi API một cách đột ngột nếu frontend chưa cập nhật

---

## 8. Quy tắc tích hợp frontend

Frontend hiện đã có chatbot UI, vì vậy:

- ưu tiên tái sử dụng `frontend/src/components/Chatbot/Chatbot.jsx`
- ưu tiên tái sử dụng `frontend/src/services/api.js`
- không viết lại toàn bộ widget nếu không cần

Nếu backend cần thêm `student_id`, `role`, `program_name` hoặc thông tin nhận diện user:

- lấy từ context/auth hiện có của frontend
- gửi lên API chatbot một cách rõ ràng
- không mô tả đây là cơ chế bảo mật production nếu thực tế chỉ là demo

Nếu hiển thị nguồn tham khảo:

- giao diện phải gọn
- không làm rối cửa sổ chat
- ưu tiên hiển thị ngắn gọn theo dạng danh sách nguồn hoặc nhãn

---

## 9. Hướng xây pipeline RAG

Pipeline mong muốn:

1. Nhận câu hỏi từ người dùng
2. Xác định intent sơ bộ
3. Xác định có cần truy vấn PostgreSQL, tài liệu RAG, hay cả hai
4. Nếu liên quan dữ liệu cá nhân -> truy vấn PostgreSQL theo đúng sinh viên hiện tại
5. Nếu liên quan quy chế/chương trình khung -> truy xuất tài liệu trong `RAG_docx/`
6. Gộp context
7. Gọi Ollama để sinh câu trả lời
8. Trả về câu trả lời có kiểm soát, có thể kèm nguồn

Các nhóm intent tối thiểu nên hỗ trợ:

- `điểm_số`
- `gpa_tín_chỉ`
- `chương_trình_khung`
- `quy_chế_học_vụ`
- `xét_tốt_nghiệp`
- `bảo_lưu_nghỉ_học`
- `đăng_ký_học_phần`
- `ngoài_phạm_vi`

---

## 10. System prompt nghiệp vụ mong muốn

Chatbot phải tuân thủ các nguyên tắc sau:

- Chỉ hỗ trợ các nội dung liên quan học vụ và học tập
- Ưu tiên chính xác hơn sáng tạo
- Không bịa điều khoản, không bịa dữ liệu
- Không khẳng định chắc chắn các quyết định nhạy cảm nếu dữ liệu chưa đủ
- Nếu câu hỏi liên quan xét tốt nghiệp, bảo lưu, cảnh báo học vụ:
  - phải nói rõ đây là tư vấn tham khảo
  - khuyến nghị xác nhận lại với Phòng Đào tạo nếu cần
- Xưng hô thân thiện, ưu tiên `mình / bạn`
- Trả lời ngắn gọn, rõ ràng, dễ hiểu

Chatbot phải phân biệt rõ 2 loại nguồn:

- **Nguồn hệ thống**: dữ liệu học tập lấy từ PostgreSQL
- **Nguồn tài liệu**: quy chế/chương trình khung lấy từ `RAG_docx/`

Khi phù hợp, câu trả lời nên có dạng:

1. Kết luận chính
2. Giải thích ngắn
3. Nguồn tham khảo

---

## 11. Dependency gợi ý

Nếu backend Python, có thể cân nhắc các dependency sau:

```bash
pip install langchain langchain-community langchain-ollama chromadb pypdf python-docx psycopg2-binary
```

Lưu ý:

- `psycopg2-binary` dùng cho PostgreSQL nếu project chưa có driver phù hợp
- chỉ thêm dependency khi thực sự cần
- ưu tiên giải pháp ổn định, phù hợp đồ án/demo

---

## 12. Trình tự triển khai nên ưu tiên

1. Đọc router chatbot hiện tại.
2. Đọc frontend chatbot hiện tại.
3. Xác định endpoint/API contract đang dùng.
4. Xác định cách backend kết nối PostgreSQL.
5. Xác định schema/bảng cần truy xuất cho chatbot.
6. Đọc tài liệu trong `RAG_docx/`.
7. Xây retriever cho tài liệu.
8. Xây retriever cho PostgreSQL.
9. Ghép vào service chatbot.
10. Gắn service vào router hiện có.
11. Cập nhật frontend nếu cần truyền thêm thông tin sinh viên/ngành.
12. Kiểm tra fallback khi Ollama không sẵn sàng.

---

## 13. Checklist bắt buộc trước khi kết thúc

```text
[ ] Chatbot frontend vẫn mở và gửi tin nhắn bình thường
[ ] API chatbot vẫn hoạt động
[ ] Chatbot không crash khi Ollama lỗi hoặc chưa chạy
[ ] Chatbot trả lời được câu hỏi dựa trên PostgreSQL
[ ] Chatbot trả lời được câu hỏi dựa trên RAG_docx
[ ] Chatbot chọn đúng tài liệu KHMT/KHDL theo ngành khi hỏi chương trình khung
[ ] Không làm hỏng login, dashboard, grades, curriculum, teacher, admin
[ ] Nếu thêm dependency thì file requirements tương ứng đã cập nhật
[ ] Có hướng dẫn chạy ngắn gọn sau khi hoàn thành
```

---

## 14. Những điều không được làm

- Không viết prompt theo giả định project chỉ dùng JSON
- Không bỏ qua PostgreSQL khi truy xuất dữ liệu học tập
- Không chọn sai tài liệu chương trình khung giữa `KHMT` và `KHDL`
- Không đổi endpoint tùy ý nếu chưa sửa frontend
- Không hardcode dữ liệu học tập khi đã có thể truy vấn từ database
- Không trả lời như thể có căn cứ nếu thực tế chưa truy xuất được nguồn
- Không thêm quá nhiều hạ tầng nặng nề nếu không cần cho project này

---

## 15. Đầu ra mong muốn của agent

Sau khi hoàn thành, agent nên để lại:

1. Code đã tích hợp chatbot AI vào project
2. Mô tả ngắn:
   - đã sửa những file nào
   - chatbot đang lấy dữ liệu từ đâu
   - tài liệu RAG nào đang được dùng
   - lệnh cần chạy để sử dụng
3. Các giới hạn còn lại nếu có:
   - Ollama chưa cài hoặc chưa pull model
   - vector store chưa ingest
   - schema PostgreSQL thực tế còn thiếu dữ liệu cho một số loại câu hỏi

---

## 16. Tinh thần thực hiện

Hãy hành động như một coding agent đang nâng cấp một đồ án đã có sẵn:

- bám đúng codebase hiện tại
- tôn trọng kiến trúc hiện có
- sửa vừa đủ nhưng chắc
- ưu tiên ổn định
- dễ demo
- dễ mở rộng về sau

Không làm như đang scaffold một boilerplate hoàn toàn mới.
