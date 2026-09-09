// Vitest global setup. Extends expect with jest-dom matchers so that
// React Testing Library assertions (toBeInTheDocument 等) are available.
import '@testing-library/jest-dom/vitest';

// jsdom は URL.createObjectURL / revokeObjectURL を実装しないため、PhotoFrame の
// useEffect（Blob → Object URL 生成）がコンポーネントテストで実行時例外になる。
// 表示の実体は検証対象ではない（写真デコードは jsdom では行われない）ため、
// テスト環境ではダミー実装を用意して例外を防ぐ。値自体はテストで検証しない。
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:test-object-url';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
