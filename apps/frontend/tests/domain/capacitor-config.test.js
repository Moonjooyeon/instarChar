import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("native builds route fetch through Capacitor HTTP", () => {
  const configPath = path.resolve(process.cwd(), "../../capacitor.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.plugins?.CapacitorHttp?.enabled, true);
});

test("Android exposes system bar insets to the app shell", () => {
  const configPath = path.resolve(process.cwd(), "../../capacitor.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.plugins?.SystemBars?.insetsHandling, "css");
  assert.equal(config.plugins?.SystemBars?.style, "DARK");
});

test("Android hides the persistent navigation buttons", () => {
  const entryPath = path.resolve(process.cwd(), "src/main.tsx");
  const entry = readFileSync(entryPath, "utf8");
  assert.match(entry, /Capacitor\.getPlatform\(\) !== "android"/);
  assert.match(entry, /SystemBars\.hide\(\{ bar: SystemBarType\.NavigationBar \}\)/);
});

test("Android requires two root back presses before closing the app", () => {
  const activityPath = path.resolve(process.cwd(), "../../android/app/src/main/java/com/ashwoodfriends/alive/MainActivity.java");
  const activity = readFileSync(activityPath, "utf8");
  assert.match(activity, /bridge\.getWebView\(\)\.canGoBack\(\)/);
  assert.match(activity, /EXIT_CONFIRMATION_WINDOW_MS = 2000L/);
  assert.match(activity, /finishAndRemoveTask\(\)/);
});

test("iOS delegates safe-area layout to the responsive app shell", () => {
  const configPath = path.resolve(process.cwd(), "../../capacitor.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.ios?.contentInset, "never");
});

test("iOS bridge registers the local Apple sign-in plugin", () => {
  const iosAppPath = path.resolve(process.cwd(), "../../ios/App/App");
  const controller = readFileSync(path.join(iosAppPath, "AliveBridgeViewController.swift"), "utf8");
  const applePlugin = readFileSync(path.join(iosAppPath, "AppleSignIn.swift"), "utf8");
  const storyboard = readFileSync(path.join(iosAppPath, "Base.lproj/Main.storyboard"), "utf8");
  assert.match(controller, /registerPluginInstance\(AppleSignIn\(\)\)/);
  assert.match(applePlugin, /getCredentialState\(forUserID:/);
  assert.match(applePlugin, /credentialRevokedNotification/);
  assert.match(storyboard, /customClass="AliveBridgeViewController"/);
});

test("iOS declares why camera access is required", () => {
  const infoPath = path.resolve(process.cwd(), "../../ios/App/App/Info.plist");
  const info = readFileSync(infoPath, "utf8");
  assert.match(info, /<key>NSCameraUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
});
