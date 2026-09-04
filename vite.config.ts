/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      // アプリシェル(JS/CSS/HTML)に加えてアイコン SVG も precache に含める。
      includeAssets: ['icon.svg'],
      // 新しい Service Worker を即時有効化し、全クライアントを制御下に置く。
      // これにより新デプロイ後に古いアプリシェルがキャッシュから配信され続けるのを防ぐ
      // （main.tsx の onNeedRefresh による自動リロードと合わせて即時反映を保証する）。
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        // 古いバージョンの precache を確実に掃除する。
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'お友達図鑑',
        short_name: 'お友達図鑑',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#ffb6c8',
        background_color: '#fff8f0',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // Cloudflare Tunnel (trycloudflare.com) 経由の一時公開URLからのアクセスを許可する。
    // 動作確認用途。恒久運用時は本番デプロイを推奨。
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
