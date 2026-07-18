import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production build contains the unko now experience", async () => {
  const clientBundle = await readFile(
    new URL("../dist/client/assets/UnkoNowClient-C1gVYQr6.js", import.meta.url),
    "utf8",
  ).catch(async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../dist/client/.vite/manifest.json", import.meta.url), "utf8"),
    );
    const entry = Object.values(manifest).find((item) =>
      String(item?.src ?? "").includes("UnkoNowClient"),
    );
    assert.ok(entry?.file, "UnkoNowClient build entry is missing");
    return readFile(new URL(`../dist/client/${entry.file}`, import.meta.url), "utf8");
  });

  assert.match(clientBundle, /うんこなう/);
  assert.match(clientBundle, /花まる/);
  assert.match(clientBundle, /おと姫/);
  assert.match(clientBundle, /日本でいま/);
  assert.match(clientBundle, /どうしたの、話聞くよ/);
  assert.doesNotMatch(clientBundle, /この会場/);
  assert.match(clientBundle, /カーボベルデ/);
  assert.match(clientBundle, /playStampSound|AudioContext/);
});

test("production build packages the cleared audio and D1 migration", async () => {
  const audio = await stat(new URL("../dist/client/sounds/otohime.m4a", import.meta.url));
  assert.ok(audio.size > 100_000, "recorded water audio was not packaged");

  const migration = await readFile(
    new URL("../dist/.openai/drizzle/0000_outstanding_zeigeist.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE `poop_events`/);
});
