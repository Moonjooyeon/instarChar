import React from "react";

export function DiscoverRoute({ ctx }) {
  const {
    activeId,
    activeSharedId,
    blockedUserIds,
    char,
    discoverQuery,
    DiscoverScreen,
    DISCOVER_POOL,
    following,
    hasBackendApiConfig,
    isFollowing,
    loadSharedCharacters,
    openCredits,
    publicFollowerCount,
    requestDmEntry,
    session,
    setDiscoverQuery,
    setPublicProfile,
    setSharedFocusId,
    setStep,
    setWorldModal,
    sharedCharacters,
    sharedFocusId,
    sharedLoadState,
    toggleFollow,
    WorldChip,
  } = ctx;
  return (
    <DiscoverScreen
      activeId={activeId}
      activeSharedId={activeSharedId}
      blockedUserIds={blockedUserIds}
      char={char}
      discoverPool={DISCOVER_POOL}
      discoverQuery={discoverQuery}
      following={following}
      hasBackendApiConfig={hasBackendApiConfig}
      isFollowing={isFollowing}
      loadSharedCharacters={loadSharedCharacters}
      openCredits={openCredits}
      publicFollowerCount={publicFollowerCount}
      requestDmEntry={requestDmEntry}
      session={session}
      setDiscoverQuery={setDiscoverQuery}
      setPublicProfile={setPublicProfile}
      setSharedFocusId={setSharedFocusId}
      setStep={setStep}
      sharedCharacters={sharedCharacters}
      sharedFocusId={sharedFocusId}
      sharedLoadState={sharedLoadState}
      toggleFollow={toggleFollow}
      WorldChip={(props) => <WorldChip {...props} onOpen={setWorldModal} />}
    />
  );
}
