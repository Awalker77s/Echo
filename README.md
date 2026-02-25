# Echo

FastAPI backend scaffold for Echo (AI passive mood journaling app) with async SQLAlchemy + PostgreSQL.

## Included
- JWT auth integration hooks for Supabase (`register`, `login`, `get_current_user`)
- Presigned upload flow for Cloudflare R2 (`POST /api/v1/upload`)
- Protected check-in and entries endpoints
- SQLAlchemy 2.0 async models + CRUD layer
- Alembic initial migration
- APScheduler cleanup job for deleting objects older than 1 hour
- Docker Compose for API + PostgreSQL

## Environment
Copy `.env.example` to `.env` and fill Supabase/R2 credentials.

## Run with Docker
```bash
docker compose up --build
```

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

## Test
```bash
pytest -q
```
