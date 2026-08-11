import React from "react";

import { getCreditCatalog, notifyCreditBalanceUpdated, type CreditOffer } from "@/api/credits";
import { isAppsInTossIapRuntime } from "@/api/tossIap";
import { shouldRecoverTossPurchases } from "@/domain/credits/tossPurchaseRecovery";
import { recoverTossCreditPurchases } from "@/features/credits/tossPurchaseRecovery";


export function useTossPurchaseRecovery(userId: string): void {
  React.useEffect(() => startSessionRecovery(userId), [userId]);
}

function startSessionRecovery(userId: string): () => void {
  let active = true;
  if (!userId || !isAppsInTossIapRuntime()) return () => undefined;
  getCreditCatalog().then((catalog) => recoverConfiguredPurchases(userId, catalog.offers)).then((updated) => { if (active && updated) notifyCreditBalanceUpdated(); }).catch(() => undefined);
  return () => { active = false; };
}

async function recoverConfiguredPurchases(userId: string, offers: readonly CreditOffer[]): Promise<boolean> {
  if (!shouldRecoverTossPurchases(userId, offers, "apps-in-toss")) return false;
  const result = await recoverTossCreditPurchases(offers.map((offer) => offer.sku));
  return result.restored + result.refunded > 0;
}
