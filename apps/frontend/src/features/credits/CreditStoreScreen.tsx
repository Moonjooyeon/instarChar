import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";

interface CreditCatalog {
  balance: number | null;
  offers: readonly CreditOffer[];
}

interface CreditOffer {
  credits: number;
  id: string;
  isFeatured?: boolean;
  label: string;
  priceLabel: string;
}

interface CreditStoreScreenProps {
  catalog?: CreditCatalog;
  onBack: () => void;
}

const MOCK_CREDIT_CATALOG: CreditCatalog = {
  balance: null,
  offers: [
    { credits: 100, id: "light", label: "가볍게 이어가기", priceLabel: "가격 미정" },
    { credits: 500, id: "regular", isFeatured: true, label: "꾸준히 이어가기", priceLabel: "가격 미정" },
    { credits: 1000, id: "deep", label: "오래 즐기기", priceLabel: "가격 미정" },
  ],
};

export function CreditStoreScreen({ catalog = MOCK_CREDIT_CATALOG, onBack }: CreditStoreScreenProps): React.ReactElement {
  const featuredOffer = catalog.offers.find((offer) => offer.isFeatured) || catalog.offers[0];
  const [selectedOfferId, setSelectedOfferId] = React.useState(featuredOffer?.id || "");
  const selectedOffer = catalog.offers.find((offer) => offer.id === selectedOfferId) || featuredOffer;
  return <div className="al-phone al-theme-ready al-credit-theme-ready"><main className="al-credit-screen"><CreditHeader onBack={onBack} /><CreditBalance balance={catalog.balance} /><CreditUseCases /><CreditOfferList offers={catalog.offers} selectedOfferId={selectedOffer?.id || ""} onSelect={setSelectedOfferId} /><CreditCheckout offer={selectedOffer} /><CreditPolicy /></main></div>;
}

function CreditHeader({ onBack }: { onBack: () => void }): React.ReactElement {
  return <header className="al-credit-head"><div><button type="button" onClick={onBack} aria-label="이전 화면으로"><AliveIcon name="chevron-left" size={21} /></button><span>CREDIT</span></div><h1>이야기를 이어갈 크레딧</h1><p>글을 부탁하거나 대화를 이어갈 때 필요한 만큼 사용해요.</p></header>;
}

function CreditBalance({ balance }: { balance: number | null }): React.ReactElement {
  return <section className="al-credit-balance" aria-label="크레딧 잔액"><header><span><AliveIcon name="wallet" size={16} /> 현재 크레딧</span><small>{balance === null ? "연결 준비 중" : "사용 가능"}</small></header><strong>{balance === null ? "—" : balance.toLocaleString("ko-KR")} <small>C</small></strong><p>{balance === null ? "잔액은 결제 API 연결 후 이곳에 표시됩니다." : "지금 사용할 수 있는 잔액입니다."}</p></section>;
}

function CreditUseCases(): React.ReactElement {
  return <section className="al-credit-uses" aria-label="크레딧 사용처"><header><b>크레딧으로 이어지는 것</b><small>사용 예정</small></header><div><span><AliveIcon name="pen" size={15} /> 글 부탁하기</span><span><AliveIcon name="message" size={15} /> 대화 이어가기</span><span><AliveIcon name="sparkle" size={15} /> 장면 만들기</span></div></section>;
}

function CreditOfferList({ offers, onSelect, selectedOfferId }: { offers: readonly CreditOffer[]; onSelect: (offerId: string) => void; selectedOfferId: string }): React.ReactElement {
  return <section className="al-credit-offers" aria-labelledby="credit-offers-title"><header><div><span>충전</span><h2 id="credit-offers-title">필요한 만큼 선택하세요</h2></div><small>가격 확정 전</small></header><div>{offers.map((offer) => <CreditOfferRow isSelected={offer.id === selectedOfferId} key={offer.id} offer={offer} onSelect={onSelect} />)}</div></section>;
}

function CreditOfferRow({ isSelected, offer, onSelect }: { isSelected: boolean; offer: CreditOffer; onSelect: (offerId: string) => void }): React.ReactElement {
  return <button className={isSelected ? "selected" : ""} type="button" aria-pressed={isSelected} onClick={() => onSelect(offer.id)}><span><b>{offer.credits.toLocaleString("ko-KR")} C</b><small>{offer.label}</small></span><em>{offer.isFeatured && <small>기본 선택</small>}<b>{offer.priceLabel}</b></em><u aria-hidden="true" /></button>;
}

function CreditCheckout({ offer }: { offer?: CreditOffer }): React.ReactElement {
  return <section className="al-credit-checkout"><div><span>선택한 크레딧</span><b>{offer ? `${offer.credits.toLocaleString("ko-KR")} C` : "상품 없음"}</b></div><button type="button" disabled>결제 준비 중</button><p><AliveIcon name="check" size={13} /> 현재 화면에서는 결제가 발생하지 않습니다.</p></section>;
}

function CreditPolicy(): React.ReactElement {
  return <aside className="al-credit-policy"><span>구매 전 안내</span><p>정식 결제 전에는 실제 가격, 지급 수량, 유효기간과 환불 기준을 한 번 더 보여드릴게요.</p></aside>;
}
