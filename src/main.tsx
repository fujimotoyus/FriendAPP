import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';

// Service Worker を登録する。新しいデプロイを検知したら自動で最新版へ更新する。
//
// vite-plugin-pwa の registerType='autoUpdate' は新しい SW を「待機」させ、
// 次回起動時に切り替える。開いたままの画面には即時反映されないため、
// 以前のデプロイ（旧ロジック）のアプリシェルがキャッシュから配信され続け、
// 「編集で写真が消える」等の旧バグが残ることがあった。
// onNeedRefresh で updateSW(true) を呼び、更新検知時に即座にリロードして
// 最新版へ切り替える（ユーザー操作不要）。
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 新しい Service Worker が利用可能。即時に有効化してページを再読み込みする。
    void updateSW(true);
  },
});

// 端末内データ(IndexedDB / 写真 Blob)が容量逼迫時に退避されにくくなるよう、
// ストレージの永続化を best-effort で要求する。失敗しても無視し、確認ダイアログは出さない
// （要件3.7 の非破壊方針の一環）。
void navigator.storage?.persist?.().catch(() => undefined);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
