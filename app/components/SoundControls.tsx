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
  const otohimeAudioRef = useRef<HTMLAudioElement | null>(null);
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

  const stopAll = useCallback(() => {
    [submitAudioRef.current, otohimeAudioRef.current].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    });
    setOtohimePlaying(false);
  }, []);

  const toggleOtohime = useCallback(async () => {
    const audio = otohimeAudioRef.current;
    if (!audio || !otohimeSoundSrc || disabled) return;

    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      setOtohimePlaying(false);
      return;
    }

    try {
      setMessage("");
      audio.currentTime = 0;
      await audio.play();
      setOtohimePlaying(true);
    } catch {
      setOtohimePlaying(false);
      reportPlaybackError();
    }
  }, [disabled, otohimeSoundSrc, reportPlaybackError]);

  useImperativeHandle(
    ref,
    () => ({ playSubmitSound, toggleOtohime, stopAll }),
    [playSubmitSound, stopAll, toggleOtohime],
  );

  useEffect(() => {
    if (disabled) stopAll();
  }, [disabled, stopAll]);

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
      {otohimeSoundSrc ? (
        <audio
          ref={otohimeAudioRef}
          src={otohimeSoundSrc}
          preload="auto"
          loop={otohimeLoop}
          onEnded={() => setOtohimePlaying(false)}
        />
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
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
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
