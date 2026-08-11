import React from "react";

import { grantCreditPurchase, type CreditOffer } from "@/api/credits";
import { completeTossIapGrant, getPendingTossIapOrders, getRefundedTossIapOrders, getTossIapProducts, isAppsInTossIapRuntime, startTossIapPurchase, tossIapErrorMessage, type TossIapProduct } from "@/api/tossIap";


type TossCreditPurchaseState = {
  displayAmounts: Record<string, string>;
  availableSkus: ReadonlySet<string>;
  purchasingSku: string;
  notice: string;
  error: string;
  purchase: (sku: string) => Promise<void>;
};

type RecoveryCount = { updated: number; failed: number };
type PurchaseRecoveryResult = { restored: number; refunded: number; failed: number };

export function useTossCreditPurchase(offers: CreditOffer[], onUpdated: () => void): TossCreditPurchaseState {
  const [products, setProducts] = React.useState<TossIapProduct[]>([]);
  const [purchasingSku, setPurchasingSku] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const cleanup = React.useRef<(() => void) | null>(null);
  const configuredSkus = offers.map((offer) => offer.sku).filter(Boolean).join("|");
  React.useEffect(() => initializePurchases(configuredSkus, setProducts, setNotice, setError, onUpdated), [configuredSkus, onUpdated]);
  React.useEffect(() => () => cleanup.current?.(), []);
  const purchase = React.useCallback(async (sku: string) => {
    preparePurchase(sku, cleanup, setPurchasingSku, setNotice, setError);
    try {
      cleanup.current = await startTossIapPurchase(sku, { grant: grantCreditPurchase, success: () => finishPurchase(cleanup, setPurchasingSku, setNotice, onUpdated), error: (value) => failPurchase(value, cleanup, setPurchasingSku, setNotice, setError) });
    } catch (value) {
      failPurchase(value, cleanup, setPurchasingSku, setNotice, setError);
    }
  }, [onUpdated]);
  return { displayAmounts: displayAmounts(products), availableSkus: new Set(products.map((product) => product.sku)), purchasingSku, notice, error, purchase };
}

function preparePurchase(sku: string, cleanup: React.MutableRefObject<(() => void) | null>, setPurchasingSku: React.Dispatch<React.SetStateAction<string>>, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>): void {
  cleanup.current?.();
  cleanup.current = null;
  setPurchasingSku(sku);
  setNotice("결제를 진행하고 있어요.");
  setError("");
}

function initializePurchases(configuredSkus: string, setProducts: React.Dispatch<React.SetStateAction<TossIapProduct[]>>, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): () => void {
  let active = true;
  if (!configuredSkus || !isAppsInTossIapRuntime()) return () => undefined;
  getTossIapProducts().then((items) => handleProducts(items, active, setProducts, setError)).catch((value) => active && setError(tossIapErrorMessage(value)));
  recoverPurchases().then((result) => handleRecovered(result, active, setNotice, setError, onUpdated)).catch(() => active && setError("결제 내역을 확인하지 못했어요. 다시 시도해 주세요."));
  return () => { active = false; };
}

async function recoverPurchases(): Promise<PurchaseRecoveryResult> {
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

function handleProducts(items: TossIapProduct[] | null, active: boolean, setProducts: React.Dispatch<React.SetStateAction<TossIapProduct[]>>, setError: React.Dispatch<React.SetStateAction<string>>): void {
  if (!active) return;
  if (!items) {
    setError("토스 앱을 최신 버전으로 업데이트해 주세요.");
    return;
  }
  setProducts(items);
}

function handleRecovered(result: PurchaseRecoveryResult, active: boolean, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): void {
  if (!active) return;
  if (result.failed > 0) setError(`결제 내역 ${result.failed}건을 확인하지 못했어요. 다시 시도해 주세요.`);
  if (result.restored > 0) setNotice(`미지급 주문 ${result.restored}건의 크레딧을 복원했어요.`);
  if (result.restored + result.refunded > 0) onUpdated();
}

function finishPurchase(cleanup: React.MutableRefObject<(() => void) | null>, setPurchasingSku: React.Dispatch<React.SetStateAction<string>>, setNotice: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): void {
  cleanup.current?.();
  cleanup.current = null;
  setPurchasingSku("");
  setNotice("결제가 완료되어 크레딧을 지급했어요.");
  onUpdated();
}

function failPurchase(error: unknown, cleanup: React.MutableRefObject<(() => void) | null>, setPurchasingSku: React.Dispatch<React.SetStateAction<string>>, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>): void {
  cleanup.current?.();
  cleanup.current = null;
  setPurchasingSku("");
  setNotice("");
  setError(tossIapErrorMessage(error));
}

function displayAmounts(products: TossIapProduct[]): Record<string, string> {
  return Object.fromEntries(products.map((product) => [product.sku, product.displayAmount]));
}
