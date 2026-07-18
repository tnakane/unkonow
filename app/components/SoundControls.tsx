"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";

export type SoundControlsHandle = {
  playSubmitSound: () => Promise<void>;
  toggleOtohime: () => Promise<void>;
  stopAll: () => void;
};

export type SoundControlsProps = {
  submitSoundSrc?: string;
  otohimeSoundSrc?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  activeButtonClassName?: string;
  label?: string;
  activeLabel?: string;
  otohimeLoop?: boolean;
  onError?: (message: string) => void;
};

export const SoundControls = forwardRef<
  SoundControlsHandle,
  SoundControlsProps
>(function SoundControls(
  {
    submitSoundSrc,
    otohimeSoundSrc,
    disabled = false,
    className,
    buttonClassName,
    activeButtonClassName,
    label = "音姫",
    activeLabel = "音姫をとめる",
    otohimeLoop = true,
    onError,
  },
  ref,
) {
  const submitAudioRef = useRef<HTMLAudioElement | null>(null);
  const otohimeContextRef = useRef<AudioContext | null>(null);
  const otohimeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const otohimeAbortRef = useRef<AbortController | null>(null);
  const otohimeOperationRef = useRef(0);
  const [otohimePlaying, setOtohimePlaying] = useState(false);
  const [message, setMessage] = useState("");

  const reportPlaybackError = useCallback(() => {
    const errorMessage = "音を再生できませんでした。";
    setMessage(errorMessage);
    onError?.(errorMessage);
  }, [onError]);

  const playSubmitSound = useCallback(async () => {
    if (disabled) return;
    const audio = submitAudioRef.current;
    try {
      if (!audio || !submitSoundSrc) {
        await playStampSound();
        return;
      }
      audio.currentTime = 0;
      await audio.play();
    } catch {
      reportPlaybackError();
    }
  }, [disabled, reportPlaybackError, submitSoundSrc]);

  const stopOtohime = useCallback(() => {
    otohimeOperationRef.current += 1;
    otohimeAbortRef.current?.abort();
    otohimeAbortRef.current = null;

    const source = otohimeSourceRef.current;
    otohimeSourceRef.current = null;
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }

    const context = otohimeContextRef.current;
    otohimeContextRef.current = null;
    if (context && context.state !== "closed") {
      void context.close().finally(clearOtohimeSystemSession);
    }
    clearOtohimeSystemSession();
    setOtohimePlaying(false);
  }, []);

  const stopAll = useCallback(() => {
    const submitAudio = submitAudioRef.current;
    if (submitAudio) {
      submitAudio.pause();
      submitAudio.currentTime = 0;
    }
    stopOtohime();
  }, [stopOtohime]);

  const toggleOtohime = useCallback(async () => {
    if (!otohimeSoundSrc || disabled) return;
    if (otohimeContextRef.current) {
      stopOtohime();
      return;
    }

    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
      reportPlaybackError();
      return;
    }

    const operation = otohimeOperationRef.current + 1;
    otohimeOperationRef.current = operation;
    const abortController = new AbortController();
    otohimeAbortRef.current = abortController;
    prepareOtohimeSystemSession();
    const context = new AudioContextClass();
    otohimeContextRef.current = context;

    try {
      setMessage("");
      await context.resume();
      const response = await fetch(otohimeSoundSrc, {
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error("audio unavailable");
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (operation !== otohimeOperationRef.current) return;

      otohimeAbortRef.current = null;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = otohimeLoop;
      source.connect(context.destination);
      source.onended = () => {
        if (otohimeSourceRef.current !== source) return;
        otohimeSourceRef.current = null;
        otohimeContextRef.current = null;
        if (context.state !== "closed") {
          void context.close().finally(clearOtohimeSystemSession);
        }
        clearOtohimeSystemSession();
        setOtohimePlaying(false);
      };
      otohimeSourceRef.current = source;
      source.start();
      setOtohimePlaying(true);
    } catch (error) {
      if (operation !== otohimeOperationRef.current) return;
      otohimeAbortRef.current = null;
      otohimeContextRef.current = null;
      if (context.state !== "closed") {
        void context.close().finally(clearOtohimeSystemSession);
      }
      clearOtohimeSystemSession();
      setOtohimePlaying(false);
      if (error instanceof DOMException && error.name === "AbortError") return;
      reportPlaybackError();
    }
  }, [
    disabled,
    otohimeLoop,
    otohimeSoundSrc,
    reportPlaybackError,
    stopOtohime,
  ]);

  useImperativeHandle(
    ref,
    () => ({ playSubmitSound, toggleOtohime, stopAll }),
    [playSubmitSound, stopAll, toggleOtohime],
  );

  useEffect(() => {
    if (disabled) stopAll();
  }, [disabled, stopAll]);

  useEffect(() => {
    clearOtohimeSystemSession();
    const stopWhenHidden = () => {
      if (document.hidden) stopAll();
    };
    window.addEventListener("pagehide", stopAll);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("pagehide", stopAll);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [stopAll]);

  useEffect(() => stopAll, [stopAll]);

  const unavailable = disabled || !otohimeSoundSrc;

  return (
    <div className={className} style={panelStyle}>
      <button
        type="button"
        className={`${buttonClassName ?? ""} ${otohimePlaying ? activeButtonClassName ?? "" : ""}`.trim() || undefined}
        style={!buttonClassName ? buttonStyle : undefined}
        disabled={unavailable}
        aria-pressed={otohimePlaying}
        onClick={() => void toggleOtohime()}
      >
        {otohimePlaying ? activeLabel : label}
      </button>
      {message ? (
        <p role="alert" style={statusStyle}>
          {message}
        </p>
      ) : null}
      {submitSoundSrc ? (
        <audio ref={submitAudioRef} src={submitSoundSrc} preload="auto" />
      ) : null}
    </div>
  );
});

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.35rem",
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
  margin: 0,
  fontSize: "0.75rem",
  opacity: 0.7,
};

async function playStampSound() {
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  await context.resume();
  const start = context.currentTime;

  const body = context.createOscillator();
  const bodyGain = context.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(145, start);
  body.frequency.exponentialRampToValueAtTime(72, start + 0.105);
  bodyGain.gain.setValueAtTime(0.0001, start);
  bodyGain.gain.exponentialRampToValueAtTime(0.32, start + 0.006);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
  body.connect(bodyGain).connect(context.destination);

  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * 0.055),
    context.sampleRate,
  );
  const noise = buffer.getChannelData(0);
  for (let index = 0; index < noise.length; index += 1) {
    noise[index] = (Math.random() * 2 - 1) * (1 - index / noise.length);
  }

  const impact = context.createBufferSource();
  const impactFilter = context.createBiquadFilter();
  const impactGain = context.createGain();
  impact.buffer = buffer;
  impactFilter.type = "bandpass";
  impactFilter.frequency.value = 1_100;
  impactFilter.Q.value = 0.8;
  impactGain.gain.setValueAtTime(0.14, start);
  impactGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
  impact.connect(impactFilter).connect(impactGain).connect(context.destination);

  body.start(start);
  impact.start(start);
  body.stop(start + 0.18);
  impact.stop(start + 0.06);
  window.setTimeout(() => void context.close(), 260);
}

function getAudioContextClass() {
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

type OtohimeAudioSession = {
  type: "auto" | "ambient";
};

function prepareOtohimeSystemSession() {
  clearMediaSession();
  const audioSession = (
    navigator as Navigator & { audioSession?: OtohimeAudioSession }
  ).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = "ambient";
  } catch {
    // Audio Session API is experimental and may be only partially available.
  }
}

function clearOtohimeSystemSession() {
  clearMediaSession();
  const audioSession = (
    navigator as Navigator & { audioSession?: OtohimeAudioSession }
  ).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = "auto";
  } catch {
    // Audio Session API is experimental and may be only partially available.
  }
}

function clearMediaSession() {
  if (!("mediaSession" in navigator)) return;

  const mediaSession = navigator.mediaSession;
  try {
    mediaSession.playbackState = "none";
  } catch {
    // Some Safari releases expose this property as read-only.
  }
  try {
    mediaSession.metadata = null;
  } catch {
    // Some Safari releases do not allow clearing metadata explicitly.
  }
  try {
    mediaSession.setPositionState();
  } catch {
    // Some Safari releases do not implement position-state clearing.
  }

  const actions: MediaSessionAction[] = [
    "play",
    "pause",
    "stop",
    "seekbackward",
    "seekforward",
    "seekto",
    "previoustrack",
    "nexttrack",
  ];
  actions.forEach((action) => {
    try {
      mediaSession.setActionHandler(action, null);
    } catch {
      // Ignore actions unsupported by this Safari version.
    }
  });
}
