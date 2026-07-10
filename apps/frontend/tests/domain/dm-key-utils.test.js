import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalDmKey,
  localRoomIdFromDmThreadKey,
  roomKeyFromDmThreadKey,
  scopedLocalDmKey,
} from "../../src/domain/dm/dmKeyUtils.js";

test("canonicalDmKey sorts participants into a stable room key", () => {
  assert.equal(canonicalDmKey("세인", "하루"), "dm::세인|하루");
  assert.equal(canonicalDmKey("하루", "세인"), "dm::세인|하루");
});

test("scopedLocalDmKey includes scope and optional local room id", () => {
  assert.equal(scopedLocalDmKey("acc1", "하루", "세인"), "local::acc1::세인|하루");
  assert.equal(scopedLocalDmKey("acc1", "하루", "세인", "room9"), "local::acc1::room9::세인|하루");
});

test("room key helpers recover local room metadata", () => {
  assert.equal(localRoomIdFromDmThreadKey("local::acc1::room9::세인|하루"), "room9");
  assert.equal(localRoomIdFromDmThreadKey("dm::세인|하루"), "");
  assert.equal(roomKeyFromDmThreadKey("dm::세인|하루"), "세인|하루");
  assert.equal(roomKeyFromDmThreadKey("local::acc1::room9::세인|하루"), "세인|하루");
});
