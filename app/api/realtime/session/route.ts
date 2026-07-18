import { createRealtimeSessionConfig } from "@/lib/voice/sessionConfig";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const MAX_SDP_BYTES = 64_000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonError(
      503,
      "VOICE_UNAVAILABLE",
      "Voiceは準備中です（APIキーが設定されていません）。",
    );
  }

  if (!isSameOriginRequest(request)) {
    return jsonError(403, "FORBIDDEN", "この接続は利用できません。");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType.startsWith("application/sdp") &&
    !contentType.startsWith("text/plain")
  ) {
    return jsonError(415, "INVALID_CONTENT_TYPE", "SDPが必要です。");
  }

  const sdp = await request.text();
  if (!sdp.startsWith("v=0") || new TextEncoder().encode(sdp).byteLength > MAX_SDP_BYTES) {
    return jsonError(400, "INVALID_SDP", "接続情報が正しくありません。");
  }

  const formData = new FormData();
  formData.set("sdp", sdp);
  formData.set("session", JSON.stringify(createRealtimeSessionConfig()));

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  } catch {
    return jsonError(
      502,
      "VOICE_CONNECTION_FAILED",
      "Voiceに接続できませんでした。もう一度お試しください。",
    );
  }

  if (!upstream.ok) {
    return jsonError(
      upstream.status === 401 ? 503 : 502,
      "VOICE_CONNECTION_FAILED",
      "Voiceに接続できませんでした。もう一度お試しください。",
    );
  }

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "no-store",
    },
  });
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function jsonError(status: number, error: string, message: string) {
  return Response.json(
    { error, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
