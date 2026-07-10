type SetState<T> = (updater: T | ((prev: T) => T)) => void;

type CharacterCorrections = {
  corrections?: string[];
  directions?: string;
  name: string;
};

type AccountWithCharacter = {
  char: CharacterCorrections;
};

type CorrectionsOptions = {
  char: CharacterCorrections;
  setAccounts: SetState<AccountWithCharacter[]>;
  setChar: SetState<CharacterCorrections>;
};

export function useAliveCorrections({ char, setAccounts, setChar }: CorrectionsOptions): {
  addCorrection: (note: string, targetName?: string | null) => void;
  correctionBlock: () => string;
  correctionBlockFor: (char: CharacterCorrections) => string;
} {
  function addCorrection(note: string, targetName?: string | null): void {
    if (!note.trim()) return;
    if (targetName && targetName !== char.name) {
      setAccounts((items) => items.map((item) => item.char.name === targetName ? correctedAccount(item, note) : item));
      return;
    }
    setChar((item) => ({ ...item, corrections: [...(item.corrections || []), note.trim()] }));
  }
  function correctionBlock(): string {
    return correctionBlockFor(char);
  }
  return { addCorrection, correctionBlock, correctionBlockFor };
}

function correctedAccount(account: AccountWithCharacter, note: string): AccountWithCharacter {
  return { ...account, char: { ...account.char, corrections: [...(account.char.corrections || []), note.trim()] } };
}

function correctionBlockFor(char: CharacterCorrections): string {
  let output = "";
  if ((char.directions || "").trim()) output += `\n\n[오너의 지시 — 이 캐릭터를 연기할 때 항상 따라라]\n${char.directions.trim()}`;
  const corrections = char.corrections || [];
  if (corrections.length) output += `\n\n[캐해 교정 — 반드시 지켜라]\n${corrections.map((item) => `- ${item}`).join("\n")}`;
  return output;
}
