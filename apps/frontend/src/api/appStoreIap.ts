import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";


export type AppStoreProduct = {
  productId: string;
  title: string;
  description: string;
  displayAmount: string;
};

export type AppStorePurchase = {
  transactionId: string;
  productId: string;
  signedTransaction: string;
};

type AppStoreBillingPlugin = {
  getProducts(options: { productIds: string[] }): Promise<{ products: AppStoreProduct[] }>;
  getUnfinishedTransactions(): Promise<{ purchases: AppStorePurchase[] }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<AppStorePurchase>;
  finish(options: { transactionId: string }): Promise<void>;
  addListener(eventName: "transactionUpdated", listenerFunc: (purchase: AppStorePurchase) => void): Promise<PluginListenerHandle>;
};

const AppStoreBilling = registerPlugin<AppStoreBillingPlugin>("AppStoreBilling");

export function isAppStoreIapRuntime(platform: string = Capacitor.getPlatform(), native: boolean = Capacitor.isNativePlatform(), runtime: string = import.meta.env?.VITE_ALIVE_RUNTIME || ""): boolean {
  return runtime !== "apps-in-toss" && native && platform === "ios";
}

export async function getAppStoreProducts(productIds: string[]): Promise<AppStoreProduct[]> {
  if (!isAppStoreIapRuntime() || !productIds.length) return [];
  return (await AppStoreBilling.getProducts({ productIds })).products;
}

export async function getUnfinishedAppStorePurchases(): Promise<AppStorePurchase[]> {
  if (!isAppStoreIapRuntime()) return [];
  return (await AppStoreBilling.getUnfinishedTransactions()).purchases;
}

export async function startAppStorePurchase(productId: string, appAccountToken: string): Promise<AppStorePurchase> {
  if (!isAppStoreIapRuntime()) throw new Error("App Store purchases are available only in the iOS app.");
  return AppStoreBilling.purchase({ productId, appAccountToken });
}

export async function finishAppStorePurchase(transactionId: string): Promise<void> {
  if (!isAppStoreIapRuntime()) return;
  await AppStoreBilling.finish({ transactionId });
}

export async function listenAppStoreTransactions(listener: (purchase: AppStorePurchase) => void): Promise<() => Promise<void>> {
  if (!isAppStoreIapRuntime()) return async () => undefined;
  const handle = await AppStoreBilling.addListener("transactionUpdated", listener);
  return async () => handle.remove();
}

export function appStoreIapErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("cancelled")) return "결제를 취소했어요.";
  if (message.includes("already in progress")) return "이미 결제를 진행하고 있어요.";
  if (message.includes("unavailable")) return "현재 이 상품은 App Store에서 구매할 수 없어요.";
  return "결제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
