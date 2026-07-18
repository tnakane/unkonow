import type { Metadata } from "next";
import { UnkoNowClient } from "./UnkoNowClient";

export const metadata: Metadata = {
  title: { absolute: "うんこなう" },
  description: "ひとりだけど、ひとりじゃない。いま踏ん張る人のための、ゆるいつながり。",
};

export default function Home() {
  return <UnkoNowClient />;
}
