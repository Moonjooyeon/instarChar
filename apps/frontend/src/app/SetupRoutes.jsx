import React from "react";

export function SetupRoutes({ ctx }) {
  const {
    accounts,
    activeId,
    BUILD_MARK,
    canUseApp,
    char,
    confirmReady,
    ConfirmScreen,
    deletePersona,
    dump,
    DumpScreen,
    editAccount,
    EXAMPLES,
    hasSupabaseConfig,
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
          buildMark={BUILD_MARK}
          deletePersona={deletePersona}
          editAccount={editAccount}
          hasSupabaseConfig={hasSupabaseConfig}
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
          hasSupabaseConfig={hasSupabaseConfig}
          parsing={parsing}
          parseDump={parseDump}
          profileName={profileName}
          rpLog={rpLog}
          saveStatus={saveStatus}
          session={session}
          setDump={setDump}
          setRpLog={setRpLog}
          setStep={setStep}
          signOut={signOut}
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
