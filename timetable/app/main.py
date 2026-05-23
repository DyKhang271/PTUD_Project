from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import admin, admin_import, auth, core_debug, inspect, student, teacher

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(student.router)
app.include_router(teacher.router)
app.include_router(admin.router)
app.include_router(admin_import.router)
app.include_router(core_debug.router)
app.include_router(inspect.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Attendance & Timetable API is running", "version": "0.1.0"}
