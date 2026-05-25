from __future__ import annotations

from pydantic import BaseModel, model_validator


class LoginRequest(BaseModel):
    role: str
    username: str | None = None
    email: str | None = None
    password: str

    @model_validator(mode="after")
    def validate_identity(self):
        if not (self.username or self.email):
            raise ValueError("username or email is required")
        return self


class ExternalLoginRequest(BaseModel):
    external_token: str


class AuthUser(BaseModel):
    external_id: str
    role: str
    full_name: str | None = None


class ExternalLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser
