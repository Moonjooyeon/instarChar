import Capacitor
import StoreKit

@objc(AppStoreBilling)
public class AppStoreBilling: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppStoreBilling"
    public let jsName = "AppStoreBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUnfinishedTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)
    ]
    private var pendingTransactions: [String: Transaction] = [:]
    private var updatesTask: Task<Void, Never>?

    override public func load() {
        updatesTask = Task { [weak self] in
            guard let self else { return }
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                self.pendingTransactions[String(transaction.id)] = transaction
                self.notifyListeners("transactionUpdated", data: Self.purchasePayload(transaction, signedTransaction: result.jwsRepresentation))
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc public func getProducts(_ call: CAPPluginCall) {
        let productIds = call.getArray("productIds", String.self) ?? []
        Task { [weak self] in
            guard self != nil else { return }
            do {
                let products = try await Product.products(for: productIds)
                call.resolve(["products": products.map(Self.productPayload)])
            } catch {
                call.reject("App Store products are unavailable")
            }
        }
    }

    @objc public func getUnfinishedTransactions(_ call: CAPPluginCall) {
        Task { [weak self] in
            guard let self else { return }
            var purchases: [[String: String]] = []
            for await result in Transaction.unfinished {
                guard case .verified(let transaction) = result else { continue }
                self.pendingTransactions[String(transaction.id)] = transaction
                purchases.append(Self.purchasePayload(transaction, signedTransaction: result.jwsRepresentation))
            }
            call.resolve(["purchases": purchases])
        }
    }

    @objc public func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("App Store product ID is required")
            return
        }
        guard let tokenValue = call.getString("appAccountToken"), let token = UUID(uuidString: tokenValue) else {
            call.reject("App Store account token is required")
            return
        }
        Task { [weak self] in
            guard let self else { return }
            await self.completePurchase(productId: productId, token: token, call: call)
        }
    }

    @objc public func finish(_ call: CAPPluginCall) {
        guard let transactionId = call.getString("transactionId"), let transaction = pendingTransactions[transactionId] else {
            call.reject("App Store transaction is not pending")
            return
        }
        Task { [weak self] in
            await transaction.finish()
            self?.pendingTransactions.removeValue(forKey: transactionId)
            call.resolve()
        }
    }

    private func completePurchase(productId: String, token: UUID, call: CAPPluginCall) async {
        do {
            guard let product = try await Product.products(for: [productId]).first else {
                call.reject("App Store product is unavailable")
                return
            }
            try await resolvePurchase(await product.purchase(options: [.appAccountToken(token)]), call: call)
        } catch {
            call.reject("App Store purchase failed")
        }
    }

    private func resolvePurchase(_ result: Product.PurchaseResult, call: CAPPluginCall) async throws {
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                call.reject("App Store transaction verification failed")
                return
            }
            pendingTransactions[String(transaction.id)] = transaction
            call.resolve(Self.purchasePayload(transaction, signedTransaction: verification.jwsRepresentation))
        case .pending:
            call.reject("App Store purchase is pending")
        case .userCancelled:
            call.reject("App Store purchase cancelled")
        @unknown default:
            call.reject("App Store purchase failed")
        }
    }

    private static func productPayload(_ product: Product) -> [String: String] {
        return ["productId": product.id, "title": product.displayName, "description": product.description, "displayAmount": product.displayPrice]
    }

    private static func purchasePayload(_ transaction: Transaction, signedTransaction: String) -> [String: String] {
        return ["transactionId": String(transaction.id), "productId": transaction.productID, "signedTransaction": signedTransaction]
    }
}
