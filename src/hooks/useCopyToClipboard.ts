import { useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "copied" | "error";

/** Copies text to the clipboard and briefly reports whether it succeeded, for a "コピーしました" style button. */
export function useCopyToClipboard(resetDelayMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async (text: string) => {
    clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    timerRef.current = setTimeout(() => setStatus("idle"), resetDelayMs);
  };

  return { copy, status };
}
