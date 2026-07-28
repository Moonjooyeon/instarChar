import AuthenticationServices
import Capacitor
import Foundation
import UIKit

@objc(AppleSignIn)
public class AppleSignIn: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignIn"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCredentialState", returnType: CAPPluginReturnPromise)
    ]
    private let userIdentifierKey = "alive.apple.userIdentifier"
    private var pendingCall: CAPPluginCall?

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(handleCredentialRevoked), name: ASAuthorizationAppleIDProvider.credentialRevokedNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc public func authorize(_ call: CAPPluginCall) {
        guard pendingCall == nil else {
            call.reject("Apple login is already in progress")
            return
        }
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("Apple login nonce is required")
            return
        }
        pendingCall = call
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        DispatchQueue.main.async { controller.performRequests() }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            finishWithError("Apple login returned an unsupported credential")
            return
        }
        guard let identityToken = string(from: credential.identityToken), let authorizationCode = string(from: credential.authorizationCode) else {
            finishWithError("Apple login did not return verification tokens")
            return
        }
        UserDefaults.standard.set(credential.user, forKey: userIdentifierKey)
        pendingCall?.resolve([
            "authorizationCode": authorizationCode,
            "identityToken": identityToken,
            "displayName": displayName(from: credential.fullName)
        ])
        pendingCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let code = (error as? ASAuthorizationError)?.code
        finishWithError(code == .canceled ? "Apple login cancelled" : "Apple login failed", code: code == .canceled ? "CANCELED" : "FAILED")
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    @objc public func getCredentialState(_ call: CAPPluginCall) {
        guard let userIdentifier = UserDefaults.standard.string(forKey: userIdentifierKey) else {
            call.resolve(["state": "notFound", "hasStoredCredential": false])
            return
        }
        ASAuthorizationAppleIDProvider().getCredentialState(forUserID: userIdentifier) { [weak self] state, error in
            guard error == nil, let self else {
                call.resolve(["state": "unknown", "hasStoredCredential": true])
                return
            }
            let value = self.credentialStateValue(state)
            if value != "authorized" && value != "unknown" {
                UserDefaults.standard.removeObject(forKey: self.userIdentifierKey)
            }
            call.resolve(["state": value, "hasStoredCredential": true])
        }
    }

    @objc private func handleCredentialRevoked() {
        notifyListeners("credentialRevoked", data: [:])
    }

    private func credentialStateValue(_ state: ASAuthorizationAppleIDProvider.CredentialState) -> String {
        switch state {
        case .authorized: return "authorized"
        case .revoked: return "revoked"
        case .notFound: return "notFound"
        case .transferred: return "transferred"
        @unknown default: return "unknown"
        }
    }

    private func string(from data: Data?) -> String? {
        guard let data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private func displayName(from components: PersonNameComponents?) -> String {
        guard let components else {
            return ""
        }
        return PersonNameComponentsFormatter().string(from: components)
    }

    private func finishWithError(_ message: String, code: String = "FAILED") {
        pendingCall?.reject(message, code)
        pendingCall = nil
    }
}
