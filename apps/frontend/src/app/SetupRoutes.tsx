import React from "react";
import { CreditStoreScreen } from "@/features/credits/CreditStoreScreen";
import type { useAliveAppController } from "@/hooks/useAliveAppController";

interface SetupRoutesProps {
  ctx: ReturnType<typeof useAliveAppController>;
}

export function SetupRoutes({ ctx }: SetupRoutesProps) {
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
    exitProfileEdit,
    EXAMPLES,
    hasBackendApiConfig,
    HomeScreen,
    handleAvailability,
    handleError,
    parseDump,
    parseFailed,
    parseRelations,
    parsing,
    profileEditBackLabel,
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
          parseFailed={parseFailed}
          parseRelations={parseRelations}
          parsing={parsing}
          parseDump={parseDump}
          onBack={exitProfileEdit}
          profileEditBackLabel={profileEditBackLabel}
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
