---
inclusion: always
---

# デプロイ / ホスティング メモ

## ホスティング / デプロイ

- ホスティング: Vercel。GitHub リポジトリ fujimotoyus/FriendAPP (origin: https://github.com/fujimotoyus/FriendAPP.git) と連携した自動デプロイ。
- デプロイ方法: main ブランチへ push すると Vercel が自動でビルド・デプロイする。
- ビルドコマンド: npm run build (= tsc -b && vite build)。型チェック(tsc -b)を含み、型エラーがあればデプロイは失敗する。型チェック単体は npm run typecheck (= tsc -b)。

## 既知の注意点

- (解消済み 2025) 過去に src/hooks/useRegistration.ts に一時デバッグコード (storeErrorDetail state と未定義の readStoreErrorDetail 参照) が残っており、新規登録時に実行時例外で登録が失敗していた。該当コードは削除済みで、現在は tsc -b も通る。
- package.json は必ず BOM なし UTF-8 で保存する。vite-plugin-pwa が package.json を JSON.parse するため、先頭に BOM があると "Unexpected token ... is not valid JSON" でビルドが失敗する。PowerShell の Set-Content -Encoding utf8 は BOM 付きになるため、package.json の編集には [System.IO.File]::WriteAllText を UTF8Encoding($false) で使うこと。
- ローカルで npm 実行時は PowerShell の ExecutionPolicy により npm.ps1 がブロックされることがある。その場合は node ./node_modules/vite/bin/vite.js build や node ./node_modules/vitest/vitest.mjs run のように node 経由で直接起動する。
- Service Worker は skipWaiting/clientsClaim/cleanupOutdatedCaches を有効化し、main.tsx の onNeedRefresh で自動リロードする。新デプロイは次回アクセス時に即時反映される（旧キャッシュ由来の不具合を防止）。

## 外部公開の別手段

- 過去に Cloudflare Tunnel (cloudflared, trycloudflare.com の一時 URL) で開発サーバーを外部公開した記録がある (tunnel.log 参照)。恒久公開は Vercel を使う。

## オフライン / データ

- PWA (vite-plugin-pwa の Service Worker) により初回読み込み後はオフラインで動作する。
- データは端末内のみに保存 (IndexedDB、写真は Blob)。外部サーバーへの同期・送信は行わない。

## 公開 URL

- 公開 URL: https://friend-app-psi.vercel.app/ (サイトタイトル「お友達図鑑」、HTTP 200 を確認済み)。