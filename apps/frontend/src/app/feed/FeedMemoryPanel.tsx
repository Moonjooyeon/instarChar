import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { CharacterAvatarImage } from "@/components/ui/CharacterAvatarImage";

type FeedMemoryEntry = {
  content?: string;
  id?: number;
  importance?: number;
  peer?: string;
  pinned?: boolean;
  source?: string;
};

export function FeedMemoryPanel({ ctx }) {
  const {
    addManualMemory,
    char,
    deleteMemory,
    editingMemoryId,
    editMemory,
    lorePeerOptions,
    memDraftText,
    memFilter,
    normalizeMemoryEntry,
    renderLorePeerSelect,
    setEditingMemoryId,
    setMemDraftPeer,
    setMemDraftText,
    setMemFilter,
    setShowMemoryAdd,
    showMemoryAdd,
    updateMemory,
  } = ctx;
  const allMem = safeMemoryList(char.lorebook).map(normalizeMemoryEntry) as FeedMemoryEntry[];
  const peerOptions = lorePeerOptions();
  const peerEntries = [...new Set(allMem.map((entry) => entry.peer || "*"))]
    .map((peer) => ({ peer, count: allMem.filter((entry) => (entry.peer || "*") === peer).length }))
    .sort((a, b) => b.count - a.count);
  const shown = allMem
    .filter((entry) => (entry.peer || "*") === memFilter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.importance || 2) - (a.importance || 2) || (b.id || 0) - (a.id || 0))
    .slice(0, 30);
  return (
    <div className="al-memlist">
      {allMem.length === 0 ? (
        <>
          <p className="al-mem-note">아직 남겨둔 기억이 없어요. {char.name}가 대화를 나누면 약속과 중요한 순간을 알아서 기억해요.</p>
          <FeedMemoryAdd ctx={{ addManualMemory, lorePeerOptions, memDraftText, renderLorePeerSelect, setMemDraftText, setShowMemoryAdd, showMemoryAdd }} />
        </>
      ) : (
        <>
          {!memFilter ? (
            <FeedMemoryPeers peerEntries={peerEntries} setMemDraftPeer={setMemDraftPeer} setMemFilter={setMemFilter} />
          ) : (
            <FeedMemoryDetail ctx={{ addManualMemory, deleteMemory, editingMemoryId, editMemory, memDraftText, memFilter, peerOptions, renderLorePeerSelect, setEditingMemoryId, setMemDraftText, setMemFilter, setShowMemoryAdd, showMemoryAdd, shown, updateMemory }} />
          )}
          {!memFilter && (
            <FeedMemoryAdd compact ctx={{ addManualMemory, lorePeerOptions, memDraftText, renderLorePeerSelect, setMemDraftText, setShowMemoryAdd, showMemoryAdd }} />
          )}
          <p className="al-mem-note">{memFilter ? "왜 마음이 달라졌는지 함께 남기면 다음 대화가 더 자연스러워요." : "상대를 선택하면 둘 사이에 남은 기억만 모아볼 수 있어요."}</p>
        </>
      )}
    </div>
  );
}

function safeMemoryList(value: unknown): FeedMemoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === "object") as FeedMemoryEntry[];
}

function FeedMemoryPeers({ peerEntries, setMemDraftPeer, setMemFilter }) {
  return (
    <div className="al-mem-peers">
      {peerEntries.map(({ peer, count }) => (
        <button key={String(peer)} className="al-mem-peer-card" onClick={() => { setMemFilter(peer); setMemDraftPeer(peer === "*" ? "" : String(peer)); }}>
          <span className="al-mem-peer-av">{peer === "*" ? <AliveIcon name="memory" size={15} /> : <CharacterAvatarImage />}</span>
          <span className="al-mem-peer-info">
            <b>{peer === "*" ? "전체 설정" : peer}</b>
            <small>{count}개</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function FeedMemoryDetail({ ctx }) {
  const { addManualMemory, deleteMemory, editingMemoryId, editMemory, memDraftText, memFilter, peerOptions, renderLorePeerSelect, setEditingMemoryId, setMemDraftText, setMemFilter, setShowMemoryAdd, showMemoryAdd, shown, updateMemory } = ctx;
  return (
    <>
      <div className="al-mem-detail-head">
        <button onClick={() => setMemFilter(null)}><AliveIcon name="chevron-left" size={14} /> 사람별 목록</button>
        <span>{memFilter === "*" ? "전체 설정" : memFilter}</span>
      </div>
      {shown.length === 0 && <p className="al-mem-note">이 사람과 아직 남겨둔 기억이 없어요.</p>}
      {shown.map((entry) => (
        <React.Fragment key={entry.id}>
          <FeedMemoryCard entry={entry} ctx={{ deleteMemory, editingMemoryId, editMemory, setEditingMemoryId, updateMemory }} />
        </React.Fragment>
      ))}
      <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((value) => !value)}>
        <AliveIcon name="plus" size={15} /> {memFilter === "*" ? "전체 설정" : memFilter} 기억 남기기
      </button>
      {showMemoryAdd && (
        <div className="al-mem-add slide">
          {renderLorePeerSelect(peerOptions, memFilter)}
          <textarea value={memDraftText} onChange={(event) => setMemDraftText(event.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
          <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>기억 남기기</button>
        </div>
      )}
    </>
  );
}

function FeedMemoryCard({ entry, ctx }) {
  const { deleteMemory, editingMemoryId, editMemory, setEditingMemoryId, updateMemory } = ctx;
  const editing = editingMemoryId === entry.id;
  const importanceLabel = (entry.importance || 2) >= 5 ? "핵심" : (entry.importance || 2) >= 4 ? "사건" : "감정";
  return (
    <div className={`al-mem-card ${entry.pinned ? "pinned" : ""}`}>
      <div className="al-mem-card-top">
        <span className="al-mem-kind">{importanceLabel}</span>
        <span className="al-mem-source">{entry.source === "manual" ? "수동" : "자동"}</span>
        {entry.pinned && <span className="al-mem-pin">고정</span>}
        <div className="al-mem-card-actions">
          <button onClick={() => updateMemory(entry.id, { pinned: !entry.pinned })}>{entry.pinned ? "해제" : "고정"}</button>
          <button onClick={() => setEditingMemoryId(editing ? null : entry.id)}>{editing ? "닫기" : "수정"}</button>
          <button className="danger" onClick={() => deleteMemory(entry.id)}>삭제</button>
        </div>
      </div>
      {editing ? (
        <div className="al-mem-editbox">
          <textarea value={entry.content} onChange={(event) => editMemory(entry.id, event.target.value)} />
          <select value={entry.importance || 3} onChange={(event) => updateMemory(entry.id, { importance: Number(event.target.value) })}>
            <option value={3}>감정 변화</option>
            <option value={4}>중요 사건</option>
            <option value={5}>핵심 기억</option>
          </select>
        </div>
      ) : (
        <p className="al-mem-card-text">{entry.content}</p>
      )}
    </div>
  );
}

function FeedMemoryAdd({ compact = false, ctx }) {
  const { addManualMemory, lorePeerOptions, memDraftText, renderLorePeerSelect, setMemDraftText, setShowMemoryAdd, showMemoryAdd } = ctx;
  return (
    <>
      <button className="al-mem-add-toggle" onClick={() => setShowMemoryAdd((value) => !value)}>
        <AliveIcon name="plus" size={15} /> 기억 직접 남기기
      </button>
      {showMemoryAdd && (
        <div className={`al-mem-add ${compact ? "compact " : ""}slide`}>
          {compact && <div className="al-mem-add-title">기억 직접 남기기</div>}
          {renderLorePeerSelect(lorePeerOptions())}
          <textarea value={memDraftText} onChange={(event) => setMemDraftText(event.target.value)} placeholder="감정 변화와 원인, 약속, 사건 같은 핵심만 추가" />
          <button className="al-mem-add-btn" disabled={!memDraftText.trim()} onClick={addManualMemory}>기억 남기기</button>
        </div>
      )}
    </>
  );
}
