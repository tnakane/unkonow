const RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEMO_COUNTRIES = new Set([
  "アイスランド",
  "ウルグアイ",
  "ネパール",
  "フィンランド",
  "ニュージーランド",
]);

const narrationState = globalThis as typeof globalThis & {
  __unkoNowNarrations?: Map<string, string>;
};
const narrationCache =
  narrationState.__unkoNowNarrations ??
  (narrationState.__unkoNowNarrations = new Map<string, string>());

type NarrateBody = {
  country?: unknown;
  flag?: unknown;
  fallback?: unknown;
};

type ResponsesPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as NarrateBody;
  const country = clean(body.country, 40);
  const flag = clean(body.flag, 8);
  const fallback = clean(body.fallback, 80) || "遠くから、うんこなうが届きました。";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!country || !DEMO_COUNTRIES.has(country) || !apiKey) {
    return Response.json(
      { message: fallback, generatedBy: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const cached = narrationCache.get(country);
  if (cached) {
    return Response.json(
      { message: cached, generatedBy: "gpt-5.6-cache" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upstream = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.6",
        store: false,
        max_output_tokens: 80,
        instructions:
          "あなたは『うんこなう』の世界実況担当です。与えられた国について、誰かが今そっと参加したことを伝える、温かく少し可笑しい日本語を一文だけ書いてください。国民性、文化、健康、排便習慣を推測・断定しないでください。24文字程度、絵文字と引用符なし。",
        input: `${flag} ${country}から匿名の参加が1件届きました。`,
      }),
    });

    if (!upstream.ok) throw new Error("narration failed");
    const data = (await upstream.json()) as ResponsesPayload;
    const text = data.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text")
      ?.text?.trim();

    const message = clean(text, 80) || fallback;
    narrationCache.set(country, message);

    return Response.json(
      { message, generatedBy: "gpt-5.6" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { message: fallback, generatedBy: "fallback" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength)
    : "";
}
