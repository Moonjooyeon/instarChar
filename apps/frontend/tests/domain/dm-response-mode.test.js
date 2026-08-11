import assert from "node:assert/strict";
import test from "node:test";
import { DM_RESPONSE_MODES, dmResponseFlowLabel, dmResponseMode } from "../../src/domain/dm/dmResponseMode.js";

test("DM response modes preserve the intended credit and context ladder", () => {
  assert.deepEqual(DM_RESPONSE_MODES.map((mode) => [mode.code, mode.credits, mode.historyLimit, mode.memoryLimit, mode.outputTokens]), [
    ["direct_dm_basic", 1, 10, 3, 512],
    ["direct_dm_context", 2, 24, 6, 768],
    ["direct_dm_pro", 5, 28, 12, 1536],
  ]);
  assert.equal(dmResponseMode("direct_dm_pro_story").code, "direct_dm_basic");
  assert.ok(dmResponseMode("direct_dm_pro").outputTokens > dmResponseMode("direct_dm_basic").outputTokens);
  assert.equal(dmResponseFlowLabel("direct_dm_pro"), "중요한 답장");
  assert.equal(dmResponseFlowLabel("feed_post"), null);
});
