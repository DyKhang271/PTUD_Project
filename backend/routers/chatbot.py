from fastapi import APIRouter
from pydantic import BaseModel


class ChatMessage(BaseModel):
    message: str


router = APIRouter(prefix="/api", tags=["chatbot"])


def get_bot_reply(message: str) -> str:
    msg = message.lower().strip()

    if any(kw in msg for kw in ["gpa", "điểm", "diem", "kết quả", "ket qua"]):
        return (
            "📊 GPA tích lũy hiện tại của bạn là 3.20/4.0 (Loại Khá). "
            "Để cải thiện GPA, bạn nên:\n"
            "1. Tập trung vào các môn chuyên ngành có hệ số tín chỉ cao\n"
            "2. Tham gia nhóm học tập để trao đổi kiến thức\n"
            "3. Gặp giảng viên trong giờ office hours để được hướng dẫn thêm\n"
            "4. Ôn tập đều đặn thay vì học dồn trước kỳ thi"
        )

    if any(kw in msg for kw in ["môn học", "mon hoc", "đăng ký", "dang ky", "đăng kí"]):
        return (
            "📚 Dựa trên tiến độ học tập hiện tại, bạn nên đăng ký các môn sau:\n"
            "• Khóa luận tốt nghiệp (10 TC) — Bắt buộc\n"
            "• Thực tập doanh nghiệp (5 TC) — Nên đăng ký sớm\n"
            "• Xử lý ngôn ngữ tự nhiên (3 TC) — Tự chọn, phù hợp với chuyên ngành\n"
            "Lưu ý: Nên đăng ký tối đa 18-20 TC/kỳ để đảm bảo chất lượng học tập."
        )

    if any(kw in msg for kw in ["lộ trình", "lo trinh", "kế hoạch", "ke hoach"]):
        return (
            "🗺️ Lộ trình gợi ý cho các học kỳ còn lại:\n\n"
            "📌 HK2 Năm 4 (hiện tại):\n"
            "• Phát triển ứng dụng (đang học)\n"
            "• Đồ án chuyên ngành (đang học)\n\n"
            "📌 HK Hè hoặc HK kế tiếp:\n"
            "• Khóa luận tốt nghiệp\n"
            "• Thực tập doanh nghiệp\n"
            "• 2-3 môn tự chọn còn lại\n\n"
            "Bạn còn 43 TC cần hoàn thành. Với tốc độ 18 TC/kỳ, cần khoảng 2-3 học kỳ nữa."
        )

    if any(kw in msg for kw in ["rớt", "rot", "học lại", "hoc lai", "nợ", "no"]):
        return (
            "⚠️ Bạn đã rớt môn Toán rời rạc (3 TC) ở HK2 Năm 2 và đã học lại thành công ở HK1 Năm 3 (Đạt loại B). "
            "Hiện tại bạn không còn môn nợ nào.\n\n"
            "Nếu có môn cần học lại, lời khuyên:\n"
            "1. Đăng ký học lại càng sớm càng tốt\n"
            "2. Tìm bạn/nhóm đã qua môn để hỗ trợ\n"
            "3. Tham khảo đề thi cũ và tài liệu ôn tập"
        )

    if any(kw in msg for kw in ["tín chỉ", "tin chi", "tc"]):
        return (
            "📋 Tình trạng tín chỉ của bạn:\n"
            "• Đã hoàn thành: 85/140 TC (60.7%)\n"
            "• Đang học: 6 TC\n"
            "• Còn lại: 49 TC\n"
            "Bạn cần hoàn thành thêm 49 TC nữa để đủ điều kiện tốt nghiệp."
        )

    if any(kw in msg for kw in ["xin chào", "hello", "hi", "chào"]):
        return (
            "👋 Xin chào! Tôi là trợ lý tư vấn học tập AI. "
            "Tôi có thể giúp bạn về:\n"
            "• Thông tin GPA và điểm số\n"
            "• Gợi ý đăng ký môn học\n"
            "• Lộ trình học tập\n"
            "• Tư vấn học lại/cải thiện\n"
            "• Thông tin tín chỉ\n\n"
            "Hãy đặt câu hỏi nhé! 😊"
        )

    return (
        "🤖 Tôi có thể hỗ trợ bạn về các chủ đề sau:\n"
        "• **GPA/Điểm số** — Xem và tư vấn cải thiện\n"
        "• **Môn học/Đăng ký** — Gợi ý môn nên đăng ký\n"
        "• **Lộ trình học tập** — Kế hoạch các kỳ còn lại\n"
        "• **Học lại/Rớt môn** — Tư vấn xử lý\n"
        "• **Tín chỉ** — Kiểm tra tiến độ\n\n"
        "Hãy thử hỏi tôi nhé! Ví dụ: \"GPA của tôi thế nào?\" "
        "hoặc \"Tôi nên đăng ký môn gì?\""
    )


@router.post("/chatbot")
def chat(msg: ChatMessage):
    reply = get_bot_reply(msg.message)
    return {"reply": reply}
