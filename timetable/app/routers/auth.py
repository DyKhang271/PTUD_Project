from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth_schema import ExternalLoginRequest, ExternalLoginResponse, LoginRequest
from app.services.auth_service import external_login, login_with_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ExternalLoginResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> ExternalLoginResponse:
    username = payload.username or payload.email or ""
    return login_with_credentials(db, payload.role, username, payload.password)


@router.post("/external-login", response_model=ExternalLoginResponse)
def login_with_external_token(payload: ExternalLoginRequest, db: Annotated[Session, Depends(get_db)]) -> ExternalLoginResponse:
    return external_login(db, payload.external_token)
