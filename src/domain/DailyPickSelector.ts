/**
 * DailyPickSelector — 今日の一枚ガチャの決定的選出（純粋 TypeScript ドメインモジュール）
 *
 * 「今日の相棒」を同一暦日内で固定するため（要件5.2）、選出を乱数ではなく
 * プラットフォーム非依存の決定的な計算で行う。`Math.random()` は使用しない。
 * 乱数状態を永続化する代わりに、暦日（{@link CalendarDay}）と salt、そして
 * コレクションの id 集合から安定なインデックスを導出する。
 *
 * これにより次を乱数状態の保存なしに満たす（design.md「決定的な『今日の一枚』選出」）:
 * - 同一暦日 + 同一コレクション + 同一 salt では常に同じ id を返す（決定的）
 * - アプリ再オープンでも同じ結果（純粋関数で同一入力→同一出力）
 * - 引き直しは salt をインクリメントして再計算（呼び出し側が salt を管理、要件5.3）
 *
 * 本モジュールは React / DOM / IndexedDB / localStorage に一切依存しない。
 * property-based testing の主対象である（Correctness Property 14）。
 *
 * 参照: design.md「Algorithms / 決定的な『今日の一枚』選出」「Domain モジュール /
 * DailyPickSelector」、要件5.1, 5.2, 5.3、Correctness Property 14
 */

import type { CalendarDay } from './types';

/**
 * FNV-1a 32bit ハッシュの offset basis（初期値）。
 * 参照: FNV-1a の標準定数（2166136261）。
 */
const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * FNV-1a 32bit ハッシュの prime（乗数）。
 * 参照: FNV-1a の標準定数（16777619）。
 */
const FNV_PRIME = 0x01000193;

/**
 * 文字列を FNV-1a 32bit の決定的ハッシュ値へ変換する。
 *
 * プラットフォーム非依存かつ実行毎にシードが変わらない安定なハッシュであり、
 * 同一文字列に対して常に同一の 32bit 符号なし整数を返す。文字は UTF-16 の
 * コードユニット単位（`charCodeAt`）で処理する。
 *
 * ビット演算は 32bit で行い、`>>> 0` で符号なし 32bit に丸めて返す。
 *
 * @param input ハッシュ対象の文字列
 * @returns 0 以上 2^32 未満の符号なし 32bit ハッシュ値
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    // 各コードユニットと XOR してから FNV_PRIME を乗算する。
    hash ^= input.charCodeAt(i);
    // 32bit 乗算（Math.imul は 32bit 整数乗算を保証する）。
    hash = Math.imul(hash, FNV_PRIME);
  }
  // 符号なし 32bit へ丸める。
  return hash >>> 0;
}

/**
 * 暦日・salt・ソート済み id 列から、決定的なハッシュ入力文字列を構成する。
 *
 * id の連結には、id 内に出現し得ない区切り文字（`\u0000`）を用いて、
 * 異なる id 列が同一文字列に衝突する可能性を減らす。
 *
 * @param sortedIds 辞書順昇順にソート済みの id 配列
 * @param day 端末ローカルの暦日
 * @param salt 引き直し用の salt（同一暦日内は同じ salt で固定）
 * @returns ハッシュ入力用に連結した文字列
 */
function buildHashInput(
  sortedIds: readonly string[],
  day: CalendarDay,
  salt: number,
): string {
  const dayPart = `${day.year}-${day.month}-${day.day}`;
  return `${dayPart}|${salt}|${sortedIds.join('\u0000')}`;
}

/**
 * 今日の一枚（「今日の相棒」）を決定的に選出して 1 件の id を返す。
 *
 * アルゴリズム（design.md「決定的な『今日の一枚』選出」）:
 * 1. id 配列を辞書順昇順で安定ソートする（同一集合なら常に同じ順序）。
 * 2. `CalendarDay`（year/month/day）+ salt + ソート済み id 列を連結した文字列を
 *    FNV-1a 32bit の決定的ハッシュ `h` にする（{@link fnv1a32}）。
 * 3. `index = h mod count` の位置の id を返す。
 *
 * 空配列の場合は選出対象が無いため `null` を返す（要件5.6 の 0 件時は呼び出し側で処理）。
 * 引数 `ids` は変更しない純粋関数である（ソートはコピーに対して行う）。
 *
 * @param ids コレクションの Character id 配列
 * @param day 端末ローカルの暦日
 * @param salt 引き直し用 salt（呼び出し側が管理）
 * @returns 選出された id。`ids` が空の場合は `null`
 */
export function pick(
  ids: readonly string[],
  day: CalendarDay,
  salt: number,
): string | null {
  if (ids.length === 0) {
    return null;
  }

  // 元配列を変更しないようコピーしてから辞書順昇順で安定ソートする。
  const sortedIds = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const hash = fnv1a32(buildHashInput(sortedIds, day, salt));
  const index = hash % sortedIds.length;
  return sortedIds[index];
}
