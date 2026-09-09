/**
 * deriveFavoriteLevelDisplay — お気に入り度の表示モデル導出（純粋 TypeScript ドメインモジュール）
 *
 * お気に入り度（Favorite_Level）を、色/記号のみに依存せず度合いを判別できる形で表示する
 * ための表示モデルを導出する（要件12）。React / DOM / IndexedDB に依存しない純粋関数であり、
 * property-based testing の対象である（Correctness Property 19）。
 *
 * - `favoriteLevel` が 1〜5 の整数（`Number.isInteger` かつ 1..5）→ `filled = favoriteLevel`。要件12.1, 12.3
 * - 範囲外・未設定・非整数・NaN 等、数値として解釈できない/範囲を外れる値 → `filled = 0`。要件12.4
 * - `total` は常に 5（5 段階固定）。
 * - `textEquivalent` は `5段階中${filled}`（色/記号に依存しないテキスト等価物）。要件12.3, 12.4
 *
 * 参照: design.md「Domain 層 / deriveFavoriteLevelDisplay」、要件12.1, 12.3, 12.4、Correctness Property 19
 */

/** お気に入り度の表示モデル。塗り記号 `filled` 個・合計 `total`（=5）個で度合いを表す。 */
export interface FavoriteLevelDisplay {
  /** 塗り記号の個数（1〜5 の整数のとき当該値、そうでなければ 0）。 */
  filled: number;
  /** 記号の合計個数。常に 5（5 段階固定）。 */
  total: 5;
  /** 色/記号に依存しないテキスト等価物。`5段階中${filled}`。 */
  textEquivalent: string;
}

/**
 * お気に入り度から表示モデルを導出する純粋関数。
 * 要件12.1/12.3/12.4 の分岐に従う（Correctness Property 19）。
 */
export function deriveFavoriteLevelDisplay(favoriteLevel: number): FavoriteLevelDisplay {
  // 1〜5 の整数のみ度合いとして採用し、それ以外（範囲外/非整数/NaN/未設定）は 0 とする。
  const isValid =
    Number.isInteger(favoriteLevel) && favoriteLevel >= 1 && favoriteLevel <= 5;
  const filled = isValid ? favoriteLevel : 0;

  return {
    filled,
    total: 5,
    textEquivalent: `5段階中${filled}`,
  };
}
