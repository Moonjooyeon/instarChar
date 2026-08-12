import React from "react";
import { createPortal } from "react-dom";
import { AliveIcon } from "@/components/ui/AliveIcon";

interface FeedHelpTourProps {
  characterName: string;
  hasPosts: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface HelpStep {
  description: string;
  focusX: number;
  focusY: number;
  glyph: React.ComponentProps<typeof AliveIcon>["name"];
  selector: string;
  title: string;
}

interface TargetRectangle {
  bottom: number;
  height: number;
  left: number;
  top: number;
  width: number;
}

interface TargetMeasurement {
  rectangle: TargetRectangle;
  selector: string;
}

const VIEWPORT_MARGIN = 16;
const HIGHLIGHT_VIEWPORT_MARGIN = 4;
const HIGHLIGHT_PADDING = 14;
const TOOLTIP_GAP = 14;
const TOOLTIP_WIDTH = 304;
const TOOLTIP_ESTIMATED_HEIGHT = 190;
const TAP_INDICATOR_SIZE = 24;
type TooltipPlacement = "above" | "below" | "docked";

const FIRST_POST_STEPS: readonly HelpStep[] = [
  { selector: ".al-profile-top", glyph: "user", focusX: .34, focusY: .45, title: "캐릭터의 홈", description: "이름과 소개를 확인하는 계정이에요." },
  { selector: ".al-first-feed", glyph: "sparkle", focusX: .62, focusY: .78, title: "첫 장면 고르기", description: "장면 하나를 고르면 캐릭터가 첫 글을 써요." },
] as const;

const FEED_STEPS: readonly HelpStep[] = [
  { selector: ".al-profile-top", glyph: "user", focusX: .84, focusY: .5, title: "캐릭터의 홈", description: "프로필을 보고 바로 대화를 시작해요." },
  { selector: ".al-profile-network", glyph: "sparkle", focusX: .72, focusY: .5, title: "이어지는 관계", description: "추천 캐릭터, 팔로잉, 기억을 여기서 바로 확인해요." },
  { selector: ".al-composer", glyph: "pen", focusX: .34, focusY: .5, title: "부탁하거나, 직접 쓰거나", description: "캐릭터에게 맡기거나 내가 직접 작성해요." },
  { selector: ".al-feed-tabs", glyph: "swap", focusX: .73, focusY: .5, title: "세 가지 피드", description: "내 글, 팔로잉, 취향 추천을 나눠 봐요." },
  { selector: ".al-post-actions", glyph: "heart", focusX: .25, focusY: .5, title: "반응하고 다듬기", description: "하트·댓글로 반응하고 어색한 말투를 고쳐요." },
] as const;

export function FeedHelpTour({ characterName, hasPosts, isOpen, onClose }: FeedHelpTourProps) {
  const [stepIndex, setStepIndex] = React.useState(0);
  const steps = hasPosts ? FEED_STEPS : FIRST_POST_STEPS;
  const step = steps[stepIndex];
  const rectangle = useTargetRectangle(isOpen, step?.selector || "");
  const hasRectangle = rectangle !== null;
  const dialogReference = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen, hasPosts]);
  React.useEffect(() => {
    if (!isOpen) return;
    dialogReference.current?.focus();
  }, [hasRectangle, isOpen, stepIndex]);
  React.useEffect(() => registerEscapeClose(isOpen, onClose), [isOpen, onClose]);
  if (!isOpen || !step || !rectangle) return null;
  const isLastStep = stepIndex === steps.length - 1;
  const placement = getTooltipPlacement(rectangle);
  const goNext = (): void => isLastStep ? onClose() : setStepIndex((index) => index + 1);
  return createPortal(<div className="al-theme-ready al-feed-help-theme-ready"><div className="al-help-shield" aria-hidden="true" onClick={goNext} /><div className="al-help-highlight" style={getHighlightStyle(rectangle)} /><div className="al-help-tap" aria-hidden="true" style={getTapIndicatorStyle(rectangle, step)}><i /></div><section className="al-help-coach" data-placement={placement} ref={dialogReference} role="dialog" aria-modal="true" aria-label={`${characterName} 피드 도움말`} style={getTooltipStyle(rectangle, placement)} tabIndex={-1}><button className="al-help-close" type="button" onClick={onClose} aria-label="도움말 닫기"><AliveIcon name="close" size={16} /></button><div className="al-help-coach-copy" key={step.selector}><span><AliveIcon name={step.glyph} size={19} /></span><div><small>{String(stepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</small><h2>{step.title}</h2><p>{step.description}</p></div></div><footer><div className="al-help-progress" aria-hidden="true">{steps.map((item, index) => <i className={index === stepIndex ? "on" : index < stepIndex ? "done" : ""} key={item.selector} />)}</div><div><button className="al-help-prev border-line bg-surface-raised text-soft hover:bg-surface-muted hover:text-ink" disabled={stepIndex === 0} onClick={() => setStepIndex((index) => index - 1)} aria-label="이전 도움말"><AliveIcon name="arrow-left" size={14} /></button><button className="al-help-next border-accent bg-accent text-on-accent hover:bg-accent-strong" onClick={goNext}>{isLastStep ? "완료" : "다음"} <span><AliveIcon name="arrow-right" size={13} /></span></button></div></footer></section></div>, document.body);
}

function useTargetRectangle(isOpen: boolean, selector: string): TargetRectangle | null {
  const [measurement, setMeasurement] = React.useState<TargetMeasurement | null>(null);
  React.useEffect(() => {
    if (!isOpen) {
      setMeasurement(null);
      return;
    }
    if (!selector) return;
    const target = document.querySelector<HTMLElement>(selector);
    if (!target) return;
    const updateRectangle = (): void => {
      const rectangle = toTargetRectangle(target.getBoundingClientRect());
      setMeasurement((current) => current && isOutsideViewport(rectangle) ? current : { rectangle, selector });
    };
    target.scrollIntoView({ behavior: hasReducedMotion() ? "auto" : "smooth", block: "center" });
    updateRectangle();
    const observer = new ResizeObserver(updateRectangle);
    const timeoutId = window.setTimeout(updateRectangle, 280);
    observer.observe(target);
    window.addEventListener("resize", updateRectangle);
    window.addEventListener("scroll", updateRectangle, true);
    return () => removeTargetObservers({ observer, timeoutId, updateRectangle });
  }, [isOpen, selector]);
  return measurement?.rectangle || null;
}

function removeTargetObservers({ observer, timeoutId, updateRectangle }: { observer: ResizeObserver; timeoutId: number; updateRectangle: () => void }): void {
  observer.disconnect();
  window.clearTimeout(timeoutId);
  window.removeEventListener("resize", updateRectangle);
  window.removeEventListener("scroll", updateRectangle, true);
}

function registerEscapeClose(isOpen: boolean, onClose: () => void): (() => void) | undefined {
  if (!isOpen) return undefined;
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") onClose();
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}

function toTargetRectangle(rectangle: DOMRect): TargetRectangle {
  return { bottom: rectangle.bottom, height: rectangle.height, left: rectangle.left, top: rectangle.top, width: rectangle.width };
}

function isOutsideViewport(rectangle: TargetRectangle): boolean {
  return rectangle.bottom < HIGHLIGHT_VIEWPORT_MARGIN || rectangle.top > window.innerHeight - HIGHLIGHT_VIEWPORT_MARGIN;
}

function hasReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getTooltipPlacement(rectangle: TargetRectangle): TooltipPlacement {
  const spaceBelow = window.innerHeight - rectangle.bottom - TOOLTIP_GAP;
  const spaceAbove = rectangle.top - TOOLTIP_GAP;
  if (spaceBelow >= TOOLTIP_ESTIMATED_HEIGHT) return "below";
  if (spaceAbove >= TOOLTIP_ESTIMATED_HEIGHT) return "above";
  return "docked";
}

function getHighlightStyle(rectangle: TargetRectangle): React.CSSProperties {
  const left = Math.max(HIGHLIGHT_VIEWPORT_MARGIN, rectangle.left - HIGHLIGHT_PADDING);
  const right = Math.min(window.innerWidth - HIGHLIGHT_VIEWPORT_MARGIN, rectangle.left + rectangle.width + HIGHLIGHT_PADDING);
  const top = Math.max(HIGHLIGHT_VIEWPORT_MARGIN, rectangle.top - HIGHLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight - HIGHLIGHT_VIEWPORT_MARGIN, rectangle.top + rectangle.height + HIGHLIGHT_PADDING);
  return { height: bottom - top, left, top, width: right - left };
}

function getTapIndicatorStyle(rectangle: TargetRectangle, step: HelpStep): React.CSSProperties {
  const maxLeft = window.innerWidth - TAP_INDICATOR_SIZE - HIGHLIGHT_VIEWPORT_MARGIN;
  const maxTop = window.innerHeight - TAP_INDICATOR_SIZE - HIGHLIGHT_VIEWPORT_MARGIN;
  const rawLeft = rectangle.left + rectangle.width * step.focusX - TAP_INDICATOR_SIZE / 2;
  const rawTop = rectangle.top + rectangle.height * step.focusY - TAP_INDICATOR_SIZE / 2;
  const left = Math.min(Math.max(HIGHLIGHT_VIEWPORT_MARGIN, rawLeft), maxLeft);
  const top = Math.min(Math.max(HIGHLIGHT_VIEWPORT_MARGIN, rawTop), maxTop);
  return { left, top };
}

function getTooltipStyle(rectangle: TargetRectangle, placement: TooltipPlacement): React.CSSProperties {
  const width = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const left = Math.min(Math.max(VIEWPORT_MARGIN, rectangle.left), window.innerWidth - width - VIEWPORT_MARGIN);
  if (placement === "below") return { left, top: rectangle.bottom + TOOLTIP_GAP, width };
  if (placement === "above") return { bottom: window.innerHeight - rectangle.top + TOOLTIP_GAP, left, width };
  return { bottom: VIEWPORT_MARGIN, left, width };
}
