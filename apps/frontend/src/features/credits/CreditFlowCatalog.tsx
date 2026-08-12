import React from "react";
import type { CreditFlow } from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditFlowMeta } from "@/domain/credits/creditPresentation";
import { dmResponseFlowLabel } from "@/domain/dm/dmResponseMode";

export function CreditChargeOrder(): React.ReactElement {
  return (
    <section className="al-credit-order" aria-labelledby="credit-order-title">
      <header><small>일반 기능의 사용 순서</small><h2 id="credit-order-title">무료부터 차례대로 사용해요</h2></header>
      <ol>
        <ChargeStep index="1" label="무료 회복 에너지" detail="100%에서 사용 후 6시간마다 25%" />
        <ChargeStep index="2" label="무료 보너스" detail="가입·첫 활동 보상" />
        <ChargeStep index="3" label="구매 크레딧" detail="에너지와 보너스 소진 후" />
      </ol>
      <p>일반 기능만 이 순서를 따라요. <strong>Pro·혼자 남기는 근황·캐릭터 재분석은 구매 크레딧만 사용해요.</strong></p>
    </section>
  );
}

export function CreditFlowCatalog({ flows }: { flows: CreditFlow[] }): React.ReactElement {
  const conversation = flows.filter((flow) => creditFlowMeta(flow.code).category === "conversation");
  const content = flows.filter((flow) => creditFlowMeta(flow.code).category === "content");
  return (
    <section className="al-credit-flow-catalog" aria-labelledby="credit-flow-title">
      <header><small>기능별 사용량</small><h2 id="credit-flow-title">무엇에 얼마나 쓰이나요?</h2><p>한 번의 요청 기준이에요. 첫 캐릭터 분석은 무료이고, 이후 재분석과 Pro·혼자 남기는 근황은 구매 크레딧만 사용해요.</p></header>
      <FlowGroup label="대화" flows={conversation} />
      <FlowGroup label="콘텐츠와 관계" flows={content} />
      <aside className="al-credit-included-ai"><b>예외 규칙만 기억하세요</b><ul><li><strong>혼자 남기는 근황</strong>은 한 편당 구매 크레딧 2C예요. 잔액이 2C보다 적으면 잠시 쉬어요.</li><li><strong>포함 AI</strong>는 댓글·팔로잉 글 합산 12회, 관계 제안·판정 합산 6회, 호감도·기억 정리 합산 4회까지 별도 C 차감 없이 제공돼요.</li></ul></aside>
    </section>
  );
}

function ChargeStep({ detail, index, label }: { detail: string; index: string; label: string }): React.ReactElement {
  return <li><b>{index}</b><span><strong>{label}</strong><small>{detail}</small></span></li>;
}

function FlowGroup({ flows, label }: { flows: CreditFlow[]; label: string }): React.ReactElement {
  return <div className="al-credit-flow-group"><h3>{label}<small>{flows.length}개</small></h3><div>{flows.map((flow) => <FlowCard flow={flow} key={flow.code} />)}</div></div>;
}

function FlowCard({ flow }: { flow: CreditFlow }): React.ReactElement {
  const meta = creditFlowMeta(flow.code);
  const cost = flow.intro_free_uses > 0 ? <><span><AliveIcon name="sparkle" size={11} /> 첫 {flow.intro_free_uses}회 무료</span><span><AliveIcon name="wallet" size={11} /> 이후 {flow.credits}C</span></> : flow.energy_eligible ? <><span><AliveIcon name="sun" size={11} /> 에너지 {flow.energy_percent}%</span><span><AliveIcon name="wallet" size={11} /> 부족하면 {flow.credits}C</span></> : <span><AliveIcon name="wallet" size={11} /> 구매 크레딧 {flow.credits}C</span>;
  return (
    <article className={!meta.available ? "planned" : ""}>
      <span className="al-credit-flow-icon"><FlowIcon code={flow.code} /></span>
      <div><header><b>{dmResponseFlowLabel(flow.code) || flow.label}</b><small>{meta.tier}</small></header><p>{meta.description}</p><footer>{cost}{flow.hard_daily_limit > 0 && <em>하루 최대 {flow.hard_daily_limit}회</em>}{!meta.available && <em>선택 기능 준비 중</em>}</footer></div>
    </article>
  );
}

function FlowIcon({ code }: { code: string }): React.ReactElement {
  if (code === "feed_post") return <AliveIcon name="pen" size={16} />;
  if (code === "auto_feed_post") return <AliveIcon name="sparkle" size={16} />;
  if (code === "character_interaction") return <AliveIcon name="relationship" size={16} />;
  if (code === "character_analysis") return <AliveIcon name="sparkle" size={16} />;
  return <AliveIcon name="message" size={16} />;
}
