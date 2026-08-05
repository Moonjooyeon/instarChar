import React from "react";
import { CreditStoreScreen } from "@/features/credits/CreditStoreScreen";
import type { useAliveAppController } from "@/hooks/useAliveAppController";
import type { ThemeController } from "@/hooks/useAliveTheme";

interface SetupRoutesProps {
  ctx: ReturnType<typeof useAliveAppController>;
  theme: ThemeController;
}

export function SetupRoutes({ ctx, theme }: SetupRoutesProps) {
  const {
    accounts,
    activeId,
    canUseApp,
    char,
    characterSaveError,
    closeCredits,
    confirmReady,
    ConfirmScreen,
    deleteAccount,
    deletePersona,
    dump,
    DumpScreen,
    editAccount,
    EXAMPLES,
    hasBackendApiConfig,
    HomeScreen,
    handleAvailability,
    handleError,
    parseDump,
    parseError,
    parseFailed,
    parseRelations,
    parsing,
    openCredits,
    personas,
    profileName,
    rpLog,
    saveCharacterEdits,
    saveStatus,
    session,
    setDeleteTarget,
    setDump,
    setPersonaDraft,
    setRpLog,
    setStep,
    signOut,
    startNewCharacter,
    step,
    switchAccount,
    update,
    wakeCharacter,
    waking,
  } = ctx;
  return (
    <>
      {canUseApp && step === "home" && (
        <HomeScreen
          accounts={accounts}
          deleteAccount={deleteAccount}
          deletePersona={deletePersona}
          editAccount={editAccount}
          hasBackendApiConfig={hasBackendApiConfig}
          personas={personas}
          profileName={profileName}
          openCredits={openCredits}
          saveStatus={saveStatus}
          session={session}
          setDeleteTarget={setDeleteTarget}
          setPersonaDraft={setPersonaDraft}
          signOut={signOut}
          startNewCharacter={startNewCharacter}
          switchAccount={switchAccount}
          theme={theme}
        />
      )}

      {canUseApp && step === "credits" && (
        <CreditStoreScreen onBack={closeCredits} />
      )}

      {canUseApp && step === "dump" && (
        <DumpScreen
          dump={dump}
          examples={EXAMPLES}
          parsing={parsing}
          parseDump={parseDump}
          rpLog={rpLog}
          setDump={setDump}
          setRpLog={setRpLog}
          setStep={setStep}
        />
      )}

      {}
      {canUseApp && step === "confirm" && (
        <ConfirmScreen
          activeId={activeId}
          char={char}
          characterSaveError={characterSaveError}
          confirmReady={confirmReady}
          handleAvailability={handleAvailability}
          handleError={handleError}
          parseError={parseError}
          parseFailed={parseFailed}
          parseRelations={parseRelations}
          saveCharacterEdits={saveCharacterEdits}
          setStep={setStep}
          update={update}
          wakeCharacter={wakeCharacter}
          waking={waking}
        />
      )}

      {}
    </>
  );
}
