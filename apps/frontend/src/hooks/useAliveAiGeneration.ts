import {
  apiContentText,
  apiErrorText,
  cleanApiFailureMessage,
  readApiContent,
  readApiJson,
} from "@/api/generate";

export function useAliveAiGeneration(): {
  apiContentText: typeof apiContentText;
  apiErrorText: typeof apiErrorText;
  cleanApiFailureMessage: typeof cleanApiFailureMessage;
  readApiContent: typeof readApiContent;
  readApiJson: typeof readApiJson;
} {
  return {
    apiContentText,
    apiErrorText,
    cleanApiFailureMessage,
    readApiContent,
    readApiJson,
  };
}
