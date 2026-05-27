from fastapi import APIRouter
from pydantic import BaseModel

from chatbot.service import get_chatbot_service


class ChatMessage(BaseModel):
    message: str
    student_id: str | None = None
    role: str | None = None
    session_id: str | None = None
    program_name: str | None = None


router = APIRouter(prefix="/api", tags=["chatbot"])


@router.post("/chatbot")
def chat(msg: ChatMessage):
    result = get_chatbot_service().chat(
        message=msg.message,
        student_id=msg.student_id,
        role=msg.role,
        session_id=msg.session_id,
        program_name=msg.program_name,
    )
    return {
        "reply": result.reply,
        "sources": result.sources,
        "intent": result.intent,
        "has_context": result.has_context,
        "metadata": result.metadata,
    }
