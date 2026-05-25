from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _normalize_multiline_env(value: str) -> str:
    return value.replace("\\n", "\n")


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    database_url: str
    core_api_base_url: str
    core_api_key: str
    core_api_timeout_seconds: float
    secret_key: str
    portal_jwt_secret: str
    portal_jwt_public_key: str
    portal_jwt_issuer: str
    portal_jwt_algorithm: str
    checkin_expire_minutes: int
    allowed_origins: str

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    _load_dotenv()
    return Settings(
        app_name=os.getenv("APP_NAME", "Attendance & Timetable API"),
        api_prefix=os.getenv("API_PREFIX", ""),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:1307@localhost:5432/timetable",
        ),
        core_api_base_url=os.getenv("CORE_API_BASE_URL", "http://localhost:8000"),
        core_api_key=os.getenv("CORE_API_KEY", "dev-internal-secret"),
        core_api_timeout_seconds=float(os.getenv("CORE_API_TIMEOUT_SECONDS", "10")),
        secret_key=os.getenv("SECRET_KEY", "change-me-in-production"),
        portal_jwt_secret=os.getenv("PORTAL_JWT_SECRET", os.getenv("SECRET_KEY", "student-portal-dev-secret")),
        portal_jwt_public_key=_normalize_multiline_env(os.getenv("PORTAL_JWT_PUBLIC_KEY", "")),
        portal_jwt_issuer=os.getenv("PORTAL_JWT_ISSUER", "student-portal"),
        portal_jwt_algorithm=os.getenv("PORTAL_JWT_ALGORITHM", "HS256"),
        checkin_expire_minutes=int(os.getenv("CHECKIN_EXPIRE_MINUTES", "15")),
        allowed_origins=os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
        ),
    )
