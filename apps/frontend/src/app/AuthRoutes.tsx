import React from "react";
import type { useAliveAppController } from "@/hooks/useAliveAppController";

interface AuthRoutesProps {
  ctx: ReturnType<typeof useAliveAppController>;
}

export function AuthRoutes({ ctx }: AuthRoutesProps) {
  const {
    authBusy,
    AuthEntryScreen,
    authLoading,
    AuthLoadingScreen,
    authMessage,
    hasBackendApiConfig,
    session,
    setAuthMessage,
    setProfileLoading,
    setProfileLoadRetry,
    setStateReady,
    signInWithProvider,
    signInWithToss,
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

      {hasBackendApiConfig && !authLoading && !session && (
        <AuthEntryScreen
          authLoading={authLoading}
          authMessage={authMessage}
          signInWithProvider={signInWithProvider}
          signInWithToss={signInWithToss}
        />
      )}
    </>
  );
}
