import React from "react";

import type { CreditPurchase } from "@/api/credits";
import { creditPurchaseCredits, creditPurchaseStatusText, creditPurchaseTime } from "@/domain/credits/creditPurchasePresentation";


export function CreditPurchaseHistory({ items }: { items: readonly CreditPurchase[] }): React.ReactElement {
  return (
    <section className="al-credit-history">
      <header><span>최근 결제</span><small>최대 30개</small></header>
      {items.length ? <ul>{items.map((item) => <PurchaseRow item={item} key={item.provider_order_id} />)}</ul> : <p>아직 결제 내역이 없어요.</p>}
    </section>
  );
}

function PurchaseRow({ item }: { item: CreditPurchase }): React.ReactElement {
  const credits = creditPurchaseCredits(item).toLocaleString("ko-KR");
  const statusClass = item.status === "refunded" ? "refunded" : item.status === "processing" || item.status === "review" ? "pending" : "";
  return (
    <li>
      <span><b>크레딧 {credits}C</b><small>{formatPurchaseTime(creditPurchaseTime(item))} · 주문 {shortOrderId(item.provider_order_id)}</small></span>
      <em className={statusClass}>{creditPurchaseStatusText(item.status)}</em>
    </li>
  );
}

function shortOrderId(orderId: string): string {
  return orderId.length > 8 ? `…${orderId.slice(-8)}` : orderId;
}

function formatPurchaseTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
