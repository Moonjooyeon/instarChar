import { useEffect, useRef } from "react";
import {
  RENDERABLE_STEPS,
  normalizeSavedStep,
  pathForStep,
  stepFromPath,
} from "@/domain/app/aliveCore";

export function useAliveNavigation({
  activeId,
  canUseApp,
  dmSettingsOpen,
  dmWorldDraft,
  followPanel,
  newChatMode,
  pendingDm,
  publicProfile,
  setDmSettingsOpen,
  setDmWorldDraft,
  setFollowPanel,
  setNewChatMode,
  setPendingDm,
  setPublicProfile,
  setStep,
  step,
}) {
  const navInitRef = useRef(false);
  const navApplyingRef = useRef(false);
  const navLastKeyRef = useRef("");

  function navStateForHistory() {
    return {
      __aliveNav: true,
      step: RENDERABLE_STEPS.has(step) ? step : "home",
      pendingDm,
      dmWorldDraft,
      followPanel,
      publicProfile,
      newChatMode,
      dmSettingsOpen,
    };
  }

  function navKey(state = navStateForHistory()) {
    return JSON.stringify({
      step: state.step,
      pending: Boolean(state.pendingDm),
      pendingMode: state.pendingDm?.mode || "",
      followPanel: state.followPanel || "",
      publicProfile: state.publicProfile?.id || state.publicProfile?.sharedId || state.publicProfile?.name || "",
      newChatMode: state.newChatMode || "",
      dmSettingsOpen: Boolean(state.dmSettingsOpen),
    });
  }

  function navUrlForState(state = navStateForHistory()) {
    const url = new URL(window.location.href);
    url.pathname = pathForStep(state.step);
    url.search = "";
    url.hash = "";
    return `${url.pathname}${url.search}${url.hash}`;
  }

  useEffect(() => {
    if (!canUseApp) {
      navInitRef.current = false;
      navLastKeyRef.current = "";
      return;
    }
    const state = navStateForHistory();
    const key = navKey(state);
    if (!navInitRef.current) {
      const routeStep = stepFromPath(window.location.pathname, Boolean(activeId));
      const shouldUseRouteStep = state.step === "home" && routeStep !== "home";
      const routedState = { ...state, step: shouldUseRouteStep ? routeStep : state.step };
      if (shouldUseRouteStep) setStep(routeStep);
      window.history.replaceState(routedState, "", navUrlForState(routedState));
      navInitRef.current = true;
      navLastKeyRef.current = navKey(routedState);
      return;
    }
    if (navApplyingRef.current) {
      window.history.replaceState(state, "", navUrlForState(state));
      navLastKeyRef.current = key;
      return;
    }
    if (key !== navLastKeyRef.current) {
      window.history.pushState(state, "", navUrlForState(state));
      navLastKeyRef.current = key;
      return;
    }
    window.history.replaceState(state, "", navUrlForState(state));
  }, [canUseApp, step, pendingDm, followPanel, publicProfile, newChatMode, dmSettingsOpen, activeId]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp || !navInitRef.current) return;
    const state = navStateForHistory();
    window.history.replaceState(state, "", navUrlForState(state));
  }, [dmWorldDraft]); // eslint-disable-line

  useEffect(() => {
    if (!canUseApp) return;
    function handlePopState(event) {
      const state = event.state;
      if (!state?.__aliveNav) {
        const fallback = navStateForHistory();
        window.history.pushState(fallback, "", navUrlForState(fallback));
        return;
      }
      navApplyingRef.current = true;
      navLastKeyRef.current = navKey(state);
      setPendingDm(state.pendingDm || null);
      setDmWorldDraft(state.dmWorldDraft || "");
      setFollowPanel(state.followPanel || null);
      setPublicProfile(state.publicProfile || null);
      setNewChatMode(state.newChatMode || null);
      setDmSettingsOpen(Boolean(state.dmSettingsOpen));
      setStep(normalizeSavedStep(state.step, Boolean(activeId)));
      window.setTimeout(() => {
        navApplyingRef.current = false;
      }, 0);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [canUseApp, activeId]); // eslint-disable-line

  return {
    navApplyingRef,
    navInitRef,
    navKey,
    navLastKeyRef,
    navStateForHistory,
    navUrlForState,
  };
}
