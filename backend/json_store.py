from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
STATE_FILE = STORAGE_DIR / "portal_state.json"


def load_runtime_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save_runtime_state(*, account_metadata: dict, raw_student_db: dict, system_config: dict = None, teacher_users: dict = None, schedule_db: list = None, notifications_db: list = None) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "account_metadata": deepcopy(account_metadata),
        "raw_student_db": deepcopy(raw_student_db),
        "system_config": deepcopy(system_config or {}),
        "teacher_users": deepcopy(teacher_users or {}),
        "schedule_db": deepcopy(schedule_db if schedule_db is not None else []),
        "notifications_db": deepcopy(notifications_db if notifications_db is not None else []),
    }
    STATE_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
