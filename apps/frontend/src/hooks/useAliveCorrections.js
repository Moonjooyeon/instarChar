export function useAliveCorrections({ char, setAccounts, setChar }) {
  function addCorrection(note, targetName) {
    if (!note.trim()) return;
    if (targetName && targetName !== char.name) {
      setAccounts((items) => items.map((item) => item.char.name === targetName ? correctedAccount(item, note) : item));
      return;
    }
    setChar((item) => ({ ...item, corrections: [...(item.corrections || []), note.trim()] }));
  }
  function correctionBlock() {
    return correctionBlockFor(char);
  }
  return { addCorrection, correctionBlock, correctionBlockFor };
}

function correctedAccount(account, note) {
  return { ...account, char: { ...account.char, corrections: [...(account.char.corrections || []), note.trim()] } };
}

function correctionBlockFor(char) {
  let output = "";
  if ((char.directions || "").trim()) output += `\n\n[오너의 지시 — 이 캐릭터를 연기할 때 항상 따라라]\n${char.directions.trim()}`;
  const corrections = char.corrections || [];
  if (corrections.length) output += `\n\n[캐해 교정 — 반드시 지켜라]\n${corrections.map((item) => `- ${item}`).join("\n")}`;
  return output;
}
