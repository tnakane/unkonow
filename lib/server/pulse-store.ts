import { getD1Binding } from "@/db";

export const DEFAULT_ROOM_ID = "buildweek-tokyo";
export const DEFAULT_COUNTRY_CODE = "JP";
export const PRESENCE_WINDOW_MS = 10 * 60 * 1000;

export interface LiveEventInput {
  eventId: string;
  roomId: string;
  countryCode: string;
}

export interface LatestLiveEvent {
  country: string;
  countryCode: string;
  roomId: string;
  createdAt: number;
  source: "live";
}

export interface PulseCounts {
  japanNow: number;
  roomNow: number;
  latestLiveEvent: LatestLiveEvent | null;
}

export interface RegisterResult extends PulseCounts {
  registered: boolean;
  eventId: string;
}

interface StoredEvent extends LiveEventInput {
  createdAt: number;
  expiresAt: number;
  source: "live";
}

interface D1CountRow {
  japan_now: number | string | null;
  room_now: number | string | null;
}

interface D1LatestRow {
  country_code: string;
  room_id: string;
  created_at: number;
}

interface PulseStore {
  register(input: LiveEventInput, now: number): Promise<RegisterResult>;
  read(roomId: string, now: number): Promise<PulseCounts>;
}

const COUNTRY_NAMES: Record<string, string> = {
  JP: "日本",
};

function toLatestEvent(row: D1LatestRow | StoredEvent): LatestLiveEvent {
  const countryCode =
    "country_code" in row ? row.country_code : row.countryCode;
  const roomId = "room_id" in row ? row.room_id : row.roomId;
  const createdAt = "created_at" in row ? row.created_at : row.createdAt;

  return {
    country: COUNTRY_NAMES[countryCode] ?? countryCode,
    countryCode,
    roomId,
    createdAt: Number(createdAt),
    source: "live",
  };
}

class D1PulseStore implements PulseStore {
  constructor(private readonly d1: D1Database) {}

  async register(input: LiveEventInput, now: number): Promise<RegisterResult> {
    await this.deleteExpired(now);

    const inserted = await this.d1
      .prepare(
        `INSERT OR IGNORE INTO poop_events
          (event_id, room_id, country_code, created_at, expires_at, source)
         VALUES (?, ?, ?, ?, ?, 'live')`,
      )
      .bind(
        input.eventId,
        input.roomId,
        input.countryCode,
        now,
        now + PRESENCE_WINDOW_MS,
      )
      .run();

    const counts = await this.read(input.roomId, now);

    return {
      ...counts,
      registered: Number(inserted.meta.changes ?? 0) > 0,
      eventId: input.eventId,
    };
  }

  async read(roomId: string, now: number): Promise<PulseCounts> {
    const windowStart = now - PRESENCE_WINDOW_MS;

    const row = await this.d1
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN country_code = 'JP' THEN 1 ELSE 0 END), 0) AS japan_now,
           COALESCE(SUM(CASE WHEN room_id = ? THEN 1 ELSE 0 END), 0) AS room_now
         FROM poop_events
         WHERE created_at >= ? AND expires_at > ? AND source = 'live'`,
      )
      .bind(roomId, windowStart, now)
      .first<D1CountRow>();

    const latest = await this.d1
      .prepare(
        `SELECT country_code, room_id, created_at
         FROM poop_events
         WHERE created_at >= ? AND expires_at > ? AND source = 'live'
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .bind(windowStart, now)
      .first<D1LatestRow>();

    return {
      japanNow: Number(row?.japan_now ?? 0),
      roomNow: Number(row?.room_now ?? 0),
      latestLiveEvent: latest ? toLatestEvent(latest) : null,
    };
  }

  private async deleteExpired(now: number) {
    await this.d1
      .prepare("DELETE FROM poop_events WHERE expires_at <= ?")
      .bind(now)
      .run();
  }
}

const memoryState = globalThis as typeof globalThis & {
  __unkoNowEvents?: Map<string, StoredEvent>;
};

class MemoryPulseStore implements PulseStore {
  private readonly events =
    memoryState.__unkoNowEvents ??
    (memoryState.__unkoNowEvents = new Map<string, StoredEvent>());

  async register(input: LiveEventInput, now: number): Promise<RegisterResult> {
    this.deleteExpired(now);
    const registered = !this.events.has(input.eventId);

    if (registered) {
      this.events.set(input.eventId, {
        ...input,
        createdAt: now,
        expiresAt: now + PRESENCE_WINDOW_MS,
        source: "live",
      });
    }

    return {
      ...(await this.read(input.roomId, now)),
      registered,
      eventId: input.eventId,
    };
  }

  async read(roomId: string, now: number): Promise<PulseCounts> {
    this.deleteExpired(now);
    const windowStart = now - PRESENCE_WINDOW_MS;
    const active = [...this.events.values()].filter(
      (event) => event.createdAt >= windowStart && event.expiresAt > now,
    );
    const latest = active.reduce<StoredEvent | null>(
      (current, event) =>
        !current || event.createdAt > current.createdAt ? event : current,
      null,
    );

    return {
      japanNow: active.filter((event) => event.countryCode === "JP").length,
      roomNow: active.filter((event) => event.roomId === roomId).length,
      latestLiveEvent: latest ? toLatestEvent(latest) : null,
    };
  }

  private deleteExpired(now: number) {
    for (const [eventId, event] of this.events) {
      if (event.expiresAt <= now) this.events.delete(eventId);
    }
  }
}

const localStore = new MemoryPulseStore();

export function getPulseStore(): PulseStore {
  const d1 = getD1Binding();
  return d1 ? new D1PulseStore(d1) : localStore;
}
