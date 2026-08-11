import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import Select

from app.core.credit_policy import resolve_flow
from app.models import CreditAccount, CreditUsage, EnergyAccount
from app.repositories.credits import CreditRepository


class StubSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, value: object) -> None:
        self.added.append(value)


class CountResult:
    def scalar_one(self) -> int:
        return 0


class CountSession(StubSession):
    def __init__(self) -> None:
        super().__init__()
        self.statement: Select[tuple[int]] | None = None

    async def execute(self, statement: Select[tuple[int]]) -> CountResult:
        self.statement = statement
        return CountResult()


class UsageScalars:
    def all(self) -> list[CreditUsage]:
        return []


class UsageResult:
    def scalars(self) -> UsageScalars:
        return UsageScalars()


class UsageSession(StubSession):
    def __init__(self) -> None:
        super().__init__()
        self.statement: Select[tuple[CreditUsage]] | None = None

    async def execute(self, statement: Select[tuple[CreditUsage]]) -> UsageResult:
        self.statement = statement
        return UsageResult()


class MissionScalars:
    def all(self) -> list[str]:
        return ["signup", "first_character"]


class MissionResult:
    def scalars(self) -> MissionScalars:
        return MissionScalars()


class MissionSession(StubSession):
    async def execute(self, statement: object) -> MissionResult:
        return MissionResult()


class ConflictResult:
    def scalar_one_or_none(self) -> object | None:
        return None


class ConflictSession(StubSession):
    async def execute(self, statement: object) -> ConflictResult:
        return ConflictResult()


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


def test_free_limit_falls_back_to_purchased_credits_only(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=20, bonus_credits=10)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy, free_limit_reached=True)
    result = asyncio.run(repository.reserve(account.user_id, "feed_post", "paid-after-free-limit"))
    usage = next(item for item in session.added if isinstance(item, CreditUsage))
    assert result.allowed is True
    assert (energy.energy_percent, account.bonus_credits, account.purchased_credits) == (100, 10, 17)
    assert (usage.energy_percent, usage.bonus_credits, usage.purchased_credits) == (0, 0, 3)


def test_free_limit_blocks_without_enough_purchased_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=2, bonus_credits=10)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy, free_limit_reached=True)
    result = asyncio.run(repository.reserve(account.user_id, "feed_post", "blocked-free-limit"))
    assert result.error_code == "FREE_FLOW_DAILY_LIMIT_EXCEEDED"
    assert (energy.energy_percent, account.bonus_credits, account.purchased_credits) == (100, 10, 2)


def test_free_limit_counts_only_active_free_usage() -> None:
    session = CountSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    result = asyncio.run(repository._free_flow_limit_reached(uuid4(), resolve_flow("feed_post"), datetime.now(timezone.utc)))
    assert result is False
    assert session.statement is not None
    sql = str(session.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "credit_usages.status IN ('reserved', 'committed')" in sql
    assert "credit_usages.energy_percent > 0 OR credit_usages.bonus_credits > 0" in sql


def test_user_usage_history_excludes_zero_cost_service_calls() -> None:
    session = UsageSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    assert asyncio.run(repository.usages(uuid4())) == []
    assert session.statement is not None
    sql = str(session.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "credit_usages.credits > 0 OR credit_usages.energy_percent > 0" in sql


def test_pro_hard_limit_counts_all_active_usage() -> None:
    session = CountSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    result = asyncio.run(repository._hard_flow_limit_reached(uuid4(), resolve_flow("direct_dm_pro"), datetime.now(timezone.utc)))
    assert result is False
    assert session.statement is not None
    sql = str(session.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "credit_usages.status IN ('reserved', 'committed')" in sql
    assert "credit_usages.flow = 'direct_dm_pro'" in sql


def test_pro_hard_limit_blocks_before_charging(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=100, bonus_credits=0)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    stub_repository(monkeypatch, repository, account, energy, hard_limit_reached=True)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_pro", "pro-hard-limit"))
    assert result.error_code == "FLOW_DAILY_LIMIT_EXCEEDED"
    assert account.purchased_credits == 100


def test_reserve_reports_duplicate_reservation_in_progress(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    existing = CreditUsage(user_id=account.user_id, flow="direct_dm_basic", policy_version="v1", model="flash", status="reserved", idempotency_key="same")
    stub_repository(monkeypatch, repository, account, energy, existing)
    result = asyncio.run(repository.reserve(account.user_id, "direct_dm_basic", "same"))
    assert result.allowed is False
    assert result.error_code == "REQUEST_IN_PROGRESS"
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


def test_snapshot_uses_new_signup_bonus_amount(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=account.user_id, energy_percent=100, last_recovered_at=datetime.now(timezone.utc))
    grants: list[tuple[str, int]] = []
    stub_repository(monkeypatch, repository, account, energy)
    async def grant(user_id: object, event_code: str, credits: int, current: CreditAccount) -> bool:
        grants.append((event_code, credits))
        return True
    monkeypatch.setattr(repository, "_grant_if_missing", grant)
    result = asyncio.run(repository.snapshot(account.user_id))
    assert grants == [("signup", 50)]
    assert result["reward_missions"] == []


def test_reward_missions_preserve_story_order_and_server_completion() -> None:
    repository = CreditRepository(MissionSession())  # type: ignore[arg-type]
    missions = asyncio.run(repository._reward_missions(uuid4()))
    assert [(item["code"], item["credits"], item["completed"]) for item in missions] == [("signup", 50, True), ("first_character", 50, True), ("first_dm", 50, False)]


def test_existing_signup_grant_preserves_previous_balance() -> None:
    session = ConflictSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    account = CreditAccount(user_id=uuid4(), purchased_credits=0, bonus_credits=300)
    created = asyncio.run(repository._grant_if_missing(account.user_id, "signup", 50, account))
    assert created is False
    assert account.bonus_credits == 300
    assert session.added == []


def test_first_dm_grant_uses_new_amount(monkeypatch: pytest.MonkeyPatch) -> None:
    session = StubSession()
    repository = CreditRepository(session)  # type: ignore[arg-type]
    user_id = uuid4()
    usage = CreditUsage(id=uuid4(), user_id=user_id, flow="direct_dm_basic", policy_version="v2", model="flash", status="reserved", idempotency_key="first-dm")
    account = CreditAccount(user_id=user_id, purchased_credits=0, bonus_credits=0)
    energy = EnergyAccount(user_id=user_id, energy_percent=92, last_recovered_at=datetime.now(timezone.utc))
    grants: list[tuple[str, int, bool]] = []
    async def grant(owner_id: object, event_code: str, credits: int, current: CreditAccount, enabled: bool = True) -> bool:
        grants.append((event_code, credits, enabled))
        return True
    stub_refund(monkeypatch, repository, usage, account, energy)
    monkeypatch.setattr(repository, "_grant_if_missing", grant)
    asyncio.run(repository.commit_usage(usage.id, user_id))
    assert grants == [("first_dm", 50, True)]


def stub_repository(monkeypatch: pytest.MonkeyPatch, repository: CreditRepository, account: CreditAccount, energy: EnergyAccount, existing: CreditUsage | None = None, free_limit_reached: bool = False, hard_limit_reached: bool = False) -> None:
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
        return free_limit_reached
    async def hard_limit(user_id: object, policy: object, now: object) -> bool:
        return hard_limit_reached
    async def reward_missions(user_id: object) -> list[dict[str, object]]:
        return []
    monkeypatch.setattr(repository, "_locked_accounts", locked)
    monkeypatch.setattr(repository, "_reconcile_stale", reconcile)
    monkeypatch.setattr(repository, "_usage_by_key", usage)
    monkeypatch.setattr(repository, "_grant_if_missing", grant)
    monkeypatch.setattr(repository, "_free_flow_limit_reached", flow_limit)
    monkeypatch.setattr(repository, "_hard_flow_limit_reached", hard_limit)
    monkeypatch.setattr(repository, "_reward_missions", reward_missions)
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
