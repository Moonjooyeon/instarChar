import React from "react";
import {
  getCreditBalance,
  getCreditCatalog,
  getCreditUsage,
  type CreditBalance,
  type CreditCatalog,
  type CreditOffer,
  type CreditUsage,
} from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditUsageAmount } from "@/domain/credits/creditPresentation";
import { CreditChargeOrder, CreditFlowCatalog } from "@/features/credits/CreditFlowCatalog";

interface CreditStoreScreenProps {
  onBack: () => void;
}
type CreditStoreData = {
  balance: CreditBalance | null;
  catalog: CreditCatalog | null;
  usages: CreditUsage[];
};

export function CreditStoreScreen({
  onBack,
}: CreditStoreScreenProps): React.ReactElement {
  const { data, error, loading, retry } = useCreditStoreData();
  const offers = data.catalog?.offers || [];
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
        <CreditBalanceCard balance={data.balance} />
        <EnergyCard balance={data.balance} />
        <CreditChargeOrder />
        <CreditFlowCatalog flows={data.catalog?.flows || []} />
        <UsageHistory items={data.usages} />
        <OfferList
          offers={offers}
          selectedId={selected?.id || ""}
          onSelect={setSelectedId}
        />
        <CheckoutPreview offer={selected} />
        <CreditPolicy />
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
    usages: [],
  });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);
  React.useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getCreditBalance(), getCreditCatalog(), getCreditUsage()])
      .then(([balance, catalog, usage]) =>
        setData({ balance, catalog, usages: usage.items }),
      )
      .catch(() => setError("크레딧 정보를 불러오지 못했어."))
      .finally(() => setLoading(false));
  }, [refreshKey]);
  return {
    data,
    error,
    loading,
    retry: () => setRefreshKey((value) => value + 1),
  };
}

function CreditHeader({ onBack }: { onBack: () => void }): React.ReactElement {
  return (
    <header className="al-credit-head">
      <div>
        <button type="button" onClick={onBack} aria-label="이전 화면으로">
          <AliveIcon name="chevron-left" size={21} />
        </button>
        <span>CREDIT</span>
      </div>
      <h1>이야기를 이어갈 크레딧</h1>
      <p>무료 에너지를 먼저 사용하고, 더 이어가고 싶을 때 크레딧을 사용해요.</p>
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

function CreditBalanceCard({
  balance,
}: {
  balance: CreditBalance | null;
}): React.ReactElement {
  return (
    <section className="al-credit-balance" aria-label="크레딧 잔액">
      <header>
        <span>
          <AliveIcon name="wallet" size={16} /> 현재 크레딧
        </span>
        <small>{balance ? "사용 가능" : "—"}</small>
      </header>
      <strong>
        {numberText(balance?.total_credits)} <small>C</small>
      </strong>
      <div className="al-credit-balance-breakdown">
        <span>
          <small>무료 보너스</small>
          <b>{numberText(balance?.bonus_credits)}C</b>
          <em>활동 보상 · 먼저 사용</em>
        </span>
        <span>
          <small>구매 크레딧</small>
          <b>{numberText(balance?.purchased_credits)}C</b>
          <em>충전 잔액 · Pro에도 사용</em>
        </span>
      </div>
    </section>
  );
}

function EnergyCard({
  balance,
}: {
  balance: CreditBalance | null;
}): React.ReactElement {
  const percent = balance?.energy_percent || 0;
  const recovery = balance?.next_energy_recovery_at
    ? `다음 회복 ${formatRecoveryTime(balance.next_energy_recovery_at)}`
    : "현재 최대치예요";
  return (
    <section className="al-credit-energy" aria-label="무료 회복 에너지">
      <header>
        <div>
          <AliveIcon name="sun" size={15} />
          <b>무료 회복 에너지</b>
        </div>
        <span>{balance ? `${percent}%` : "—"}</span>
      </header>
      <div
        className="al-credit-energy-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      <p>
        {balance ? `${recovery} · 자정 초기화 없이 100%에서 사용 후 6시간마다 25%` : "에너지를 확인하고 있어요."}
      </p>
    </section>
  );
}

function OfferList({
  offers,
  onSelect,
  selectedId,
}: {
  offers: readonly CreditOffer[];
  onSelect: (id: string) => void;
  selectedId: string;
}): React.ReactElement {
  return (
    <section className="al-credit-offers" aria-labelledby="credit-offers-title">
      <header>
        <div>
          <span>충전 상품</span>
          <h2 id="credit-offers-title">필요한 만큼 선택하세요</h2>
        </div>
        <small>결제 연결 전</small>
      </header>
      <div>
        {offers.map((offer) => (
          <OfferRow
            isSelected={offer.id === selectedId}
            key={offer.id}
            offer={offer}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function OfferRow({
  isSelected,
  offer,
  onSelect,
}: {
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
        <small>{offer.label}</small>
      </span>
      <em>
        {offer.id === "credit-30000" && <mark>추천</mark>}
        <b>{offer.price_krw.toLocaleString("ko-KR")}원</b>
        <small>
          첫 구매 {offer.first_purchase_total_credits.toLocaleString("ko-KR")}C
        </small>
      </em>
      <u aria-hidden="true" />
    </button>
  );
}

function CheckoutPreview({
  offer,
}: {
  offer?: CreditOffer;
}): React.ReactElement {
  return (
    <section className="al-credit-checkout">
      <div>
        <span>선택한 상품</span>
        <b>
          {offer
            ? `${offer.price_krw.toLocaleString("ko-KR")}원 · ${offer.total_credits.toLocaleString("ko-KR")}C`
            : "상품 확인 중"}
        </b>
      </div>
      <button type="button" disabled>
        인앱 결제 신청 후 연결
      </button>
      <p>
        <AliveIcon name="check" size={13} /> 지금은 결제가 발생하지 않아요.
      </p>
    </section>
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
  return (
    (
      {
        direct_dm_basic: "기본 대화",
        direct_dm_context: "문맥형 대화",
        direct_dm_flash_long: "긴 대화",
        direct_dm_pro: "Pro 대화",
        direct_dm_pro_story: "Pro 서사형",
        feed_post: "피드 글 생성",
        image_understanding: "이미지 이해",
        character_interaction: "캐릭터 상호작용",
      } as Record<string, string>
    )[flow] || "AI 기능"
  );
}
