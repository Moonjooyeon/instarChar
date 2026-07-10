import {
  apiContentText,
  apiErrorText,
  cleanApiFailureMessage,
  readApiContent,
  readApiJson,
} from "@/api/generate";

export function useAliveAiGeneration() {
  return {
    apiContentText,
    apiErrorText,
    cleanApiFailureMessage,
    readApiContent,
    readApiJson,
  };
}
