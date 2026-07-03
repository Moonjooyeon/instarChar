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
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  authMessage,
  setAuthMessage,
  submitAuth,
  sendMagicLoginLink,
  sendPasswordReset,
  signInWithProvider,
}) {
  return (
    <div className="al-phone">
      <div className="al-auth">
        <span className="al-spark">✶</span>
        <h1>{authMode === "signup" ? "ALIVE 시작하기" : "ALIVE 로그인"}</h1>
        <p>{authMode === "signup" ? "계정을 만들면 캐릭터, 장기기억, DM이 저장돼." : "저장된 캐릭터와 대화를 불러올게."}</p>
        <div className="al-auth-tabs">
          <button className={authMode === "signup" ? "on" : ""} onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}>회원가입</button>
          <button className={authMode === "signin" ? "on" : ""} onClick={() => { setAuthMode("signin"); setAuthMessage(""); }}>로그인</button>
        </div>
        <div className="al-social-login">
          <button onClick={() => signInWithProvider("kakao")} disabled={authLoading}>Kakao로 계속</button>
          <button onClick={() => signInWithProvider("google")} disabled={authLoading}>Google로 계속</button>
          <button onClick={() => signInWithProvider("x")} disabled={authLoading}>X로 계속</button>
        </div>
        <div className="al-auth-divider"><span>또는 이메일로</span></div>
        <input
          className="al-auth-input"
          type="email"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          placeholder="email@example.com"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAuth(); }}
        />
        <input
          className="al-auth-input"
          type="password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          placeholder="비밀번호 6자 이상"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submitAuth(); }}
        />
        <button className="al-auth-btn" disabled={!authEmail.trim() || authPassword.length < 6 || authLoading} onClick={submitAuth}>
          {authMode === "signup" ? "회원가입하고 시작" : "로그인"}
        </button>
        <div className="al-auth-alt">
          <button disabled={!authEmail.trim() || authLoading} onClick={sendMagicLoginLink}>이메일 링크로 간편 로그인</button>
          <button disabled={!authEmail.trim() || authLoading} onClick={sendPasswordReset}>비밀번호 재설정</button>
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
