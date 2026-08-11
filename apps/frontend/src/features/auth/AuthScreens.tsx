import React from "react";

import { isAppsInTossRuntime, shouldShowAppleLogin } from "@/api/auth";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { ServiceTour } from "@/features/onboarding/ServiceTour";

const PRIMARY_AUTH_ACTION_CLASS = "al-auth-btn bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-muted disabled:text-soft";
const SECONDARY_AUTH_ACTION_CLASS = "al-auth-linkbtn border-line bg-accent-soft text-accent-ink hover:border-accent hover:bg-surface-raised hover:text-accent-strong";

export function AuthLoadingScreen({ authMessage, onRetryCharacters }) {
  const canRetry = String(authMessage || "").includes("캐릭터를 불러오지 못했어요");

  return (
    <div className="al-phone al-theme-ready">
      <div className="al-auth">
        <span className="al-spark"><AliveIcon name="sparkle" size={24} /></span>
        <h1>ALIVE 불러오는 중</h1>
        <p>계정과 저장된 캐릭터를 확인하고 있어.</p>
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
        {canRetry && (
          <button className={PRIMARY_AUTH_ACTION_CLASS} onClick={onRetryCharacters}>
            다시 불러오기
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthEntryScreen({
  authLoading,
  authMessage,
  signInWithProvider,
  signInWithToss,
}) {
  const [isTourOpen, setIsTourOpen] = React.useState(false);
  const isAppsInToss = isAppsInTossRuntime();
  const showAppleLogin = shouldShowAppleLogin();
  if (isTourOpen) return <ServiceTour completeLabel="로그인하고 시작하기" onBack={() => setIsTourOpen(false)} onComplete={() => setIsTourOpen(false)} />;
  return (
    <div className="al-phone al-theme-ready">
      <main className="al-auth al-auth-entry">
        <header className="al-auth-header">
          <div className="al-auth-brand" aria-label="ALIVE">ALIVE<span /></div>
          <button className="al-auth-tour-link" onClick={() => setIsTourOpen(true)}><span><AliveIcon name="play" size={10} /></span><b>미리보기</b><i>3장</i></button>
        </header>
        <div className="al-auth-panel">
          <div className="al-auth-intro">
            <span>한 줄에서 시작되는 이야기</span>
            <h1>캐릭터가 먼저 글을 쓰고,<br />당신의 말을 기억해요.</h1>
            <p>{isAppsInToss ? "로그인하고 설정 한 줄만 남겨보세요. 나머지는 ALIVE가 이어가요." : "계정으로 시작하고 설정 한 줄만 남겨보세요. 나머지는 ALIVE가 이어가요."}</p>
          </div>
          <ol className="al-auth-archive" aria-label="계정에 이어서 저장되는 이야기">
            <li><small>01</small><b>한 줄 입력</b><span>이름과 설정</span></li>
            <li><small>02</small><b>첫 피드</b><span>먼저 쓰는 글</span></li>
            <li><small>03</small><b>대화</b><span>기억하는 순간</span></li>
          </ol>
          <div className="al-social-login">
          {isAppsInToss ? (
            <button className={PRIMARY_AUTH_ACTION_CLASS} onClick={signInWithToss} disabled={authLoading} aria-label="토스로 계속">토스로 계속</button>
          ) : (
            <button className="al-google-login" onClick={() => signInWithProvider("google")} disabled={authLoading} aria-label="Google로 계속">
            <span className="al-google-login-content">
              <img src="/google-g-logo.png" alt="" aria-hidden="true" />
              <span>Google로 계속</span>
            </span>
          </button>
          )}
          {!isAppsInToss && showAppleLogin && (
            <button className="al-apple-login" onClick={() => signInWithProvider("apple")} disabled={authLoading} aria-label="Apple로 계속">
              <img src="/apple-sign-in-continue-ko.png" alt="" aria-hidden="true" />
            </button>
          )}
          </div>
          <p className="al-auth-new">로그인하면 이야기가 계정에 이어져요.</p>
          {authMessage && <p className="al-auth-msg" role="status">{authMessage}</p>}
        </div>
      </main>
    </div>
  );
}


export function RecoveryScreen({ authMessage, onHome, onRecoverAuth }) {
  return (
    <div className="al-phone al-theme-ready">
      <div className="al-auth">
        <span className="al-spark"><AliveIcon name="sparkle" size={24} /></span>
        <h1>화면 복구가 필요해</h1>
        <p>저장된 화면 위치가 꼬였어. 홈으로 돌아가거나 로그인 상태를 초기화할 수 있어.</p>
        <button className={PRIMARY_AUTH_ACTION_CLASS} onClick={onHome}>홈으로 돌아가기</button>
        <button className={SECONDARY_AUTH_ACTION_CLASS} onClick={onRecoverAuth}>로그인 상태 초기화</button>
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
      </div>
    </div>
  );
}
