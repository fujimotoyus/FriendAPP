/**
 * 一覧の決定的並び替え（要件11）。
 *
 * `sortCharacters` は与えられた Character 集合を指定の {@link SortOrder} に従って
 * 並べ替えた **新しい配列** を返す純粋関数である。元配列は一切変更しない
 * （`[...characters]` でコピーしてからソートする）。表示順のみに作用し、
 * Character の内容やストアには影響しない（要件11.5, 11.6）。
 *
 * 各 order のタイブレーク（決定的順序、design.md「sortCharacters」・Property 17）:
 *   - `'newest'`  : createdAt 降順 → id 昇順
 *   - `'favorite'`: favoriteLevel 降順 → createdAt 降順 → id 昇順
 *   - `'name'`    : 名前の Unicode コードポイント順で昇順（ロケール非依存の一貫比較）。
 *                   名前が空（空文字/空白のみ）は名前を持つ要素より後方。比較同値は id 昇順。
 *   - `'metOn'`   : 出会った日（Met_On、`YYYY-MM-DD`）の降順（新しい順）。Met_On 未設定
 *                   （undefined）は Met_On を持つ要素より後方。Met_On 同値または両方未設定は
 *                   createdAt 降順 → id 昇順（'newest' と同じタイブレーク）。`YYYY-MM-DD` は
 *                   辞書順＝日付順のためコードポイント比較で降順にできる（値は妥当な
 *                   `YYYY-MM-DD` か undefined、Persistence 正規化で保証）。
 *
 * 「Unicode コードポイント順」はロケール非依存の一貫比較とするため `localeCompare` は
 * 用いず、文字列の `<` / `>` 比較でコードポイント順に判定する。名前の空判定は `trim()`
 * で行う。id 比較も同様に文字列のコードポイント順で一貫させる。
 *
 * 参照: design.md「sortCharacters」「Property 17」、要件11.2, 11.3, 11.4, 11.5, 11.6
 */

import type { Character, SortOrder } from './types';

/**
 * 文字列を Unicode コードポイント順で比較する（ロケール非依存）。
 * `a < b` なら負、`a > b` なら正、等しければ 0 を返す。
 */
function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * 名前が空（空文字または空白のみ）かどうかを判定する。
 */
function isEmptyName(name: string): boolean {
  return name.trim() === '';
}

/**
 * Character 配列を指定の並び順で並べ替えた新しい配列を返す純粋関数。
 * 元配列は変更しない。
 *
 * @param characters 並べ替え対象の Character 配列（不変・変更しない）
 * @param order      並び順（'newest' | 'favorite' | 'name' | 'metOn'）
 * @returns 並べ替え済みの新しい配列
 */
export function sortCharacters(
  characters: readonly Character[],
  order: SortOrder,
): Character[] {
  const sorted = [...characters];

  sorted.sort((a, b) => {
    switch (order) {
      case 'newest': {
        // createdAt 降順 → id 昇順
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return compareCodePoint(a.id, b.id);
      }
      case 'favorite': {
        // favoriteLevel 降順 → createdAt 降順 → id 昇順
        if (a.favoriteLevel !== b.favoriteLevel) {
          return b.favoriteLevel - a.favoriteLevel;
        }
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return compareCodePoint(a.id, b.id);
      }
      case 'name': {
        // 空名は後方 → Unicode コードポイント順昇順 → id 昇順
        const aEmpty = isEmptyName(a.name);
        const bEmpty = isEmptyName(b.name);
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        if (!aEmpty && !bEmpty) {
          const nameCmp = compareCodePoint(a.name, b.name);
          if (nameCmp !== 0) return nameCmp;
        }
        return compareCodePoint(a.id, b.id);
      }
      case 'metOn': {
        // Met_On 設定済みを前・未設定を後方 → Met_On 降順 → createdAt 降順 → id 昇順
        const aMissing = a.metOn === undefined;
        const bMissing = b.metOn === undefined;
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        if (!aMissing && !bMissing) {
          // YYYY-MM-DD は辞書順＝日付順。降順にするため b と a を入れ替えて比較。
          const metOnCmp = compareCodePoint(b.metOn as string, a.metOn as string);
          if (metOnCmp !== 0) return metOnCmp;
        }
        // Met_On 同値または両方未設定: createdAt 降順 → id 昇順
        if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
        return compareCodePoint(a.id, b.id);
      }
    }
  });

  return sorted;
}
