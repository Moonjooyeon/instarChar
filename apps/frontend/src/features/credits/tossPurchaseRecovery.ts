import { grantCreditPurchase } from "@/api/credits";
import { completeTossIapGrant, getPendingTossIapOrders, getRefundedTossIapOrders } from "@/api/tossIap";


export type PurchaseRecoveryResult = { restored: number; refunded: number; failed: number };
type RecoveryCount = { updated: number; failed: number };

let recoveryInFlight: Promise<PurchaseRecoveryResult> | null = null;

export function recoverTossCreditPurchases(): Promise<PurchaseRecoveryResult> {
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = runRecovery().finally(() => { recoveryInFlight = null; });
  return recoveryInFlight;
}

async function runRecovery(): Promise<PurchaseRecoveryResult> {
  const restored = await restorePendingPurchases();
  const refunded = await reconcileRefundedPurchases();
  return { restored: restored.updated, refunded: refunded.updated, failed: restored.failed + refunded.failed };
}

async function restorePendingPurchases(): Promise<RecoveryCount> {
  const orders = await getPendingTossIapOrders();
  if (!orders) return { updated: 0, failed: 0 };
  return settleRecovery(orders.map((order) => restorePendingOrder(order.orderId)));
}

async function restorePendingOrder(orderId: string): Promise<boolean> {
  try {
    const result = await grantCreditPurchase(orderId);
    if (result.status !== "granted") return false;
    return completeTossIapGrant(orderId);
  } catch {
    return false;
  }
}

async function reconcileRefundedPurchases(): Promise<RecoveryCount> {
  const orders = await getRefundedTossIapOrders();
  if (!orders) return { updated: 0, failed: 0 };
  return settleRecovery(orders.map((order) => reconcileRefundedOrder(order.orderId)));
}

async function reconcileRefundedOrder(orderId: string): Promise<boolean> {
  try {
    const result = await grantCreditPurchase(orderId);
    return result.status === "refunded";
  } catch {
    return false;
  }
}

async function settleRecovery(tasks: Promise<boolean>[]): Promise<RecoveryCount> {
  const results = await Promise.all(tasks);
  const updated = results.filter(Boolean).length;
  return { updated, failed: results.length - updated };
}
