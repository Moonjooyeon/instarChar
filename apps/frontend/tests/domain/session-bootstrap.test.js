import assert from "node:assert/strict";
import test from "node:test";
import { nextSessionState } from "../../src/domain/sessionBootstrap.js";

test("nextSessionState clears profile loading when there is no session", () => {
  const profileLoadedRef = { current: true };
  const state = stateSetters({ profileLoading: true, stateReady: true });
  const result = nextSessionState({ user: { id: "user-1" } }, null, {
    profileLoadedRef,
    setProfileLoading: state.setProfileLoading,
    setStateReady: state.setStateReady,
  });
  assert.equal(result, null);
  assert.equal(profileLoadedRef.current, false);
  assert.equal(state.profileLoading, false);
  assert.equal(state.stateReady, false);
});

test("nextSessionState keeps loaded state for the same user", () => {
  const profileLoadedRef = { current: true };
  const state = stateSetters({ profileLoading: true, stateReady: false });
  const session = { user: { id: "user-1" } };
  const result = nextSessionState(session, session, {
    profileLoadedRef,
    setProfileLoading: state.setProfileLoading,
    setStateReady: state.setStateReady,
  });
  assert.equal(result, session);
  assert.equal(state.profileLoading, false);
  assert.equal(state.stateReady, true);
});

function stateSetters(initial) {
  const state = {
    profileLoading: initial.profileLoading,
    stateReady: initial.stateReady,
    setProfileLoading: (value) => {
      state.profileLoading = value;
    },
    setStateReady: (value) => {
      state.stateReady = value;
    },
  };
  return state;
}
