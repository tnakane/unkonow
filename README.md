# うんこなう

> ひとりだけど、ひとりじゃない。

排便中の孤独を、匿名でゆるい連帯に変えるワンタップ体験です。大きな「うんこなう」ボタンを押すと、同じ10分間に参加している日本と会場の人数が更新されます。つらいときはOpenAI Realtime APIのVoiceが最初から優しく声をかけます。

## Prerequisites

- Node.js `>=22.13.0`

## ローカル起動

```bash
npm install
npm run db:generate
npm run dev
npm run build
npm test
```

`http://localhost:3000/?room=buildweek-tokyo` が参加者用、`http://localhost:3000/?stage=1&room=buildweek-tokyo` が発表用です。発表用画面のQRコードから参加者用画面が開きます。

## 環境変数

`.env.example` を参考に、公開先のSecretとして `OPENAI_API_KEY` を設定してください。キーはブラウザには渡さず、VoiceのWebRTCセッションと世界実況の生成はサーバー経由で行います。

## 音源

以下のファイルを置くと音が有効になります。

- 「うんこなう」の送信音はWeb Audioで合成する短いハンコ音です。
- `public/sounds/otohime.m4a`: 「おと姫」ボタンで再生・停止する流水音

第三者製品の録音を公開する前に、録音場所の規約と権利関係を確認してください。デモでは自分で録った一般的な流水音、または自作音源を推奨します。

## データとプライバシー

- タップはランダムなイベントID、会場ID、受動的に判定できた国コード、時刻だけを保存します。
- イベントは10分で集計対象から外れます。
- IPアドレス、正確な位置、氏名、ユーザーエージェントは保存しません。
- Voiceの音声と会話内容はアプリ側で保存しません。
- 世界の国カードは明示したデモデータです。会場の人数だけがライブデータです。

## 構成

- UI: Next.js / React（vinext）
- リアルタイム人数: 0.9秒（発表画面）または2.5秒（参加画面）の軽量ポーリング
- 永続化: Cloudflare D1 / Drizzle。ローカルではインメモリにフォールバック
- Voice: OpenAI Realtime API + WebRTC
- 世界実況: OpenAI Responses API。APIキー未設定時は用意済みコピーへフォールバック
- ホスティング: OpenAI Sites

## 主なAPI

- `POST /api/events`: タップを冪等に登録
- `GET /api/pulse?room_id=buildweek-tokyo`: 現在人数と最新参加を取得
- `POST /api/realtime/session`: Realtime WebRTC接続をサーバー側で確立
- `POST /api/narrate`: 発表画面用の短い世界実況を生成

本番では `.openai/hosting.json` の `DB` バインディングをSitesが注入します。
