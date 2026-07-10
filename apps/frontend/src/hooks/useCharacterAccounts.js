import { useState } from "react";

export function useCharacterAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [dump, setDump] = useState("");
  const [rpLog, setRpLog] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseFailed, setParseFailed] = useState(false);
  const [parseError, setParseError] = useState("");
  const [waking, setWaking] = useState(false);
  const [char, setChar] = useState(blankChar());
  const [gallery, setGallery] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const update = (key, value) => setChar((current) => ({ ...current, [key]: value }));
  function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    files.forEach((file) => readGalleryFile(file, setGallery));
    event.target.value = "";
  }
  function handleProfileImage(kind, event) {
    const file = Array.from(event.target.files || [])[0];
    if (!file) return;
    readProfileImageFile(kind, file, update);
    event.target.value = "";
  }
  return { accounts, activeId, blankChar, char, deleteTarget, dump, gallery, handleProfileImage, handleUpload, parseError, parseFailed, parsing, rpLog, setAccounts, setActiveId, setChar, setDeleteTarget, setDump, setGallery, setParseError, setParseFailed, setParsing, setRpLog, setWaking, update, waking };
}

function blankChar() {
  return { name: "", handle: "", age: "", tone: "calm", persona: "", world: "", speech: "", catchphrase: "", avatarImg: "", headerImg: "", surface: "", inner: "", situational: "", triggers: "", interests: "", relations: "", corrections: [], directions: "", lorebook: [] };
}

function readGalleryFile(file, setGallery) {
  const reader = new FileReader();
  reader.onload = (event) => setGallery((items) => [...items, event.target.result]);
  reader.readAsDataURL(file);
}

function readProfileImageFile(kind, file, update) {
  const reader = new FileReader();
  reader.onload = (event) => update(kind === "avatar" ? "avatarImg" : "headerImg", event.target.result);
  reader.readAsDataURL(file);
}
