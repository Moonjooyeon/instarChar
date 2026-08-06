import React from "react";
import { FeedHelpTour } from "@/app/feed/FeedHelpTour";
import { FeedMemoryPanel } from "@/app/feed/FeedMemoryPanel";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { mediaUrl } from "@/api/media";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";
import { CreditShortcut } from "@/features/credits/CreditShortcut";
import { knownCharacterRelations } from "@/domain/app/aliveCore";
import { useFeedHelpTour } from "@/hooks/useFeedHelpTour";

interface FirstSceneCharacter {
  age?: unknown;
  catchphrase?: unknown;
  interests?: unknown;
  name: string;
  world?: unknown;
}

export function FeedProfilePanel({ ctx }) {
  const {
    activeSharedId,
    accounts,
    affOf,
    affinityStage,
    char,
    clearActiveProfileImage,
    deleteRelationAt,
    editActiveProfile,
    feedView,
    followerCounts,
    following,
    followPanel,
    gallery,
    goHome,
    handleProfileImage,
    handleUpload,
    isFollowedCharacterName,
    loading,
    myPosts,
    myFollowers,
    openCredits,
    parseRelations,
    relationStageLabel,
    relLabelFor,
    setAffinityManual,
    setDiscoverQuery,
    setFeedView,
    setGallery,
    setSharedFocusId,
    setStep,
    setWorldModal,
    session,
    shareCurrentCharacter,
    shareStatus,
    sharedCharacters,
    showMemory,
    showRelations,
    toggleFollowPanel,
    toggleMemoryPanel,
    toggleRelationsPanel,
    WorldChip,
  } = ctx;
  const candidates = [...accounts.map((item) => item.char), ...following, ...sharedCharacters];
  const relations = knownCharacterRelations(parseRelations(char.relations), candidates, char.name);
  const [isProfileToolsOpen, setIsProfileToolsOpen] = React.useState(false);
  const isFirstPost = myPosts.length === 0;
  const { closeHelp, isHelpOpen, openHelp } = useFeedHelpTour({ hasPosts: !isFirstPost, userId: session?.user?.id });
  React.useEffect(() => {
    if (!isHelpOpen || isFirstPost || feedView === "mine") return;
    setFeedView("mine");
  }, [feedView, isFirstPost, isHelpOpen, setFeedView]);
  const relCount = relations.length;
  return (
    <div className={`al-profile ${isFirstPost ? "al-profile-first" : ""}`}>
      <button className="al-back" onClick={goHome} aria-label="내 캐릭터 목록으로"><AliveIcon name="chevron-left" size={21} /></button>
      <div className="al-banner">
        {char.headerImg && <img src={mediaUrl(char.headerImg)} alt="" />}
        {isFirstPost && !char.headerImg && <FirstSceneBanner char={char} />}
        <div className="al-feed-utilities"><CreditShortcut onOpen={openCredits} overlay /><button className="al-feed-help" type="button" disabled={loading} onClick={openHelp} aria-label="피드 도움말 열기"><span><AliveIcon name="help" size={15} /></span><b>도움말</b></button></div>
      </div>
      <div className="al-avatar-wrap">
        <div className="al-avatar"><CharacterAvatarImage src={char.avatarImg} /></div>
      </div>
      <div className="al-profile-info">
        <div className="al-profile-top">
          <div className="al-profile-top-main">
            <div className="al-name-line">
              <h2>{char.name}</h2>
            </div>
            <span className="al-handle">@{char.handle || char.name.replace(/\s/g, "").toLowerCase()}</span>
          </div>
          {!isFirstPost && <div className="al-feed-actions"><button aria-label="공유 링크 복사" className="al-dmbtn ghost inline-flex min-h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-xs font-extrabold leading-none text-ink transition-colors hover:border-accent hover:bg-accent-soft" onClick={shareCurrentCharacter} title="공유 링크 복사"><span className="text-accent-ink"><AliveIcon name="arrow-up-right" size={14} /></span><b>공유</b></button><button className="al-dmbtn ghost inline-flex min-h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-xs font-extrabold leading-none text-ink transition-colors hover:border-accent hover:bg-accent-soft" onClick={editActiveProfile} title="프로필 수정"><span className="text-accent-ink"><AliveIcon name="pen" size={14} /></span><b>수정</b></button><button className="al-dmbtn inline-flex min-h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-3 py-2 text-xs font-extrabold leading-none text-ink transition-colors hover:border-accent hover:bg-accent-soft" onClick={() => setStep("dmlist")} title="대화"><span className="text-accent-ink"><AliveIcon name="mail" size={15} /></span><b>대화</b></button></div>}
        </div>
        {shareStatus && <p className="al-share-status" role="status">{shareStatus}</p>}
        {(char.age || char.world || !isFirstPost) && <div className="al-profile-meta-row">{char.age && <span className="al-profile-meta">{char.age}</span>}{(char.world || !isFirstPost) && <WorldChip character={char} fallback="current-character" onOpen={setWorldModal} />}</div>}
        {char.surface && isFirstPost && <FirstImpression text={char.surface} />}
        {char.persona && !isFirstPost && <p className="al-bio-text"><span>소개</span><b>{char.persona}</b></p>}
        {!isFirstPost && <div className="al-profile-network" aria-label="캐릭터 관계와 활동">
          <div className="al-profile-network-head"><span><small>함께하는 세계</small><b>관계와 기억을 이어가 보세요.</b></span><button className="al-profile-discover" type="button" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); setStep("discover"); }}><AliveIcon name="sparkle" size={14} /> 추천 캐릭터</button></div>
          <div className="al-follow-stats">
          <button className={`al-fstat ${followPanel === "following" ? "on" : ""}`} onClick={() => toggleFollowPanel("following")}>
            <b>{following.length}</b> 추가한 캐릭터
          </button>
          <button className={`al-fstat ${followPanel === "followers" ? "on" : ""}`} onClick={() => toggleFollowPanel("followers")}>
            <b>{activeSharedId ? (followerCounts[activeSharedId] || 0) : myFollowers().length}</b> 팔로워
          </button>
          <button className={`al-fstat ${showMemory ? "on" : ""}`} onClick={toggleMemoryPanel}>
            <AliveIcon name="memory" size={14} /> <b>{(char.lorebook || []).length}</b> 기억 <AliveIcon name={showMemory ? "chevron-down" : "chevron-right"} size={13} />
          </button>
          {relCount > 0 && (
            <button className={`al-fstat ${showRelations ? "on" : ""}`} onClick={toggleRelationsPanel}>
              <AliveIcon name="relationship" size={14} /> <b>{relCount}</b> 관계 <AliveIcon name={showRelations ? "chevron-down" : "chevron-right"} size={13} />
            </button>
          )}
          {myFollowers().length > 0 && <span className="al-fstat-new">친해진 캐가 맞팔했어!</span>}
          </div>
        </div>}
        {showRelations && relCount > 0 && <FeedRelations ctx={{ affOf, affinityStage, char, deleteRelationAt, isFollowedCharacterName, relationStageLabel, relations, relLabelFor, setAffinityManual }} />}
        {showMemory && <FeedMemoryPanel ctx={ctx} />}
        {!isFirstPost && <button className="al-profile-more border-line bg-surface text-ink hover:border-accent hover:bg-accent-soft" type="button" aria-controls="profile-media-tools" aria-expanded={isProfileToolsOpen} onClick={() => setIsProfileToolsOpen((open) => !open)}><span><b>사진 관리</b><small className="text-faint">인장, 헤더, 캐릭터 그림을 바꿔요.</small></span><i className={`text-accent-ink ${isProfileToolsOpen ? "open" : ""}`}><AliveIcon name="chevron-down" size={19} /></i></button>}
        {!isFirstPost && isProfileToolsOpen && <div className="al-profile-tools" id="profile-media-tools"><section className="al-profile-photos" aria-label="프로필 사진 관리"><div><b>프로필 사진</b><small>인장과 헤더를 직접 바꿔보세요.</small></div><div className="al-profile-photo-actions"><label><AliveIcon name="user" size={14} /> 인장 사진<input type="file" accept="image/*" onChange={(e) => handleProfileImage("avatar", e)} hidden /></label><label><AliveIcon name="image" size={14} /> 헤더 사진<input type="file" accept="image/*" onChange={(e) => handleProfileImage("header", e)} hidden /></label></div>{(char.avatarImg || char.headerImg) && <div className="al-profile-image-removals">{char.avatarImg && <button type="button" onClick={() => clearActiveProfileImage("avatar")}>인장 지우기</button>}{char.headerImg && <button type="button" onClick={() => clearActiveProfileImage("header")}>헤더 지우기</button>}</div>}</section><div className="al-gallery">
          <div className="al-gallery-head">
            <span>{char.name}의 그림 {gallery.length > 0 && `(${gallery.length})`}</span>
            <label className="al-upload">
              <AliveIcon name="plus" size={14} /> 그림 올리기
              <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
            </label>
          </div>
          {gallery.length > 0 ? (
            <div className="al-gallery-strip">
              {gallery.map((g, i) => (
                <div className="al-thumb" key={i}>
                  <img src={mediaUrl(g)} alt="" />
                  <button className="al-thumb-x" onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))} aria-label="그림 삭제"><AliveIcon name="close" size={11} /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="al-gallery-empty">캐릭터 그림을 올려두면, {char.name}가 셀카·일상·랜덤 글을 쓸 때 알아서 골라 붙여.</p>
          )}
        </div></div>}
      </div>
      <FeedHelpTour characterName={char.name} hasPosts={!isFirstPost} isOpen={isHelpOpen} onClose={closeHelp} />
    </div>
  );
}

function FirstSceneBanner({ char }: { char: FirstSceneCharacter }): React.ReactElement {
  const line = compactSceneText(char.catchphrase, `${char.name}의 첫 문장을 기다리는 중`);
  const context = compactSceneText(char.world || char.interests || char.age, "설정에서 장면을 준비하고 있어요");
  return <div className="al-first-banner-copy"><small>첫 장면의 단서</small><p>“{line}”</p><span>{context}</span></div>;
}

function FirstImpression({ text }: { text: unknown }): React.ReactElement {
  return <div className="al-first-impression"><span>첫인상</span><p>{firstImpressionText(text)}</p></div>;
}

function firstImpressionText(value: unknown): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text) return "아직 첫인상을 알아가는 중이에요.";
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] || text;
  return sentence.length > 68 ? `${sentence.slice(0, 68).trim()}…` : sentence;
}

function compactSceneText(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!text) return fallback;
  return text.length > 42 ? `${text.slice(0, 42).trim()}…` : text;
}

function FeedRelations({ ctx }) {
  const { affOf, affinityStage, char, deleteRelationAt, isFollowedCharacterName, relationStageLabel, relations, relLabelFor, setAffinityManual } = ctx;
  return (
    <div className="al-rellist">
      {relations.map(({ who, label, sourceIndex }) => {
        const aff = affOf(char.name, who);
        const back = affOf(who, char.name);
        const neg = aff < 0;
        const peerExists = isFollowedCharacterName(who);
        const oneSided = (peerExists && relLabelFor(char, who) === "짝사랑")
          || (peerExists && aff >= 50 && back < 30 && !/부부|배우자|연인|애인|약혼|사랑/.test(label));
        return (
          <div className="al-rel" key={sourceIndex}>
            <div className="al-rel-top">
              <span className="al-rel-av"><CharacterAvatarImage /></span>
              <span className="al-rel-who">{who}</span>
              {oneSided && <span className="al-rel-onesided"><AliveIcon name="heart-broken" size={12} /> 짝사랑</span>}
              <span className="al-rel-stage">{relationStageLabel(label, aff)} · {aff}</span>
              <button type="button" className="al-rel-delete" onClick={() => deleteRelationAt(sourceIndex)}>삭제</button>
            </div>
            {label && <p className="al-rel-desc">{label}</p>}
            <div className="al-rel-bar">
              <div className={`al-rel-fill ${neg ? "neg" : ""}`} style={{ width: `${Math.abs(aff)}%` }} />
            </div>
            <div className="al-rel-edit">
              <span>내 호감도</span>
              <input type="range" min="-100" max="100" value={aff} onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
              <input type="number" min="-100" max="100" value={aff} onChange={(e) => setAffinityManual(char.name, who, e.target.value)} />
            </div>
            {oneSided && <span className="al-rel-onesided-note">{who}의 마음은 아직 {affinityStage(back)}({back}) — 아직 닿지 않았어</span>}
          </div>
        );
      })}
      <p className="al-mem-note">{char.name}의 관계와 지금 마음. 대화할수록 호감도가 변해.</p>
    </div>
  );
}
