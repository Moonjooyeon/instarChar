export type CreditPurchaseState = {
  displayAmounts: Record<string, string>;
  availableProductIds: ReadonlySet<string>;
  purchasingProductId: string;
  notice: string;
  error: string;
  purchase: (productId: string) => Promise<void>;
};
