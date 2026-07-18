"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SoundControls, type SoundControlsHandle } from "./components/SoundControls";
import { VoicePanel, type VoiceState } from "./components/VoicePanel";

type PulseCard = {
  flag: string;
  country: string;
  message: string;
  live?: boolean;
};

type FloatingPulse = PulseCard & {
  id: number;
  slot: number;
  local?: boolean;
};

type PulseResponse = {
  japanNow?: number;
  roomNow?: number;
  count?: number;
  worldCard?: Partial<PulseCard> | null;
  latestLiveEvent?: {
    id?: string;
    country?: string;
    countryCode?: string;
    createdAt?: string | number;
  } | null;
};

type NarrationResponse = {
  message?: string;
};

const WORLD_PULSES: PulseCard[] = [
  {
    flag: "🇮🇸",
    country: "アイスランド",
    message: "朝の静かな一件です。",
  },
  {
    flag: "🇺🇾",
    country: "ウルグアイ",
    message: "夜更けに、ひとつ。",
  },
  {
    flag: "🇳🇵",
    country: "ネパール",
    message: "山の国から、ひとつ。",
  },
  {
    flag: "🇫🇮",
    country: "フィンランド",
    message: "北のほうで、いま。",
  },
  {
    flag: "🇳🇿",
    country: "ニュージーランド",
    message: "海の向こうから、ひとつ。",
  },
];

const JP_LIVE_CARD: PulseCard = {
  flag: "🇯🇵",
  country: "日本",
  message: "いま、ひとつ。",
  live: true,
};

function roomFromLocation() {
  if (typeof window === "undefined") return "buildweek-tokyo";
  return new URLSearchParams(window.location.search).get("room") ?? "buildweek-tokyo";
}

function audienceUrlFromLocation() {
  const url = new URL(window.location.href);
  url.searchParams.delete("stage");
  url.searchParams.set("room", roomFromLocation());
  return url.toString();
}

function stableEventId() {
  if (typeof window === "undefined") return "";
  const key = "unkonow-event-id";
  const previous = window.sessionStorage.getItem(key);
  if (previous) return previous;
  const next =
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

export function UnkoNowClient() {
  const [japanNow, setJapanNow] = useState<number | null>(null);
  const [roomNow, setRoomNow] = useState<number | null>(null);
  const [floatingPulses, setFloatingPulses] = useState<FloatingPulse[]>([]);
  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [pageUrl, setPageUrl] = useState("このページのURL");
  const [isStage, setIsStage] = useState(false);
  const latestLiveKey = useRef("");
  const narratedCountries = useRef(new Set<string>());
  const pulseSequence = useRef(0);
  const pulseTimers = useRef(new Set<number>());
  const latestWorldPulse = useRef<PulseCard | null>(null);
  const soundControls = useRef<SoundControlsHandle | null>(null);
  const roomId = useMemo(roomFromLocation, []);

  const pushFloatingPulse = useCallback((nextCard: PulseCard, local = false) => {
    const sequence = pulseSequence.current++;
    const id = Date.now() * 10 + (sequence % 10);
    const nextPulse: FloatingPulse = {
      ...nextCard,
      id,
      local,
      slot: sequence % 8,
    };

    setFloatingPulses((current) => [...current.slice(-3), nextPulse]);
    const timer = window.setTimeout(() => {
      setFloatingPulses((current) => current.filter((pulse) => pulse.id !== id));
      pulseTimers.current.delete(timer);
    }, local ? 5600 : 5000);
    pulseTimers.current.add(timer);
    return id;
  }, []);

  const showLiveArrival = useCallback((count?: number) => {
    pushFloatingPulse(
      {
        ...JP_LIVE_CARD,
        message: typeof count === "number" ? `いま ${count}人` : JP_LIVE_CARD.message,
      },
      true,
    );
  }, [pushFloatingPulse]);

  const updateFromPulse = useCallback(
    (data: PulseResponse) => {
      const count = data.japanNow ?? data.count;
      if (typeof count === "number") setJapanNow(count);
      if (typeof data.roomNow === "number") setRoomNow(data.roomNow);

      const live = data.latestLiveEvent;
      const key = String(live?.id ?? live?.createdAt ?? "");
      if (key && key !== latestLiveKey.current) {
        const hadPrevious = Boolean(latestLiveKey.current);
        latestLiveKey.current = key;
        if (hadPrevious) showLiveArrival(count);
      }

      if (data.worldCard?.country && data.worldCard.message) {
        latestWorldPulse.current = {
          flag: data.worldCard.flag ?? "🌏",
          country: data.worldCard.country,
          message: data.worldCard.message,
          live: data.worldCard.live,
        };
      }
    },
    [showLiveArrival],
  );

  const fetchPulse = useCallback(async () => {
    try {
      const response = await fetch(`/api/pulse?room_id=${encodeURIComponent(roomId)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("pulse unavailable");
      updateFromPulse((await response.json()) as PulseResponse);
    } catch {
      // The three primary controls remain usable while polling reconnects.
    }
  }, [roomId, updateFromPulse]);

  useEffect(() => {
    const stage = new URLSearchParams(window.location.search).get("stage") === "1";
    setPageUrl(audienceUrlFromLocation());
    setIsStage(stage);
    void fetchPulse();
    const poll = window.setInterval(() => void fetchPulse(), stage ? 900 : 2500);
    return () => window.clearInterval(poll);
  }, [fetchPulse]);

  const showWorldPulse = useCallback(async (fallback: PulseCard) => {
    const nextCard = latestWorldPulse.current ?? fallback;
    const id = pushFloatingPulse(nextCard);
    latestWorldPulse.current = null;

    if (!isStage || narratedCountries.current.has(nextCard.country)) return;
    narratedCountries.current.add(nextCard.country);

    try {
      const response = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: nextCard.country,
          flag: nextCard.flag,
          fallback: nextCard.message,
        }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as NarrationResponse;
      if (!data.message) return;
      setFloatingPulses((current) =>
        current.map((pulse) =>
          pulse.id === id ? { ...pulse, message: data.message! } : pulse,
        ),
      );
    } catch {
      // Curated copy remains visible when narration is unavailable.
    }
  }, [isStage, pushFloatingPulse]);

  useEffect(() => {
    let index = 0;
    let rotation: number | null = null;
    const firstPulse = window.setTimeout(() => {
      void showWorldPulse(WORLD_PULSES[index]);
      rotation = window.setInterval(() => {
        index = (index + 1) % WORLD_PULSES.length;
        void showWorldPulse(WORLD_PULSES[index]);
      }, 2800);
    }, 1500);

    return () => {
      window.clearTimeout(firstPulse);
      if (rotation) window.clearInterval(rotation);
    };
  }, [showWorldPulse]);

  useEffect(() => {
    return () => {
      pulseTimers.current.forEach((timer) => window.clearTimeout(timer));
      pulseTimers.current.clear();
      soundControls.current?.stopAll();
    };
  }, []);

  const joinNow = async () => {
    if (submitting) return;
    setStampKey((key) => key + 1);
    navigator.vibrate?.([14, 28, 16]);
    void soundControls.current?.playSubmitSound();
    if (joined) return;

    setSubmitting(true);

    const previousJapan = japanNow;
    const previousRoom = roomNow;
    setJapanNow((value) => (value ?? 0) + 1);
    setRoomNow((value) => (value ?? 0) + 1);
    setJoined(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: stableEventId(), room_id: roomId }),
      });
      if (!response.ok) throw new Error("submit unavailable");
      const data = (await response.json()) as PulseResponse;
      updateFromPulse(data);
    } catch {
      setJapanNow(previousJapan);
      setRoomNow(previousRoom);
      setJoined(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="unko-shell">
      <div className="pulse-cloud" aria-live="polite" aria-atomic="false">
        {floatingPulses.map((pulse) => (
          <article
            className={`floating-pulse pulse-slot-${pulse.slot} ${pulse.local ? "is-local" : ""}`}
            key={pulse.id}
          >
            <span className="floating-flag" role="img" aria-label={`${pulse.country}の旗`}>
              {pulse.flag}
            </span>
            <span className="floating-copy">
              <strong>{pulse.country}</strong>
              <small>{pulse.message}</small>
            </span>
          </article>
        ))}
      </div>

      <section className="experience" id="top">
        <div className="action-stage">
          {stampKey > 0 ? (
            <span
              className="hanamaru"
              key={stampKey}
            aria-hidden="true"
            onAnimationEnd={() => setStampKey(0)}
          >
              <strong>花まる</strong>
              <small>よくできました</small>
            </span>
          ) : null}
          <button
            className="unko-button"
            type="button"
            onClick={joinNow}
            disabled={submitting}
            aria-label={joined ? "うんこなうは送信済み" : "うんこなうを送信"}
          >
            <span className="unko-main-label">うんこなう</span>
          </button>
        </div>

        <div className="secondary-actions">
          <VoicePanel
            className="integrated-control voice-control"
            buttonClassName="sub-action integrated-button"
            activeButtonClassName="is-active"
            label="つらいので話す"
            stopLabel="話すのをやめる"
            onStateChange={(state) => {
              setVoiceState(state);
              if (state !== "idle" && state !== "disabled" && state !== "error") {
                navigator.vibrate?.(12);
              }
            }}
          />
          <SoundControls
            ref={soundControls}
            className="integrated-control sound-control"
            buttonClassName="sub-action integrated-button"
            activeButtonClassName="is-active"
            otohimeSoundSrc="/sounds/otohime.m4a"
            label="おと姫"
            activeLabel="おと姫を止める"
          />
        </div>

        <div className={`voice-note ${voiceState === "speaking" || voiceState === "listening" ? "is-open" : ""}`} aria-hidden={voiceState !== "speaking" && voiceState !== "listening"}>
          <span className="voice-orb" aria-hidden="true" />
          <div>
            <strong>{voiceState === "speaking" ? "大丈夫。ここにいます。" : "話して大丈夫です。"}</strong>
            <p>会話はこのアプリに保存しません。</p>
          </div>
        </div>
      </section>

      {isStage ? (
        <aside className="qr-panel" aria-label="会場参加用QRコード">
          <div className="qr-placeholder">
            {pageUrl.startsWith("http") ? (
              <img
                src={`https://quickchart.io/qr?size=180&margin=1&text=${encodeURIComponent(pageUrl)}`}
                alt="スマホ参加用QRコード"
              />
            ) : (
              <span aria-hidden="true">QR</span>
            )}
          </div>
          <div>
            <strong>スマホで参加</strong>
            <small>{pageUrl.replace(/^https?:\/\//, "")}</small>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
