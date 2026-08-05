import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";

interface CreditShortcutProps {
  balance?: number | null;
  onOpen: () => void;
  overlay?: boolean;
}

export function CreditShortcut({ balance = null, onOpen, overlay = false }: CreditShortcutProps): React.ReactElement {
  const amount = balance?.toLocaleString("ko-KR");
  const accessibleBalance = amount ? `${amount} C` : "잔액 연결 전";
  return <button aria-label={`크레딧 ${accessibleBalance} · 충전 화면 열기`} className={`al-credit-shortcut ${overlay ? "overlay" : ""}`} onClick={onOpen} type="button"><span><AliveIcon name="wallet" size={14} /></span><b>{amount ? <>{amount} <small>C</small></> : "크레딧"}</b></button>;
}
