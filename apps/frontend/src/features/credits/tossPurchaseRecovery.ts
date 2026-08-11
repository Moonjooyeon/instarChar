import { grantCreditPurchase } from "@/api/credits";
import { completeTossIapGrant, getPendingTossIapOrders, getRefundedTossIapOrders } from "@/api/tossIap";
import { pendingPurchaseRecoveryAttempt, summarizePurchaseRecovery, type PurchaseRecoveryAttempt, type PurchaseRecoverySummary } from "@/domain/credits/tossPurchaseRecovery";


export type PurchaseRecoveryResult = { restored: number; refunded: number; pending: number; failed: number };

let recoveryInFlight: Promise<PurchaseRecoveryResult> | null = null;

export function recoverTossCreditPurchases(): Promise<PurchaseRecoveryResult> {
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = runRecovery().finally(() => { recoveryInFlight = null; });
  return recoveryInFlight;
}

async function runRecovery(): Promise<PurchaseRecoveryResult> {
  const restored = await restorePendingPurchases();
  const refunded = await reconcileRefundedPurchases();
  return { restored: restored.updated, refunded: refunded.updated, pending: restored.pending, failed: restored.failed + refunded.failed };
}

async function restorePendingPurchases(): Promise<PurchaseRecoverySummary> {
  const orders = await getPendingTossIapOrders();
  if (!orders) return summarizePurchaseRecovery([]);
  return settleRecovery(orders.map((order) => restorePendingOrder(order.orderId)));
}

async function restorePendingOrder(orderId: string): Promise<PurchaseRecoveryAttempt> {
  try {
    const result = await grantCreditPurchase(orderId);
    const acknowledged = result.status === "granted" && await completeTossIapGrant(orderId);
    return pendingPurchaseRecoveryAttempt(result.status, acknowledged);
  } catch {
    return "failed";
  }
}

async function reconcileRefundedPurchases(): Promise<PurchaseRecoverySummary> {
  const orders = await getRefundedTossIapOrders();
  if (!orders) return summarizePurchaseRecovery([]);
  return settleRecovery(orders.map((order) => reconcileRefundedOrder(order.orderId)));
}

async function reconcileRefundedOrder(orderId: string): Promise<PurchaseRecoveryAttempt> {
  try {
    const result = await grantCreditPurchase(orderId);
    return result.status === "refunded" ? "updated" : "failed";
  } catch {
    return "failed";
  }
}

async function settleRecovery(tasks: Promise<PurchaseRecoveryAttempt>[]): Promise<PurchaseRecoverySummary> {
  return summarizePurchaseRecovery(await Promise.all(tasks));
}
