import assert from "node:assert/strict";
import test from "node:test";
import {
  blockSafetyUser,
  createSafetyReport,
  getSafetyConsent,
} from "../../src/api/safety.js";

test("getSafetyConsent reads the current terms version", async () => {
  const restore = stubFetch(() => Response.json({ accepted: false, terms_version: "2026-07-24" }));
  try {
    const result = await getSafetyConsent();
    assert.equal(result.data.accepted, false);
    assert.equal(result.data.terms_version, "2026-07-24");
  } finally {
    restore();
  }
});

test("createSafetyReport posts the target snapshot and reason", async () => {
  const calls = [];
  const restore = stubFetch((input, init) => {
    calls.push({ input, init });
    return Response.json({ id: "report-1", status: "pending" }, { status: 201 });
  });
  try {
    await createSafetyReport({ targetType: "post", targetOwnerId: "owner-1", targetReference: "char:post", snapshot: { text: "bad" }, label: "게시물" }, "harassment", "detail");
    assert.equal(calls[0].input, "/api/safety/reports");
    assert.equal(JSON.parse(calls[0].init.body).reason, "harassment");
  } finally {
    restore();
  }
});

test("blockSafetyUser persists a server-side block", async () => {
  const calls = [];
  const restore = stubFetch((input, init) => {
    calls.push({ input, init });
    return new Response(null, { status: 204 });
  });
  try {
    await blockSafetyUser("owner-1");
    assert.equal(calls[0].input, "/api/safety/blocks/owner-1");
    assert.equal(calls[0].init.method, "PUT");
  } finally {
    restore();
  }
});

function stubFetch(responseFactory) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => responseFactory(input, init);
  return () => {
    globalThis.fetch = originalFetch;
  };
}
