from fastapi import HTTPException, status
from sqlalchemy.orm import Session


def external_login(db: Session, external_token: str):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Timetable no longer exchanges external tokens. Use Student Portal JWT directly.",
    )


def login_with_credentials(db: Session, role: str, username: str, password: str):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Timetable no longer authenticates credentials. Log in via Student Portal and use its JWT.",
    )
