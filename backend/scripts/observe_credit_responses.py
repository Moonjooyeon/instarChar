from __future__ import annotations

import asyncio
import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import RowMapping

from app.db.session import AsyncSessionLocal


REPORT_QUERY = text("""
SELECT status,
       prompt_version,
       count(*) AS total_rows,
       count(*) FILTER (WHERE response_body <> '{}'::jsonb) AS non_empty_rows,
       coalesce(sum(pg_column_size(response_body)) FILTER (WHERE response_body <> '{}'::jsonb), 0) AS total_bytes,
       coalesce(round(avg(pg_column_size(response_body)) FILTER (WHERE response_body <> '{}'::jsonb)), 0) AS average_bytes,
       coalesce(max(pg_column_size(response_body)) FILTER (WHERE response_body <> '{}'::jsonb), 0) AS maximum_bytes,
       count(*) FILTER (WHERE response_body <> '{}'::jsonb AND created_at <= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS rows_older_24h,
       count(*) FILTER (WHERE response_body <> '{}'::jsonb AND created_at <= CURRENT_TIMESTAMP - INTERVAL '72 hours') AS rows_older_72h,
       count(*) FILTER (WHERE response_body <> '{}'::jsonb AND created_at <= CURRENT_TIMESTAMP - INTERVAL '7 days') AS rows_older_7d,
       min(created_at) FILTER (WHERE response_body <> '{}'::jsonb) AS oldest_created_at
FROM credit_usages
GROUP BY status, prompt_version
ORDER BY status, prompt_version
""")


def report_payload(row: RowMapping) -> dict[str, object]:
    return {"status": str(row["status"]), "prompt_version": str(row["prompt_version"]), "total_rows": int(row["total_rows"]), "non_empty_rows": int(row["non_empty_rows"]), "total_bytes": int(row["total_bytes"]), "average_bytes": int(row["average_bytes"]), "maximum_bytes": int(row["maximum_bytes"]), "rows_older_24h": int(row["rows_older_24h"]), "rows_older_72h": int(row["rows_older_72h"]), "rows_older_7d": int(row["rows_older_7d"]), "oldest_created_at": timestamp_text(row["oldest_created_at"])}


def timestamp_text(value: object) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


async def report() -> None:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(REPORT_QUERY)).mappings().all()
    if not rows:
        print('{"credit_response_groups": []}')
        return
    for row in rows:
        print(json.dumps(report_payload(row), ensure_ascii=False, sort_keys=True))


def main() -> None:
    asyncio.run(report())


if __name__ == "__main__":
    main()
