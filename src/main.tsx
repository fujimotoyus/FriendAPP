import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';

// Register the service worker (auto-updates on new deploys).
registerSW({ immediate: true });

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
