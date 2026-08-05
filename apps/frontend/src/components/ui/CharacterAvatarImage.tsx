import React, { type SyntheticEvent } from "react";

const DEFAULT_CHARACTER_AVATAR = "/character-placeholder.svg";

interface CharacterAvatarImageProps {
  src?: unknown;
}

export function CharacterAvatarImage({ src }: CharacterAvatarImageProps): React.ReactElement {
  const imageSource = typeof src === "string" && src.trim() ? src : DEFAULT_CHARACTER_AVATAR;
  return <img className="al-character-avatar-image" src={imageSource} alt="" aria-hidden="true" onError={replaceBrokenAvatar} />;
}

function replaceBrokenAvatar(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  if (image.getAttribute("src") === DEFAULT_CHARACTER_AVATAR) return;
  image.src = DEFAULT_CHARACTER_AVATAR;
}
