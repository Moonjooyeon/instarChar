import { useEffect, useRef, type MutableRefObject } from "react";
import {
  RENDERABLE_STEPS,
  normalizeSavedStep,
  pathForStep,
  sharedSearchForNavigation,
  stepFromPath,
  type AppStep,
} from "@/domain/app/aliveCore";

type NavState = {
  __aliveNav: true;
  dmSettingsOpen: boolean;
  dmWorldDraft: unknown;
  followPanel: NavTarget | null;
  newChatMode: unknown;
  pendingDm: NavTarget | null;
  publicProfile: NavTarget | null;
  step: AppStep;
};

type NavTarget = {
  id?: string;
  mode?: string;
  name?: string;
  sharedId?: string;
  [key: string]: unknown;
};

type NavigationOptions = {
  activeId: string | null;
  canUseApp: boolean;
  dmSettingsOpen: boolean;
  dmWorldDraft: unknown;
  followPanel: unknown;
  newChatMode: unknown;
  pendingDm: unknown;
  publicProfile: unknown;
  setDmSettingsOpen: (value: boolean) => void;
  setDmWorldDraft: (value: string) => void;
  setFollowPanel: (value: unknown) => void;
  setNewChatMode: (value: unknown) => void;
  setPendingDm: (value: unknown) => void;
  setPublicProfile: (value: unknown) => void;
  setStep: (value: AppStep) => void;
  step: AppStep;
};

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
}: NavigationOptions): {
  navApplyingRef: MutableRefObject<boolean>;
  navInitRef: MutableRefObject<boolean>;
  navKey: (state?: NavState) => string;
  navLastKeyRef: MutableRefObject<string>;
  navStateForHistory: () => NavState;
  navUrlForState: (state?: NavState) => string;
} {
  const navInitRef = useRef(false);
  const navApplyingRef = useRef(false);
  const navLastKeyRef = useRef("");

  function navStateForHistory(): NavState {
    return {
      __aliveNav: true,
      step: RENDERABLE_STEPS.has(step) ? step : "home",
      pendingDm: navTargetOrNull(pendingDm),
      dmWorldDraft,
      followPanel: navTargetOrNull(followPanel),
      publicProfile: navTargetOrNull(publicProfile),
      newChatMode,
      dmSettingsOpen,
    };
  }

  function navKey(state = navStateForHistory()): string {
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

  function navUrlForState(state = navStateForHistory()): string {
    const url = new URL(window.location.href);
    url.pathname = pathForStep(state.step);
    url.search = sharedSearchForNavigation(url.search);
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
    function handlePopState(event: PopStateEvent): void {
      const state = navStateFromUnknown(event.state);
      if (!state) {
        const fallback = navStateForHistory();
        window.history.pushState(fallback, "", navUrlForState(fallback));
        return;
      }
      navApplyingRef.current = true;
      navLastKeyRef.current = navKey(state);
      setPendingDm(state.pendingDm || null);
      setDmWorldDraft(String(state.dmWorldDraft || ""));
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

function navStateFromUnknown(value: unknown): NavState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<NavState>;
  if (!state.__aliveNav) return null;
  return { ...state, step: normalizeSavedStep(state.step, true) } as NavState;
}

function navTargetOrNull(value: unknown): NavTarget | null {
  if (!value || typeof value !== "object") return null;
  return value as NavTarget;
}
