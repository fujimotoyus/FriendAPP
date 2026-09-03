---
inclusion: always
---

# デプロイ / ホスティング メモ

## ホスティング / デプロイ

- ホスティング: Vercel。GitHub リポジトリ fujimotoyus/FriendAPP (origin: https://github.com/fujimotoyus/FriendAPP.git) と連携した自動デプロイ。
- デプロイ方法: main ブランチへ push すると Vercel が自動でビルド・デプロイする。
- ビルドコマンド: npm run build (= vite build のみ。tsc 型チェックは含まない。型チェックは別途 npm run typecheck = tsc -b)。

## 既知の注意点

- (解消済み 2025) 過去に src/hooks/useRegistration.ts に一時デバッグコード (storeErrorDetail state と未定義の readStoreErrorDetail 参照) が残っており、新規登録時に実行時例外 (未定義参照) で登録が失敗していた。該当コードは削除済みで、現在は tsc -b (npm run typecheck) も通る。
- ローカルで npm 実行時は PowerShell の ExecutionPolicy により npm.ps1 がブロックされることがある。その場合は node ./node_modules/vite/bin/vite.js build や node ./node_modules/vitest/vitest.mjs run のように node 経由で直接起動する。

## 外部公開の別手段

- 過去に Cloudflare Tunnel (cloudflared, trycloudflare.com の一時 URL) で開発サーバーを外部公開した記録がある (tunnel.log 参照)。恒久公開は Vercel を使う。

## オフライン / データ

- PWA (vite-plugin-pwa の Service Worker) により初回読み込み後はオフラインで動作する。
- データは端末内のみに保存 (IndexedDB、写真は Blob)。外部サーバーへの同期・送信は行わない。

## 公開 URL

- 公開 URL: https://friend-app-psi.vercel.app/ (サイトタイトル「お友達図鑑」、HTTP 200 を確認済み)。
