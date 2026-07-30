import { useEffect, useRef, useState } from "react";
import { getCharacterHandleAvailability } from "@/api/characters";
import { characterHandleError, normalizeHandle } from "@/domain/app/textUtils";

export type CharacterHandleAvailabilityState = "available" | "checking" | "idle" | "invalid" | "taken" | "unknown";

type AvailabilityResult = {
  message: string;
  normalizedHandle: string;
  state: CharacterHandleAvailabilityState;
};

export function useCharacterHandleAvailability(handle: unknown, excludeSourceAccountId: string | null): AvailabilityResult {
  const normalizedHandle = normalizeHandle(handle);
  const validationError = characterHandleError(handle);
  const [result, setResult] = useState<AvailabilityResult>({ message: "", normalizedHandle, state: "idle" });
  const requestSequence = useRef(0);
  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (validationError) {
      setResult({ message: validationError, normalizedHandle, state: "invalid" });
      return;
    }
    setResult({ message: "아이디 확인 중…", normalizedHandle, state: "checking" });
    const timer = window.setTimeout(() => checkAvailability(normalizedHandle, excludeSourceAccountId, sequence, requestSequence, setResult), 350);
    return () => window.clearTimeout(timer);
  }, [excludeSourceAccountId, normalizedHandle, validationError]);
  return result;
}

async function checkAvailability(handle: string, excludeId: string | null, sequence: number, requestSequence: { current: number }, setResult: (value: AvailabilityResult) => void): Promise<void> {
  try {
    const result = await getCharacterHandleAvailability(handle, excludeId || "");
    if (sequence !== requestSequence.current) return;
    const state = result.available ? "available" : "taken";
    const message = result.available ? "사용할 수 있는 아이디야." : "이미 사용 중인 아이디야.";
    setResult({ message, normalizedHandle: result.handle, state });
  } catch {
    if (sequence !== requestSequence.current) return;
    setResult({ message: "미리 확인하지 못했어. 저장할 때 다시 확인할게.", normalizedHandle: handle, state: "unknown" });
  }
}
