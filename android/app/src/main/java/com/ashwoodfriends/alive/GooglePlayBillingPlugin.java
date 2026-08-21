package com.ashwoodfriends.alive;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private final List<ConnectionRequest> connectionRequests = new ArrayList<>();
    private boolean connecting;
    private PluginCall purchaseCall;
    private String purchaseProductId = "";

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext()).setListener(this).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).enableAutoServiceReconnection().build();
        connect(null, () -> { });
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) billingClient.endConnection();
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        List<String> productIds = productIds(call);
        if (productIds.isEmpty()) {
            call.reject("At least one Google Play product ID is required");
            return;
        }
        connect(call, () -> queryProducts(call, productIds));
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        connect(call, () -> queryPurchases(call));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        String accountId = call.getString("obfuscatedAccountId", "");
        if (purchaseCall != null) {
            call.reject("A Google Play purchase is already in progress");
            return;
        }
        if (productId.isEmpty() || accountId.isEmpty()) {
            call.reject("Google Play product and account IDs are required");
            return;
        }
        connect(call, () -> launchPurchase(call, productId, accountId));
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (purchaseCall == null) return;
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            rejectPurchase(result);
            return;
        }
        Purchase purchase = matchingPurchase(purchases);
        if (purchase == null) {
            purchaseCall.reject("Google Play did not return the requested product");
            clearPurchase();
            return;
        }
        resolvePurchase(purchase);
    }

    private void connect(PluginCall call, Runnable onConnected) {
        if (billingClient.isReady()) {
            onConnected.run();
            return;
        }
        connectionRequests.add(new ConnectionRequest(call, onConnected));
        if (connecting) return;
        connecting = true;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) { finishConnection(result); }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void finishConnection(BillingResult result) {
        List<ConnectionRequest> requests = new ArrayList<>(connectionRequests);
        connectionRequests.clear();
        connecting = false;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
            for (ConnectionRequest request : requests) request.onConnected.run();
            return;
        }
        for (ConnectionRequest request : requests) rejectConnection(request.call, result);
    }

    private void rejectConnection(PluginCall call, BillingResult result) {
        if (call != null) call.reject(billingError(result));
    }

    private List<String> productIds(PluginCall call) {
        JSArray values = call.getArray("productIds", new JSArray());
        List<String> productIds = new ArrayList<>();
        for (int index = 0; index < values.length(); index += 1) addProductId(productIds, values.optString(index));
        return productIds;
    }

    private void addProductId(List<String> productIds, String productId) {
        if (!productId.isEmpty() && !productIds.contains(productId)) productIds.add(productId);
    }

    private void queryProducts(PluginCall call, List<String> productIds) {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(productQueries(productIds)).build();
        billingClient.queryProductDetailsAsync(params, (result, details) -> resolveProducts(call, result, details));
    }

    private List<QueryProductDetailsParams.Product> productQueries(List<String> productIds) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String productId : productIds) products.add(productQuery(productId));
        return products;
    }

    private QueryProductDetailsParams.Product productQuery(String productId) {
        return QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(BillingClient.ProductType.INAPP).build();
    }

    private void resolveProducts(PluginCall call, BillingResult result, QueryProductDetailsResult details) {
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            call.reject(billingError(result));
            return;
        }
        JSArray products = new JSArray();
        for (ProductDetails product : details.getProductDetailsList()) products.put(productJson(product));
        JSObject payload = new JSObject();
        payload.put("products", products);
        call.resolve(payload);
    }

    private JSObject productJson(ProductDetails product) {
        ProductDetails.OneTimePurchaseOfferDetails offer = product.getOneTimePurchaseOfferDetails();
        JSObject item = new JSObject();
        item.put("productId", product.getProductId());
        item.put("title", product.getTitle());
        item.put("description", product.getDescription());
        item.put("displayAmount", offer == null ? "" : offer.getFormattedPrice());
        return item;
    }

    private void queryPurchases(PluginCall call) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> resolvePurchases(call, result, purchases));
    }

    private void resolvePurchases(PluginCall call, BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            call.reject(billingError(result));
            return;
        }
        JSArray items = new JSArray();
        for (Purchase purchase : purchases) items.put(purchaseJson(purchase));
        JSObject payload = new JSObject();
        payload.put("purchases", items);
        call.resolve(payload);
    }

    private void launchPurchase(PluginCall call, String productId, String accountId) {
        List<String> productIds = new ArrayList<>();
        productIds.add(productId);
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(productQueries(productIds)).build();
        billingClient.queryProductDetailsAsync(params, (result, details) -> launchProductPurchase(call, productId, accountId, result, details));
    }

    private void launchProductPurchase(PluginCall call, String productId, String accountId, BillingResult result, QueryProductDetailsResult details) {
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            call.reject(billingError(result));
            return;
        }
        ProductDetails product = matchingProduct(details.getProductDetailsList(), productId);
        ProductDetails.OneTimePurchaseOfferDetails offer = product == null ? null : product.getOneTimePurchaseOfferDetails();
        if (offer == null) {
            call.reject("Google Play product is unavailable");
            return;
        }
        startPurchase(call, product, offer, productId, accountId);
    }

    private ProductDetails matchingProduct(List<ProductDetails> products, String productId) {
        for (ProductDetails product : products) if (product.getProductId().equals(productId)) return product;
        return null;
    }

    private void startPurchase(PluginCall call, ProductDetails product, ProductDetails.OneTimePurchaseOfferDetails offer, String productId, String accountId) {
        BillingFlowParams.ProductDetailsParams details = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offer.getOfferToken()).build();
        BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(List.of(details)).setObfuscatedAccountId(accountId).build();
        purchaseCall = call;
        purchaseProductId = productId;
        BillingResult result = billingClient.launchBillingFlow(getActivity(), params);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            rejectPurchase(result);
            return;
        }
    }

    private Purchase matchingPurchase(List<Purchase> purchases) {
        for (Purchase purchase : purchases) if (purchase.getProducts().contains(purchaseProductId)) return purchase;
        return null;
    }

    private void resolvePurchase(Purchase purchase) {
        purchaseCall.resolve(purchaseJson(purchase));
        clearPurchase();
    }

    private JSObject purchaseJson(Purchase purchase) {
        JSObject payload = new JSObject();
        payload.put("purchaseToken", purchase.getPurchaseToken());
        payload.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
        payload.put("state", purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased" : "pending");
        return payload;
    }

    private void rejectPurchase(BillingResult result) {
        purchaseCall.reject(billingError(result));
        clearPurchase();
    }

    private void clearPurchase() {
        purchaseCall = null;
        purchaseProductId = "";
    }

    private String billingError(BillingResult result) {
        return "Google Play Billing error " + result.getResponseCode() + ": " + result.getDebugMessage();
    }

    private static class ConnectionRequest {
        private final PluginCall call;
        private final Runnable onConnected;

        private ConnectionRequest(PluginCall call, Runnable onConnected) {
            this.call = call;
            this.onConnected = onConnected;
        }
    }
}
