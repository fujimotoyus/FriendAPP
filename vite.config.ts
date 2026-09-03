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
      manifest: {
        name: 'お友達図鑑',
        short_name: 'お友達図鑑',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#ffb6c8',
        background_color: '#fff8f0',
        icons: [],
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

