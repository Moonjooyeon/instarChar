from __future__ import annotations

import argparse
import asyncio
from pathlib import Path
import sys
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

if __package__ is None:
    sys.path.insert(0, str(Path(__file__).parents[1]))

from app.core.config import get_settings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Backfill the public feed projection in small transactions.")
    parser.add_argument("--after-id", type=UUID)
    parser.add_argument("--batch-size", type=int, default=100)
    return parser


async def backfill_batch(connection: AsyncConnection, after_id: UUID | None, batch_size: int) -> list[UUID]:
    statement = sa.text(_BACKFILL_BATCH_SQL).bindparams(
        sa.bindparam("after_id", type_=postgresql.UUID(as_uuid=True)),
        sa.bindparam("batch_size", type_=sa.Integer()),
    )
    result = await connection.execute(statement, {"after_id": after_id, "batch_size": batch_size})
    return list(result.scalars().all())


async def run(batch_size: int, after_id: UUID | None = None) -> int:
    if batch_size < 1 or batch_size > 1000:
        raise ValueError("batch-size must be between 1 and 1000")
    engine = create_async_engine(get_settings().database_url)
    count = 0
    try:
        while True:
            async with engine.begin() as connection:
                ids = await backfill_batch(connection, after_id, batch_size)
            if not ids:
                return count
            after_id = max(ids)
            count += len(ids)
            print(f"backfilled={count} last_character_id={after_id}")
    finally:
        await engine.dispose()


def main() -> None:
    args = build_parser().parse_args()
    print(f"completed={asyncio.run(run(args.batch_size, args.after_id))}")


_BACKFILL_BATCH_SQL = """
WITH candidates AS (
  SELECT id
  FROM characters
  WHERE (:after_id IS NULL OR id > :after_id)
  ORDER BY id
  LIMIT :batch_size
  FOR UPDATE
)
UPDATE characters AS character
SET posts = character.posts
FROM candidates
WHERE character.id = candidates.id
RETURNING character.id
"""


if __name__ == "__main__":
    main()
