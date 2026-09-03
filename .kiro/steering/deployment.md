---
inclusion: always
---

# デプロイ / ホスティング メモ

## ホスティング / デプロイ

- ホスティング: Vercel。GitHub リポジトリ fujimotoyus/FriendAPP (origin: https://github.com/fujimotoyus/FriendAPP.git) と連携した自動デプロイ。
- デプロイ方法: main ブランチへ push すると Vercel が自動でビルド・デプロイする。
- ビルドコマンド: npm run build (= vite build のみ。tsc 型チェックは含まない。型チェックは別途 npm run typecheck = tsc -b)。

## 既知の注意点

- src/hooks/useRegistration.ts に一時デバッグコード (storeErrorDetail state と未定義の readStoreErrorDetail 参照) が残っている。そのため tsc -b (npm run typecheck) は失敗するが、Vercel のビルドは vite build のみなので公開デプロイには影響しない。将来クリーンアップする場合はここを参照。

## 外部公開の別手段

- 過去に Cloudflare Tunnel (cloudflared, trycloudflare.com の一時 URL) で開発サーバーを外部公開した記録がある (tunnel.log 参照)。恒久公開は Vercel を使う。

## オフライン / データ

- PWA (vite-plugin-pwa の Service Worker) により初回読み込み後はオフラインで動作する。
- データは端末内のみに保存 (IndexedDB、写真は Blob)。外部サーバーへの同期・送信は行わない。

## 公開 URL

- 公開 URL は未確認 (TODO: ユーザーに確認して追記)。過去の疎通確認ログ (vercelcheck.log) ではサイトタイトルが「お友達図鑑」で HTTP 200 を返していた。
