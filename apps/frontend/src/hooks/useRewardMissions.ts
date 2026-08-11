import React from "react";
import { CREDIT_BALANCE_UPDATED_EVENT, getCreditBalance, type CreditRewardMission } from "@/api/credits";

export function useRewardMissions(enabled: boolean): CreditRewardMission[] {
  const [missions, setMissions] = React.useState<CreditRewardMission[]>([]);
  React.useEffect(() => subscribeToRewardMissions(enabled, setMissions), [enabled]);
  return missions;
}

function subscribeToRewardMissions(enabled: boolean, setMissions: (missions: CreditRewardMission[]) => void): () => void {
  let active = true;
  const refresh = (): void => {
    if (!enabled) return;
    getCreditBalance().then((balance) => active && setMissions(balance.reward_missions || [])).catch(() => active && setMissions([]));
  };
  refresh();
  window.addEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh);
  return () => {
    active = false;
    window.removeEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh);
  };
}
