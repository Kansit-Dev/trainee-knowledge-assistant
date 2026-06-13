from sqlalchemy.orm import Session

from app.models.user import User


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, username: str, password_hash: str, display_name: str | None = None) -> User:
    user = User(username=username, password_hash=password_hash, display_name=display_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
