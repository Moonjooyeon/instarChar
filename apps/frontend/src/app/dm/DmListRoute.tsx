import React from "react";

export function DmListRoute({ ctx }) {
  const {
    accounts,
    activeId,
    char,
    deleteDmThread,
    displayDmTitle,
    DmListScreen,
    following,
    myConversations,
    nameMatch,
    newChatMode,
    newChatSpeaker,
    openCredits,
    personas,
    relationMatched,
    requestDmEntry,
    setNewChatMode,
    setNewChatSpeaker,
    setPersonaDraft,
    setStep,
    sharedCharacters,
    startRenameDm,
  } = ctx;
  return (
    <DmListScreen
      accounts={accounts}
      activeId={activeId}
      char={char}
      conversations={myConversations()}
      deleteDmThread={deleteDmThread}
      displayDmTitle={displayDmTitle}
      following={following}
      nameMatch={nameMatch}
      newChatMode={newChatMode}
      newChatSpeaker={newChatSpeaker}
      openCredits={openCredits}
      personas={personas}
      relationMatched={relationMatched}
      requestDmEntry={requestDmEntry}
      setNewChatMode={setNewChatMode}
      setNewChatSpeaker={setNewChatSpeaker}
      setPersonaDraft={setPersonaDraft}
      setStep={setStep}
      sharedCharacters={sharedCharacters}
      startRenameDm={startRenameDm}
    />
  );
}
