import { apiJson } from "./client.js";

export type CreditOffer = {
  id: string;
  sku: string;
  price_krw: number;
  base_credits: number;
  product_bonus_credits: number;
  first_purchase_bonus_percent: number;
  total_credits: number;
  first_purchase_total_credits: number;
  label: string;
  payment_available: boolean;
};

export type CreditFlow = {
  code: string;
  label: string;
  credits: number;
  energy_percent: number;
  energy_eligible: boolean;
  bonus_eligible: boolean;
  hard_daily_limit: number;
  intro_free_uses: number;
};

export type CreditCatalog = {
  credit_policy_version: string;
  energy_policy_version: string;
  offers: CreditOffer[];
  flows: CreditFlow[];
};

export type CreditUsage = {
  id: string;
  flow: string;
  credits: number;
  energy_percent: number;
  bonus_credits: number;
  purchased_credits: number;
  status: "reserved" | "committed" | "refunded";
  created_at: string;
};

export type CreditUsageList = { items: CreditUsage[] };

export const CREDIT_BALANCE_UPDATED_EVENT = "alive:credit-balance-updated";

export type CreditRewardMission = {
  code: "signup" | "first_character" | "first_dm";
  credits: number;
  completed: boolean;
};

export type CreditBalance = {
  purchased_credits: number;
  bonus_credits: number;
  debt_credits: number;
  total_credits: number;
  energy_percent: number;
  energy_max_percent: number;
  next_energy_recovery_at: string | null;
  credit_policy_version: string;
  energy_policy_version: string;
  reward_missions: CreditRewardMission[];
};

export function getCreditBalance(): Promise<CreditBalance> {
  return apiJson<CreditBalance>("/credits");
}

export function getCreditCatalog(): Promise<CreditCatalog> {
  return apiJson<CreditCatalog>("/credits/catalog");
}

export function getCreditUsage(): Promise<CreditUsageList> {
  return apiJson<CreditUsageList>("/credits/usage");
}

export type CreditPurchaseGrant = {
  order_id: string;
  status: "granted" | "refunded" | "processing" | "failed" | "review";
  granted_credits: number;
  purchased_credits: number;
  bonus_credits: number;
  debt_credits: number;
  total_credits: number;
};

export type CreditPurchase = {
  provider_order_id: string;
  sku: string;
  status: "processing" | "granted" | "refunded" | "failed" | "review";
  base_credits: number;
  product_bonus_credits: number;
  first_purchase_bonus_credits: number;
  granted_credits: number;
  chargeback_credits: number;
  created_at: string;
  granted_at: string | null;
  refunded_at: string | null;
};

export type CreditPurchaseList = { items: CreditPurchase[] };
export type TossIapEnvironment = "toss" | "sandbox";

export function grantCreditPurchase(orderId: string, sku: string = "", environment: TossIapEnvironment = "toss"): Promise<CreditPurchaseGrant> {
  return apiJson<CreditPurchaseGrant>("/credits/purchases/grant", { method: "POST", body: JSON.stringify({ order_id: orderId, sku, environment }) });
}

export function getCreditPurchases(): Promise<CreditPurchaseList> {
  return apiJson<CreditPurchaseList>("/credits/purchases");
}

export function notifyCreditBalanceUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDIT_BALANCE_UPDATED_EVENT));
}
