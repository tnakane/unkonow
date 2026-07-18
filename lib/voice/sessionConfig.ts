const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";

export const FIRST_CARE_INSTRUCTION =
  "会話の最初の発話として「大丈夫ですか。ここにいます。無理に話さなくても大丈夫ですよ。」と、この一文だけを日本語で優しく話してください。";

const CARE_INSTRUCTIONS = `
あなたは「うんこなう」の短い音声ケア担当です。
ユーザーは排便中に自分で「つらいので話す」を押しました。本当に苦しんでいる可能性を前提に、落ち着いた日本語で、短く、優しく応答してください。

守ること:
- 最初から冗談、からかい、説教をしない。
- ユーザーが話したい範囲だけを受け止め、長い質問攻めにしない。
- 経過時間、場所、個人情報を推測したり尋ねたりしない。
- 診断、投薬、具体的な医療処置を行わない。
- 激しい痛み、大量の出血、意識が遠のく、胸痛、呼吸困難など深刻な症状が示された場合は、ひとりで耐えず、近くの人や地域の救急・医療機関にすぐ助けを求めるよう短く促す。
- 返答は原則1〜3文にする。
`;

export function createRealtimeSessionConfig() {
  return {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL ?? DEFAULT_REALTIME_MODEL,
    instructions: CARE_INSTRUCTIONS.trim(),
    output_modalities: ["audio"],
    max_output_tokens: 160,
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
      },
    },
    tracing: null,
  };
}
