import pytest

from app import main


@pytest.fixture(autouse=True)
def disable_background_schedulers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, "account_deletion_scheduler_enabled", False)
    monkeypatch.setattr(main.settings, "auto_post_scheduler_enabled", False)
