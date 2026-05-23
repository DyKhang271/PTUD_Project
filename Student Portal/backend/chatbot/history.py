from __future__ import annotations

from collections import defaultdict, deque


_SESSION_HISTORY: dict[str, deque[dict[str, str]]] = defaultdict(lambda: deque(maxlen=12))


def get_session_history(session_id: str | None, limit: int = 6) -> list[dict[str, str]]:
    if not session_id:
        return []
    history = list(_SESSION_HISTORY.get(session_id, ()))
    if limit <= 0:
        return history
    return history[-limit:]


def append_session_message(session_id: str | None, role: str, text: str) -> None:
    if not session_id or not text:
        return
    _SESSION_HISTORY[session_id].append({"role": role, "text": text})
