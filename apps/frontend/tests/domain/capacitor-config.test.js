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

test("iOS delegates safe-area layout to the responsive app shell", () => {
  const configPath = path.resolve(process.cwd(), "../../capacitor.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.ios?.contentInset, "never");
});

test("iOS bridge registers the local Apple sign-in plugin", () => {
  const iosAppPath = path.resolve(process.cwd(), "../../ios/App/App");
  const controller = readFileSync(path.join(iosAppPath, "AliveBridgeViewController.swift"), "utf8");
  const storyboard = readFileSync(path.join(iosAppPath, "Base.lproj/Main.storyboard"), "utf8");
  assert.match(controller, /registerPluginInstance\(AppleSignIn\(\)\)/);
  assert.match(storyboard, /customClass="AliveBridgeViewController"/);
});
