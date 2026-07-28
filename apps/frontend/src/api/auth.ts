import { App } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";

import { apiNoContent, apiResult, apiUrl, type ApiError } from "./client.js";

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
};

const NATIVE_OAUTH_REDIRECT_URL = "com.ashwoodfriends.alive://oauth/callback";
const NativeAppleSignIn = registerPlugin<NativeAppleSignInPlugin>("AppleSignIn");
const authStateListeners = new Set<AuthStateListener>();
let nativeOAuthInitialization: Promise<void> | null = null;

export function isAuthApiAvailable(): boolean {
  return true;
}

export async function signInWithOAuthProvider(provider: AuthProvider): Promise<{ error: ApiError | null }> {
  if (provider === "apple" && isNativeApplePlatform()) return signInWithNativeApple();
  window.location.assign(oauthStartUrl(provider));
  return { error: null };
}

export function signOutAuthSession(): Promise<{ error: ApiError | null }> {
  return apiNoContent("/auth/logout", { method: "POST" });
}

export function deleteAuthAccount(): Promise<{ error: ApiError | null }> {
  return apiNoContent("/auth/account", { method: "DELETE" });
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

async function initializeNativeOAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!nativeOAuthInitialization) nativeOAuthInitialization = startNativeOAuthListener();
  return nativeOAuthInitialization;
}

async function startNativeOAuthListener(): Promise<void> {
  await App.addListener("appUrlOpen", ({ url }) => {
    exchangeNativeOAuthUrl(url, true).catch(showNativeOAuthError);
  });
  const launch = await App.getLaunchUrl();
  if (launch?.url) await exchangeNativeOAuthUrl(launch.url, false);
}

async function exchangeNativeOAuthUrl(value: string, notify: boolean): Promise<void> {
  const url = new URL(value);
  if (!isNativeOAuthCallback(url)) return;
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) throw new Error(error);
  const code = url.searchParams.get("code");
  if (!code) throw new Error("소셜 로그인 승인 코드가 없어.");
  await exchangeNativeOAuthCode(code);
  if (notify) authStateListeners.forEach((listener) => listener());
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
  const response = await CapacitorHttp.post({ url, headers: { "Content-Type": "application/json" }, data });
  if (response.status >= 200 && response.status < 300) return;
  throw new Error(appleLoginFailureMessage(response.status));
}

function isNativeApplePlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

function nativeAppleErrorMessage(error: unknown): string {
  if (error instanceof Error && /cancel/i.test(error.message)) return "Apple 로그인을 취소했어.";
  if (error instanceof Error && error.message) return error.message;
  return "Apple 로그인에 실패했어.";
}

export function appleLoginFailureMessage(status: number): string {
  if (status >= 500) return "Apple 로그인 서버에 잠시 연결할 수 없어. 다시 시도해줘.";
  return "Apple 로그인 승인이 만료됐거나 유효하지 않아. 다시 로그인해줘.";
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
