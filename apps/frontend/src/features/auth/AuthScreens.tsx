import React from "react";

import { isAppsInTossRuntime, shouldShowAppleLogin } from "@/api/auth";
import { ServiceTour } from "@/features/onboarding/ServiceTour";

export function AuthLoadingScreen({ authMessage, onRetryCharacters }) {
  const canRetry = String(authMessage || "").includes("캐릭터를 불러오지 못했어요");

  return (
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">★</span>
        <h1>ALIVE 불러오는 중</h1>
        <p>계정과 저장된 캐릭터를 확인하고 있어.</p>
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
        {canRetry && (
          <button className="al-auth-btn" onClick={onRetryCharacters}>
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
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">★</span>
        <h1>ALIVE 로그인</h1>
        <p>{isAppsInToss ? "토스 계정으로 저장된 캐릭터와 대화를 불러올게." : showAppleLogin ? "Google 또는 Apple 계정으로 저장된 캐릭터와 대화를 불러올게." : "Google 계정으로 저장된 캐릭터와 대화를 불러올게."}</p>
        <button className="al-auth-tour-link" onClick={() => setIsTourOpen(true)}>ALIVE에서 무엇을 할 수 있나요? <span>둘러보기 →</span></button>
        <div className="al-social-login">
          {isAppsInToss ? (
            <button className="al-auth-btn" onClick={signInWithToss} disabled={authLoading} aria-label="토스로 계속">토스로 계속</button>
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
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
      </div>
    </div>
  );
}


export function RecoveryScreen({ authMessage, onHome, onRecoverAuth }) {
  return (
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">★</span>
        <h1>화면 복구가 필요해</h1>
        <p>저장된 화면 위치가 꼬였어. 홈으로 돌아가거나 로그인 상태를 초기화할 수 있어.</p>
        <button className="al-auth-btn" onClick={onHome}>홈으로 돌아가기</button>
        <button className="al-auth-linkbtn" onClick={onRecoverAuth}>로그인 상태 초기화</button>
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
      </div>
    </div>
  );
}
