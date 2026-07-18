import {
  DEFAULT_ROOM_ID,
  getPulseStore,
} from "@/lib/server/pulse-store";
import { getWorldCard } from "@/lib/server/world-cards";

export const runtime = "edge";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedRoom =
    url.searchParams.get("room_id") ?? url.searchParams.get("room");
  const roomId =
    requestedRoom && ROOM_ID_PATTERN.test(requestedRoom)
      ? requestedRoom
      : DEFAULT_ROOM_ID;
  const now = Date.now();

  try {
    const pulse = await getPulseStore().read(roomId, now);
    return Response.json(
      {
        ...pulse,
        worldCard: getWorldCard(now),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to read live pulse", error);
    return Response.json(
      { error: "最新のうんこなうを取得できませんでした。" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
