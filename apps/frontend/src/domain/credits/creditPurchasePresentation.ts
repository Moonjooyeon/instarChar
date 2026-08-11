import type { CreditPurchase } from "@/api/credits";


export function creditPurchaseCredits(purchase: CreditPurchase): number {
  if (purchase.granted_credits > 0) return purchase.granted_credits;
  return purchase.base_credits + purchase.product_bonus_credits;
}

export function creditPurchaseStatusText(status: CreditPurchase["status"]): string {
  if (status === "granted") return "지급 완료";
  if (status === "refunded") return "환불 완료";
  if (status === "failed") return "결제 실패";
  return status === "review" ? "확인 필요" : "처리 중";
}

export function creditPurchaseTime(purchase: CreditPurchase): string {
  return purchase.refunded_at || purchase.granted_at || purchase.created_at;
}
