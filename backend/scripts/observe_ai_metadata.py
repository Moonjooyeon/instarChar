from __future__ import annotations

import asyncio
import json
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import RowMapping

from app.core.ai_prompt_policy import AI_PROMPT_VERSION
from app.db.session import AsyncSessionLocal


REPORT_QUERY = text("""
SELECT status,
       prompt_version,
       count(*) AS total_rows,
       count(*) FILTER (WHERE NOT usage_metadata_complete) AS metadata_incomplete_rows,
       count(*) FILTER (WHERE provider_cost_usd = 0) AS zero_provider_cost_rows,
       count(*) FILTER (WHERE NOT usage_metadata_complete OR provider_cost_usd = 0) AS anomaly_rows,
       min(created_at) AS oldest_created_at,
       max(created_at) AS newest_created_at
FROM credit_usages
GROUP BY status, prompt_version
ORDER BY status, prompt_version
""")


def prompt_cohort(prompt_version: str) -> str:
    if prompt_version == AI_PROMPT_VERSION:
        return "current"
    return "legacy" if prompt_version == "legacy" else "previous"


def report_payload(row: RowMapping) -> dict[str, object]:
    status = str(row["status"])
    prompt_version = str(row["prompt_version"])
    cohort = prompt_cohort(prompt_version)
    alert_rows = int(row["anomaly_rows"]) if cohort == "current" and status == "committed" else 0
    return {"cohort": cohort, "status": status, "prompt_version": prompt_version, "current_prompt_version": AI_PROMPT_VERSION, "total_rows": int(row["total_rows"]), "metadata_incomplete_rows": int(row["metadata_incomplete_rows"]), "zero_provider_cost_rows": int(row["zero_provider_cost_rows"]), "alert_candidate_rows": alert_rows, "oldest_created_at": timestamp_text(row["oldest_created_at"]), "newest_created_at": timestamp_text(row["newest_created_at"])}


def timestamp_text(value: object) -> str:
    return value.isoformat() if isinstance(value, datetime) else ""


async def report() -> None:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(REPORT_QUERY)).mappings().all()
    if not rows:
        print('{"ai_metadata_groups": []}')
        return
    for row in rows:
        print(json.dumps(report_payload(row), ensure_ascii=False, sort_keys=True))


def main() -> None:
    asyncio.run(report())


if __name__ == "__main__":
    main()
