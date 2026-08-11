type ConfiguredOffer = { sku: string };
type PurchaseOrder = { sku: string };
export type PurchaseRecoveryAttempt = "updated" | "pending" | "failed";
export type PurchaseRecoverySummary = { updated: number; pending: number; failed: number };


export function shouldRecoverTossPurchases(userId: string, offers: readonly ConfiguredOffer[], runtime: string): boolean {
  return Boolean(userId && runtime === "apps-in-toss" && offers.some((offer) => Boolean(offer.sku)));
}

export function filterConfiguredPurchaseOrders<Order extends PurchaseOrder>(orders: readonly Order[], configuredSkus: readonly string[], additionalSkus: readonly string[] = []): Order[] {
  const allowedSkus = new Set([...configuredSkus, ...additionalSkus].filter(Boolean));
  return orders.filter((order) => allowedSkus.has(order.sku));
}

export function pendingPurchaseRecoveryAttempt(status: string, acknowledged: boolean): PurchaseRecoveryAttempt {
  if (status !== "granted") return "failed";
  return acknowledged ? "updated" : "pending";
}

export function summarizePurchaseRecovery(attempts: readonly PurchaseRecoveryAttempt[]): PurchaseRecoverySummary {
  const pending = attempts.filter((attempt) => attempt === "pending").length;
  const failed = attempts.filter((attempt) => attempt === "failed").length;
  return { updated: attempts.length - failed, pending, failed };
}
