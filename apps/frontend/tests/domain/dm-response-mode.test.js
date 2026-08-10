import assert from "node:assert/strict";
import test from "node:test";
import { DM_RESPONSE_MODES, dmResponseFlowLabel, dmResponseMode } from "../../src/domain/dm/dmResponseMode.js";

test("DM response modes preserve the intended credit and context ladder", () => {
  assert.deepEqual(DM_RESPONSE_MODES.map((mode) => [mode.code, mode.credits, mode.historyLimit, mode.memoryLimit, mode.outputTokens]), [
    ["direct_dm_basic", 1, 10, 3, 512],
    ["direct_dm_context", 2, 24, 6, 768],
    ["direct_dm_flash_long", 2, 48, 12, 1536],
    ["direct_dm_pro", 5, 28, 12, 1536],
    ["direct_dm_pro_story", 7, 60, 12, 3072],
  ]);
  assert.ok(dmResponseMode("direct_dm_pro_story").historyLimit > dmResponseMode("direct_dm_basic").historyLimit);
  assert.ok(dmResponseMode("direct_dm_pro_story").outputTokens > dmResponseMode("direct_dm_basic").outputTokens);
  assert.equal(dmResponseFlowLabel("direct_dm_pro"), "중요한 답장");
  assert.equal(dmResponseFlowLabel("feed_post"), null);
});
