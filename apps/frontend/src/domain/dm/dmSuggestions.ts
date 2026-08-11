type DmSuggestionOptions = {
  asOwner: boolean;
  lastText?: string;
  messageCount: number;
  peerName: string;
};

export function dmSuggestionPrompts({ asOwner, lastText = "", messageCount, peerName }: DmSuggestionOptions): string[] {
  const prompts = lastText ? continuingPrompts(asOwner, peerName) : openingPrompts(asOwner, peerName);
  const start = promptOffset(`${peerName}:${lastText}`, messageCount, prompts.length);
  return [...prompts.slice(start), ...prompts.slice(0, start)].slice(0, 3);
}

function openingPrompts(asOwner: boolean, peerName: string): string[] {
  if (asOwner) return ["지금 잠깐 이야기할 수 있어?", "오늘은 어떤 하루였어?", "요즘 네가 가장 신경 쓰는 건 뭐야?", "내게 들려주고 싶은 이야기가 있어?", "함께 해보고 싶은 게 있어?", "가장 기분 좋았던 순간은 언제였어?"];
  return [`${peerName}에게 가볍게 인사한다.`, `${peerName}의 오늘 이야기를 조심스럽게 묻는다.`, `이 장면에서 ${peerName}와 함께할 일을 제안한다.`, `${peerName}가 요즘 빠진 것을 묻는다.`, `${peerName}의 기분을 살핀다.`, `${peerName}와 어울릴 만한 다음 장면을 꺼낸다.`];
}

function continuingPrompts(asOwner: boolean, peerName: string): string[] {
  const name = asOwner ? "" : `${peerName}, `;
  return [`${name}방금 말한 이야기를 조금 더 들려줘.`, `${name}그때 어떤 기분이었어?`, `${name}그 뒤에는 어떻게 됐어?`, `${name}가장 기억에 남는 부분은 뭐야?`, `${name}그 선택을 한 이유가 궁금해.`, `${name}지금은 어떻게 생각해?`, `${name}그 장면을 함께 이어가 볼까?`, `${name}다음에는 어떤 일이 일어나면 좋겠어?`, `${name}너라면 어떻게 하고 싶어?`, `${name}조금 더 솔직하게 말해줘도 괜찮아.`, `${name}그 이야기를 들으니 나도 궁금해졌어.`, `${name}오늘의 너를 가장 잘 보여주는 순간은 뭐야?`];
}

function promptOffset(source: string, messageCount: number, length: number): number {
  const total = [...source].reduce((sum, character) => sum + character.codePointAt(0)!, messageCount);
  return total % length;
}
