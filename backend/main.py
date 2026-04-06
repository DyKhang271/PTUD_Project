from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import student, schedule, notifications, grades, curriculum, chatbot, auth

app = FastAPI(title="Student Portal API", version="1.0.0")

# CORS — cho phép frontend ở localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/")
def root():
    return {"message": "Student Portal API is running", "version": "1.0.0"}
