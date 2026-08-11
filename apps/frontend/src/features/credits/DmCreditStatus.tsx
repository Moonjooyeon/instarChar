import React from "react";
import { CREDIT_BALANCE_UPDATED_EVENT, getCreditBalance, getCreditCatalog, type CreditBalance, type CreditCatalog } from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditUsagePreview, type CreditUsagePreview } from "@/domain/credits/creditPresentation";

interface DmCreditStatusProps {
  busy: boolean;
  flowCode: string;
  onOpenCredits: () => void;
}

type DmCreditData = {
  balance: CreditBalance | null;
  catalog: CreditCatalog | null;
};

export function DmCreditStatus({ busy, flowCode, onOpenCredits }: DmCreditStatusProps): React.ReactElement {
  const { data, error } = useDmCreditData(flowCode);
  const preview = creditPreview(data, flowCode, busy);
  if (busy) return <div className="al-dm-credit-status energy"><span><AliveIcon name="refresh" size={13} /></span><p><b>사용량 예약 중</b><small>이번 답장 사용량을 예약하고 있어요.</small></p></div>;
  if (!preview) return <div className="al-dm-credit-status loading">{error || "이번 답장 비용을 확인하고 있어요."}</div>;
  return <div className={`al-dm-credit-status ${preview.state}`}><span><AliveIcon name={busy ? "refresh" : "wallet"} size={13} /></span><p><b>{preview.label}</b><small>{preview.detail}</small></p>{preview.action === "open-credits" && <button type="button" onClick={onOpenCredits}>크레딧 확인</button>}</div>;
}

function useDmCreditData(flowCode: string): { data: DmCreditData; error: string } {
  const [data, setData] = React.useState<DmCreditData>({ balance: null, catalog: null });
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active = true;
    const refresh = (): void => { Promise.all([getCreditBalance(), getCreditCatalog()]).then(([balance, catalog]) => { if (active) setData({ balance, catalog }); }).catch(() => { if (active) setError("크레딧 정보를 불러오지 못했어요."); }); };
    refresh();
    window.addEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh);
    return () => { active = false; window.removeEventListener(CREDIT_BALANCE_UPDATED_EVENT, refresh); };
  }, [flowCode]);
  return { data, error };
}

function creditPreview(data: DmCreditData, flowCode: string, busy: boolean): CreditUsagePreview | null {
  const flow = data.catalog?.flows.find((item) => item.code === flowCode);
  if (!flow || !data.balance) return null;
  return creditUsagePreview(flow, data.balance);
}
