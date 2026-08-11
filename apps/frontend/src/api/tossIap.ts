import type { CreditPurchaseGrant } from "./credits.js";


export type TossIapProduct = {
  sku: string;
  type: "CONSUMABLE";
  displayName: string;
  displayAmount: string;
  iconUrl: string;
  description: string;
};

export type TossPendingOrder = {
  orderId: string;
  sku: string;
  paymentCompletedDate: string;
};

export type TossIapHistoryOrder = {
  orderId: string;
  sku: string;
  status: "COMPLETED" | "REFUNDED";
  date: string;
};

type TossIapHistoryPage = {
  hasNext: boolean;
  nextKey?: string | null;
  orders: TossIapHistoryOrder[];
};

type TossIapHistoryFetcher = (params?: { key?: string | null }) => Promise<TossIapHistoryPage | undefined>;
type TossIapVersionChecker = (versions: { android: `${number}.${number}.${number}`; ios: `${number}.${number}.${number}` }) => boolean;

export const TOSS_IAP_FULL_FLOW_MIN_VERSIONS = { android: "5.234.0", ios: "5.233.0" } as const;

type PurchaseCallbacks = {
  grant: (orderId: string) => Promise<CreditPurchaseGrant>;
  success: (orderId: string) => void;
  error: (error: unknown) => void;
};

export function isAppsInTossIapRuntime(runtime: string = import.meta.env?.VITE_ALIVE_RUNTIME || ""): boolean {
  return runtime === "apps-in-toss";
}

export async function getTossIapProducts(): Promise<TossIapProduct[] | null> {
  if (!isAppsInTossIapRuntime()) return [];
  const { IAP, isMinVersionSupported } = await import("@apps-in-toss/web-framework");
  if (!hasTossIapFullFlowSupport(isMinVersionSupported)) return null;
  const result = await IAP.getProductItemList();
  if (!result) return null;
  return result.products.filter((product): product is TossIapProduct => product.type === "CONSUMABLE");
}

export function hasTossIapFullFlowSupport(checker: TossIapVersionChecker): boolean {
  return checker(TOSS_IAP_FULL_FLOW_MIN_VERSIONS);
}

export async function startTossIapPurchase(sku: string, callbacks: PurchaseCallbacks): Promise<() => void> {
  const { IAP } = await import("@apps-in-toss/web-framework");
  return IAP.createOneTimePurchaseOrder({ options: { sku, processProductGrant: ({ orderId }) => grantProduct(orderId, callbacks) }, onEvent: ({ data }) => callbacks.success(data.orderId), onError: callbacks.error });
}

export async function getPendingTossIapOrders(): Promise<TossPendingOrder[] | null> {
  if (!isAppsInTossIapRuntime()) return [];
  const { IAP } = await import("@apps-in-toss/web-framework");
  const result = await IAP.getPendingOrders();
  return result?.orders || null;
}

export async function getRefundedTossIapOrders(): Promise<TossIapHistoryOrder[] | null> {
  if (!isAppsInTossIapRuntime()) return [];
  return collectRefundedTossIapOrders(fetchTossIapHistoryPage);
}

export async function collectRefundedTossIapOrders(fetchPage: TossIapHistoryFetcher, maxPages: number = 100): Promise<TossIapHistoryOrder[] | null> {
  let page = await fetchPage({ key: null });
  if (!page) return null;
  const refunded: TossIapHistoryOrder[] = [];
  for (let pageCount = 0; pageCount < maxPages; pageCount += 1) {
    refunded.push(...page.orders.filter((order) => order.status === "REFUNDED"));
    if (!page.hasNext) return refunded;
    if (!page.nextKey) throw new Error("Toss IAP history pagination key is missing");
    page = await fetchPage({ key: page.nextKey });
    if (!page) return null;
  }
  throw new Error("Toss IAP history pagination limit exceeded");
}

export async function completeTossIapGrant(orderId: string): Promise<boolean> {
  const { IAP } = await import("@apps-in-toss/web-framework");
  return (await IAP.completeProductGrant({ params: { orderId } })) || false;
}

export function tossIapErrorMessage(error: unknown): string {
  const code = tossIapErrorCode(error);
  if (code === "USER_CANCELED") return "결제를 취소했어요.";
  if (code === "PAYMENT_PENDING") return "결제 승인을 기다리고 있어요. 잠시 후 다시 확인해 주세요.";
  if (code === "UNSUPPORTED_APP_VERSION") return "토스 앱을 최신 버전으로 업데이트해 주세요.";
  if (code === "INVALID_PRODUCT_ID") return "구매할 상품 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
  if (code === "INVALID_USER_ENVIRONMENT" || code === "KOREAN_ACCOUNT_ONLY") return "현재 기기나 앱마켓 계정에서는 이 상품을 구매할 수 없어요.";
  if (code === "ITEM_ALREADY_OWNED") return "이미 처리 중인 구매가 있어요. 결제 내역을 다시 확인해 주세요.";
  if (code === "APP_MARKET_VERIFICATION_FAILED") return "앱마켓의 결제 확인에 실패했어요. 앱마켓 고객센터에서 결제 내역을 확인해 주세요.";
  if (code === "PRODUCT_NOT_GRANTED_BY_PARTNER") return "결제는 완료됐지만 크레딧 지급을 확인하지 못했어요. 다시 들어오면 자동으로 복원해요.";
  if (code === "NETWORK_ERROR" || code === "TOSS_SERVER_VERIFICATION_FAILED" || code === "INTERNAL_ERROR") return "결제 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  return "결제를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

async function grantProduct(orderId: string, callbacks: PurchaseCallbacks): Promise<boolean> {
  try {
    const result = await callbacks.grant(orderId);
    return result.status === "granted";
  } catch {
    return false;
  }
}

async function fetchTossIapHistoryPage(params?: { key?: string | null }): Promise<TossIapHistoryPage | undefined> {
  const { IAP } = await import("@apps-in-toss/web-framework");
  const fetchPage = IAP.getCompletedOrRefundedOrders as unknown as TossIapHistoryFetcher;
  return fetchPage(params);
}

function tossIapErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = error as { code?: unknown; errorCode?: unknown };
  const code = value.code || value.errorCode;
  return typeof code === "string" ? code : "";
}
