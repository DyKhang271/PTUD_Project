from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import re
import unicodedata

from docx import Document
from pypdf import PdfReader

from .settings import get_chatbot_settings


@dataclass(frozen=True)
class DocumentChunk:
    source: str
    category: str
    program_code: str | None
    text: str


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9\s]", " ", ascii_text.lower())


def _chunk_text(text: str, max_chars: int) -> list[str]:
    segments: list[str] = []
    current = ""
    for raw_paragraph in text.splitlines():
        paragraph = raw_paragraph.strip()
        if not paragraph:
            continue
        if len(current) + len(paragraph) + 1 > max_chars and current:
            segments.append(current.strip())
            current = paragraph
        else:
            current = f"{current}\n{paragraph}".strip()
    if current:
        segments.append(current)
    return segments


def _read_docx(path: Path) -> str:
    document = Document(path)
    return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())


def _read_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(page_text)
    return "\n\n".join(pages)


def _infer_category(path: Path) -> tuple[str, str | None]:
    name = normalize_text(path.stem)
    if "quy che" in name:
        return "policy", None
    if "khmt" in name:
        return "curriculum", "KHMT"
    if "khdl" in name:
        return "curriculum", "KHDL"
    return "general", None


@lru_cache(maxsize=1)
def load_document_chunks() -> tuple[DocumentChunk, ...]:
    settings = get_chatbot_settings()
    chunks: list[DocumentChunk] = []

    for path in sorted(settings.rag_directory.glob("*")):
        if path.suffix.lower() not in {".pdf", ".docx"}:
            continue

        try:
            if path.suffix.lower() == ".docx":
                full_text = _read_docx(path)
            else:
                full_text = _read_pdf(path)
        except Exception:
            continue

        if not full_text.strip():
            continue

        category, program_code = _infer_category(path)
        for segment in _chunk_text(full_text, settings.max_snippet_chars):
            chunks.append(
                DocumentChunk(
                    source=path.name,
                    category=category,
                    program_code=program_code,
                    text=segment,
                )
            )

    return tuple(chunks)
