from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class ChatbotSettings:
    ollama_base_url: str
    ollama_model: str
    ollama_timeout_seconds: int
    rag_directory: Path
    max_history_messages: int
    max_document_snippets: int
    max_snippet_chars: int
    ai_enabled: bool


@lru_cache(maxsize=1)
def get_chatbot_settings() -> ChatbotSettings:
    backend_dir = Path(__file__).resolve().parent.parent
    project_root = backend_dir.parent
    rag_directory = Path(os.getenv("RAG_DOCUMENTS_DIR", project_root / "RAG_docx"))

    return ChatbotSettings(
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/"),
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
        ollama_timeout_seconds=int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180")),
        rag_directory=rag_directory,
        max_history_messages=int(os.getenv("CHATBOT_HISTORY_LIMIT", "6")),
        max_document_snippets=int(os.getenv("CHATBOT_RAG_TOP_K", "4")),
        max_snippet_chars=int(os.getenv("CHATBOT_SNIPPET_CHARS", "900")),
        ai_enabled=os.getenv("CHATBOT_AI_ENABLED", "1") != "0",
    )
