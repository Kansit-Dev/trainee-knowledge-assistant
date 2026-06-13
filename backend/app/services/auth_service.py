from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.repositories import user_repo


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = user_repo.get_by_username(db, username)
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def login(db: Session, username: str, password: str) -> tuple[User, str] | None:
    user = authenticate_user(db, username, password)
    if user is None:
        return None
    token = create_access_token(subject=user.id)
    return user, token
