type ConfiguredOffer = { sku: string };


export function shouldRecoverTossPurchases(userId: string, offers: readonly ConfiguredOffer[], runtime: string): boolean {
  return Boolean(userId && runtime === "apps-in-toss" && offers.some((offer) => Boolean(offer.sku)));
}
