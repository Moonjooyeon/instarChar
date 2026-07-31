import React from "react";

export function AuthRoutes({ ctx }) {
  const {
    authBusy,
    authEmail,
    AuthEntryScreen,
    authLoading,
    AuthLoadingScreen,
    authMessage,
    authMode,
    authPassword,
    externalAuthAvailable,
    hasSupabaseConfig,
    sendMagicLoginLink,
    sendPasswordReset,
    session,
    setAuthEmail,
    setAuthMessage,
    setAuthMode,
    setAuthPassword,
    setProfileLoading,
    setProfileLoadRetry,
    setStateReady,
    signInWithProvider,
    submitAuth,
  } = ctx;
  return (
    <>
      {authBusy && (
        <AuthLoadingScreen
          authMessage={authMessage}
          onRetryCharacters={() => {
            setAuthMessage("캐릭터를 다시 불러오고 있어요.");
            setProfileLoading(true);
            setStateReady(false);
            setProfileLoadRetry((v) => v + 1);
          }}
        />
      )}

      {hasSupabaseConfig && !authLoading && !session && (
        <AuthEntryScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authLoading={authLoading}
          authMessage={authMessage}
          setAuthMessage={setAuthMessage}
          submitAuth={submitAuth}
          sendMagicLoginLink={sendMagicLoginLink}
          sendPasswordReset={sendPasswordReset}
          signInWithProvider={signInWithProvider}
          externalAuthAvailable={externalAuthAvailable}
        />
      )}
    </>
  );
}
