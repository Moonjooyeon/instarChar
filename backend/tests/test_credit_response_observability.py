from datetime import datetime, timezone
from typing import cast

from sqlalchemy.engine import RowMapping

from scripts.observe_credit_responses import report_payload


def test_report_payload_contains_only_non_identifying_aggregates() -> None:
    row = cast(RowMapping, {"status": "committed", "prompt_version": "ai-prompt-v1", "total_rows": 12, "non_empty_rows": 10, "total_bytes": 2048, "average_bytes": 205, "maximum_bytes": 512, "rows_older_24h": 8, "rows_older_72h": 6, "rows_older_7d": 2, "oldest_created_at": datetime(2026, 8, 1, tzinfo=timezone.utc)})
    payload = report_payload(row)
    assert payload["total_bytes"] == 2048
    assert payload["oldest_created_at"] == "2026-08-01T00:00:00+00:00"
    assert not {"response_body", "idempotency_key", "user_id"} & payload.keys()
