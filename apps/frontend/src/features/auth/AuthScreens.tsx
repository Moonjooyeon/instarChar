import React from "react";

export function AuthLoadingScreen({ authMessage, onRetryCharacters }) {
  const canRetry = String(authMessage || "").includes("캐릭터를 불러오지 못했어요");

  return (
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">✶</span>
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
}) {
  return (
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">✶</span>
        <h1>ALIVE 로그인</h1>
        <p>Google 또는 Apple 계정으로 저장된 캐릭터와 대화를 불러올게.</p>
        <div className="al-social-login">
          <button onClick={() => signInWithProvider("google")} disabled={authLoading}>Google로 계속</button>
          <button onClick={() => signInWithProvider("apple")} disabled={authLoading}>Apple로 계속</button>
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
        <span className="al-spark">✶</span>
        <h1>화면 복구가 필요해</h1>
        <p>저장된 화면 위치가 꼬였어. 홈으로 돌아가거나 로그인 상태를 초기화할 수 있어.</p>
        <button className="al-auth-btn" onClick={onHome}>홈으로 돌아가기</button>
        <button className="al-auth-linkbtn" onClick={onRecoverAuth}>로그인 상태 초기화</button>
        {authMessage && <p className="al-auth-msg">{authMessage}</p>}
      </div>
    </div>
  );
}
