import { apiJson } from "./client.js";

export type CreditOffer = {
  id: string;
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

export type CreditBalance = {
  purchased_credits: number;
  bonus_credits: number;
  total_credits: number;
  energy_percent: number;
  energy_max_percent: number;
  next_energy_recovery_at: string | null;
  credit_policy_version: string;
  energy_policy_version: string;
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

export function notifyCreditBalanceUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDIT_BALANCE_UPDATED_EVENT));
}
