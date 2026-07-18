"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FIRST_CARE_INSTRUCTION } from "@/lib/voice/sessionConfig";

export type VoiceState =
  | "idle"
  | "connecting"
  | "speaking"
  | "listening"
  | "error"
  | "disabled";

export type VoicePanelProps = {
  endpoint?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  label?: string;
  stopLabel?: string;
  onStateChange?: (state: VoiceState) => void;
  onError?: (message: string) => void;
};

type RealtimeServerEvent = {
  type?: string;
  error?: { message?: string };
};

export function VoicePanel({
  endpoint = "/api/realtime/session",
  disabled = false,
  className,
  buttonClassName,
  activeButtonClassName,
  label = "つらいので話す",
  stopLabel = "話すのをやめる",
  onStateChange,
  onError,
}: VoicePanelProps) {
  const [state, setStateValue] = useState<VoiceState>(
    disabled ? "disabled" : "idle",
  );
  const [message, setMessage] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const mountedRef = useRef(true);

  const setVoiceState = useCallback(
    (next: VoiceState) => {
      if (!mountedRef.current) return;
      setStateValue(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  const enableMicrophone = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
  }, []);

  const teardown = useCallback(() => {
    operationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    if (openingTimerRef.current) {
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
  }, []);

  const showError = useCallback(
    (errorMessage: string) => {
      teardown();
      if (!mountedRef.current) return;
      setMessage(errorMessage);
      setVoiceState("error");
      onError?.(errorMessage);
    },
    [onError, setVoiceState, teardown],
  );

  const stop = useCallback(() => {
    teardown();
    setMessage("");
    setVoiceState(disabled ? "disabled" : "idle");
  }, [disabled, setVoiceState, teardown]);

  const start = useCallback(async () => {
    if (disabled || state === "connecting") return;
    if (
      typeof RTCPeerConnection === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      showError("このブラウザではVoiceを利用できません。");
      return;
    }

    teardown();
    const operation = operationRef.current;
    setMessage("");
    setVoiceState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (operation !== operationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        // The assistant says the first caring line before listening starts.
        track.enabled = false;
      });

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          void audioRef.current.play().catch(() => undefined);
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          showError("Voiceの接続が切れました。もう一度お試しください。");
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("open", () => {
        setVoiceState("speaking");
        channel.send(
          JSON.stringify({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
              instructions: FIRST_CARE_INSTRUCTION,
            },
          }),
        );

        openingTimerRef.current = setTimeout(() => {
          enableMicrophone();
          setVoiceState("listening");
        }, 12_000);
      });

      channel.addEventListener("message", (event) => {
        let serverEvent: RealtimeServerEvent;
        try {
          serverEvent = JSON.parse(String(event.data)) as RealtimeServerEvent;
        } catch {
          return;
        }

        if (serverEvent.type === "response.created") {
          setVoiceState("speaking");
        }
        if (serverEvent.type === "response.done") {
          if (openingTimerRef.current) {
            clearTimeout(openingTimerRef.current);
            openingTimerRef.current = null;
          }
          enableMicrophone();
          setVoiceState("listening");
        }
        if (serverEvent.type === "error") {
          showError("Voiceでエラーが起きました。もう一度お試しください。");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const abortController = new AbortController();
      abortRef.current = abortController;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
        signal: abortController.signal,
      });
      abortRef.current = null;

      if (operation !== operationRef.current) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || "Voiceに接続できませんでした。");
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        showError("マイクの利用を許可してください。");
        return;
      }
      showError(
        error instanceof Error
          ? error.message
          : "Voiceに接続できませんでした。",
      );
    }
  }, [
    disabled,
    enableMicrophone,
    endpoint,
    setVoiceState,
    showError,
    state,
    teardown,
  ]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const active = state === "connecting" || state === "speaking" || state === "listening";
  const statusText = getStatusText(state, message);

  return (
    <div className={className} style={panelStyle}>
      <button
        type="button"
        className={`${buttonClassName ?? ""} ${active ? activeButtonClassName ?? "" : ""}`.trim() || undefined}
        style={!buttonClassName ? buttonStyle : undefined}
        disabled={disabled}
        aria-pressed={active}
        onClick={active ? stop : start}
      >
        {state === "connecting" ? "つないでいます…" : active ? stopLabel : label}
      </button>
      <p role={state === "error" ? "alert" : "status"} aria-live="polite" style={statusStyle}>
        {statusText}
      </p>
      <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} />
    </div>
  );
}

function getStatusText(state: VoiceState, errorMessage: string) {
  switch (state) {
    case "connecting":
      return "マイクにつないでいます";
    case "speaking":
      return "そばにいます";
    case "listening":
      return "話して大丈夫です";
    case "disabled":
      return "Voiceは準備中です";
    case "error":
      return errorMessage;
    default:
      return "会話はこのアプリに保存しません";
  }
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
