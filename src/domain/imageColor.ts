/**
 * imageColor — イメージカラーからの縁取り導出（純粋 TypeScript ドメインモジュール）
 *
 * `Character.imageColor`（{@link ImageColor}）から、写真枠・カード枠へ縁取りを
 * 適用するか、適用する場合に参照する `tokens.css` のトークン名を導出する（要件15）。
 * React / DOM / IndexedDB に依存しない純粋関数であり、property-based testing の対象
 * である（Correctness Property 22）。
 *
 * - `'none'`、または許容値（プリセット5色）以外の任意の文字列（旧データ・不正値を含む）
 *   → `{ hasBorder: false }`（`borderVarName` を持たない = 縁取りを一切適用しない）。要件15.7, 15.8
 * - プリセット5色（`'rose'` / `'mint'` / `'lavender'` / `'butter'` / `'sky'`）
 *   → `{ hasBorder: true, borderVarName: \`--image-color-${color}\` }`。要件15.4, 15.6
 *
 * `borderVarName` は `tokens.css` の `--image-color-{color}` に一致し、`CharacterCard`・
 * `CharacterDetailView` はこの結果に基づき縁取りをトークン経由で `border-color` に描画する。
 *
 * 参照: design.md「Domain 層 / deriveImageColorStyle」「イメージカラートークン」、
 *       要件15.4, 15.6, 15.7, 15.8、Correctness Property 22
 */

import type { ImageColor } from './types';

/** イメージカラーの縁取り表示スタイル。`hasBorder` が true のときのみ `borderVarName` を持つ。 */
export interface ImageColorStyle {
  /** 縁取りを適用するか。プリセット5色のとき true、`'none'`／許容値以外は false。 */
  hasBorder: boolean;
  /** 縁取り色として参照する tokens.css のトークン名（例 `--image-color-rose`）。`hasBorder` が true のときのみ存在。 */
  borderVarName?: string;
}

/**
 * 縁取り適用対象のプリセット5色の集合。
 * `'none'` は含めない（縁取りを一切出さないため）。判定はこの集合への所属で行う。
 */
const BORDER_COLORS = new Set<ImageColor>(['rose', 'mint', 'lavender', 'butter', 'sky']);

/**
 * イメージカラーから縁取り表示スタイルを導出する純粋関数。
 *
 * 引数の型は {@link ImageColor} だが、旧データや不正値により実行時に許容値以外の文字列が
 * 渡される可能性を考慮し、プリセット5色の集合に含まれない値はすべて `'none'` と同じく
 * `{ hasBorder: false }` を返す堅牢な実装とする（要件15.7, 15.8）。
 */
export function deriveImageColorStyle(imageColor: ImageColor): ImageColorStyle {
  if (BORDER_COLORS.has(imageColor)) {
    return { hasBorder: true, borderVarName: `--image-color-${imageColor}` };
  }
  return { hasBorder: false };
}
