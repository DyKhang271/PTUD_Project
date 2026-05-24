from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", deprecated=True)
def login() -> None:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Timetable no longer issues JWT. Log in via Student Portal and send its access_token as Bearer token.",
    )


@router.post("/external-login", deprecated=True)
def login_with_external_token() -> None:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Timetable no longer exchanges external tokens. Use Student Portal JWT directly.",
    )
