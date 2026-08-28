from datetime import datetime, timezone
from typing import cast

from sqlalchemy.engine import RowMapping

from app.core.ai_prompt_policy import AI_PROMPT_VERSION
from scripts.observe_ai_metadata import report_payload


def metadata_row(prompt_version: str, status: str = "committed") -> RowMapping:
    return cast(RowMapping, {"status": status, "prompt_version": prompt_version, "total_rows": 12, "metadata_incomplete_rows": 3, "zero_provider_cost_rows": 2, "anomaly_rows": 4, "oldest_created_at": datetime(2026, 8, 1, tzinfo=timezone.utc), "newest_created_at": datetime(2026, 8, 26, tzinfo=timezone.utc)})


def test_current_committed_metadata_anomalies_are_alert_candidates() -> None:
    payload = report_payload(metadata_row(AI_PROMPT_VERSION))
    assert payload["cohort"] == "current"
    assert payload["alert_candidate_rows"] == 4
    assert not {"user_id", "idempotency_key", "response_body"} & payload.keys()


def test_legacy_metadata_anomalies_remain_historical() -> None:
    payload = report_payload(metadata_row("legacy"))
    assert payload["cohort"] == "legacy"
    assert payload["alert_candidate_rows"] == 0


def test_previous_prompt_anomalies_are_not_current_alerts() -> None:
    payload = report_payload(metadata_row("ai-prompt-2026-08-v1"))
    assert payload["cohort"] == "previous"
    assert payload["alert_candidate_rows"] == 0


def test_non_committed_current_rows_do_not_raise_alert_candidates() -> None:
    payload = report_payload(metadata_row(AI_PROMPT_VERSION, "refunded"))
    assert payload["cohort"] == "current"
    assert payload["alert_candidate_rows"] == 0
