import {
  DEFAULT_COUNTRY_CODE,
  DEFAULT_ROOM_ID,
  getPulseStore,
} from "@/lib/server/pulse-store";

export const runtime = "edge";

const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

interface EventPayload {
  event_id?: unknown;
  room_id?: unknown;
  country_code?: unknown;
}

type RequestWithCountry = Request & {
  cf?: { country?: unknown };
};

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  let payload: EventPayload;

  try {
    payload = (await request.json()) as EventPayload;
  } catch {
    return noStoreJson({ error: "JSON body is required" }, { status: 400 });
  }

  const eventId =
    typeof payload.event_id === "string" ? payload.event_id.trim() : "";
  const roomId =
    typeof payload.room_id === "string" && payload.room_id.trim()
      ? payload.room_id.trim()
      : DEFAULT_ROOM_ID;
  const passiveCountry = (request as RequestWithCountry).cf?.country;
  const countryCode =
    typeof passiveCountry === "string" && passiveCountry.trim()
      ? passiveCountry.trim().toUpperCase()
      : typeof payload.country_code === "string" && payload.country_code.trim()
        ? payload.country_code.trim().toUpperCase()
        : DEFAULT_COUNTRY_CODE;

  if (!EVENT_ID_PATTERN.test(eventId)) {
    return noStoreJson(
      { error: "event_id must be 8-128 letters, numbers, underscores, or dashes" },
      { status: 400 },
    );
  }

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return noStoreJson({ error: "invalid room_id" }, { status: 400 });
  }

  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    return noStoreJson({ error: "invalid country_code" }, { status: 400 });
  }

  try {
    const result = await getPulseStore().register(
      { eventId, roomId, countryCode },
      Date.now(),
    );
    return noStoreJson(result, { status: result.registered ? 201 : 200 });
  } catch (error) {
    console.error("Unable to register live event", error);
    return noStoreJson(
      { error: "うんこなうを届けられませんでした。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
