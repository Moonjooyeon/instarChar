import React from "react";

interface FeedHelpTourOptions {
  hasPosts: boolean;
  userId?: string | null;
}

interface FeedHelpTourState {
  closeHelp: () => void;
  isHelpOpen: boolean;
  openHelp: () => void;
}

const HELP_STORAGE_PREFIX = "alive_feed_help_seen_v2";

export function useFeedHelpTour({ hasPosts, userId }: FeedHelpTourOptions): FeedHelpTourState {
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const storageKey = `${HELP_STORAGE_PREFIX}:${userId || "local"}`;
  React.useEffect(() => {
    if (!hasPosts || hasSeenHelp(storageKey)) return;
    setIsHelpOpen(true);
  }, [hasPosts, storageKey]);
  const openHelp = React.useCallback((): void => setIsHelpOpen(true), []);
  const closeHelp = React.useCallback((): void => {
    setIsHelpOpen(false);
    if (hasPosts) saveSeenHelp(storageKey);
  }, [hasPosts, storageKey]);
  return { closeHelp, isHelpOpen, openHelp };
}

function hasSeenHelp(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function saveSeenHelp(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, "true");
  } catch {
    return;
  }
}
