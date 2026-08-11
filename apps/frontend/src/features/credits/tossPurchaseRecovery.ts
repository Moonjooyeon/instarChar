import { grantCreditPurchase } from "@/api/credits";
import { completeTossIapGrant, getPendingTossIapOrders, getRefundedTossIapOrders, getTossIapEnvironment, TOSS_IAP_SANDBOX_FIXTURE_SKU } from "@/api/tossIap";
import type { TossIapEnvironment } from "@/api/credits";
import { filterConfiguredPurchaseOrders, pendingPurchaseRecoveryAttempt, summarizePurchaseRecovery, type PurchaseRecoveryAttempt, type PurchaseRecoverySummary } from "@/domain/credits/tossPurchaseRecovery";


export type PurchaseRecoveryResult = { restored: number; refunded: number; pending: number; failed: number };

let recoveryInFlight: Promise<PurchaseRecoveryResult> | null = null;

export function recoverTossCreditPurchases(configuredSkus: readonly string[]): Promise<PurchaseRecoveryResult> {
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = runRecovery(configuredSkus).finally(() => { recoveryInFlight = null; });
  return recoveryInFlight;
}

async function runRecovery(configuredSkus: readonly string[]): Promise<PurchaseRecoveryResult> {
  const environment = await getTossIapEnvironment();
  const restored = await restorePendingPurchases(configuredSkus, environment);
  const refunded = environment === "toss" ? await reconcileRefundedPurchases(configuredSkus) : summarizePurchaseRecovery([]);
  return { restored: restored.updated, refunded: refunded.updated, pending: restored.pending, failed: restored.failed + refunded.failed };
}

async function restorePendingPurchases(configuredSkus: readonly string[], environment: TossIapEnvironment): Promise<PurchaseRecoverySummary> {
  const orders = await getPendingTossIapOrders();
  if (!orders) return summarizePurchaseRecovery([]);
  const extraSkus = environment === "sandbox" ? [TOSS_IAP_SANDBOX_FIXTURE_SKU] : [];
  return settleRecovery(filterConfiguredPurchaseOrders(orders, configuredSkus, extraSkus).map((order) => restorePendingOrder(order.orderId, order.sku, environment)));
}

async function restorePendingOrder(orderId: string, sku: string, environment: TossIapEnvironment): Promise<PurchaseRecoveryAttempt> {
  try {
    const result = await grantCreditPurchase(orderId, sku, environment);
    const acknowledged = result.status === "granted" && await completeTossIapGrant(orderId);
    return pendingPurchaseRecoveryAttempt(result.status, acknowledged);
  } catch {
    return "failed";
  }
}

async function reconcileRefundedPurchases(configuredSkus: readonly string[]): Promise<PurchaseRecoverySummary> {
  const orders = await getRefundedTossIapOrders();
  if (!orders) return summarizePurchaseRecovery([]);
  return settleRecovery(filterConfiguredPurchaseOrders(orders, configuredSkus).map((order) => reconcileRefundedOrder(order.orderId, order.sku)));
}

async function reconcileRefundedOrder(orderId: string, sku: string): Promise<PurchaseRecoveryAttempt> {
  try {
    const result = await grantCreditPurchase(orderId, sku, "toss");
    return result.status === "refunded" ? "updated" : "failed";
  } catch {
    return "failed";
  }
}

async function settleRecovery(tasks: Promise<PurchaseRecoveryAttempt>[]): Promise<PurchaseRecoverySummary> {
  return summarizePurchaseRecovery(await Promise.all(tasks));
}
