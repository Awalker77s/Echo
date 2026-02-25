from logging.config import fileConfig

from alembic import context
from decouple import config
from sqlalchemy import engine_from_config, pool

from app.db.models import Base

config_obj = context.config

if config_obj.config_file_name is not None:
    fileConfig(config_obj.config_file_name)

database_url = config("DATABASE_URL", default=config_obj.get_main_option("sqlalchemy.url"))
config_obj.set_main_option("sqlalchemy.url", database_url.replace("+asyncpg", "+psycopg2"))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config_obj.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config_obj.get_section(config_obj.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
