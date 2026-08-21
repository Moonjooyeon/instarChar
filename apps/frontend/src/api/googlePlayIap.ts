import { Capacitor, registerPlugin } from "@capacitor/core";


export type GooglePlayProduct = {
  productId: string;
  title: string;
  description: string;
  displayAmount: string;
};

export type GooglePlayPurchase = {
  purchaseToken: string;
  productId: string;
  state: "purchased" | "pending";
};

type GooglePlayBillingPlugin = {
  getProducts(options: { productIds: string[] }): Promise<{ products: GooglePlayProduct[] }>;
  getPurchases(): Promise<{ purchases: GooglePlayPurchase[] }>;
  purchase(options: { productId: string; obfuscatedAccountId: string }): Promise<GooglePlayPurchase>;
};

const GooglePlayBilling = registerPlugin<GooglePlayBillingPlugin>("GooglePlayBilling");

export function isGooglePlayIapRuntime(platform: string = Capacitor.getPlatform(), native: boolean = Capacitor.isNativePlatform(), runtime: string = import.meta.env?.VITE_ALIVE_RUNTIME || ""): boolean {
  return runtime !== "apps-in-toss" && native && platform === "android";
}

export async function getGooglePlayProducts(productIds: string[]): Promise<GooglePlayProduct[]> {
  if (!isGooglePlayIapRuntime() || !productIds.length) return [];
  return (await GooglePlayBilling.getProducts({ productIds })).products;
}

export async function getGooglePlayPurchases(): Promise<GooglePlayPurchase[]> {
  if (!isGooglePlayIapRuntime()) return [];
  return (await GooglePlayBilling.getPurchases()).purchases;
}

export async function startGooglePlayPurchase(productId: string, obfuscatedAccountId: string): Promise<GooglePlayPurchase> {
  if (!isGooglePlayIapRuntime()) throw new Error("Google Play purchases are available only in the Android app.");
  return GooglePlayBilling.purchase({ productId, obfuscatedAccountId });
}

export function googlePlayIapErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Billing error 1")) return "결제를 취소했어요.";
  if (message.includes("already in progress")) return "이미 결제를 진행하고 있어요.";
  if (message.includes("unavailable")) return "현재 이 상품은 Google Play에서 구매할 수 없어요.";
  return "결제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
