import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";
import { USER_PERSONA_FEATURE_ENABLED, normalizeUserPersonaSpeaker } from "@/domain/app/featureFlags";

interface AvatarCharacter {
  avatarImg?: unknown;
  name: string;
}

interface AvatarAccount {
  char: AvatarCharacter;
}

interface AvatarConversation {
  peerName: string;
}

export function DmListScreen({
  accounts,
  activeId,
  char,
  conversations,
  deleteDmThread,
  displayDmTitle,
  following,
  nameMatch,
  newChatMode,
  newChatSpeaker,
  personas,
  relationMatched,
  requestDmEntry,
  setNewChatMode,
  setNewChatSpeaker,
  setPersonaDraft,
  setStep,
  sharedCharacters,
  startRenameDm,
}) {
  const safeNewChatSpeaker = normalizeUserPersonaSpeaker(newChatSpeaker);
  const personaMode = USER_PERSONA_FEATURE_ENABLED && newChatMode === "persona";
  const speakerName = safeNewChatSpeaker === "char"
    ? char.name
    : (personas.find((p) => `p:${p.id}` === safeNewChatSpeaker)?.name || char.name);

  return (
    <div className="al-phone al-theme-ready al-dm-list-theme-ready">
      <div className="al-dmhead">
        <button className="al-back-inline" onClick={() => setStep("feed")} aria-label="피드로 돌아가기"><AliveIcon name="chevron-left" size={22} /></button>
        <div className="al-dmhead-av"><CharacterAvatarImage src={char.avatarImg} /></div>
        <div className="al-dmhead-info">
          <span className="al-dmhead-name">{char.name}의 대화</span>
          <span className="al-dmhead-sub">바로 말하거나 캐릭터끼리 만나게 해요.</span>
        </div>
      </div>

      <div className="al-convlist">
        {conversations.length === 0 && !newChatMode && (
          <div className="al-conv-empty">
            <p>{char.name}에게 첫 말을 건네보세요.</p>
              <span>설정 없이 바로 시작할 수 있어요.</span>
          </div>
        )}
        {conversations.map((c) => (
          <div key={c.key} className="al-convitem">
            <button
              className="al-convmain"
              onClick={() => {
                if (c.asOwner) {
                  requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
                } else {
                  const acc = accounts.find((a) => nameMatch(a.char.name, c.peerName));
                  const fol = following.find((f) => nameMatch(f.name, c.peerName));
                  const shared = sharedCharacters.find((s) => nameMatch(s.name, c.peerName));
                  const basePeer = acc?.char || fol || shared || {};
                  const nextPeer = {
                    ...basePeer,
                    name: c.peerName,
                    persona: basePeer.persona || "",
                    relation: relationMatched(char, basePeer.name ? basePeer : { name: c.peerName }),
                    dmKind: c.dmKind,
                    dmKey: c.dmKey,
                    localRoomId: c.localRoomId,
                    legacySpeakerName: c.asPersona || "",
                    readOnly: !USER_PERSONA_FEATURE_ENABLED && Boolean(c.asPersona),
                  };
                  let restoredSpeakAs = "char";
                  if (c.asPersona) {
                    const p = personas.find((pp) => pp.name === c.asPersona);
                    restoredSpeakAs = p ? `p:${p.id}` : "char";
                  }
                  requestDmEntry(nextPeer, normalizeUserPersonaSpeaker(restoredSpeakAs));
                }
              }}
            >
              <div className="al-convitem-av">{c.asOwner ? <AliveIcon name="user" size={20} /> : c.asPersona ? <AliveIcon name="masks" size={20} /> : <CharacterAvatarImage src={conversationAvatar(c, accounts, following, sharedCharacters, nameMatch)} />}</div>
              <div className="al-convitem-info">
                <span className="al-convitem-name">{displayDmTitle(c)}</span>
                <span className="al-convitem-last">{c.dmKind === "npc" ? "나만 보는 대화 · " : c.asOwner ? "직접 대화 · " : "함께 보는 대화 · "}{c.last.slice(0, 28) || "대화 시작"}</span>
              </div>
              <span className="al-convitem-count">{c.count}</span>
            </button>
            {(USER_PERSONA_FEATURE_ENABLED || !c.asPersona) && <div className="al-conv-actions">
              <button type="button" onClick={(e) => startRenameDm(c, e)}>수정</button>
              <button type="button" className="danger" onClick={(e) => deleteDmThread(c.key, e)}>삭제</button>
            </div>}
          </div>
        ))}
      </div>

      <div className="al-newchat">
        {!newChatMode ? (
          <>
            <button
              className="al-owner-entry border-accent bg-accent-soft text-ink hover:border-accent-strong hover:bg-surface-muted"
              onClick={() => {
                requestDmEntry({ name: char.name, persona: char.persona, relation: "", asOwner: true }, "owner");
              }}
            >
              <span>나</span><b>{char.name}와 바로 대화하기</b><small>가장 간단하게 시작해요.</small>
            </button>
            <button className="al-newchat-btn border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft" onClick={() => { setNewChatSpeaker("char"); setNewChatMode("char"); }}>
              <span>캐릭터</span><b>{char.name}와 다른 캐릭터 만나게 하기</b><small>캐릭터끼리 대화가 이어져요.</small>
            </button>
            {USER_PERSONA_FEATURE_ENABLED && <button
              className="al-persona-entry"
              onClick={() => {
                if (personas.length === 0) { setPersonaDraft({ name: "", age: "", persona: "", speech: "" }); return; }
                setNewChatSpeaker(`p:${personas[0].id}`);
                setNewChatMode("persona");
              }}
            >
              <AliveIcon name="masks" size={16} /> 내 페르소나로 캐릭터에게 말 걸기 {personas.length === 0 && <span className="al-pe-hint">(먼저 만들기)</span>}
            </button>}
          </>
        ) : (
          <div className="al-newchat-panel">
            {personaMode && (
              <>
                <p className="al-newchat-lbl">어떤 페르소나로?</p>
                <div className="al-nc-speakers">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      className={`al-spk-chip persona ${newChatSpeaker === `p:${p.id}` ? "on" : ""}`}
                      onClick={() => setNewChatSpeaker(`p:${p.id}`)}
                    >
                      <AliveIcon name="masks" size={14} /> {p.name}
                    </button>
                  ))}
                  <button className="al-spk-chip add" onClick={() => setPersonaDraft({ name: "", age: "", persona: "", speech: "" })}><AliveIcon name="plus" size={14} /> 페르소나</button>
                </div>
              </>
            )}
            <p className="al-newchat-lbl">{speakerName}와 누구를 만나게 할까요?</p>
            <div className="al-newchat-targets">
              {personaMode && (
                <button
                  className="al-newchat-target mine"
                  onClick={() => {
                    requestDmEntry({ name: char.name, persona: char.persona, relation: "" }, safeNewChatSpeaker);
                  }}
                >
                  <span className="al-nt-av"><CharacterAvatarImage src={char.avatarImg} /></span>
                  <span className="al-nt-name">{char.name}</span>
                  <span className="al-nt-mine-tag">내 캐릭터</span>
                </button>
              )}
              {accounts.filter((a) => a.id !== activeId).map((a) => {
                const rel = relationMatched(char, { name: a.char.name });
                return (
                  <button
                    key={a.id}
                    className="al-newchat-target"
                    onClick={() => {
                      requestDmEntry({ name: a.char.name, persona: a.char.persona, relation: "" }, safeNewChatSpeaker);
                    }}
                  >
                    <span className="al-nt-av"><CharacterAvatarImage src={a.char.avatarImg} /></span>
                    <span className="al-nt-name">{a.char.name}</span>
                    {rel && <span className="al-nt-rel"><AliveIcon name="heart" size={13} /> {rel.split(/[—\-–:]/).slice(1).join("").trim() || "관계"}</span>}
                  </button>
                );
              })}
              {following.map((f) => (
                <button
                  key={f.id}
                  className="al-newchat-target ext"
                  onClick={() => {
                    requestDmEntry({ ...f, name: f.name, persona: f.persona, relation: relationMatched(char, f) }, safeNewChatSpeaker);
                  }}
                >
                  <span className="al-nt-av"><CharacterAvatarImage src={f.avatarImg} /></span>
                  <span className="al-nt-name">{f.name}</span>
                  <span className="al-nt-ext">타임라인에 추가됨 · {f.owner}</span>
                </button>
              ))}
              {newChatMode === "char" && accounts.filter((a) => a.id !== activeId).length === 0 && following.length === 0 && (
                <p className="al-nt-none">다른 캐릭터를 만들거나, 탐색에서 대화 상대를 타임라인에 추가해보세요.</p>
              )}
            </div>
            <button className="al-newchat-cancel" onClick={() => setNewChatMode(null)}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}

function conversationAvatar(conversation: AvatarConversation, accounts: AvatarAccount[], following: AvatarCharacter[], sharedCharacters: AvatarCharacter[], nameMatch: (left: string, right: string) => boolean): unknown {
  const account = accounts.find((item) => nameMatch(item.char.name, conversation.peerName));
  if (account?.char.avatarImg) return account.char.avatarImg;
  const followed = following.find((item) => nameMatch(item.name, conversation.peerName));
  if (followed?.avatarImg) return followed.avatarImg;
  return sharedCharacters.find((item) => nameMatch(item.name, conversation.peerName))?.avatarImg;
}
