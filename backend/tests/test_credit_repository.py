import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.models import CreditAccount, CreditUsage, EnergyAccount
from app.repositories.credits import CreditRepository


class StubSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)


def test_reserve_uses_energy_before_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=20, bonus_credits=10)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_basic", "request-1"))
    usage = next(item for item in session.added if isinstance(item, CreditUsage))
    assert result.allowed is True
    assert energy.energy_percent == 92
    assert account.bonus_credits == 10
    assert usage.model == "flash"


def test_reserve_uses_bonus_before_purchased_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=20, bonus_credits=2)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=0, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy)
    result = asyncio.run(repository.reserve(account.user_id, "feed_post", "request-2"))
    usage = next(item for item in session.added if isinstance(item, CreditUsage))
    assert result.allowed is True
    assert account.bonus_credits == 0
    assert account.purchased_credits == 19
    assert usage.bonus_credits == 2
    assert usage.purchased_credits == 1


def test_reserve_rejects_duplicate_idempotency_key(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    existing = CreditUsage(user_id=account.user_id, flow="direct_dm_basic", policy_version="v1", model="flash", idempotency_key="same")
    stub_repository(monkeypatch, repository, account, energy, existing)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_basic", "same"))
    assert result.allowed is False
    assert result.error_code == "REQUEST_ALREADY_PROCESSED"
    assert energy.energy_percent == 100


def test_reserve_replays_committed_idempotent_response(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    existing = CreditUsage(user_id=account.user_id, flow="direct_dm_basic", policy_version="v1", model="flash", status="committed", idempotency_key="same", response_body={"content": [{"type": "text", "text": "안녕"}]})
    stub_repository(monkeypatch, repository, account, energy, existing)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_basic", "same"))
    assert result.replay_body == existing.response_body


def test_pro_flow_requires_purchased_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=4, bonus_credits=100)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_pro", "pro-request"))
    assert result.allowed is False
    assert result.error_code == "CREDIT_INSUFFICIENT"
    assert account.bonus_credits == 100
    assert energy.energy_percent == 100


def test_refund_restores_original_balance_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    usage = CreditUsage(id=uuid4(), user_id=user_id, flow="feed_post", policy_version="v1", model="flash", status="reserved", credits=3, energy_percent=0, bonus_credits=2, purchased_credits=1, idempotency_key="request-refund")
    account = CreditAccount(user_id=user_id, purchased_credits=4, bonus_credits=0)
    energy = EnergyAccount(user_id=user_id, energy_percent=0, last_recovered_at=datetime.now(timezone.utc))
    stub_refund(monkeypatch, repository, usage, account, energy)
    asyncio.run(repository.refund_usage(usage.id, user_id, "API_ERROR"))
    assert (account.bonus_credits, account.purchased_credits) == (2, 5)
    assert (usage.status, usage.provider_status) == ("refunded", "API_ERROR")


def test_stale_cost_reservation_is_released_before_status_changes(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    usage = CreditUsage(id=uuid4(), user_id=user_id, flow="feed_post", policy_version="v1", model="flash", status="reserved", credits=0, energy_percent=0, bonus_credits=0, purchased_credits=0, provider_status="cost_reserved", idempotency_key="stale")
    account = CreditAccount(user_id=user_id, purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=user_id, energy_percent=0, last_recovered_at=datetime.now(timezone.utc))
    released: list[object] = []
    async def release(current: CreditUsage, now: object) -> None:
        released.append(current.id)
    monkeypatch.setattr(repository, "_release_reserved_cost", release)
    asyncio.run(repository._refund_stale_usage(usage, account, energy, datetime.now(timezone.utc)))
    assert released == [usage.id]
    assert usage.provider_status == "RESERVATION_EXPIRED"


def stub_repository(monkeypatch: pytest.MonkeyPatch, repository: CreditRepository, account: CreditAccount, energy: EnergyAccount, existing: CreditUsage | None = None) -> None:
    async def locked(user_id: object, now: object) -> tuple[CreditAccount, EnergyAccount]:
        return account, energy
    async def usage(user_id: object, key: str) -> CreditUsage | None:
        return existing
    async def grant(*args: object, **kwargs: object) -> bool:
        return False
    async def commit() -> None:
        return None
    async def reconcile(user_id: object, current_account: CreditAccount, current_energy: EnergyAccount, now: object) -> None:
        return None
    async def flow_limit(user_id: object, policy: object, now: object) -> bool:
        return False
    monkeypatch.setattr(repository, "_locked_accounts", locked)
    monkeypatch.setattr(repository, "_reconcile_stale", reconcile)
    monkeypatch.setattr(repository, "_usage_by_key", usage)
    monkeypatch.setattr(repository, "_grant_if_missing", grant)
    monkeypatch.setattr(repository, "_flow_limit_reached", flow_limit)
    monkeypatch.setattr(repository, "_commit", commit)


def stub_refund(monkeypatch: pytest.MonkeyPatch, repository: CreditRepository, usage: CreditUsage, account: CreditAccount, energy: EnergyAccount) -> None:
    async def usage_for_update(usage_id: object, user_id: object) -> CreditUsage:
        return usage
    async def locked(user_id: object, now: object) -> tuple[CreditAccount, EnergyAccount]:
        return account, energy
    async def commit() -> None:
        return None
    monkeypatch.setattr(repository, "_usage_for_update", usage_for_update)
    monkeypatch.setattr(repository, "_locked_accounts", locked)
    monkeypatch.setattr(repository, "_commit", commit)
