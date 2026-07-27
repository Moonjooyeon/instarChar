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
  setSaveStatus: Dispatch<SetStateAction<string>>;
};

export function useAliveSafety({ session, setSaveStatus }: SafetyOptions) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [termsVersion, setTermsVersion] = useState("");
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  useEffect(() => {
    setConsentLoaded(false);
    if (!session?.user?.id) return resetSafetyState(setConsentAccepted, setBlockedUserIds, setConsentLoaded);
    void loadSafetyState(setBlockedUserIds, setConsentAccepted, setConsentLoaded, setTermsVersion);
  }, [session?.user?.id]);
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
  return { acceptTerms, blockedUserIds, blockUser, consentAccepted, consentLoaded, reportTarget, setReportTarget, submitReport, termsVersion };
}

async function loadSafetyState(
  setBlocked: Dispatch<SetStateAction<string[]>>,
  setAccepted: Dispatch<SetStateAction<boolean>>,
  setLoaded: Dispatch<SetStateAction<boolean>>,
  setVersion: Dispatch<SetStateAction<string>>,
): Promise<void> {
  const [consent, blocks] = await Promise.all([getSafetyConsent(), getBlockedUsers()]);
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
