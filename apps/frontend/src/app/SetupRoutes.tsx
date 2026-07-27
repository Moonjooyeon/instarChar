import React from "react";

export function SetupRoutes({ ctx }) {
  const {
    accounts,
    activeId,
    canUseApp,
    char,
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
    parseDump,
    parseError,
    parseFailed,
    parseRelations,
    parsing,
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
          saveStatus={saveStatus}
          session={session}
          setDeleteTarget={setDeleteTarget}
          setPersonaDraft={setPersonaDraft}
          signOut={signOut}
          startNewCharacter={startNewCharacter}
          switchAccount={switchAccount}
        />
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
          confirmReady={confirmReady}
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
