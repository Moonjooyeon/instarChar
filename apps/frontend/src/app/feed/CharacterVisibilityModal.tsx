import React from "react";
import { createPortal } from "react-dom";
import { AliveIcon } from "@/components/ui/AliveIcon";

interface CharacterVisibilityModalProps {
  characterName: string;
  isOpen: boolean;
  isPublic: boolean;
  onClose: () => void;
  onSave: (isPublic: boolean) => Promise<boolean>;
}

interface VisibilityOptionProps {
  description: string;
  icon: "moon" | "users";
  isSelected: boolean;
  onSelect: () => void;
  title: string;
}

export function CharacterVisibilityModal({ characterName, isOpen, isPublic, onClose, onSave }: CharacterVisibilityModalProps): React.ReactElement | null {
  const [selectedPublic, setSelectedPublic] = React.useState(isPublic);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const dialogReference = React.useRef<HTMLElement>(null);
  React.useEffect(() => setSelectedPublic(isPublic), [isOpen, isPublic]);
  React.useEffect(() => registerModalFocus(isOpen, isSaving, dialogReference, onClose), [isOpen, isSaving, onClose]);
  if (!isOpen) return null;
  async function saveVisibility(): Promise<void> {
    setIsSaving(true);
    setSaveError("");
    const saved = await onSave(selectedPublic);
    setIsSaving(false);
    if (saved) onClose();
    else setSaveError("공개 설정을 바꾸지 못했어. 잠시 후 다시 시도해줘.");
  }
  return createPortal(<div className="al-modal-bg al-theme-ready al-visibility-modal-theme-ready" onClick={() => { if (!isSaving) onClose(); }}><section aria-labelledby="visibility-title" aria-modal="true" className="al-visibility-modal" onClick={(event) => event.stopPropagation()} ref={dialogReference} role="dialog" tabIndex={-1}><header className="al-visibility-head"><span className={selectedPublic ? "public" : "private"}><AliveIcon name={selectedPublic ? "users" : "moon"} size={18} /></span><div><small>추천 탭 관리</small><h2 id="visibility-title">{characterName}을(를) 어디까지 보여줄까요?</h2></div><button aria-label="공개 설정 닫기" disabled={isSaving} onClick={onClose} type="button"><AliveIcon name="close" size={17} /></button></header><p className="al-visibility-intro">공개 범위는 언제든 바꿀 수 있어요. 비공개여도 캐릭터와 대화 기록은 그대로 남아요.</p><div className="al-visibility-options"><VisibilityOption description="추천 탭에서 다른 사람이 캐릭터와 게시글을 볼 수 있어요." icon="users" isSelected={selectedPublic} onSelect={() => setSelectedPublic(true)} title="추천 탭에 공개" /><VisibilityOption description="추천 탭과 공개 프로필에서 숨겨져요." icon="moon" isSelected={!selectedPublic} onSelect={() => setSelectedPublic(false)} title="나만 보기" /></div>{saveError && <p className="al-visibility-error" role="alert">{saveError}</p>}<footer className="al-visibility-actions"><button className="al-visibility-cancel" disabled={isSaving} onClick={onClose} type="button">취소</button><button className={selectedPublic ? "al-visibility-save public" : "al-visibility-save private"} disabled={isSaving || selectedPublic === isPublic} onClick={() => void saveVisibility()} type="button">{isSaving ? "저장하는 중…" : selectedPublic ? "추천 탭에 공개" : "비공개로 전환"}</button></footer></section></div>, document.body);
}

function VisibilityOption({ description, icon, isSelected, onSelect, title }: VisibilityOptionProps): React.ReactElement {
  return <button aria-pressed={isSelected} className={`al-visibility-option ${isSelected ? "selected" : ""}`} onClick={onSelect} type="button"><span><AliveIcon name={icon} size={18} /></span><b>{title}</b><p>{description}</p>{isSelected && <i><AliveIcon name="check" size={15} /></i>}</button>;
}

function registerModalFocus(isOpen: boolean, isSaving: boolean, dialogReference: React.RefObject<HTMLElement>, onClose: () => void): (() => void) | undefined {
  if (!isOpen) return;
  dialogReference.current?.focus();
  const handleKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape" && !isSaving) onClose(); };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
