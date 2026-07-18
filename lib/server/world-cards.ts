export interface WorldCard {
  flag: string;
  country: string;
  message: string;
  source: "synthetic";
}

const WORLD_CARDS: readonly WorldCard[] = [
  {
    flag: "🇮🇸",
    country: "アイスランド",
    message: "北の島から、ひとつのうんこなう。",
    source: "synthetic",
  },
  {
    flag: "🇺🇾",
    country: "ウルグアイ",
    message: "地球の反対側から、うんこなうが届きました。",
    source: "synthetic",
  },
  {
    flag: "🇪🇪",
    country: "エストニア",
    message: "バルト海のほとりから、静かなうんこなう。",
    source: "synthetic",
  },
  {
    flag: "🇳🇦",
    country: "ナミビア",
    message: "遠い空の下でも、誰かがうんこなう。",
    source: "synthetic",
  },
  {
    flag: "🇼🇸",
    country: "サモア",
    message: "太平洋の島から、今日のうんこなう。",
    source: "synthetic",
  },
] as const;

const CARD_ROTATION_MS = 6_000;

export function getWorldCard(now = Date.now()): WorldCard {
  const index = Math.floor(now / CARD_ROTATION_MS) % WORLD_CARDS.length;
  return WORLD_CARDS[index];
}
