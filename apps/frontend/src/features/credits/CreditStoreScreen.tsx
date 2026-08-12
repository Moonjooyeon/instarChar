import React from "react";
import {
  getCreditBalance,
  getCreditCatalog,
  getCreditPurchases,
  getCreditUsage,
  type CreditBalance,
  type CreditCatalog,
  type CreditFlow,
  type CreditOffer,
  type CreditPurchase,
  type CreditUsage,
} from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditUsageAmount } from "@/domain/credits/creditPresentation";
import { dmResponseFlowLabel } from "@/domain/dm/dmResponseMode";
import { CreditChargeOrder, CreditFlowCatalog } from "@/features/credits/CreditFlowCatalog";
import { CreditPurchaseHistory } from "@/features/credits/CreditPurchaseHistory";
import { StarterMissionJourney } from "@/features/credits/StarterMissions";
import { useTossCreditPurchase } from "@/features/credits/useTossCreditPurchase";
import type { RewardMissionCode } from "@/domain/credits/rewardMissions";

interface CreditStoreScreenProps {
  onBack: () => void;
  onContinueMission: (code: RewardMissionCode) => void;
}
type CreditStoreData = {
  balance: CreditBalance | null;
  catalog: CreditCatalog | null;
  purchases: CreditPurchase[];
  usages: CreditUsage[];
};

export function CreditStoreScreen({
  onBack,
  onContinueMission,
}: CreditStoreScreenProps): React.ReactElement {
  const { data, error, loading, retry } = useCreditStoreData();
  const offers = data.catalog?.offers || [];
  const purchase = useTossCreditPurchase(offers, retry);
  const featured =
    offers.find((offer) => offer.id === "credit-30000") || offers[0];
  const [selectedId, setSelectedId] = React.useState("");
  const selected = offers.find((offer) => offer.id === selectedId) || featured;
  React.useEffect(() => {
    if (featured && !selectedId) setSelectedId(featured.id);
  }, [featured?.id, selectedId]);
  return (
    <div className="al-phone al-theme-ready al-credit-theme-ready">
      <main className="al-credit-screen">
        <CreditHeader onBack={onBack} />
        <LoadNotice error={error} loading={loading} retry={retry} />
        <CreditOverview balance={data.balance} />
        <OfferList
          displayAmounts={purchase.displayAmounts}
          offers={offers}
          selectedId={selected?.id || ""}
          onSelect={setSelectedId}
        />
        <CheckoutPreview offer={selected} purchase={purchase} />
        <StarterMissionJourney missions={data.balance?.reward_missions || []} onContinue={onContinueMission} />
        <CreditDetails
          flows={data.catalog?.flows || []}
          purchases={data.purchases}
          usages={data.usages}
        />
      </main>
    </div>
  );
}

function useCreditStoreData(): {
  data: CreditStoreData;
  error: string;
  loading: boolean;
  retry: () => void;
} {
  const [data, setData] = React.useState<CreditStoreData>({
    balance: null,
    catalog: null,
    purchases: [],
    usages: [],
  });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const retry = React.useCallback(() => setRefreshKey((value) => value + 1), []);
  React.useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getCreditBalance(), getCreditCatalog(), getCreditPurchases(), getCreditUsage()])
      .then(([balance, catalog, purchases, usage]) =>
        setData({ balance, catalog, purchases: purchases.items, usages: usage.items }),
      )
      .catch(() => setError("크레딧 정보를 불러오지 못했어."))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  return {
    data,
    error,
    loading,
    retry,
  };
}

function CreditHeader({ onBack }: { onBack: () => void }): React.ReactElement {
  return (
    <header className="al-credit-head">
      <button type="button" onClick={onBack} aria-label="이전 화면으로">
        <AliveIcon name="chevron-left" size={20} />
      </button>
      <div>
        <h1>크레딧</h1>
        <p>잔액을 확인하고 필요한 만큼 충전하세요.</p>
      </div>
    </header>
  );
}

function LoadNotice({
  error,
  loading,
  retry,
}: {
  error: string;
  loading: boolean;
  retry: () => void;
}): React.ReactElement | null {
  if (loading)
    return (
      <div className="al-credit-notice" role="status">
        잔액과 에너지를 확인하고 있어요.
      </div>
    );
  if (!error) return null;
  return (
    <div className="al-credit-notice error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={retry}>
        <AliveIcon name="refresh" size={13} /> 다시 시도
      </button>
    </div>
  );
}

function CreditOverview({ balance }: { balance: CreditBalance | null }): React.ReactElement {
  return (
    <section
      className="al-credit-overview"
      aria-labelledby="credit-balance-title"
    >
      <header>
        <h2 id="credit-balance-title">보유 크레딧</h2>
        <small>{balance ? "사용 가능" : "확인 중"}</small>
      </header>
      <div className="al-credit-ledger">
        <strong>{numberText(balance?.total_credits)} <small>C</small></strong>
        <BalanceBreakdown balance={balance} />
      </div>
      <EnergyStatus balance={balance} />
    </section>
  );
}

function BalanceBreakdown({ balance }: { balance: CreditBalance | null }): React.ReactElement {
  return (
    <dl className="al-credit-balance-breakdown">
      <BalanceSource detail="먼저 사용" label="무료" value={balance?.bonus_credits} />
      <BalanceSource detail="Pro 사용 가능" label="구매" value={balance?.purchased_credits} />
      {Boolean(balance?.debt_credits) && <BalanceSource detail="다음 구매에서 우선 정산" label="환불 정산" value={-(balance?.debt_credits || 0)} />}
    </dl>
  );
}

function BalanceSource({ detail, label, value }: { detail: string; label: string; value?: number }): React.ReactElement {
  return <div><dt>{label}</dt><dd><b>{numberText(value)} C</b><small>{detail}</small></dd></div>;
}

function EnergyStatus({ balance }: { balance: CreditBalance | null }): React.ReactElement {
  const percent = balance?.energy_percent || 0;
  return (
    <div className="al-credit-energy" aria-label="무료 회복 에너지">
      <header>
        <div><AliveIcon name="sun" size={15} /><b>무료 에너지</b></div>
        <span>{energyStatusText(balance)}</span>
      </header>
      <EnergyMeter percent={percent} />
      <p>사용 후 6시간마다 25% 회복 · 자정 초기화 없음</p>
    </div>
  );
}

function EnergyMeter({ percent }: { percent: number }): React.ReactElement {
  return (
    <div className="al-credit-energy-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

function OfferList({
  displayAmounts,
  offers,
  onSelect,
  selectedId,
}: {
  displayAmounts: Record<string, string>;
  offers: readonly CreditOffer[];
  onSelect: (id: string) => void;
  selectedId: string;
}): React.ReactElement {
  return (
    <section className="al-credit-offers" aria-labelledby="credit-offers-title">
      <header>
        <div>
          <span>충전</span>
          <h2 id="credit-offers-title">크레딧 선택</h2>
        </div>
        <small>첫 구매 시 10% 추가 · VAT 포함</small>
      </header>
      <div>
        {offers.map((offer) => (
          <OfferRow
            isSelected={offer.id === selectedId}
            key={offer.id}
            offer={offer}
            displayAmount={displayAmounts[offer.sku]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function OfferRow({
  displayAmount,
  isSelected,
  offer,
  onSelect,
}: {
  displayAmount?: string;
  isSelected: boolean;
  offer: CreditOffer;
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <button
      className={isSelected ? "selected" : ""}
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(offer.id)}
    >
      <span>
        <b>{offer.total_credits.toLocaleString("ko-KR")} C</b>
        <small>{offerDescription(offer)}</small>
      </span>
      <em>
        {offer.id === "credit-30000" && <mark>추천</mark>}
        <b>{offerPriceText(offer, displayAmount)}</b>
        <small>
          첫 구매 {offer.first_purchase_total_credits.toLocaleString("ko-KR")} C
        </small>
      </em>
      <u aria-hidden="true" />
    </button>
  );
}

function CheckoutPreview({
  offer,
  purchase,
}: {
  offer?: CreditOffer;
  purchase: ReturnType<typeof useTossCreditPurchase>;
}): React.ReactElement {
  const displayAmount = offer ? purchase.displayAmounts[offer.sku] : "";
  const available = Boolean(offer?.payment_available && offer.sku && purchase.availableSkus.has(offer.sku));
  const purchasing = Boolean(offer?.sku && purchase.purchasingSku === offer.sku);
  return (
    <section className="al-credit-checkout" aria-label="결제 요약">
      <div>
        <span>선택한 상품</span>
        <b>
          {offer
            ? `${offerPriceText(offer, displayAmount)} · ${offer.total_credits.toLocaleString("ko-KR")}C`
            : "상품 확인 중"}
        </b>
      </div>
      <button type="button" disabled={!available || purchasing} onClick={() => offer?.sku && purchase.purchase(offer.sku)}>
        {purchasing ? "결제 처리 중" : available ? "구매하기" : "결제 준비 중"}
      </button>
      <p className={purchase.error ? "error" : ""}><AliveIcon name={purchase.error ? "help" : "check"} size={13} />{purchase.error || purchase.notice || (available ? "결제 후 크레딧이 바로 지급돼요. 표시 금액은 VAT 포함이에요." : "지금은 결제되지 않아요.")}</p>
    </section>
  );
}

function CreditDetails({ flows, purchases, usages }: { flows: CreditFlow[]; purchases: CreditPurchase[]; usages: CreditUsage[] }): React.ReactElement {
  return (
    <section className="al-credit-details" aria-label="크레딧 상세 정보">
      <CreditDisclosure title="결제 내역" summary="충전과 환불 기록">
        <CreditPurchaseHistory items={purchases} />
      </CreditDisclosure>
      <CreditDisclosure title="최근 사용 내역" summary="차감과 환급 기록">
        <UsageHistory items={usages} />
      </CreditDisclosure>
      <CreditDisclosure title="기능별 사용량" summary="AI 기능별 비용">
        <CreditFlowCatalog flows={flows} />
      </CreditDisclosure>
      <CreditDisclosure title="이용 안내" summary="사용 순서와 환급 정책">
        <CreditChargeOrder />
        <CreditPolicy />
      </CreditDisclosure>
    </section>
  );
}

function CreditDisclosure({ children, summary, title }: { children: React.ReactNode; summary: string; title: string }): React.ReactElement {
  return (
    <details>
      <summary>
        <span>
          <b>{title}</b>
          <small>{summary}</small>
        </span>
        <AliveIcon name="chevron-down" size={17} />
      </summary>
      <div className="al-credit-disclosure-body">{children}</div>
    </details>
  );
}

function UsageHistory({ items }: { items: CreditUsage[] }): React.ReactElement {
  const visible = items
    .filter((item) => item.credits > 0 || item.energy_percent > 0)
    .slice(0, 5);
  return (
    <section className="al-credit-history">
      <header>
        <span>최근 사용</span>
        <small>최대 5개</small>
      </header>
      {visible.length ? (
        <ul>
          {visible.map((item) => (
            <UsageRow item={item} key={item.id} />
          ))}
        </ul>
      ) : (
        <p>아직 기록된 사용 내역이 없어요.</p>
      )}
    </section>
  );
}

function UsageRow({ item }: { item: CreditUsage }): React.ReactElement {
  const refunded = item.status === "refunded";
  const pending = item.status === "reserved";
  const amount = creditUsageAmount(item);
  const status = refunded
    ? `환급 · ${amount}`
    : pending
      ? `처리 중 · ${amount}`
      : `-${amount}`;
  return (
    <li>
      <span>
        <b>{flowLabel(item.flow)}</b>
        <small>{formatUsageTime(item.created_at)}</small>
      </span>
      <em className={refunded ? "refunded" : pending ? "pending" : ""}>
        {status}
      </em>
    </li>
  );
}

function CreditPolicy(): React.ReactElement {
  return (
    <aside className="al-credit-policy">
      <span>이용 안내</span>
      <p>
        일반 기능은 회복 에너지 → 무료 보너스 → 구매 크레딧 순서로 사용되고,
        Pro 기능은 구매 크레딧만 사용해요. AI 생성이 실패하거나 안전 정책으로
        중단되면 예약된 사용량은 자동 환급돼요. 베타 기간에는 무료 보너스와
        구매 크레딧 모두 만료 없이 누적돼요.
      </p>
    </aside>
  );
}

function offerDescription(offer: CreditOffer): string {
  if (!offer.product_bonus_credits) return offer.label;
  return `기본 ${offer.base_credits.toLocaleString("ko-KR")} + 추가 ${offer.product_bonus_credits.toLocaleString("ko-KR")}`;
}

function offerPriceText(offer: CreditOffer, displayAmount?: string): string {
  if (displayAmount) return displayAmount;
  if (offer.payment_available) return "가격 확인 중";
  return `${offer.price_krw.toLocaleString("ko-KR")}원`;
}

function energyStatusText(balance: CreditBalance | null): string {
  if (!balance) return "확인 중";
  const recovery = balance.next_energy_recovery_at
    ? `다음 회복 ${formatRecoveryTime(balance.next_energy_recovery_at)}`
    : "현재 최대치";
  return `${balance.energy_percent}% · ${recovery}`;
}

function numberText(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString("ko-KR");
}
function formatRecoveryTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function formatUsageTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function flowLabel(flow: string): string {
  const dmLabel = dmResponseFlowLabel(flow);
  if (dmLabel) return dmLabel;
  return (
    (
      {
        direct_dm_basic: "기본 대화",
        feed_post: "피드 글 생성",
        auto_feed_post: "혼자 남긴 근황",
        character_interaction: "캐릭터 상호작용",
      } as Record<string, string>
    )[flow] || "AI 기능"
  );
}
