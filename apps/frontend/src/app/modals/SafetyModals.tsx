import React, { useState } from "react";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/domain/app/legal";
import type { ReportReason } from "@/api/safety";

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "sexual", label: "성적·음란 콘텐츠" },
  { value: "harassment", label: "괴롭힘·위협" },
  { value: "hate", label: "혐오·차별" },
  { value: "violence", label: "폭력적 콘텐츠" },
  { value: "self_harm", label: "자해·자살 조장" },
  { value: "illegal", label: "불법 행위" },
  { value: "impersonation", label: "사칭" },
  { value: "privacy", label: "개인정보 침해" },
  { value: "copyright", label: "저작권 침해" },
  { value: "spam", label: "스팸" },
  { value: "other", label: "기타" },
];

const REPORT_INPUT_CLASS = "border-line bg-surface-raised text-ink placeholder:text-faint focus:border-accent";
const REPORT_CANCEL_CLASS = "al-modal-cancel border-line bg-surface-raised text-soft hover:bg-surface-muted hover:text-ink";
const REPORT_DANGER_CLASS = "al-modal-danger bg-danger-soft text-danger hover:bg-danger hover:text-white";

export function SafetyModals({ ctx }) {
  return (
    <>
      <ConsentModal ctx={ctx} />
      <ReportModal ctx={ctx} />
    </>
  );
}

function ConsentModal({ ctx }) {
  const { acceptTerms, consentAccepted, consentLoaded, hasBackendApiConfig, session, termsVersion } = ctx;
  if (!hasBackendApiConfig || !session || !consentLoaded || consentAccepted) return null;
  return (
    <div className="al-modal-bg al-safety-layer al-theme-ready al-common-modal-theme-ready">
      <div className="al-modal al-consent-modal">
        <h3 className="al-modal-title">커뮤니티 이용약관 동의</h3>
        <p className="al-modal-sub">공개 캐릭터, 게시물, 댓글과 DM을 이용하려면 커뮤니티 규칙과 개인정보처리방침에 동의해야 해요.</p>
        <ul>
          <li>타인을 괴롭히거나 권리를 침해하는 콘텐츠를 게시하지 않습니다.</li>
          <li>불쾌한 콘텐츠는 신고하고, 원치 않는 사용자는 차단할 수 있습니다.</li>
          <li>위반 콘텐츠와 계정은 운영 정책에 따라 제한될 수 있습니다.</li>
        </ul>
        <p className="al-consent-links"><a href={TERMS_URL} target="_blank" rel="noreferrer">이용약관</a><a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">개인정보처리방침</a></p>
        <button className="al-modal-save al-consent-accept bg-accent text-white hover:bg-accent-strong" onClick={acceptTerms}>동의하고 계속</button>
        <small>약관 버전 {termsVersion || "확인 중"}</small>
      </div>
    </div>
  );
}

function ReportModal({ ctx }) {
  const { reportTarget, setReportTarget, submitReport } = ctx;
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [detail, setDetail] = useState("");
  if (!reportTarget) return null;
  return (
    <div className="al-modal-bg al-safety-layer al-theme-ready al-common-modal-theme-ready" onClick={() => setReportTarget(null)}>
      <div className="al-modal" onClick={(event) => event.stopPropagation()}>
        <h3 className="al-modal-title">콘텐츠 신고</h3>
        <p className="al-modal-sub">{reportTarget.label}을(를) 운영팀에 신고합니다. 신고 내용은 상대방에게 공개되지 않습니다.</p>
        <select className={`al-report-select ${REPORT_INPUT_CLASS}`} value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
          {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <textarea className={`al-report-detail ${REPORT_INPUT_CLASS}`} value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={2000} placeholder="상세 내용을 입력해 주세요. (선택)" />
        <div className="al-modal-actions">
          <button className={REPORT_CANCEL_CLASS} onClick={() => setReportTarget(null)}>취소</button>
          <button className={REPORT_DANGER_CLASS} onClick={() => submitReport(reason, detail)}>신고 접수</button>
        </div>
      </div>
    </div>
  );
}
