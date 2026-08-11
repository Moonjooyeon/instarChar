import assert from "node:assert/strict";
import test from "node:test";
import { dmSuggestionPrompts } from "../../src/domain/dm/dmSuggestions.js";

test("DM suggestions offer varied openings and continuation prompts", () => {
  const opening = dmSuggestionPrompts({ asOwner: true, messageCount: 0, peerName: "세인" });
  const firstReply = dmSuggestionPrompts({ asOwner: true, lastText: "오늘은 오래 걷고 왔어.", messageCount: 2, peerName: "세인" });
  const nextReply = dmSuggestionPrompts({ asOwner: true, lastText: "지금은 조금 편해졌어.", messageCount: 4, peerName: "세인" });
  assert.equal(opening.length, 3);
  assert.equal(firstReply.length, 3);
  assert.notDeepEqual(firstReply, nextReply);
  assert.ok(firstReply.every((prompt) => !opening.includes(prompt)));
});

test("roleplay continuation prompts keep the peer name", () => {
  const prompts = dmSuggestionPrompts({ asOwner: false, lastText: "비가 그치지 않네.", messageCount: 6, peerName: "하린" });
  assert.ok(prompts.every((prompt) => prompt.startsWith("하린, ")));
});
