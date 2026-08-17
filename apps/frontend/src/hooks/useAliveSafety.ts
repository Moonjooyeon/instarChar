import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  acceptSafetyTerms,
  blockSafetyUser,
  createSafetyReport,
  getBlockedUsers,
  getSafetyConsent,
  type ReportReason,
  type ReportTarget,
} from "@/api/safety";

type SessionLike = {
  user?: {
    id?: string;
  };
};

type SafetyOptions = {
  session: SessionLike | null;
  setAuthMessage: (value: string) => void;
  setSaveStatus: Dispatch<SetStateAction<string>>;
};

export function useAliveSafety({ session, setAuthMessage, setSaveStatus }: SafetyOptions) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [safetyLoadFailed, setSafetyLoadFailed] = useState(false);
  const [safetyLoadRetry, setSafetyLoadRetry] = useState(0);
  const [termsVersion, setTermsVersion] = useState("");
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  useEffect(() => {
    setConsentLoaded(false);
    setSafetyLoadFailed(false);
    if (!session?.user?.id) return resetSafetyState(setConsentAccepted, setBlockedUserIds, setConsentLoaded);
    let active = true;
    void loadSafetyState(setBlockedUserIds, setConsentAccepted, setConsentLoaded, setTermsVersion).catch(() => {
      if (!active) return;
      setSafetyLoadFailed(true);
      setAuthMessage("안전 정보를 불러오지 못했어. 다시 시도해줘.");
    });
    return () => { active = false; };
  }, [session?.user?.id, safetyLoadRetry]);
  async function acceptTerms(): Promise<void> {
    const result = await acceptSafetyTerms();
    if (result.error) return setSaveStatus(`약관 동의 실패: ${result.error.message}`);
    setConsentAccepted(true);
    setTermsVersion(result.data?.terms_version || termsVersion);
  }
  async function blockUser(userId: string): Promise<boolean> {
    const result = await blockSafetyUser(userId);
    if (result.error) {
      setSaveStatus(`차단 실패: ${result.error.message}`);
      return false;
    }
    setBlockedUserIds((items) => [...new Set([...items, userId])]);
    setSaveStatus("사용자를 차단했어요");
    return true;
  }
  async function submitReport(reason: ReportReason, detail: string): Promise<void> {
    if (!reportTarget) return;
    const result = await createSafetyReport(reportTarget, reason, detail);
    if (result.error) return setSaveStatus(`신고 실패: ${result.error.message}`);
    setReportTarget(null);
    setSaveStatus("신고가 접수됐어요");
  }
  function retrySafetyState(): void {
    setSafetyLoadRetry((value) => value + 1);
  }
  return { acceptTerms, blockedUserIds, blockUser, consentAccepted, consentLoaded, reportTarget, retrySafetyState, safetyLoadFailed, setReportTarget, submitReport, termsVersion };
}

async function loadSafetyState(
  setBlocked: Dispatch<SetStateAction<string[]>>,
  setAccepted: Dispatch<SetStateAction<boolean>>,
  setLoaded: Dispatch<SetStateAction<boolean>>,
  setVersion: Dispatch<SetStateAction<string>>,
): Promise<void> {
  const [consent, blocks] = await Promise.all([getSafetyConsent(), getBlockedUsers()]);
  if (consent.error || blocks.error) throw new Error("Safety state request failed");
  setAccepted(Boolean(consent.data?.accepted));
  setVersion(consent.data?.terms_version || "");
  setBlocked(blocks.data?.user_ids || []);
  setLoaded(true);
}

function resetSafetyState(
  setAccepted: Dispatch<SetStateAction<boolean>>,
  setBlocked: Dispatch<SetStateAction<string[]>>,
  setLoaded: Dispatch<SetStateAction<boolean>>,
): void {
  setAccepted(false);
  setBlocked([]);
  setLoaded(true);
}
