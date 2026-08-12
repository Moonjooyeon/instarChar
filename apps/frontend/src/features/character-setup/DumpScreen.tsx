import React from "react";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { joinCreationDump, splitCreationDump } from "@/domain/app/creationDraft";

const CREATION_STAGES = ["인물", "성격", "말투"] as const;

export function DumpScreen({
  dump,
  examples,
  parsing,
  parseDump,
  rpLog,
  setDump,
  setRpLog,
  setStep,
}) {
  const initialSections = splitCreationDump(dump);
  const [creationStage, setCreationStage] = React.useState(0);
  const [identity, setIdentity] = React.useState(initialSections.identity);
  const [personality, setPersonality] = React.useState(initialSections.personality);
  const [voice, setVoice] = React.useState(rpLog);
  React.useEffect(() => setDump(joinCreationDump(identity, personality)), [identity, personality, setDump]);
  React.useEffect(() => setRpLog(voice), [voice, setRpLog]);
  return (
    <div className="al-phone al-phone-wizard al-theme-ready">
      <button className="al-dump-back" onClick={() => setStep("home")}><AliveIcon name="arrow-left" size={15} /> 내 캐릭터들</button>
      <div className="al-setup al-setup-wizard">
        <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label={`캐릭터 생성 ${creationStage + 1}단계, 총 3단계`}>{CREATION_STAGES.map((label, stage) => <li aria-current={stage === creationStage ? "step" : undefined} className={creationStageClass(stage, creationStage)} key={label}><i className="text-[10px] not-italic tabular-nums">{String(stage + 1).padStart(2, "0")}</i><b className="text-[10.5px] font-bold tracking-[0.02em]">{label}</b></li>)}</ol>
        {creationStage === 0 && <IdentityStep examples={examples} identity={identity} onChange={setIdentity} onNext={() => setCreationStage(1)} />}
        {creationStage === 1 && <PersonalityStep onBack={() => setCreationStage(0)} onChange={setPersonality} onNext={() => setCreationStage(2)} personality={personality} />}
        {creationStage === 2 && <VoiceStep identity={identity} onBack={() => setCreationStage(1)} onChange={setVoice} onComplete={parseDump} parsing={parsing} voice={voice} />}
      </div>
    </div>
  );
}

function creationStageClass(stage: number, currentStage: number): string {
  const baseClass = "grid grid-cols-[auto_1fr] gap-1.5 border-t-2 pt-2";
  if (stage === currentStage) return `${baseClass} border-accent text-accent-ink`;
  if (stage < currentStage) return `${baseClass} border-accent/50 text-soft`;
  return `${baseClass} border-line text-faint`;
}

function IdentityStep({ examples, identity, onChange, onNext }) {
  return <section className="al-creation-step" aria-labelledby="identity-title">
    <StepHeading id="identity-title" title="이 캐릭터는 누구인가요?" description="이름과 지금 하는 일을 적어주세요." />
    <label className="al-step-field"><span>이름 · 나이 · 하는 일 <i className="al-field-required">필수</i></span><textarea className="al-dump" value={identity} onChange={(event) => onChange(event.target.value)} placeholder={"리안, 21세.\n마법학교의 야간 조교."} /></label>
    <div className="al-step-examples"><span>막막하면 예시로 시작해보세요.</span><div>{examples.map((example) => <button key={example.name} type="button" onClick={() => onChange(example.text)}><b>{example.name}</b><small>{example.short}</small></button>)}</div></div>
    <button className="al-start" disabled={!identity.trim()} onClick={onNext}>다음: 어떤 사람인지 적기</button>
  </section>;
}

function PersonalityStep({ onBack, onChange, onNext, personality }) {
  return <section className="al-creation-step" aria-labelledby="personality-title">
    <StepHeading id="personality-title" title="어떤 사람인가요?" description="반전 하나만 있어도 충분해요." />
    <label className="al-step-field"><span>평소 모습 · 반전 <i>선택</i></span><textarea className="al-dump" value={personality} onChange={(event) => onChange(event.target.value)} placeholder={"낯선 사람에게는 말이 적다.\n학생이 위험하면 평소와 다르게 단호해진다."} /></label>
    <aside className="al-step-guide"><p>누구 앞에서 약해지는지 떠올려보세요.</p></aside>
    <StepActions backLabel="이전" nextLabel={personality.trim() ? "다음: 말투 남기기" : "건너뛰고 말투 보기"} onBack={onBack} onNext={onNext} />
  </section>;
}

function VoiceStep({ identity, onBack, onChange, onComplete, parsing, voice }) {
  return <section className="al-creation-step" aria-labelledby="voice-title">
    <StepHeading id="voice-title" title="어떻게 말하나요?" description="대사 한마디면 충분해요." />
    <label className="al-step-field"><span>대사 한마디 <i>선택</i></span><textarea className="al-rp-box" value={voice} onChange={(event) => onChange(event.target.value)} placeholder={"“그건… 다음에 이야기하죠.”\n짧은 존댓말을 쓰고, 당황하면 말끝을 흐린다."} /></label>
    <aside className="al-step-guide"><p>떠오르지 않으면 건너뛰어도 괜찮아요.</p></aside>
    <p className="text-[10px] leading-5 text-soft">프로필 정리는 처음 1회 무료예요. 다시 AI로 정리하면 구매 크레딧 10C가 사용돼요.</p>
    <div className="al-step-actions"><button className="al-step-back" type="button" onClick={onBack}>이전</button><button className="al-start" disabled={!identity.trim() || parsing} onClick={onComplete}>{parsing ? <span className="al-typing"><i/><i/><i/></span> : voice.trim() ? "이제 프로필로 정리하기" : "건너뛰고 프로필 보기"}</button></div>
  </section>;
}

function StepHeading({ description, id, title }) {
  return <header className="al-step-heading"><h1 className="al-flow-title" id={id}>{title}</h1><p className="al-flow-copy">{description}</p></header>;
}

function StepActions({ backLabel, nextLabel, onBack, onNext }) {
  return <div className="al-step-actions"><button className="al-step-back" type="button" onClick={onBack}>{backLabel}</button><button className="al-start" type="button" onClick={onNext}>{nextLabel}</button></div>;
}
