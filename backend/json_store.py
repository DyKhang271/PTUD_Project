from __future__ import annotations

import json
import os
from copy import deepcopy
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import Json
except ImportError:  # pragma: no cover - local fallback when postgres deps are absent
    psycopg2 = None
    Json = None


BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
STATE_FILE = STORAGE_DIR / "portal_state.json"

RUNTIME_STATE_KEYS = (
    "account_metadata",
    "system_config",
    "teacher_users",
    "schedule_db",
    "notifications_db",
)


def is_database_store_enabled() -> bool:
    return bool(os.getenv("DATABASE_URL"))


def _connect_database():
    if psycopg2 is None or Json is None:
        raise RuntimeError("psycopg2-binary is required to use PostgreSQL persistence.")
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _ensure_database_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS app_runtime_state (
                state_key TEXT PRIMARY KEY,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS student_raw_records (
                student_id TEXT PRIMARY KEY,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    conn.commit()


def _load_runtime_state_from_database() -> dict:
    with _connect_database() as conn:
        _ensure_database_schema(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT state_key, payload::text FROM app_runtime_state;")
            runtime_entries = {
                key: json.loads(payload_text)
                for key, payload_text in cur.fetchall()
            }
            cur.execute("SELECT student_id, payload::text FROM student_raw_records;")
            raw_student_db = {
                student_id: json.loads(payload_text)
                for student_id, payload_text in cur.fetchall()
            }

    if not runtime_entries and not raw_student_db:
        return {}

    return {
        "account_metadata": runtime_entries.get("account_metadata", {}),
        "raw_student_db": raw_student_db,
        "system_config": runtime_entries.get("system_config", {}),
        "teacher_users": runtime_entries.get("teacher_users", {}),
        "schedule_db": runtime_entries.get("schedule_db", []),
        "notifications_db": runtime_entries.get("notifications_db", []),
    }


def _save_runtime_state_to_database(
    *,
    account_metadata: dict,
    raw_student_db: dict,
    system_config: dict | None = None,
    teacher_users: dict | None = None,
    schedule_db: list | None = None,
    notifications_db: list | None = None,
) -> None:
    runtime_payload = {
        "account_metadata": deepcopy(account_metadata),
        "system_config": deepcopy(system_config or {}),
        "teacher_users": deepcopy(teacher_users or {}),
        "schedule_db": deepcopy(schedule_db if schedule_db is not None else []),
        "notifications_db": deepcopy(notifications_db if notifications_db is not None else []),
    }

    with _connect_database() as conn:
        _ensure_database_schema(conn)
        with conn.cursor() as cur:
            for key, value in runtime_payload.items():
                cur.execute(
                    """
                    INSERT INTO app_runtime_state (state_key, payload, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (state_key) DO UPDATE
                    SET payload = EXCLUDED.payload,
                        updated_at = NOW();
                    """,
                    (key, Json(value)),
                )

            if raw_student_db:
                cur.execute(
                    "DELETE FROM student_raw_records WHERE student_id <> ALL(%s);",
                    (list(raw_student_db.keys()),),
                )
            else:
                cur.execute("DELETE FROM student_raw_records;")

            for student_id, payload in raw_student_db.items():
                cur.execute(
                    """
                    INSERT INTO student_raw_records (student_id, payload, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (student_id) DO UPDATE
                    SET payload = EXCLUDED.payload,
                        updated_at = NOW();
                    """,
                    (student_id, Json(deepcopy(payload))),
                )
        conn.commit()


def load_runtime_state() -> dict:
    if is_database_store_enabled():
        return _load_runtime_state_from_database()

    if not STATE_FILE.exists():
        return {}
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))


def save_runtime_state(
    *,
    account_metadata: dict,
    raw_student_db: dict,
    system_config: dict = None,
    teacher_users: dict = None,
    schedule_db: list = None,
    notifications_db: list = None,
) -> None:
    if is_database_store_enabled():
        _save_runtime_state_to_database(
            account_metadata=account_metadata,
            raw_student_db=raw_student_db,
            system_config=system_config,
            teacher_users=teacher_users,
            schedule_db=schedule_db,
            notifications_db=notifications_db,
        )
        return

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
