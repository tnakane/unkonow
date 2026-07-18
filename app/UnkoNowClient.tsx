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
  { flag: "🇮🇸", country: "アイスランド", message: "北の島から、そっとひとつ。" },
  { flag: "🇺🇾", country: "ウルグアイ", message: "地球の向こうから、ひとつ。" },
  { flag: "🇪🇪", country: "エストニア", message: "バルト海のほとりから、いま。" },
  { flag: "🇳🇦", country: "ナミビア", message: "遠い空の下から、ひとつ。" },
  { flag: "🇼🇸", country: "サモア", message: "太平洋の島から、今日のひとつ。" },
  { flag: "🇧🇹", country: "ブータン", message: "山あいの国から、ひとつ。" },
  { flag: "🇬🇪", country: "ジョージア", message: "黒海の東から、うんこなう。" },
  { flag: "🇷🇼", country: "ルワンダ", message: "赤道の少し南から、いま。" },
  { flag: "🇸🇮", country: "スロベニア", message: "小さな国から、大切なひとつ。" },
  { flag: "🇲🇳", country: "モンゴル", message: "広い空の下から、ひとつ。" },
  { flag: "🇨🇷", country: "コスタリカ", message: "中米から、静かな知らせです。" },
  { flag: "🇲🇹", country: "マルタ", message: "地中海の島から、ひとつ。" },
  { flag: "🇫🇯", country: "フィジー", message: "南太平洋から、うんこなう。" },
  { flag: "🇱🇹", country: "リトアニア", message: "北東ヨーロッパから、いま。" },
  { flag: "🇧🇼", country: "ボツワナ", message: "南部アフリカから、ひとつ。" },
  { flag: "🇱🇦", country: "ラオス", message: "メコン川の国から、そっと。" },
  { flag: "🇸🇷", country: "スリナム", message: "南米の北から、届きました。" },
  { flag: "🇨🇻", country: "カーボベルデ", message: "大西洋の島々から、ひとつ。" },
  { flag: "🇳🇵", country: "ネパール", message: "山の国から、うんこなう。" },
  { flag: "🇫🇮", country: "フィンランド", message: "北のほうで、いまひとつ。" },
  { flag: "🇳🇿", country: "ニュージーランド", message: "海の向こうから、届きました。" },
  { flag: "🇦🇱", country: "アルバニア", message: "アドリア海の東から、ひとつ。" },
  { flag: "🇧🇿", country: "ベリーズ", message: "カリブ海のそばから、いま。" },
  { flag: "🇲🇩", country: "モルドバ", message: "東ヨーロッパから、そっとひとつ。" },
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

function createEventId() {
  if (typeof window === "undefined") return "";
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function UnkoNowClient() {
  const [japanNow, setJapanNow] = useState<number | null>(null);
  const [floatingPulses, setFloatingPulses] = useState<FloatingPulse[]>([]);
  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stampKey, setStampKey] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [pageUrl, setPageUrl] = useState("このページのURL");
  const [isStage, setIsStage] = useState(false);
  const latestLiveKey = useRef("");
  const hasInitialPulse = useRef(false);
  const pendingEventId = useRef("");
  const narratedCountries = useRef(new Set<string>());
  const pulseSequence = useRef(0);
  const pulseTimers = useRef(new Set<number>());
  const latestWorldPulse = useRef<PulseCard | null>(null);
  const lastWorldPulse = useRef<Pick<PulseCard, "country" | "message"> | null>(null);
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

      const live = data.latestLiveEvent;
      const key = String(live?.id ?? live?.createdAt ?? "");
      if (key && key !== latestLiveKey.current) {
        latestLiveKey.current = key;
        if (hasInitialPulse.current) showLiveArrival(count);
      }
      hasInitialPulse.current = true;

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
    const fastPoll = stage || window.matchMedia("(min-width: 851px)").matches;
    const poll = window.setInterval(() => void fetchPulse(), fastPoll ? 900 : 2500);
    return () => window.clearInterval(poll);
  }, [fetchPulse]);

  const showWorldPulse = useCallback(async (fallback: PulseCard) => {
    const serverCard = latestWorldPulse.current;
    latestWorldPulse.current = null;
    const offset = pulseSequence.current % WORLD_PULSES.length;
    const candidates = [
      serverCard,
      fallback,
      ...WORLD_PULSES.slice(offset),
      ...WORLD_PULSES.slice(0, offset),
    ].filter((card): card is PulseCard => Boolean(card));
    const previous = lastWorldPulse.current;
    const nextCard =
      candidates.find(
        (card) => card.country !== previous?.country && card.message !== previous?.message,
      ) ?? fallback;
    lastWorldPulse.current = {
      country: nextCard.country,
      message: nextCard.message,
    };
    const id = pushFloatingPulse(nextCard);

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
    setJapanNow((value) => (value ?? 0) + 1);
    setJoined(true);

    try {
      const eventId = pendingEventId.current || createEventId();
      pendingEventId.current = eventId;
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, room_id: roomId }),
      });
      if (!response.ok) throw new Error("submit unavailable");
      const data = (await response.json()) as PulseResponse;
      pendingEventId.current = "";
      updateFromPulse(data);
    } catch {
      setJapanNow(previousJapan);
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
        <div className="live-count" aria-live="polite">
          <span>🇯🇵 日本でいま</span>
          <strong>{japanNow ?? "—"}人</strong>
        </div>

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

        <div className={`voice-note ${voiceState === "speaking" ? "is-open" : ""}`} aria-hidden={voiceState !== "speaking"}>
          <span className="voice-orb" aria-hidden="true" />
          <div>
            <strong>どうしたの、話聞くよ</strong>
            <p>固定音声です。マイクは使いません。</p>
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
