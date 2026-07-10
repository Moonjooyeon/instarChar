import React from "react";

export function DiscoverRoute({ ctx }) {
  const {
    activeId,
    activeSharedId,
    char,
    discoverQuery,
    DiscoverScreen,
    DISCOVER_POOL,
    following,
    hasSupabaseConfig,
    isFollowing,
    loadSharedCharacters,
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
      char={char}
      discoverPool={DISCOVER_POOL}
      discoverQuery={discoverQuery}
      following={following}
      hasSupabaseConfig={hasSupabaseConfig}
      isFollowing={isFollowing}
      loadSharedCharacters={loadSharedCharacters}
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
