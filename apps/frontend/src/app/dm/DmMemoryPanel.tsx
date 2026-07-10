import React from "react";

export function DmMemoryPanel({ ctx }) {
  const { deleteMemory, deleteRoomMemory, dmKey, editingMemoryId, editMemory, peerName, setEditingMemoryId, showPeerMem, updateRoomMemory, visibleMems } = ctx;
  if (!showPeerMem) return null;
  return (
    <div className="al-peermem">
      <div className="al-peermem-list">
        {visibleMems.length === 0 ? (
          <div className="al-peermem-item muted">아직 이 DM방에 남은 장기기억이 없어.</div>
        ) : visibleMems.slice(-8).reverse().map((entry) => {
          const editing = editingMemoryId === `${entry.scope}:${entry.id}`;
          return (
            <div className="al-peermem-item" key={`${entry.scope}-${entry.id}`}>
              <div className="al-peermem-top">
                <span>{entry.scope === "room" ? "이 방" : "전역"}</span>
                <div>
                  <button onClick={() => setEditingMemoryId(editing ? null : `${entry.scope}:${entry.id}`)}>{editing ? "닫기" : "수정"}</button>
                  <button className="danger" onClick={() => entry.scope === "room" ? deleteRoomMemory(dmKey, peerName, entry.id) : deleteMemory(entry.id)}>삭제</button>
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
