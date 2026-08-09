import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CREDIT_BALANCE_UPDATED_EVENT, getCreditBalance } from "@/api/credits";

interface CreditShortcutProps {
  balance?: number | null;
  onOpen: () => void;
  overlay?: boolean;
}

export function CreditShortcut({
  balance,
  onOpen,
  overlay = false,
}: CreditShortcutProps): React.ReactElement {
  const [remoteBalance, setRemoteBalance] = React.useState<number | null>(
    balance ?? null,
  );
  React.useEffect(
    () => subscribeToBalance(balance, setRemoteBalance),
    [balance],
  );
  const amount = remoteBalance?.toLocaleString("ko-KR");
  const accessibleBalance = amount ? `${amount} C` : "잔액 연결 전";
  return (
    <button
      aria-label={`크레딧 ${accessibleBalance} · 충전 화면 열기`}
      className={`al-credit-shortcut ${overlay ? "overlay" : ""}`}
      onClick={onOpen}
      type="button"
    >
      <span>
        <AliveIcon name="wallet" size={14} />
      </span>
      <b>
        {amount ? (
          <>
            {amount} <small>C</small>
          </>
        ) : (
          "크레딧"
        )}
      </b>
    </button>
  );
}

function subscribeToBalance(
  balance: number | null | undefined,
  setBalance: (value: number | null) => void,
): () => void {
  if (balance !== undefined) setBalance(balance);
  const refresh = (): void => {
    if (balance === undefined)
      getCreditBalance()
        .then((data) => setBalance(data.total_credits))
        .catch(() => setBalance(null));
  };
  refresh();
  window.addEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh);
  return () =>
    window.removeEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh);
}
