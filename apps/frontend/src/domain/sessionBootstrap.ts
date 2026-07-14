type MutableRef<T> = {
  current: T;
};

type SessionLike = {
  user?: {
    id?: string;
  };
};

type SessionStateOptions = {
  profileLoadedRef: MutableRef<boolean>;
  setProfileLoading: (value: boolean) => void;
  setStateReady: (value: boolean) => void;
};

export function nextSessionState(prevSession: SessionLike | null, nextSession: SessionLike | null, { profileLoadedRef, setProfileLoading, setStateReady }: SessionStateOptions): SessionLike | null {
  const sameUser = prevSession?.user?.id && nextSession?.user?.id === prevSession.user.id;
  if (!nextSession) {
    profileLoadedRef.current = false;
    setStateReady(false);
    setProfileLoading(false);
  } else if (sameUser && profileLoadedRef.current) {
    setStateReady(true);
    setProfileLoading(false);
  } else {
    profileLoadedRef.current = false;
    setStateReady(false);
    setProfileLoading(true);
  }
  return nextSession;
}
