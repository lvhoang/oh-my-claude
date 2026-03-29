# Python FastAPI — CLAUDE.md

## Stack

- **Python 3.11+**
- **FastAPI** — async web framework with automatic OpenAPI docs
- **Pydantic v2** — validation, serialization, settings management
- **SQLAlchemy 2.x (async)** — ORM with `AsyncSession`
- **Alembic** — database migrations
- **pytest + pytest-asyncio** — testing
- **ruff** — linting + formatting (replaces black, isort, flake8)
- **uv** — package manager (preferred over pip/poetry)

---

## Project Structure

```
my-api/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app factory
│   ├── config.py        # Settings (Pydantic BaseSettings)
│   ├── database.py      # AsyncEngine, AsyncSession
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic request/response schemas
│   ├── routers/         # APIRouter modules
│   ├── services/        # Business logic (not in routers)
│   └── dependencies.py  # FastAPI Depends() helpers
├── tests/
│   ├── conftest.py      # pytest fixtures
│   └── test_*.py
├── alembic/
├── pyproject.toml
└── .env
```

---

## FastAPI App Factory

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.routers import users, items
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # cleanup on shutdown


def create_app() -> FastAPI:
    app = FastAPI(
        title="My API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.include_router(users.router, prefix="/users", tags=["users"])
    app.include_router(items.router, prefix="/items", tags=["items"])
    return app


app = create_app()
```

---

## Settings (Pydantic BaseSettings)

```python
# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite+aiosqlite:///./dev.db"
    secret_key: str = "change-me-in-production"
    debug: bool = False
    allowed_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
```

---

## Pydantic v2 Schemas

```python
# app/schemas/user.py
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)  # replaces orm_mode

    id: int
    created_at: datetime
    is_active: bool


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
```

---

## SQLAlchemy 2.x Async

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(settings.database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

```python
# app/models/user.py
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

---

## Routers

```python
# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.user import UserCreate, UserRead
from app.services import user_service

router = APIRouter()


@router.get("/", response_model=list[UserRead])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_users(db, skip=skip, limit=limit)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await user_service.get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    return await user_service.create_user(db, payload)


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

---

## Services (Business Logic)

```python
# app/services/user_service.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password


async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
    result = await db.execute(select(User).offset(skip).limit(limit))
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, payload: UserCreate) -> User:
    user = User(
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

---

## Testing with pytest

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    AsyncSession = async_sessionmaker(db_engine, expire_on_commit=False)
    async with AsyncSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

```python
# tests/test_users.py
import pytest


@pytest.mark.asyncio
async def test_create_user(client):
    response = await client.post("/users/", json={
        "email": "test@example.com",
        "name": "Test User",
        "password": "secret123",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_duplicate_user(client):
    payload = {"email": "dup@example.com", "name": "Dup", "password": "secret"}
    await client.post("/users/", json=payload)
    response = await client.post("/users/", json=payload)
    assert response.status_code == 409
```

---

## Tooling Config

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
ignore = ["E501"]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

## Dev Commands

```bash
uv sync                         # install dependencies
uv run fastapi dev app/main.py  # dev server with hot reload
uv run pytest                   # run tests
uv run ruff check .             # lint
uv run ruff format .            # format
uv run alembic upgrade head     # apply migrations
uv run alembic revision --autogenerate -m "add users table"
```

---

## Conventions

- **Never put business logic in routers** — use services
- **All DB operations are async** — never use `session.execute()` synchronously
- **Use `response_model`** on every endpoint — explicit output schema
- **Raise `HTTPException`** in routers, not services (services return `None` on not-found)
- **Environment config via `.env`** — never hardcode secrets
- **One Alembic migration per PR** — keep migrations small and reviewable
- **`model_config = ConfigDict(from_attributes=True)`** — required in Pydantic v2 for ORM models
