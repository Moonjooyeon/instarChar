import React from "react";
import { getCreditCatalog, type CreditCatalog, type CreditFlow } from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditCostSummary } from "@/domain/credits/creditPresentation";

interface CreditUsageHintProps {
  busy?: boolean;
  className?: string;
  flowCode: string;
  label?: string;
  maxUses?: number;
}

let catalogRequest: Promise<CreditCatalog> | null = null;

export function CreditUsageHint({ busy = false, className = "", flowCode, label, maxUses = 1 }: CreditUsageHintProps): React.ReactElement {
  const { error, flow } = useCreditFlow(flowCode);
  const title = busy ? "사용량 예약 중" : label || flow?.label || "예상 사용량";
  const detail = flow ? creditCostSummary(flow, maxUses) : error || "사용량 확인 중";
  return <div className={`al-credit-usage-hint ${busy ? "busy" : ""} ${error ? "error" : ""} ${className}`.trim()} role={busy ? "status" : undefined} aria-live={busy ? "polite" : undefined}><span><AliveIcon name={busy ? "refresh" : "sparkle"} size={12} /></span><p><b>{title}</b><small>{detail}</small></p></div>;
}

function useCreditFlow(flowCode: string): { error: string; flow: CreditFlow | null } {
  const [flow, setFlow] = React.useState<CreditFlow | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active = true;
    setError("");
    setFlow(null);
    loadCatalog().then((catalog) => setResolvedFlow(catalog, flowCode, active, setFlow, setError)).catch(() => { if (active) setError("사용량 정보를 불러오지 못했어요"); });
    return () => { active = false; };
  }, [flowCode]);
  return { error, flow };
}

function setResolvedFlow(catalog: CreditCatalog, code: string, active: boolean, setFlow: (flow: CreditFlow | null) => void, setError: (error: string) => void): void {
  if (!active) return;
  const flow = catalog.flows.find((item) => item.code === code) || null;
  setFlow(flow);
  if (!flow) setError("사용량 정보를 찾지 못했어요");
}

function loadCatalog(): Promise<CreditCatalog> {
  if (catalogRequest) return catalogRequest;
  catalogRequest = getCreditCatalog().catch((error: unknown) => { catalogRequest = null; throw error; });
  return catalogRequest;
}
