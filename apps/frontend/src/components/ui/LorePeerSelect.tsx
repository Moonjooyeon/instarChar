import React from "react";

export function LorePeerSelect({
  options,
  fallbackPeer = "*",
  memDraftPeer,
  memDraftCustomPeer,
  setMemDraftPeer,
  setMemDraftCustomPeer,
}) {
  return (
    <>
      <label>대상</label>
      <select
        value={memDraftPeer || fallbackPeer || "*"}
        onChange={(e) => {
          setMemDraftPeer(e.target.value);
          setMemDraftCustomPeer("");
        }}
      >
        {options.map((peer) => <option key={peer} value={peer}>{peer === "*" ? "전체 설정" : peer}</option>)}
        <option value="__custom__">직접 입력</option>
      </select>
      {memDraftPeer === "__custom__" && (
        <input
          value={memDraftCustomPeer}
          onChange={(e) => setMemDraftCustomPeer(e.target.value)}
          placeholder="대상 이름"
          autoFocus
        />
      )}
    </>
  );
}
