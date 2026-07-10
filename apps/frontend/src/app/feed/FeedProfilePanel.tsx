import React from "react";
import { FeedMemoryPanel } from "@/app/feed/FeedMemoryPanel";

export function FeedProfilePanel({ ctx }) {
  const {
    activeSharedId,
    affOf,
    affinityStage,
    char,
    deleteRelationAt,
    feedView,
    followerCounts,
    following,
    followPanel,
    gallery,
    goHome,
    handleProfileImage,
    handleUpload,
    initial,
    isFollowedCharacterName,
    myFollowers,
    parseRelations,
    relationStageLabel,
    relLabelFor,
    setAffinityManual,
    setDiscoverQuery,
    setGallery,
    setSharedFocusId,
    setStep,
    setWorldModal,
    shareCurrentCharacter,
    shareStatus,
    showMemory,
    showRelations,
    toggleFollowPanel,
    toggleMemoryPanel,
    toggleRelationsPanel,
    update,
    WorldChip,
  } = ctx;
  const relCount = parseRelations(char.relations).length;
  return (
    <div className="al-profile">
      <button className="al-back" onClick={goHome}>‹</button>
      <div className="al-banner">
        {char.headerImg && <img src={char.headerImg} alt="" />}
        <div className="al-cover-tools">
          <label title="헤더 등록">
            헤더 편집
            <input type="file" accept="image/*" onChange={(e) => handleProfileImage("header", e)} hidden />
          </label>
          {char.headerImg && <button onClick={() => update("headerImg", "")}>삭제</button>}
        </div>
      </div>
      <div className="al-avatar-wrap">
        <div className="al-avatar">
          {char.avatarImg ? <img src={char.avatarImg} alt="" /> : initial}
        </div>
        <div className="al-avatar-tools">
          <label title="인장 등록">
            편집
            <input type="file" accept="image/*" onChange={(e) => handleProfileImage("avatar", e)} hidden />
          </label>
          {char.avatarImg && <button onClick={() => update("avatarImg", "")}>삭제</button>}
        </div>
      </div>
      <div className="al-profile-info">
        <div className="al-profile-top">
          <div className="al-profile-top-main">
            <div className="al-name-line">
              <h2>{char.name}</h2>
              <WorldChip character={char} fallback="current-character" onOpen={setWorldModal} />
            </div>
            <span className="al-handle">@{char.handle || char.name.replace(/\s/g, "").toLowerCase()}</span>
          </div>
          <div className="al-feed-actions">
            <button className="al-dmbtn ghost" onClick={() => { setDiscoverQuery(""); setSharedFocusId(""); setStep("discover"); }} title="탐색"><span>🔍</span><b>탐색</b></button>
            <button className="al-dmbtn ghost" onClick={shareCurrentCharacter} title="공유"><span>🔗</span><b>공유</b></button>
            <button className="al-dmbtn" onClick={() => setStep("dmlist")} title="DM"><span>✉</span><b>DM</b></button>
          </div>
        </div>
        <p className="al-bio">
          {char.age && <span className="al-bio-tag">{char.age}</span>}
          {char.surface && <span className="al-bio-tag">{char.surface}</span>}
        </p>
        {char.persona && <p className="al-bio-text">{char.persona}</p>}
        {shareStatus && <p className="al-share-status">{shareStatus}</p>}
        <div className="al-follow-stats">
          <button className={`al-fstat ${followPanel === "following" ? "on" : ""}`} onClick={() => toggleFollowPanel("following")}>
            <b>{following.length}</b> 팔로잉
          </button>
          <button className={`al-fstat ${followPanel === "followers" ? "on" : ""}`} onClick={() => toggleFollowPanel("followers")}>
            <b>{activeSharedId ? (followerCounts[activeSharedId] || 0) : myFollowers().length}</b> 팔로워
          </button>
          <button className={`al-fstat ${showMemory ? "on" : ""}`} onClick={toggleMemoryPanel}>
            🧠 <b>{(char.lorebook || []).length}</b> 장기기억 {showMemory ? "▾" : "▸"}
          </button>
          {relCount > 0 && (
            <button className={`al-fstat ${showRelations ? "on" : ""}`} onClick={toggleRelationsPanel}>
              💞 <b>{relCount}</b> 관계 {showRelations ? "▾" : "▸"}
            </button>
          )}
          {myFollowers().length > 0 && <span className="al-fstat-new">친해진 캐가 맞팔했어!</span>}
        </div>
        {showRelations && <FeedRelations ctx={{ affOf, affinityStage, char, deleteRelationAt, isFollowedCharacterName, parseRelations, relationStageLabel, relLabelFor, setAffinityManual }} />}
        {showMemory && <FeedMemoryPanel ctx={ctx} />}
        <div className="al-gallery">
          <div className="al-gallery-head">
            <span>{char.name}의 그림 {gallery.length > 0 && `(${gallery.length})`}</span>
            <label className="al-upload">
              + 그림 올리기
              <input type="file" accept="image/*" multiple onChange={handleUpload} hidden />
            </label>
          </div>
          {gallery.length > 0 ? (
            <div className="al-gallery-strip">
              {gallery.map((g, i) => (
                <div className="al-thumb" key={i}>
                  <img src={g} alt="" />
                  <button className="al-thumb-x" onClick={() => setGallery((arr) => arr.filter((_, idx) => idx !== i))}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="al-gallery-empty">캐릭터 그림을 올려두면, {char.name}가 셀카·일상·랜덤 글을 쓸 때 알아서 골라 붙여.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedRelations({ ctx }) {
  const { affOf, affinityStage, char, deleteRelationAt, isFollowedCharacterName, parseRelations, relationStageLabel, relLabelFor, setAffinityManual } = ctx;
  return (
    <div className="al-rellist">
      {parseRelations(char.relations).map(({ who, label }, i) => {
        const aff = affOf(char.name, who);
        const back = affOf(who, char.name);
        const neg = aff < 0;
        const peerExists = isFollowedCharacterName(who);
        const oneSided = (peerExists && relLabelFor(char, who) === "짝사랑")
          || (peerExists && aff >= 50 && back < 30 && !/부부|배우자|연인|애인|약혼|사랑/.test(label));
        return (
          <div className="al-rel" key={i}>
            <div className="al-rel-top">
              <span className="al-rel-av">{(who.trim()[0]) || "?"}</span>
              <span className="al-rel-who">{who}</span>
              {oneSided && <span className="al-rel-onesided">💔 짝사랑</span>}
              <span className="al-rel-stage">{relationStageLabel(label, aff)} · {aff}</span>
              <button type="button" className="al-rel-delete" onClick={() => deleteRelationAt(i)}>삭제</button>
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
