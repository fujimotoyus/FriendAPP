/**
 * metOn — 出会った日（Met_On）の正規化・表示整形（純粋 TypeScript）
 *
 * 「出会った日」はフォーム入力（`<input type="date">` の値）や旧データ由来の文字列を
 * 受け取り、妥当な `YYYY-MM-DD`（ISO 8601 の暦日）であることを厳密に検証したうえで、
 * 保存・表示に用いる正規化済み文字列へ落とす。妥当でない入力（空/形式不正/実在しない
 * 日付/範囲外/未来日）は「未設定」を表す `undefined` へ正規化する。
 *
 * 本モジュールは React / DOM / IndexedDB / タイムゾーンに一切依存しない純粋関数で
 * 構成し、property-based testing の対象とする（Correctness Property 21）。実在日の判定は
 * `new Date(str)` の曖昧なパースには依存せず、`YYYY-MM-DD` の厳密な正規表現マッチと
 * 月ごとの日数（うるう年判定込み）による検証で行う。これによりロケール・タイムゾーンに
 * 依存せず一貫した結果を返す。
 *
 * 参照: design.md「Domain 層」「normalizeMetOn/formatMetOn」、
 * 要件14.2, 14.3, 14.4, 14.5, 14.10, 14.11、Correctness Property 21
 */

import type { CalendarDay } from './types';

/** 出会った日として受理する下限（要件14.3）。1900-01-01 未満は未設定へ落とす。 */
const MIN_YEAR = 1900;
const MIN_MONTH = 1;
const MIN_DAY = 1;

/** `YYYY-MM-DD` の厳密な形式マッチ（4 桁年-2 桁月-2 桁日）。 */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 指定した年がうるう年かを判定する（グレゴリオ暦のルール）。
 *
 * 4 で割り切れ、かつ（100 で割り切れない、または 400 で割り切れる）年をうるう年とする。
 *
 * @param year 西暦年
 * @returns うるう年なら true
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 指定した年・月の日数（1〜12 月）を返す。うるう年の 2 月は 29 とする。
 *
 * @param year 西暦年
 * @param month 月（1〜12）
 * @returns 当該月の日数
 */
function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

/**
 * 3 つの (year, month, day) を暦日として大小比較するための単純な序列値を返す。
 * 各成分が妥当（月 1〜12・日 1〜31）である前提で、`year*10000 + month*100 + day`
 * が辞書順の大小と一致することを利用する。
 */
function ordinal(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

/**
 * 出会った日の入力（フォーム値または旧データ）を妥当な `YYYY-MM-DD` か `undefined` へ
 * 正規化する（要件14.2, 14.3, 14.4, 14.10, 14.11）。
 *
 * 入力が次のすべてを満たす場合に限り、その正規化済み `YYYY-MM-DD` 文字列を返す:
 * - `YYYY-MM-DD` 形式（4 桁年-2 桁月-2 桁日）である
 * - 実在する暦日である（月 1〜12、日はその月の日数以内、非うるう年 2/29 は不正）
 * - `1900-01-01` 以上 `today` 以下（`today` 当日は妥当、未来日は不正）
 *
 * 空文字・`undefined`・形式不正・実在しない日付・1900 以前・未来日はいずれも
 * `undefined`（未設定）を返す。副作用を持たない純粋関数。
 *
 * @param value 検証対象の文字列（未設定は `undefined`）
 * @param today 基準となる今日の暦日（この日を含めて過去のみ許容）
 * @returns 妥当なら正規化済み `YYYY-MM-DD`、そうでなければ `undefined`
 */
export function normalizeMetOn(
  value: string | undefined,
  today: CalendarDay,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = ISO_DATE_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // 月・日の基本レンジ検証。
  if (month < 1 || month > 12) {
    return undefined;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return undefined;
  }

  const current = ordinal(year, month, day);

  // 下限（1900-01-01）チェック。
  if (current < ordinal(MIN_YEAR, MIN_MONTH, MIN_DAY)) {
    return undefined;
  }

  // 上限（today 当日まで許容、未来日は不正）チェック。
  if (current > ordinal(today.year, today.month, today.day)) {
    return undefined;
  }

  // 形式マッチにより既に正規化済み（ゼロ埋め 2 桁）なので、そのまま返す。
  return value;
}

/**
 * 妥当な `YYYY-MM-DD` を詳細表示用の「YYYY年M月D日」へ整形する（要件14.5）。
 *
 * 月・日はゼロ埋めしない（例: `'2024-03-05'` → `'2024年3月5日'`）。
 * 入力は `normalizeMetOn` を通過した妥当な `YYYY-MM-DD` を前提とする純粋関数。
 *
 * @param metOn 妥当な `YYYY-MM-DD` 文字列
 * @returns 「YYYY年M月D日」形式の表示文字列
 */
export function formatMetOn(metOn: string): string {
  const match = ISO_DATE_PATTERN.exec(metOn);
  if (match === null) {
    // 前提が破られた場合でも例外を投げず、入力をそのまま返す（防御的）。
    return metOn;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return `${year}年${month}月${day}日`;
}
