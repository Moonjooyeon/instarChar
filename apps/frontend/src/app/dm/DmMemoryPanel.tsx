import React from "react";

const MEMORY_ACTION_CLASS = "border-line-strong bg-surface-raised text-accent-ink hover:border-accent hover:bg-accent-soft";
const MEMORY_DANGER_ACTION_CLASS = "danger border-danger bg-danger-soft text-danger hover:bg-danger hover:text-white";

export function DmMemoryPanel({ ctx }) {
  const { deleteMemory, deleteRoomMemory, dmKey, editingMemoryId, editMemory, peerName, setEditingMemoryId, showPeerMem, updateRoomMemory, visibleMems } = ctx;
  if (!showPeerMem) return null;
  return (
    <div className="al-peermem">
      <div className="al-peermem-list">
        {visibleMems.length === 0 ? (
          <div className="al-peermem-item muted">아직 이 대화에 남은 기억이 없어요.</div>
        ) : visibleMems.slice(-8).reverse().map((entry) => {
          const editing = editingMemoryId === `${entry.scope}:${entry.id}`;
          return (
            <div className="al-peermem-item" key={`${entry.scope}-${entry.id}`}>
              <div className="al-peermem-top">
                <span>{entry.scope === "room" ? "이 방" : "전역"}</span>
                <div>
                  <button className={MEMORY_ACTION_CLASS} onClick={() => setEditingMemoryId(editing ? null : `${entry.scope}:${entry.id}`)}>{editing ? "닫기" : "수정"}</button>
                  <button className={MEMORY_DANGER_ACTION_CLASS} onClick={() => entry.scope === "room" ? deleteRoomMemory(dmKey, peerName, entry.id) : deleteMemory(entry.id)}>삭제</button>
                </div>
              </div>
              {editing ? (
                <div className="al-peermem-edit">
                  <textarea value={entry.content} onChange={(event) => entry.scope === "room" ? updateRoomMemory(dmKey, peerName, entry.id, { content: event.target.value }) : editMemory(entry.id, event.target.value)} />
                </div>
              ) : (
                <p>· {entry.content}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
