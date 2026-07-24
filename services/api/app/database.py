import socket

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings


def database_connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}

    url = make_url(database_url)
    if url.drivername.startswith("postgresql") and url.host:
        try:
            addresses = socket.getaddrinfo(
                url.host,
                url.port or 5432,
                family=socket.AF_INET,
                type=socket.SOCK_STREAM,
            )
        except OSError:
            return {}
        if addresses:
            return {"hostaddr": addresses[0][4][0]}

    return {}


connect_args = database_connect_args(settings.database_url)
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
