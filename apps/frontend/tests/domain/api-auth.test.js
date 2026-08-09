import assert from "node:assert/strict";
import test from "node:test";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { appleLoginFailureMessage, deleteAuthAccount, shouldInvalidateAppleCredential, shouldShowAppleLogin, shouldUseNativeGoogleBrowser, signInWithOAuthProvider } from "../../src/api/auth.js";

test("signInWithOAuthProvider sends current origin callback to backend", async () => {
  const assigned = [];
  const restoreWindow = stubWindow("http://192.168.0.2:5173", assigned);
  try {
    const result = await signInWithOAuthProvider("google");
    const url = new URL(assigned[0], "http://192.168.0.2:5173");
    assert.deepEqual(result, { error: null });
    assert.equal(url.pathname, "/api/auth/google/start");
    assert.equal(url.searchParams.get("redirect_uri"), "http://192.168.0.2:5173/api/auth/google/callback");
    assert.equal(url.searchParams.get("return_url"), "http://192.168.0.2:5173");
  } finally {
    restoreWindow();
  }
});

test("web Apple login keeps the backend OAuth flow", async () => {
  const assigned = [];
  const restoreWindow = stubWindow("https://alive.example", assigned);
  try {
    const result = await signInWithOAuthProvider("apple");
    const url = new URL(assigned[0], "https://alive.example");
    assert.deepEqual(result, { error: null });
    assert.equal(url.pathname, "/api/auth/apple/start");
    assert.equal(url.searchParams.get("return_url"), "https://alive.example");
  } finally {
    restoreWindow();
  }
});

test("Android Google login opens the external browser flow", async () => {
  const assigned = [];
  const restoreWindow = stubWindow("https://localhost", assigned);
  const restorePlatform = stubNativePlatform("android");
  const restoreNativeOAuth = stubNativeOAuthPlugins();
  try {
    await signInWithOAuthProvider("google");
    assert.equal(assigned.length, 0);
  } finally {
    restoreNativeOAuth();
    restorePlatform();
    restoreWindow();
  }
});

test("deleteAuthAccount requests deletion scheduling", async () => {
  const calls = [];
  const restoreFetch = stubFetch(calls);
  try {
    const result = await deleteAuthAccount();
    assert.deepEqual(result, { data: null, error: null });
    assert.equal(calls[0].input, "/api/auth/account");
    assert.equal(calls[0].init.method, "DELETE");
  } finally {
    restoreFetch();
  }
});

test("Apple login errors distinguish retryable provider failures", () => {
  assert.match(appleLoginFailureMessage(503), /다시 시도/);
  assert.match(appleLoginFailureMessage(400), /다시 로그인/);
  assert.match(appleLoginFailureMessage(400, { message: "OAuth identity verification failed" }), /검증/);
  assert.match(appleLoginFailureMessage(400, { message: "OAuth token exchange failed" }), /교환/);
  assert.match(appleLoginFailureMessage(400, '{"message":"OAuth token exchange failed"}'), /교환/);
  assert.match(appleLoginFailureMessage(400, { detail: "OAuth token exchange failed" }), /교환/);
  assert.match(appleLoginFailureMessage(400, '{"detail":"OAuth token exchange failed"}'), /교환/);
  assert.match(appleLoginFailureMessage(400, { message: "OAuth token exchange failed: invalid_client" }), /서버 설정/);
  assert.match(appleLoginFailureMessage(400, { message: "OAuth token exchange failed: invalid_grant" }), /교환/);
  assert.match(appleLoginFailureMessage(400, { message: "Apple client credentials are not configured" }), /서버 설정/);
});

test("Apple login is hidden only on Android", () => {
  assert.equal(shouldShowAppleLogin("android"), false);
  assert.equal(shouldShowAppleLogin("ios"), true);
  assert.equal(shouldShowAppleLogin("web"), true);
});

test("Google login uses the in-app browser on native mobile platforms", () => {
  assert.equal(shouldUseNativeGoogleBrowser("ios", true), true);
  assert.equal(shouldUseNativeGoogleBrowser("android", true), true);
  assert.equal(shouldUseNativeGoogleBrowser("web", false), false);
});

test("Apple credential state only invalidates a known revoked account", () => {
  assert.equal(shouldInvalidateAppleCredential("authorized", true), false);
  assert.equal(shouldInvalidateAppleCredential("revoked", true), true);
  assert.equal(shouldInvalidateAppleCredential("transferred", true), true);
  assert.equal(shouldInvalidateAppleCredential("notFound", true), true);
  assert.equal(shouldInvalidateAppleCredential("notFound", false), false);
});

function stubWindow(origin, assigned) {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: {
      origin,
      assign(value) {
        assigned.push(value);
      },
    },
  };
  return () => {
    globalThis.window = originalWindow;
  };
}

function stubNativePlatform(platform) {
  const originalIsNativePlatform = Capacitor.isNativePlatform;
  const originalGetPlatform = Capacitor.getPlatform;
  Capacitor.isNativePlatform = () => true;
  Capacitor.getPlatform = () => platform;
  return () => {
    Capacitor.isNativePlatform = originalIsNativePlatform;
    Capacitor.getPlatform = originalGetPlatform;
  };
}

function stubNativeOAuthPlugins() {
  const originalAppAddListener = App.addListener;
  const originalAppGetLaunchUrl = App.getLaunchUrl;
  const originalBrowserAddListener = Browser.addListener;
  const originalBrowserOpen = Browser.open;
  App.addListener = async () => ({ remove: async () => undefined });
  App.getLaunchUrl = async () => ({ url: undefined });
  Browser.addListener = async () => ({ remove: async () => undefined });
  Browser.open = async () => undefined;
  return () => {
    App.addListener = originalAppAddListener;
    App.getLaunchUrl = originalAppGetLaunchUrl;
    Browser.addListener = originalBrowserAddListener;
    Browser.open = originalBrowserOpen;
  };
}

function stubFetch(calls) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input, init });
    return new Response(null, { status: 204 });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}
