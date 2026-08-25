import React from "react";

import { getAppStorePurchaseContext, grantAppStoreCreditPurchase, type CreditOffer, type CreditPurchaseGrant } from "@/api/credits";
import { appStoreIapErrorMessage, finishAppStorePurchase, getAppStoreProducts, getUnfinishedAppStorePurchases, isAppStoreIapRuntime, listenAppStoreTransactions, startAppStorePurchase, type AppStoreProduct, type AppStorePurchase } from "@/api/appStoreIap";
import type { CreditPurchaseState } from "@/features/credits/creditPurchaseTypes";


export function useAppStoreCreditPurchase(offers: CreditOffer[], onUpdated: () => void): CreditPurchaseState {
  const [products, setProducts] = React.useState<AppStoreProduct[]>([]);
  const [purchasingProductId, setPurchasingProductId] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const productIds = offers.map((offer) => offer.app_store_product_id).filter(Boolean).join("|");
  React.useEffect(() => initializeAppStore(productIds, setProducts, setNotice, setError, onUpdated), [productIds, onUpdated]);
  React.useEffect(() => observeAppStoreTransactions(setNotice, setError, onUpdated), [onUpdated]);
  const purchase = React.useCallback(async (productId: string) => {
    setPurchasingProductId(productId);
    setNotice("App Store 결제를 진행하고 있어요.");
    setError("");
    try {
      const context = await getAppStorePurchaseContext();
      if (!context.available) throw new Error("App Store purchase is unavailable");
      const result = await startAppStorePurchase(productId, context.app_account_token);
      await grantAndFinish(result);
      setPurchasingProductId("");
      setNotice("결제가 완료되어 크레딧을 지급했어요.");
      onUpdated();
    } catch (value) {
      setPurchasingProductId("");
      setNotice("");
      setError(appStoreIapErrorMessage(value));
    }
  }, [onUpdated]);
  return { displayAmounts: displayAmounts(products), availableProductIds: new Set(products.map((product) => product.productId)), purchasingProductId, notice, error, purchase };
}

function initializeAppStore(productIds: string, setProducts: React.Dispatch<React.SetStateAction<AppStoreProduct[]>>, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): () => void {
  let active = true;
  if (!productIds || !isAppStoreIapRuntime()) return () => undefined;
  getAppStoreProducts(productIds.split("|")).then((items) => active && setProducts(items)).catch((value) => active && setError(appStoreIapErrorMessage(value)));
  recoverAppStorePurchases(productIds.split("|"), active, setNotice, setError, onUpdated);
  return () => { active = false; };
}

function observeAppStoreTransactions(setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): () => void {
  let active = true;
  let remove = async (): Promise<void> => undefined;
  listenAppStoreTransactions((purchase) => grantAndFinish(purchase).then(() => active && finishObservedPurchase(setNotice, onUpdated)).catch((value) => active && setError(appStoreIapErrorMessage(value)))).then((value) => { remove = value; });
  return () => { active = false; void remove(); };
}

async function recoverAppStorePurchases(productIds: string[], active: boolean, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): Promise<void> {
  try {
    const purchases = (await getUnfinishedAppStorePurchases()).filter((purchase) => productIds.includes(purchase.productId));
    await Promise.all(purchases.map(grantAndFinish));
    if (!active || !purchases.length) return;
    setNotice(`미지급 결제 ${purchases.length}건의 크레딧을 복원했어요.`);
    onUpdated();
  } catch (value) {
    if (active) setError(appStoreIapErrorMessage(value));
  }
}

async function grantAndFinish(purchase: AppStorePurchase): Promise<void> {
  const grant = await grantAppStoreCreditPurchase(purchase.signedTransaction);
  if (!isFinishedGrant(grant)) throw new Error("App Store purchase is pending");
  await finishAppStorePurchase(purchase.transactionId);
}

function isFinishedGrant(grant: CreditPurchaseGrant): boolean {
  return grant.status === "granted" || grant.status === "refunded";
}

function finishObservedPurchase(setNotice: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): void {
  setNotice("결제가 완료되어 크레딧을 지급했어요.");
  onUpdated();
}

function displayAmounts(products: AppStoreProduct[]): Record<string, string> {
  return Object.fromEntries(products.map((product) => [product.productId, product.displayAmount]));
}
