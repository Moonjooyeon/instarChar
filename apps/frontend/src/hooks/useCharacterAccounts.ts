import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";

type CharacterDraft = {
  [key: string]: unknown;
  corrections: string[];
  handle?: string;
  lorebook: unknown[];
  name: string;
  persona: string;
  relations?: string;
};

type AccountDraft = {
  [key: string]: unknown;
  char: CharacterDraft;
  following?: Record<string, unknown>[];
  gallery?: unknown[];
  id: string;
  posts?: Record<string, unknown>[];
};

type DeleteTarget = {
  id: string;
  [key: string]: unknown;
};

type CharacterAccountsReturn = {
  accounts: AccountDraft[];
  activeId: string | null;
  blankChar: () => CharacterDraft;
  char: CharacterDraft;
  deleteTarget: DeleteTarget | null;
  dump: string;
  gallery: string[];
  handleProfileImage: (kind: string, event: ChangeEvent<HTMLInputElement>) => void;
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  parseError: string;
  parseFailed: boolean;
  parsing: boolean;
  rpLog: string;
  setAccounts: Dispatch<SetStateAction<AccountDraft[]>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setChar: Dispatch<SetStateAction<CharacterDraft>>;
  setDeleteTarget: Dispatch<SetStateAction<DeleteTarget | null>>;
  setDump: Dispatch<SetStateAction<string>>;
  setGallery: Dispatch<SetStateAction<string[]>>;
  setParseError: Dispatch<SetStateAction<string>>;
  setParseFailed: Dispatch<SetStateAction<boolean>>;
  setParsing: Dispatch<SetStateAction<boolean>>;
  setRpLog: Dispatch<SetStateAction<string>>;
  setWaking: Dispatch<SetStateAction<boolean>>;
  update: (key: string, value: unknown) => void;
  waking: boolean;
};

export function useCharacterAccounts(): CharacterAccountsReturn {
  const [accounts, setAccounts] = useState<AccountDraft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dump, setDump] = useState("");
  const [rpLog, setRpLog] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [parseError, setParseError] = useState("");
  const [waking, setWaking] = useState(false);
  const [char, setChar] = useState(blankChar());
  const [gallery, setGallery] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const update = (key: string, value: unknown): void => setChar((current) => ({ ...current, [key]: value }));
  function handleUpload(event: ChangeEvent<HTMLInputElement>): void {
    const files = filesFromInput(event.target);
    files.forEach((file) => readGalleryFile(file, setGallery));
    event.target.value = "";
  }
  function handleProfileImage(kind: string, event: ChangeEvent<HTMLInputElement>): void {
    const file = filesFromInput(event.target)[0];
    if (!file) return;
    readProfileImageFile(kind, file, update);
    event.target.value = "";
  }
  return { accounts, activeId, blankChar, char, deleteTarget, dump, gallery, handleProfileImage, handleUpload, parseError, parseFailed, parsing, rpLog, setAccounts, setActiveId, setChar, setDeleteTarget, setDump, setGallery, setParseError, setParseFailed, setParsing, setRpLog, setWaking, update, waking };
}

function blankChar(): CharacterDraft {
  return { name: "", handle: "", age: "", tone: "calm", persona: "", world: "", speech: "", catchphrase: "", avatarImg: "", headerImg: "", surface: "", inner: "", situational: "", triggers: "", interests: "", relations: "", corrections: [], directions: "", lorebook: [] };
}

function filesFromInput(input: HTMLInputElement): File[] {
  return Array.from(input.files || []) as File[];
}

function readGalleryFile(file: File, setGallery: Dispatch<SetStateAction<string[]>>): void {
  const reader = new FileReader();
  reader.onload = (event) => appendReaderResult(event.target?.result, setGallery);
  reader.readAsDataURL(file);
}

function readProfileImageFile(kind: string, file: File, update: (key: string, value: unknown) => void): void {
  const reader = new FileReader();
  reader.onload = (event) => update(kind === "avatar" ? "avatarImg" : "headerImg", event.target?.result || "");
  reader.readAsDataURL(file);
}

function appendReaderResult(result: string | ArrayBuffer | null | undefined, setGallery: Dispatch<SetStateAction<string[]>>): void {
  if (typeof result !== "string") return;
  setGallery((items) => [...items, result]);
}
