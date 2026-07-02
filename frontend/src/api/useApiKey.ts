import { useState } from "react";

export interface CurrentIdentity {
  personId: string;
  worldId: string;
}

const CURRENT_PERSON_KEY = "wg_current_person_id";
const CURRENT_WORLD_KEY = "wg_current_world_id";

// review:P7-T10
export function getCurrentIdentity(): CurrentIdentity | null {
  const personId = localStorage.getItem(CURRENT_PERSON_KEY) ?? "";
  const worldId = localStorage.getItem(CURRENT_WORLD_KEY) ?? "";
  if (!personId || !worldId) {
    return null;
  }
  return { personId, worldId };
}

export function saveCurrentIdentity(personId: string, worldId: string) {
  if (personId) localStorage.setItem(CURRENT_PERSON_KEY, personId);
  if (worldId) localStorage.setItem(CURRENT_WORLD_KEY, worldId);
}

// review:P4-T4
export function useApiKey() {
  const [key, setKeyState] = useState(() => localStorage.getItem("wg_llm_key") ?? "");
  const [model, setModelState] = useState(
    () => localStorage.getItem("wg_llm_model") ?? "",
  );
  const [baseUrl, setBaseUrlState] = useState(
    () => localStorage.getItem("wg_llm_base_url") ?? "",
  );
  const [reasoningEffort, setReasoningEffortState] = useState(
    () => localStorage.getItem("wg_llm_reasoning") ?? "",
  );
  const [thinking, setThinkingState] = useState(
    () => localStorage.getItem("wg_llm_thinking") ?? "",
  );

  return {
    key,
    model,
    baseUrl,
    reasoningEffort,
    thinking,
    setKey: (value: string) => {
      localStorage.setItem("wg_llm_key", value);
      setKeyState(value);
    },
    setModel: (value: string) => {
      localStorage.setItem("wg_llm_model", value);
      setModelState(value);
    },
    // review:PA-T3
    setBaseUrl: (value: string) => {
      localStorage.setItem("wg_llm_base_url", value);
      setBaseUrlState(value);
    },
    setReasoningEffort: (value: string) => {
      localStorage.setItem("wg_llm_reasoning", value);
      setReasoningEffortState(value);
    },
    setThinking: (value: string) => {
      localStorage.setItem("wg_llm_thinking", value);
      setThinkingState(value);
    },
  };
}
