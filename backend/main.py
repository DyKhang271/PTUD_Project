import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import student, schedule, notifications, grades, curriculum, chatbot, auth, admin, teacher

app = FastAPI(title="Student Portal API", version="1.0.0")

# CORS — cho phép frontend ở localhost:5173
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:5173", "http://localhost:8080"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(student.router)
app.include_router(schedule.router)
app.include_router(notifications.router)
app.include_router(grades.router)
app.include_router(curriculum.router)
app.include_router(chatbot.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(teacher.router)


@app.get("/")
def root():
    return {"message": "Student Portal API is running", "version": "1.0.0"}
