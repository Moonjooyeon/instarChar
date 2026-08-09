import React from "react";
import type { CreditFlow } from "@/api/credits";
import { AliveIcon } from "@/components/ui/AliveIcon";
import { creditFlowMeta } from "@/domain/credits/creditPresentation";

export function CreditChargeOrder(): React.ReactElement {
  return (
    <section className="al-credit-order" aria-labelledby="credit-order-title">
      <header><small>사용 순서</small><h2 id="credit-order-title">무료부터 차례대로 사용해요</h2></header>
      <ol>
        <ChargeStep index="1" label="데일리 에너지" detail="6시간마다 25% 회복" />
        <ChargeStep index="2" label="무료 보너스" detail="가입·첫 활동 보상" />
        <ChargeStep index="3" label="구매 크레딧" detail="에너지와 보너스 소진 후" />
      </ol>
      <p>어떤 잔액을 사용해도 AI 답변 품질은 같아요. 단, Pro 기능은 구매 크레딧만 사용해요.</p>
    </section>
  );
}

export function CreditFlowCatalog({ flows }: { flows: CreditFlow[] }): React.ReactElement {
  const conversation = flows.filter((flow) => creditFlowMeta(flow.code).category === "conversation");
  const content = flows.filter((flow) => creditFlowMeta(flow.code).category === "content");
  return (
    <section className="al-credit-flow-catalog" aria-labelledby="credit-flow-title">
      <header><small>기능별 사용량</small><h2 id="credit-flow-title">무엇에 얼마나 쓰이나요?</h2><p>한 번의 AI 응답 기준이에요. 대부분은 에너지를 먼저 쓰고, Pro는 구매 크레딧만 사용해요.</p></header>
      <FlowGroup label="대화" flows={conversation} />
      <FlowGroup label="콘텐츠와 관계" flows={content} />
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
  const cost = flow.energy_eligible ? <><span><AliveIcon name="sun" size={11} /> 에너지 {flow.energy_percent}%</span><span><AliveIcon name="wallet" size={11} /> 부족하면 {flow.credits}C</span></> : <span><AliveIcon name="wallet" size={11} /> 구매 크레딧 {flow.credits}C</span>;
  return (
    <article className={!meta.available ? "planned" : ""}>
      <span className="al-credit-flow-icon"><FlowIcon code={flow.code} /></span>
      <div><header><b>{flow.label}</b><small>{meta.tier}</small></header><p>{meta.description}</p><footer>{cost}{!meta.available && <em>선택 기능 준비 중</em>}</footer></div>
    </article>
  );
}

function FlowIcon({ code }: { code: string }): React.ReactElement {
  if (code === "feed_post") return <AliveIcon name="pen" size={16} />;
  if (code === "image_understanding") return <AliveIcon name="image" size={16} />;
  if (code === "character_interaction") return <AliveIcon name="relationship" size={16} />;
  return <AliveIcon name="message" size={16} />;
}
