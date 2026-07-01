import { useState } from "react";

// review:P4-T4
export function useApiKey() {
  const [key, setKeyState] = useState(() => localStorage.getItem("wg_llm_key") ?? "");
  const [model, setModelState] = useState(
    () => localStorage.getItem("wg_llm_model") ?? "gpt-4o-mini",
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
