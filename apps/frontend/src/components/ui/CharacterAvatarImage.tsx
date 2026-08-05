import React, { type SyntheticEvent } from "react";

interface CharacterAvatarImageProps {
  src?: unknown;
}

export function CharacterAvatarImage({ src }: CharacterAvatarImageProps): React.ReactElement {
  const imageSource = typeof src === "string" && src.trim() ? src : "/character-placeholder.svg";
  return <img className="al-character-avatar-image" src={imageSource} alt="" aria-hidden="true" onError={replaceBrokenAvatar} />;
}

function replaceBrokenAvatar(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  if (image.getAttribute("src") === "/character-placeholder.svg") return;
  image.src = "/character-placeholder.svg";
}
