import React from "react";

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
  return (
    <div className="al-phone">
      <button className="al-dump-back" onClick={() => setStep("home")}>‹ 내 캐릭터들</button>
      <div className="al-setup">
        <div className="al-setup-head">
          <span className="al-spark">✶</span>
          <h1>내 캐릭터를 깨운다</h1>
          <p>걔에 대해 적어줘.<br />설명만 있어도 깨울 수 있어.</p>
        </div>
        <div className="al-guidechips">
          {["이름", "성격", "말투·입버릇", "좋아하는 거", "세계관", "캐치프레이즈"].map((guide) => (
            <span key={guide} className="al-guidechip">{guide}</span>
          ))}
        </div>
        <textarea
          className="al-dump"
          value={dump}
          onChange={(event) => setDump(event.target.value)}
          placeholder={"이름은 리안. 21살, 마법학교 다님.\n겉으론 시크·까칠한데 단 거 앞에선 무너짐.\n반말 쓰고 문장 끝에 '…' 자주 붙임.\n고양이 키우고 밤에 글 쓰는 거 좋아함."}
        />
        <div className="al-rp">
          <div className="al-rp-head">
            <span>역극 · 대사 로그</span>
            <span className="al-rp-opt">선택</span>
          </div>
          <p className="al-rp-desc">대사를 넣으면 말투·캐치프레이즈를 훨씬 정확하게 잡아.</p>
          <textarea
            className="al-rp-box"
            value={rpLog}
            onChange={(event) => setRpLog(event.target.value)}
            placeholder={"리안: 됐어, 그런 건 알아서 할게…\n리안: …고마워. 딱 한 번만 말한다.\n리안: 시끄러워. 그 얘긴 그만."}
          />
        </div>
        <div className="al-examples">
          <span className="al-examples-lbl">막막하면 예시로 시작해도 돼 →</span>
          <div className="al-example-cards">
            {examples.map((example) => (
              <button key={example.name} className="al-example" onClick={() => setDump(example.text)}>
                <span className="al-example-name">{example.name}</span>
                <span className="al-example-desc">{example.short}</span>
              </button>
            ))}
          </div>
        </div>
        <button className="al-start" disabled={(!dump.trim() && !rpLog.trim()) || parsing} onClick={parseDump}>
          {parsing ? <span className="al-typing"><i/><i/><i/></span> : "이대로 깨우기"}
        </button>
        <p className="al-dump-note">정리는 AI가 해줄게. 다음 화면에서 확인하고 고치면 돼.</p>
      </div>
    </div>
  );
}
