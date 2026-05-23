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


@dataclass(frozen=True)
class Settings:
    app_name: str
    api_prefix: str
    database_url: str
    core_api_base_url: str
    core_api_key: str
    core_api_timeout_seconds: float
    secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
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
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "240")),
        checkin_expire_minutes=int(os.getenv("CHECKIN_EXPIRE_MINUTES", "15")),
        allowed_origins=os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
        ),
    )
