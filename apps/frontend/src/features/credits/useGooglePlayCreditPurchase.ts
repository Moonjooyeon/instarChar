import React from "react";

import { getGooglePlayPurchaseContext, grantGooglePlayCreditPurchase, type CreditOffer } from "@/api/credits";
import { getGooglePlayProducts, getGooglePlayPurchases, googlePlayIapErrorMessage, isGooglePlayIapRuntime, startGooglePlayPurchase, type GooglePlayProduct } from "@/api/googlePlayIap";
import type { CreditPurchaseState } from "@/features/credits/creditPurchaseTypes";


export function useGooglePlayCreditPurchase(offers: CreditOffer[], onUpdated: () => void): CreditPurchaseState {
  const [products, setProducts] = React.useState<GooglePlayProduct[]>([]);
  const [purchasingProductId, setPurchasingProductId] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [error, setError] = React.useState("");
  const productIds = offers.map((offer) => offer.google_play_product_id).filter(Boolean).join("|");
  React.useEffect(() => initializeGooglePlay(productIds, setProducts, setNotice, setError, onUpdated), [productIds, onUpdated]);
  const purchase = React.useCallback(async (productId: string) => {
    setPurchasingProductId(productId);
    setNotice("Google Play 결제를 진행하고 있어요.");
    setError("");
    try {
      const context = await getGooglePlayPurchaseContext();
      if (!context.available) throw new Error("Google Play purchase is unavailable");
      const result = await startGooglePlayPurchase(productId, context.obfuscated_account_id);
      await grantPurchase(result, setNotice);
      setPurchasingProductId("");
      onUpdated();
    } catch (value) {
      setPurchasingProductId("");
      setNotice("");
      setError(googlePlayIapErrorMessage(value));
    }
  }, [onUpdated]);
  return { displayAmounts: displayAmounts(products), availableProductIds: new Set(products.map((product) => product.productId)), purchasingProductId, notice, error, purchase };
}

function initializeGooglePlay(productIds: string, setProducts: React.Dispatch<React.SetStateAction<GooglePlayProduct[]>>, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): () => void {
  let active = true;
  if (!productIds || !isGooglePlayIapRuntime()) return () => undefined;
  getGooglePlayProducts(productIds.split("|")).then((items) => active && setProducts(items)).catch((value) => active && setError(googlePlayIapErrorMessage(value)));
  recoverGooglePlayPurchases(productIds.split("|"), active, setNotice, setError, onUpdated);
  return () => { active = false; };
}

async function recoverGooglePlayPurchases(productIds: string[], active: boolean, setNotice: React.Dispatch<React.SetStateAction<string>>, setError: React.Dispatch<React.SetStateAction<string>>, onUpdated: () => void): Promise<void> {
  try {
    const purchases = (await getGooglePlayPurchases()).filter((purchase) => productIds.includes(purchase.productId));
    const completed = purchases.filter((purchase) => purchase.state === "purchased");
    await Promise.all(completed.map((purchase) => grantGooglePlayCreditPurchase(purchase.purchaseToken)));
    if (!active || !purchases.length) return;
    if (purchases.some((purchase) => purchase.state === "pending")) setNotice("결제 승인을 기다리고 있어요. 완료되면 크레딧을 지급해요.");
    if (completed.length) onUpdated();
  } catch (value) {
    if (active) setError(googlePlayIapErrorMessage(value));
  }
}

async function grantPurchase(purchase: { purchaseToken: string; state: "purchased" | "pending" }, setNotice: React.Dispatch<React.SetStateAction<string>>): Promise<void> {
  if (purchase.state === "pending") {
    setNotice("결제 승인을 기다리고 있어요. 완료되면 크레딧을 지급해요.");
    return;
  }
  await grantGooglePlayCreditPurchase(purchase.purchaseToken);
  setNotice("결제가 완료되어 크레딧을 지급했어요.");
}

function displayAmounts(products: GooglePlayProduct[]): Record<string, string> {
  return Object.fromEntries(products.map((product) => [product.productId, product.displayAmount]));
}
