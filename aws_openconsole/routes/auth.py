from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DbSession

from aws_openconsole.database import get_db
from aws_openconsole.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut
from aws_openconsole.services import auth_service
from aws_openconsole.utils.security import create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: DbSession = Depends(get_db)) -> TokenOut:
    user = auth_service.register_user(db, data)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: DbSession = Depends(get_db)) -> TokenOut:
    user = auth_service.authenticate_user(db, data)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user=Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
