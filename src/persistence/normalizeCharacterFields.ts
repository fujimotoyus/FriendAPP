/**
 * 読み出し時の後方互換正規化ヘルパ（イテレーション6 / 要件14.11, 15.5）
 *
 * イテレーション6 で `Character` に追加した `metOn`（任意・`YYYY-MM-DD`）と
 * `imageColor`（プリセット列挙・既定 `'none'`）は、それらを持たない旧データが
 * IndexedDB に残っている可能性がある。`fetchAll` の読み出し時に、既存の `PhotoData`
 * 正規化と同じ場所でこれらの欠落/不正値を既定値へ補完し、後方互換を保つ
 * （DB バージョン・スキーマは据え置き。design.md「データモデル拡張（後方互換が最重要）」）。
 *
 * 本モジュールは `IndexedDbCharacterStore` と `InMemoryCharacterStore` の双方から
 * 再利用され、両ストアの読み出し挙動を揃える（正規化ロジックの二重定義を避ける）。
 *
 * 正規化方針:
 * - `imageColor`: プリセット許容値（`'none' | 'rose' | 'mint' | 'lavender' | 'butter' | 'sky'`）
 *   以外・未設定・非文字列は `'none'` にする。
 * - `metOn`: `undefined` はそのまま `undefined`。文字列で `YYYY-MM-DD` 形式なら保持、
 *   それ以外（非文字列・空文字・形式不正）は `undefined` にする。
 *   ここでは today に依存する厳密な範囲・実在日検証は行わず、形式ベースの軽量正規化に
 *   とどめる（厳密検証は入力時に `normalizeMetOn` が担うため、旧データは形式が合えば保持、
 *   壊れていれば `undefined` でよい。design.md「Persistence」正規化記述に沿う）。
 *
 * 参照: design.md「データモデル拡張」「Persistence インターフェース」、要件14.11, 15.5
 */
import type { Character, ImageColor } from '../domain/types';

/** イメージカラーのプリセット許容値集合（`types.ts` の {@link ImageColor} と一致）。 */
const IMAGE_COLOR_PRESETS: ReadonlySet<ImageColor> = new Set<ImageColor>([
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
]);

/** `YYYY-MM-DD`（4桁-2桁-2桁）の形式判定用。実在日・範囲の検証は行わない。 */
const MET_ON_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 任意の値をプリセット許容値の {@link ImageColor} へ正規化する。
 * 許容値以外・未設定・非文字列は `'none'` を返す（要件15.5）。
 */
export function normalizeImageColorValue(value: unknown): ImageColor {
  if (typeof value === 'string' && IMAGE_COLOR_PRESETS.has(value as ImageColor)) {
    return value as ImageColor;
  }
  return 'none';
}

/**
 * 任意の値を `metOn`（`YYYY-MM-DD` 文字列 または `undefined`）へ軽量正規化する。
 * `undefined`・非文字列・空文字・形式不正は `undefined` を返す（要件14.11）。
 * 実在日・範囲（1900-01-01〜today）・未来日の厳密判定は行わない（入力時の
 * `normalizeMetOn` が担う）。
 */
export function normalizeMetOnValue(value: unknown): string | undefined {
  if (typeof value === 'string' && MET_ON_FORMAT.test(value)) {
    return value;
  }
  return undefined;
}

/**
 * 読み出した Character の `metOn` / `imageColor` を後方互換のため正規化した
 * 新しい Character を返す（写真 `photo` は呼び出し側で別途正規化済みの前提）。
 * 元オブジェクトは変更しない。
 */
export function normalizeNewFields(character: Character): Character {
  return {
    ...character,
    metOn: normalizeMetOnValue((character as { metOn?: unknown }).metOn),
    imageColor: normalizeImageColorValue(
      (character as { imageColor?: unknown }).imageColor,
    ),
  };
}
