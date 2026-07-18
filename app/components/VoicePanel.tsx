"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export type VoiceState = "idle" | "speaking" | "error" | "disabled";

export type VoicePanelProps = {
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  label?: string;
  onStateChange?: (state: VoiceState) => void;
  onError?: (message: string) => void;
};

const CARE_MESSAGE = "どうしたの、話聞くよ";

export function VoicePanel({
  disabled = false,
  className,
  buttonClassName,
  activeButtonClassName,
  label = "つらいので話す",
  onStateChange,
  onError,
}: VoicePanelProps) {
  const [state, setStateValue] = useState<VoiceState>(disabled ? "disabled" : "idle");
  const [message, setMessage] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const setVoiceState = useCallback(
    (next: VoiceState) => {
      setStateValue(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  const speak = useCallback(() => {
    if (disabled) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      const errorMessage = "この端末では音声を再生できません。";
      setMessage(errorMessage);
      setVoiceState("error");
      onError?.(errorMessage);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(CARE_MESSAGE);
    utterance.lang = "ja-JP";
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.onend = () => {
      utteranceRef.current = null;
      setMessage("");
      setVoiceState("idle");
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      const errorMessage = "音声を再生できませんでした。";
      setMessage(errorMessage);
      setVoiceState("error");
      onError?.(errorMessage);
    };
    utteranceRef.current = utterance;
    setMessage("声をかけています");
    setVoiceState("speaking");
    window.speechSynthesis.speak(utterance);
  }, [disabled, onError, setVoiceState]);

  useEffect(() => {
    if (disabled) setVoiceState("disabled");
    return () => window.speechSynthesis?.cancel();
  }, [disabled, setVoiceState]);

  const active = state === "speaking";

  return (
    <div className={className} style={panelStyle}>
      <button
        type="button"
        className={`${buttonClassName ?? ""} ${active ? activeButtonClassName ?? "" : ""}`.trim() || undefined}
        style={!buttonClassName ? buttonStyle : undefined}
        disabled={disabled}
        aria-pressed={active}
        onClick={speak}
      >
        {active ? "声をかけています…" : label}
      </button>
      <p role={state === "error" ? "alert" : "status"} aria-live="polite" style={statusStyle}>
        {message}
      </p>
    </div>
  );
}

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.4rem",
};

const buttonStyle: CSSProperties = {
  minHeight: 48,
  padding: "0.75rem 1.15rem",
  border: "1px solid currentColor",
  borderRadius: 999,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

const statusStyle: CSSProperties = {
  minHeight: "1.25em",
  margin: 0,
  fontSize: "0.75rem",
  opacity: 0.64,
};
