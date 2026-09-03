/**
 * dailyMessage — 「今日の相棒」に併記する短いメッセージ生成（純粋 TypeScript）
 *
 * 今日の一枚ガチャで選出された「今日の相棒」の表示に添える、かわいくポップな
 * 短いメッセージを生成する。メッセージの長さは常に最大 50 文字を保証する（要件5.5）。
 *
 * 本モジュールは React / DOM / IndexedDB に一切依存しない純粋関数で構成し、
 * property-based testing の対象とする（Correctness Property 15）。長さは Unicode の
 * コードポイント数（`[...str].length`、`String.prototype.length` ではなく）で数える。
 * これにより絵文字やサロゲートペアを含む名前でも 50「文字」以下を保証する。
 *
 * 参照: design.md「Components and Interfaces / DailyGachaView」「Testing Strategy」、
 * 要件5.5、Correctness Property 15
 */

/**
 * 「今日の相棒」メッセージの最大文字数（コードポイント数）。要件5.5
 */
export const MAX_MESSAGE_LENGTH = 50;

/**
 * 文字列の長さを Unicode コードポイント数で数える。
 *
 * `String.prototype.length` は UTF-16 コードユニット数を返すため、絵文字などの
 * サロゲートペアを 2 と数えてしまう。ここではイテレータ（`[...str]`）でコードポイント
 * 単位に分解して数え、「文字数」の直感に沿った長さ判定を行う。
 *
 * @param str 対象文字列
 * @returns コードポイント数
 */
function codePointLength(str: string): number {
  return [...str].length;
}

/**
 * 文字列を最大 `max` コードポイントに切り詰める。
 *
 * サロゲートペアの途中で切断しないよう、コードポイント単位で分解してから先頭
 * `max` 個を再結合する。既に `max` 以下の場合はそのまま返す。
 *
 * @param str 対象文字列
 * @param max 最大コードポイント数
 * @returns 切り詰め後の文字列
 */
function truncateToCodePoints(str: string, max: number): string {
  const points = [...str];
  if (points.length <= max) {
    return str;
  }
  return points.slice(0, max).join('');
}

/**
 * 「今日の相棒」用の短いメッセージを生成する。
 *
 * 選出された Character の名前（任意・空文字可、要件1.9）を受け取り、かわいい定型文へ
 * 埋め込む。名前が長い場合でも最終的なメッセージが最大 50 文字（コードポイント数）に
 * 収まるよう、必要なら名前部分を切り詰め、それでも上限を超える場合はメッセージ全体を
 * 上限で切り詰める。これにより **任意の入力に対して常に長さ 50 以下** を保証する
 * （要件5.5 / Correctness Property 15）。
 *
 * 名前が未入力（空文字・空白のみ）の場合は名前なしの定型文を用いる。
 *
 * @param name 選出された Character の名前（未入力可）
 * @returns 最大 50 文字（コードポイント数）の「今日の相棒」メッセージ
 */
export function buildDailyMessage(name: string): string {
  const trimmed = name.trim();

  // 名前なしの定型文（固定・50文字以下）。
  const withoutName = '今日の相棒はこの子だよ♪';

  if (trimmed.length === 0) {
    // 定型文は上限以下だが、不変条件を保証するため最後に必ず切り詰める。
    return truncateToCodePoints(withoutName, MAX_MESSAGE_LENGTH);
  }

  // 名前あり定型文の固定部分（前後）。この長さぶんを名前に割り当てられる残量から差し引く。
  const prefix = '今日の相棒は';
  const suffix = 'ちゃんだよ♪';
  const fixedLength =
    codePointLength(prefix) + codePointLength(suffix);

  // 名前に使える最大長。負にならないよう 0 で下限を設ける。
  const nameBudget = Math.max(0, MAX_MESSAGE_LENGTH - fixedLength);
  const nameForMessage = truncateToCodePoints(trimmed, nameBudget);

  const message = `${prefix}${nameForMessage}${suffix}`;

  // 定型文自体が上限を超える設計変更等に備え、最終的に必ず上限で切り詰める（不変条件の保証）。
  return truncateToCodePoints(message, MAX_MESSAGE_LENGTH);
}
