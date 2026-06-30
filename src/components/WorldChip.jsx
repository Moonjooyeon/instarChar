import React from "react";

export function worldTextFor(character) {
  return String(character?.world || character?.character?.world || "").trim();
}

export function worldKeyFor(character, fallback = "current") {
  return character?.sharedId || character?.id || character?.name || fallback;
}

export function WorldChip({ character, c, fallback, onOpen }) {
  const target = character || c;
  const text = worldTextFor(target);
  if (!text) return null;
  return (
    <button
      type="button"
      className="al-world-chip"
      onClick={(event) => {
        event?.stopPropagation();
        onOpen?.({
          key: worldKeyFor(target, fallback),
          name: target?.name || "캐릭터",
          handle: target?.handle || "",
          world: text,
        });
      }}
    >
      세계관
    </button>
  );
}
