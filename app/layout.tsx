import type { Metadata } from "next";
import "./globals.css";
import rawGlobalStyles from "./globals.css?raw";

// Keep the product UI usable when mobile Safari fails to apply the emitted
// stylesheet asset. Tailwind's import is build-time only, so omit it here and
// inline the authored application styles as a resilient fallback.
const inlineFallbackStyles = rawGlobalStyles.replace(
  '@import "tailwindcss";',
  "",
);

export const metadata: Metadata = {
  title: {
    default: "うんこなう",
    template: "%s｜うんこなう",
  },
  description: "いま踏ん張る人のための、匿名でゆるいつながり。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <style
          id="inline-app-style-fallback"
          dangerouslySetInnerHTML={{ __html: inlineFallbackStyles }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
