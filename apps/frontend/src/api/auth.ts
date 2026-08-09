import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

import { apiNoContent, apiResult, apiUrl, clearTossSessionToken, setTossSessionToken, type ApiError, type ApiResult } from "./client.js";

export type AuthProvider = "apple" | "google";

type BackendUser = {
  email?: string;
  id: string;
  provider?: string;
};

type MeResponse = {
  display_name?: string;
  onboarded?: boolean;
  user?: BackendUser;
};

export type BackendSession = {
  user: {
    email?: string;
    id: string;
    user_metadata: {
      full_name?: string;
      name?: string;
      preferred_username?: string;
      provider?: string;
    };
  };
};

type AuthResult = {
  data: {
    session: BackendSession | null;
  };
  error: ApiError | null;
};

type TossLoginResponse = {
  session_token: string;
};

export type AuthSubscription = {
  unsubscribe: () => void;
};

type AuthStateListener = () => void;

type NativeAppleCredential = {
  authorizationCode: string;
  displayName?: string;
  identityToken: string;
};

type NativeAppleSignInPlugin = {
  authorize(options: { nonce: string }): Promise<NativeAppleCredential>;
  getCredentialState(): Promise<{ hasStoredCredential: boolean; state: string }>;
  addListener(eventName: "credentialRevoked", listener: () => void): Promise<PluginListenerHandle>;
};

const NATIVE_OAUTH_REDIRECT_URL = "com.ashwoodfriends.alive://oauth/callback";
const NativeAppleSignIn = registerPlugin<NativeAppleSignInPlugin>("AppleSignIn");
const authStateListeners = new Set<AuthStateListener>();
let nativeOAuthInitialization: Promise<void> | null = null;
let nativeAppleInvalidation: Promise<void> | null = null;
let nativeGoogleBrowserOpen = false;

export function isAuthApiAvailable(): boolean {
  return true;
}

export async function signInWithOAuthProvider(provider: AuthProvider): Promise<{ error: ApiError | null }> {
  if (provider === "apple" && isNativeApplePlatform()) return signInWithNativeApple();
  if (provider === "google" && shouldUseNativeGoogleBrowser()) return openNativeGoogleBrowser();
  window.location.assign(oauthStartUrl(provider));
  return { error: null };
}

export function isAppsInTossRuntime(runtime: string = import.meta.env?.VITE_ALIVE_RUNTIME || ""): boolean {
  return runtime === "apps-in-toss";
}

export async function signInWithToss(): Promise<{ error: ApiError | null }> {
  try {
    const authorization = await requestTossAuthorization();
    const result = await apiResult<TossLoginResponse>("/auth/toss/login", { method: "POST", body: JSON.stringify({ authorization_code: authorization.authorizationCode, referrer: authorization.referrer }) });
    if (result.error) return { error: result.error };
    if (!result.data?.session_token) return { error: { message: "토스 로그인 세션을 만들지 못했어." } };
    setTossSessionToken(result.data.session_token);
    authStateListeners.forEach((listener) => listener());
    return { error: null };
  } catch (error) {
    return { error: { message: tossLoginErrorMessage(error) } };
  }
}

export function signOutAuthSession(): Promise<{ error: ApiError | null }> {
  return endTossSession();
}

export type AccountDeletionResponse = {
  purge_at: string;
  status: "pending_deletion";
};

export function deleteAuthAccount(): Promise<ApiResult<AccountDeletionResponse>> {
  return apiResult<AccountDeletionResponse>("/auth/account", { method: "DELETE" });
}

export async function getAuthSession(): Promise<AuthResult> {
  await initializeNativeOAuth();
  const result = await apiResult<MeResponse>("/auth/me");
  if (result.error) return { data: { session: null }, error: result.error };
  return { data: { session: sessionFromMe(result.data || null) }, error: null };
}

export function subscribeAuthState(listener: AuthStateListener): AuthSubscription {
  authStateListeners.add(listener);
  return { unsubscribe: () => authStateListeners.delete(listener) };
}

function oauthStartUrl(provider: AuthProvider): string {
  const callbackUrl = new URL(apiUrl(`/auth/${provider}/callback`), window.location.origin).href;
  const returnUrl = Capacitor.isNativePlatform() ? NATIVE_OAUTH_REDIRECT_URL : window.location.origin;
  return apiUrl(`/auth/${provider}/start`, { redirect_uri: callbackUrl, return_url: returnUrl });
}

async function endTossSession(): Promise<{ error: ApiError | null }> {
  const result = await apiNoContent("/auth/logout", { method: "POST" });
  clearTossSessionToken();
  return result;
}

async function requestTossAuthorization(): Promise<{ authorizationCode: string; referrer: "DEFAULT" | "SANDBOX" }> {
  const { appLogin } = await import("@apps-in-toss/web-framework");
  return appLogin();
}

async function initializeNativeOAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!nativeOAuthInitialization) nativeOAuthInitialization = startNativeOAuthListener();
  return nativeOAuthInitialization;
}

async function startNativeOAuthListener(): Promise<void> {
  await App.addListener("appUrlOpen", ({ url }) => {
    exchangeNativeOAuthUrl(url, true).catch(showNativeOAuthError);
  });
  if (shouldUseNativeGoogleBrowser()) await Browser.addListener("browserFinished", handleNativeBrowserFinished);
  const launch = await App.getLaunchUrl();
  if (launch?.url) await exchangeNativeOAuthUrl(launch.url, false);
  if (isNativeApplePlatform()) await startNativeAppleCredentialMonitoring();
}

async function exchangeNativeOAuthUrl(value: string, notify: boolean): Promise<void> {
  const url = new URL(value);
  if (!isNativeOAuthCallback(url)) return;
  await closeNativeGoogleBrowser();
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) throw new Error(error);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("소셜 로그인 승인 코드가 없어.");
  await exchangeNativeOAuthCode(code);
  if (notify) authStateListeners.forEach((listener) => listener());
}

async function openNativeGoogleBrowser(): Promise<{ error: ApiError | null }> {
  if (nativeGoogleBrowserOpen) return { error: null };
  nativeGoogleBrowserOpen = true;
  try {
    await initializeNativeOAuth();
    const url = new URL(oauthStartUrl("google"), window.location.origin).href;
    await Browser.open({ url, presentationStyle: "fullscreen" });
    return { error: null };
  } catch (error) {
    nativeGoogleBrowserOpen = false;
    return { error: { message: nativeGoogleBrowserErrorMessage(error) } };
  }
}

async function closeNativeGoogleBrowser(): Promise<void> {
  if (!nativeGoogleBrowserOpen || !shouldUseNativeGoogleBrowser()) return;
  nativeGoogleBrowserOpen = false;
  await Browser.close().catch(() => undefined);
}

function handleNativeBrowserFinished(): void {
  if (!nativeGoogleBrowserOpen) return;
  nativeGoogleBrowserOpen = false;
  authStateListeners.forEach((listener) => listener());
}

async function exchangeNativeOAuthCode(code: string): Promise<void> {
  const url = new URL(apiUrl("/auth/native/exchange"), window.location.origin).href;
  const response = await CapacitorHttp.post({ url, headers: { "Content-Type": "application/json" }, data: { code } });
  if (response.status >= 200 && response.status < 300) return;
  throw new Error("소셜 로그인 세션을 만들지 못했어.");
}

async function signInWithNativeApple(): Promise<{ error: ApiError | null }> {
  try {
    const nonce = crypto.randomUUID();
    const credential = await NativeAppleSignIn.authorize({ nonce });
    await exchangeNativeAppleCredential(credential, nonce);
    authStateListeners.forEach((listener) => listener());
    return { error: null };
  } catch (error) {
    return { error: { message: nativeAppleErrorMessage(error) } };
  }
}

async function exchangeNativeAppleCredential(credential: NativeAppleCredential, nonce: string): Promise<void> {
  const url = new URL(apiUrl("/auth/apple/native"), window.location.origin).href;
  const data = { authorization_code: credential.authorizationCode, identity_token: credential.identityToken, nonce, display_name: credential.displayName || "" };
  const response = await CapacitorHttp.post({ url, headers: { "Content-Type": "application/json" }, data, responseType: "json" });
  if (response.status >= 200 && response.status < 300) return;
  throw new Error(appleLoginFailureMessage(response.status, response.data as unknown));
}

function isNativeApplePlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export function shouldUseNativeGoogleBrowser(platform: string = Capacitor.getPlatform(), native: boolean = Capacitor.isNativePlatform()): boolean {
  return native && platform === "ios";
}

export function shouldShowAppleLogin(platform: string = Capacitor.getPlatform()): boolean {
  return platform !== "android";
}

function nativeGoogleBrowserErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Google 로그인 화면을 열지 못했어.";
}

function tossLoginErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "토스 로그인에 실패했어.";
}

function nativeAppleErrorMessage(error: unknown): string {
  if (error instanceof Error && /cancel/i.test(error.message)) return "Apple 로그인을 취소했어.";
  if (error instanceof Error && error.message) return error.message;
  return "Apple 로그인에 실패했어.";
}

export function appleLoginFailureMessage(status: number, data: unknown = null): string {
  const detail = appleLoginErrorDetail(data);
  if (/client credentials|client id|invalid_client|encryption/i.test(detail)) return "Apple 로그인 서버 설정이 완료되지 않았어.";
  if (/identity verification/i.test(detail)) return "Apple 로그인 정보 검증에 실패했어. Apple 계정으로 다시 인증해줘.";
  if (/token exchange/i.test(detail)) return "Apple 로그인 승인 코드 교환에 실패했어. 다시 로그인해줘.";
  if (status >= 500) return "Apple 로그인 서버에 잠시 연결할 수 없어. 다시 시도해줘.";
  return "Apple 로그인 승인이 만료됐거나 유효하지 않아. 다시 로그인해줘.";
}

function appleLoginErrorDetail(data: unknown): string {
  if (typeof data === "string") return appleLoginErrorDetailFromText(data);
  if (!data || typeof data !== "object") return "";
  const response = data as { detail?: unknown; message?: unknown };
  if (typeof response.message === "string") return response.message;
  return typeof response.detail === "string" ? response.detail : "";
}

function appleLoginErrorDetailFromText(data: string): string {
  try {
    return appleLoginErrorDetail(JSON.parse(data) as unknown);
  } catch {
    return "";
  }
}

export function shouldInvalidateAppleCredential(state: string, hasStoredCredential: boolean): boolean {
  if (state === "revoked" || state === "transferred") return true;
  return state === "notFound" && hasStoredCredential;
}

async function startNativeAppleCredentialMonitoring(): Promise<void> {
  await NativeAppleSignIn.addListener("credentialRevoked", () => {
    invalidateNativeAppleSession().catch(showNativeOAuthError);
  });
  await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) checkNativeAppleCredential().catch(showNativeOAuthError);
  });
  await checkNativeAppleCredential();
}

async function checkNativeAppleCredential(): Promise<void> {
  const credential = await NativeAppleSignIn.getCredentialState();
  if (shouldInvalidateAppleCredential(credential.state, credential.hasStoredCredential)) await invalidateNativeAppleSession();
}

async function invalidateNativeAppleSession(): Promise<void> {
  if (!nativeAppleInvalidation) nativeAppleInvalidation = performNativeAppleInvalidation();
  try {
    await nativeAppleInvalidation;
  } finally {
    nativeAppleInvalidation = null;
  }
}

async function performNativeAppleInvalidation(): Promise<void> {
  const result = await signOutAuthSession();
  if (result.error) throw new Error(result.error.message);
  authStateListeners.forEach((listener) => listener());
}

function isNativeOAuthCallback(url: URL): boolean {
  return `${url.protocol}//${url.host}${url.pathname}` === NATIVE_OAUTH_REDIRECT_URL;
}

function showNativeOAuthError(error: unknown): void {
  const message = error instanceof Error ? error.message : "소셜 로그인에 실패했어.";
  const url = new URL(window.location.href);
  url.searchParams.set("error", message);
  window.location.assign(url.href);
}

function sessionFromMe(data: MeResponse | null): BackendSession | null {
  if (!data?.user?.id) return null;
  return {
    user: {
      email: data.user.email,
      id: data.user.id,
      user_metadata: {
        full_name: data.display_name,
        name: data.display_name,
        preferred_username: data.display_name,
        provider: data.user.provider,
      },
    },
  };
}
