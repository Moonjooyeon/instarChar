from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_cost import ProviderUsage
from app.core.ai_prompt_policy import AI_PROMPT_VERSION
from app.core.credit_policy import CREDIT_POLICY_VERSION, ENERGY_POLICY_VERSION, FIRST_DM_BONUS_CREDITS, REWARD_MISSIONS, SIGNUP_BONUS_CREDITS, FlowPolicy, daily_period_start, next_energy_recovery_at, recover_energy, resolve_flow, usage_period
from app.models import AiDailyUsage, AiMonthlyUsage, CreditAccount, CreditLedgerEntry, CreditUsage, EnergyAccount, RewardGrant


RESERVATION_TTL = timedelta(minutes=10)


@dataclass(frozen=True)
class CreditReservation:
    allowed: bool
    usage_id: UUID | None = None
    policy: FlowPolicy | None = None
    error_code: str = ""
    message: str = ""
    replay_body: dict[str, object] | None = None


class CreditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def snapshot(self, user_id: UUID, now: datetime | None = None) -> dict[str, object]:
        current = now or datetime.now(timezone.utc)
        account, energy = await self._locked_accounts(user_id, current)
        await self._reconcile_stale(user_id, account, energy, current)
        await self._grant_if_missing(user_id, "signup", SIGNUP_BONUS_CREDITS, account)
        missions = await self._reward_missions(user_id)
        await self._commit()
        return self._snapshot(account, energy, missions)

    async def reserve(self, user_id: UUID, flow: str, idempotency_key: str = "", now: datetime | None = None) -> CreditReservation:
        current = now or datetime.now(timezone.utc)
        policy = resolve_flow(flow)
        key = idempotency_key or str(uuid4())
        account, energy = await self._locked_accounts(user_id, current)
        await self._reconcile_stale(user_id, account, energy, current)
        existing = await self._usage_by_key(user_id, key)
        if existing:
            return await self._duplicate(existing, policy)
        await self._grant_if_missing(user_id, "signup", SIGNUP_BONUS_CREDITS, account)
        intro_free = await self._intro_free_available(user_id, policy)
        if await self._hard_flow_limit_reached(user_id, policy, current):
            return await self._hard_flow_limited(policy)
        free_limit_reached = await self._free_flow_limit_reached(user_id, policy, current)
        purchased_only = free_limit_reached and policy.credits > 0 and account.purchased_credits >= policy.credits
        if free_limit_reached and not purchased_only and not intro_free:
            return await self._flow_limited(policy)
        if not intro_free and not self._can_use(account, energy, policy):
            return await self._insufficient(policy)
        usage = self._reserve_balance(user_id, key, account, energy, policy, purchased_only, intro_free)
        self.session.add(usage)
        self._usage_debits(usage)
        await self._commit()
        return CreditReservation(True, usage.id, policy)

    async def _duplicate(self, usage: CreditUsage, policy: FlowPolicy) -> CreditReservation:
        await self._commit()
        if usage.flow == policy.code and usage.status == "committed" and usage.response_body:
            return CreditReservation(False, usage.id, policy, replay_body=dict(usage.response_body))
        if usage.flow == policy.code and usage.status == "reserved":
            return CreditReservation(False, usage.id, policy, "REQUEST_IN_PROGRESS", "같은 요청을 처리하고 있어.")
        return CreditReservation(False, usage.id, policy, "REQUEST_ALREADY_PROCESSED", "이미 처리된 요청이야.")

    async def _insufficient(self, policy: FlowPolicy) -> CreditReservation:
        await self._commit()
        return CreditReservation(False, policy=policy, error_code="CREDIT_INSUFFICIENT", message="크레딧이 부족해. 충전 후 다시 이어가자.")

    async def _flow_limited(self, policy: FlowPolicy) -> CreditReservation:
        await self._commit()
        return CreditReservation(False, policy=policy, error_code="FREE_FLOW_DAILY_LIMIT_EXCEEDED", message="이 AI 기능의 오늘 무료 사용량을 모두 사용했어.")

    async def _hard_flow_limited(self, policy: FlowPolicy) -> CreditReservation:
        await self._commit()
        return CreditReservation(False, policy=policy, error_code="FLOW_DAILY_LIMIT_EXCEEDED", message="이 AI 기능의 오늘 사용 한도에 도달했어.")

    def _reserve_balance(self, user_id: UUID, key: str, account: CreditAccount, energy: EnergyAccount, policy: FlowPolicy, purchased_only: bool = False, waive_charge: bool = False) -> CreditUsage:
        energy_amount = policy.energy_percent if not purchased_only and policy.energy_allowed and energy.energy_percent >= policy.energy_percent else 0
        bonus_allowed = policy.bonus_allowed and not purchased_only
        credits = 0 if waive_charge else policy.credits if not energy_amount else 0
        bonus, purchased = self._deduct_credits(account, credits, bonus_allowed)
        energy.energy_percent -= energy_amount
        return CreditUsage(id=uuid4(), user_id=user_id, flow=policy.code, policy_version=CREDIT_POLICY_VERSION, prompt_version=AI_PROMPT_VERSION, model=policy.model, status="reserved", credits=credits, energy_percent=energy_amount, bonus_credits=bonus, purchased_credits=purchased, idempotency_key=key, provider_status="credit_reserved")

    def _usage_debits(self, usage: CreditUsage) -> None:
        if usage.bonus_credits:
            self._add_ledger(usage.user_id, "debit", "bonus", -usage.bonus_credits, f"usage:{usage.id}:bonus", usage.flow)
        if usage.purchased_credits:
            self._add_ledger(usage.user_id, "debit", "purchased", -usage.purchased_credits, f"usage:{usage.id}:purchased", usage.flow)

    async def _intro_free_available(self, user_id: UUID, policy: FlowPolicy) -> bool:
        if policy.intro_free_uses <= 0:
            return False
        stmt = select(func.count()).select_from(CreditUsage).where(CreditUsage.user_id == user_id, CreditUsage.flow == policy.code, CreditUsage.status.in_(("reserved", "committed")))
        return int((await self.session.execute(stmt)).scalar_one()) < policy.intro_free_uses

    async def commit_usage(self, usage_id: UUID, user_id: UUID, provider: ProviderUsage | None = None, response_body: dict[str, object] | None = None) -> None:
        account, _ = await self._locked_accounts(user_id, datetime.now(timezone.utc))
        usage = await self._usage_for_update(usage_id, user_id)
        if usage and usage.status == "reserved":
            usage.status = "committed"
            usage.provider_status = "success"
            self._apply_provider_usage(usage, provider or ProviderUsage())
            usage.response_body = response_body or {}
            dm_flow = usage.flow.startswith("direct_dm")
            await self._grant_if_missing(user_id, "first_dm", FIRST_DM_BONUS_CREDITS, account, dm_flow)
            await self._commit()

    async def mark_provider_started(self, usage_id: UUID, user_id: UUID) -> None:
        usage = await self._usage_for_update(usage_id, user_id)
        if usage and usage.status == "reserved":
            usage.provider_status = "provider_started"
            await self._commit()

    async def refund_usage(self, usage_id: UUID, user_id: UUID, provider_status: str, provider: ProviderUsage | None = None) -> None:
        account, energy = await self._locked_accounts(user_id, datetime.now(timezone.utc))
        usage = await self._usage_for_update(usage_id, user_id)
        if not usage or usage.status != "reserved":
            return
        energy.energy_percent = min(100, energy.energy_percent + usage.energy_percent)
        account.bonus_credits += usage.bonus_credits
        account.purchased_credits += usage.purchased_credits
        usage.status = "refunded"
        usage.provider_status = provider_status
        self._apply_provider_usage(usage, provider or ProviderUsage())
        self._add_ledger(user_id, "refund", "bonus", usage.bonus_credits, f"refund:{usage.id}:bonus", provider_status) if usage.bonus_credits else None
        self._add_ledger(user_id, "refund", "purchased", usage.purchased_credits, f"refund:{usage.id}:purchased", provider_status) if usage.purchased_credits else None
        await self._commit()

    async def usages(self, user_id: UUID, limit: int = 30) -> list[CreditUsage]:
        charged = or_(CreditUsage.credits > 0, CreditUsage.energy_percent > 0)
        result = await self.session.execute(select(CreditUsage).where(CreditUsage.user_id == user_id, charged).order_by(CreditUsage.created_at.desc()).limit(limit))
        return list(result.scalars().all())

    async def grant(self, user_id: UUID, event_code: str, credits: int) -> bool:
        account, _ = await self._locked_accounts(user_id, datetime.now(timezone.utc))
        created = await self._grant_if_missing(user_id, event_code, credits, account)
        await self._commit()
        return created

    async def _locked_accounts(self, user_id: UUID, now: datetime) -> tuple[CreditAccount, EnergyAccount]:
        await self._ensure_accounts(user_id)
        account = (await self.session.execute(select(CreditAccount).where(CreditAccount.user_id == user_id).with_for_update())).scalar_one()
        energy = (await self.session.execute(select(EnergyAccount).where(EnergyAccount.user_id == user_id).with_for_update())).scalar_one()
        energy.energy_percent, energy.last_recovered_at = recover_energy(energy.energy_percent, energy.last_recovered_at, now)
        return account, energy

    async def _ensure_accounts(self, user_id: UUID) -> None:
        await self.session.execute(insert(CreditAccount).values(user_id=user_id).on_conflict_do_nothing())
        await self.session.execute(insert(EnergyAccount).values(user_id=user_id).on_conflict_do_nothing())

    async def _usage_by_key(self, user_id: UUID, key: str) -> CreditUsage | None:
        result = await self.session.execute(select(CreditUsage).where(CreditUsage.user_id == user_id, CreditUsage.idempotency_key == key))
        return result.scalar_one_or_none()

    async def _usage_for_update(self, usage_id: UUID, user_id: UUID) -> CreditUsage | None:
        result = await self.session.execute(select(CreditUsage).where(CreditUsage.id == usage_id, CreditUsage.user_id == user_id).with_for_update())
        return result.scalar_one_or_none()

    async def _grant_if_missing(self, user_id: UUID, event_code: str, credits: int, account: CreditAccount | None, enabled: bool = True) -> bool:
        if not enabled:
            return False
        grant = await self.session.execute(insert(RewardGrant).values(user_id=user_id, event_code=event_code, credits=credits).on_conflict_do_nothing().returning(RewardGrant.id))
        if not grant.scalar_one_or_none():
            return False
        target = account or (await self._locked_accounts(user_id, datetime.now(timezone.utc)))[0]
        target.bonus_credits += credits
        self._add_ledger(user_id, "grant", "bonus", credits, f"grant:{event_code}", event_code)
        return True

    def _can_use(self, account: CreditAccount, energy: EnergyAccount, policy: FlowPolicy) -> bool:
        available_credits = account.purchased_credits + (account.bonus_credits if policy.bonus_allowed else 0)
        return policy.credits == 0 or (policy.energy_allowed and energy.energy_percent >= policy.energy_percent) or available_credits >= policy.credits

    def _deduct_credits(self, account: CreditAccount, amount: int, bonus_allowed: bool) -> tuple[int, int]:
        bonus = min(account.bonus_credits, amount) if bonus_allowed else 0
        purchased = amount - bonus
        account.bonus_credits -= bonus
        account.purchased_credits -= purchased
        return bonus, purchased

    def _add_ledger(self, user_id: UUID, entry_type: str, balance_type: str, amount: int, key: str, metadata: str) -> None:
        self.session.add(CreditLedgerEntry(user_id=user_id, entry_type=entry_type, balance_type=balance_type, amount=amount, idempotency_key=key, entry_metadata={"flow": metadata}))

    async def _reward_missions(self, user_id: UUID) -> list[dict[str, object]]:
        result = await self.session.execute(select(RewardGrant.event_code).where(RewardGrant.user_id == user_id))
        completed = set(result.scalars().all())
        return [{"code": code, "credits": credits, "completed": code in completed} for code, credits in REWARD_MISSIONS]

    def _snapshot(self, account: CreditAccount, energy: EnergyAccount, missions: list[dict[str, object]]) -> dict[str, object]:
        debt = int(getattr(account, "debt_credits", 0) or 0)
        return {"purchased_credits": account.purchased_credits, "bonus_credits": account.bonus_credits, "debt_credits": debt, "total_credits": account.purchased_credits + account.bonus_credits, "energy_percent": energy.energy_percent, "energy_max_percent": 100, "next_energy_recovery_at": next_energy_recovery_at(energy.energy_percent, energy.last_recovered_at), "credit_policy_version": CREDIT_POLICY_VERSION, "energy_policy_version": ENERGY_POLICY_VERSION, "reward_missions": missions}

    async def _free_flow_limit_reached(self, user_id: UUID, policy: FlowPolicy, now: datetime) -> bool:
        if not policy.energy_allowed and not policy.bonus_allowed:
            return False
        if policy.free_daily_limit <= 0:
            return True
        start = daily_period_start(now)
        conditions = [CreditUsage.user_id == user_id, CreditUsage.flow == policy.code, CreditUsage.created_at >= start, CreditUsage.status.in_(("reserved", "committed"))]
        if policy.credits > 0 or policy.energy_percent > 0:
            conditions.append(or_(CreditUsage.energy_percent > 0, CreditUsage.bonus_credits > 0))
        stmt = select(func.count()).select_from(CreditUsage).where(*conditions)
        return int((await self.session.execute(stmt)).scalar_one()) >= policy.free_daily_limit

    async def _hard_flow_limit_reached(self, user_id: UUID, policy: FlowPolicy, now: datetime) -> bool:
        if policy.hard_daily_limit <= 0:
            return False
        start = daily_period_start(now)
        stmt = select(func.count()).select_from(CreditUsage).where(CreditUsage.user_id == user_id, CreditUsage.flow == policy.code, CreditUsage.created_at >= start)
        return int((await self.session.execute(stmt)).scalar_one()) >= policy.hard_daily_limit

    async def _reconcile_stale(self, user_id: UUID, account: CreditAccount, energy: EnergyAccount, now: datetime) -> None:
        cutoff = now - RESERVATION_TTL
        stmt = select(CreditUsage).where(CreditUsage.user_id == user_id, CreditUsage.status == "reserved", CreditUsage.created_at < cutoff).with_for_update()
        usages = list((await self.session.execute(stmt)).scalars().all())
        for usage in usages:
            await self._refund_stale_usage(usage, account, energy, now)

    async def _refund_stale_usage(self, usage: CreditUsage, account: CreditAccount, energy: EnergyAccount, now: datetime) -> None:
        release_cost = usage.provider_status == "cost_reserved"
        energy.energy_percent = min(100, energy.energy_percent + usage.energy_percent)
        account.bonus_credits += usage.bonus_credits
        account.purchased_credits += usage.purchased_credits
        usage.status = "refunded"
        usage.provider_status = "RESERVATION_EXPIRED"
        self._refund_ledger_entries(usage)
        if release_cost:
            await self._release_reserved_cost(usage, now)

    def _refund_ledger_entries(self, usage: CreditUsage) -> None:
        if usage.bonus_credits:
            self._add_ledger(usage.user_id, "refund", "bonus", usage.bonus_credits, f"refund:{usage.id}:bonus", "RESERVATION_EXPIRED")
        if usage.purchased_credits:
            self._add_ledger(usage.user_id, "refund", "purchased", usage.purchased_credits, f"refund:{usage.id}:purchased", "RESERVATION_EXPIRED")

    async def _release_reserved_cost(self, usage: CreditUsage, now: datetime) -> None:
        created = usage.created_at or now
        usage_date, usage_month = usage_period(created)
        daily_stmt = select(AiDailyUsage).where(AiDailyUsage.owner_id == usage.user_id, AiDailyUsage.usage_date == usage_date).with_for_update()
        monthly_stmt = select(AiMonthlyUsage).where(AiMonthlyUsage.usage_month == usage_month).with_for_update()
        daily = (await self.session.execute(daily_stmt)).scalar_one_or_none()
        monthly = (await self.session.execute(monthly_stmt)).scalar_one_or_none()
        if daily:
            daily.estimated_cost_usd = max(Decimal("0"), daily.estimated_cost_usd - usage.reserved_cost_usd)
        if monthly:
            monthly.estimated_cost_usd = max(Decimal("0"), monthly.estimated_cost_usd - usage.reserved_cost_usd)

    def _apply_provider_usage(self, usage: CreditUsage, provider: ProviderUsage) -> None:
        if provider.model:
            usage.model = provider.model
        usage.provider_attempts = provider.attempts
        usage.input_tokens = provider.input_tokens
        usage.output_tokens = provider.output_tokens
        usage.thought_tokens = provider.thought_tokens
        usage.total_tokens = provider.total_tokens
        usage.usage_metadata_complete = provider.measured
        usage.provider_cost_usd = provider.cost_usd

    async def _commit(self) -> None:
        await self.session.commit()
