import { useState } from "react";

// review:P4-T4
export function useApiKey() {
  const [key, setKeyState] = useState(() => localStorage.getItem("wg_llm_key") ?? "");
  const [model, setModelState] = useState(
    () => localStorage.getItem("wg_llm_model") ?? "gpt-4o-mini",
  );

  return {
    key,
    model,
    setKey: (value: string) => {
      localStorage.setItem("wg_llm_key", value);
      setKeyState(value);
    },
    setModel: (value: string) => {
      localStorage.setItem("wg_llm_model", value);
      setModelState(value);
    },
  };
}
