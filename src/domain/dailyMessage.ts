/**
 * dailyMessage — 「今日の相棒」の一言（Daily_Line）を決定的に生成する（純粋 TypeScript）
 *
 * 今日の一枚ガチャで選出された「今日の相棒」の表示に添える、相棒キャラ本人のセリフ風の
 * 短い一言（Daily_Line）を生成する。一言は複数のテンプレート集から、暦日
 * （{@link CalendarDay}）と相棒の id、および現在の salt から決定的に選ぶ（要件16.2）。
 * 選出は既存 {@link ../domain/DailyPickSelector} と同じ FNV-1a 系の決定的ハッシュ思想に
 * 揃え、`Math.random()` は使用しない。よって同一の `{ id, day, salt }` では再オープンしても
 * 常に同一の一言を返し（要件16.2、要件5.2 と整合）、salt や相棒が変われば一言も変わりうる
 * （要件16.3、要件5.3 と整合）。
 *
 * 一言の長さは常に最大 50 文字（Unicode コードポイント数）以下を保証する（要件16.4、要件5.5）。
 * 名前が空（空文字・空白のみ）のときは名前を差し込まないテンプレートを用い、空でない一言を
 * 返す（要件16.6）。本モジュールは端末内で完結する純粋関数で構成し、いかなる外部サーバーへも
 * 送信しない（要件16.5、要件3.8）。property-based testing の対象とする（Correctness
 * Property 16 / Property 23）。長さは Unicode のコードポイント数（`[...str].length`）で数える。
 *
 * 参照: design.md「Components and Interfaces / DailyGachaView」「Testing Strategy」、
 * 要件16、要件5.5、Correctness Property 16 / 23
 */

import type { CalendarDay } from './types';
import { fnv1a32 } from './DailyPickSelector';

/**
 * 「今日の相棒」の一言（Daily_Line）の最大文字数（コードポイント数）。要件5.5, 16.4
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
 * 名前差し込み用のセリフ風テンプレート集。
 *
 * 相棒キャラ本人の一言として表現する文で、`{name}` に相棒の名前を差し込む。名前は
 * 差し込み前に、固定部分を除いた残量で切り詰めてから埋め込むため、`{name}` の位置は
 * 各テンプレートで 1 回のみとする。rng の違いで異なる一言が生じうるよう複数用意する
 * （要件16.3 の存在量化を満たす）。
 */
const WITH_NAME_TEMPLATES: readonly string[] = [
  '{name}だよ！今日もよろしくね♪',
  'やっほー、{name}だよ〜。会えて嬉しいな♪',
  '今日は{name}が相棒だよ。いっぱい遊ぼ♪',
  'ねえねえ、{name}だよ。今日はいい日になりそう！',
  '{name}です！今日も一緒にがんばろっ♪',
  'えへへ、{name}が来ちゃった。よろしくね♪',
];

/**
 * 名前なし用のセリフ風テンプレート集。
 *
 * 相棒の名前が空（空文字・空白のみ）のときに用いる、名前を差し込まないセリフ風の一言。
 * いずれも空でない固定文で、rng の違いで異なる一言が生じうるよう複数用意する（要件16.6）。
 */
const WITHOUT_NAME_TEMPLATES: readonly string[] = [
  '今日はわたしの日だね♪',
  'やっほー！今日もよろしくね♪',
  'えへへ、会えて嬉しいな♪',
  '今日は一緒に遊ぼ〜♪',
  'きょうもいい日になりますように♪',
  'ねえねえ、今日はどこ行く？♪',
];

/**
 * 暦日・相棒 id・salt から、テンプレート選択用の決定的ハッシュ入力文字列を構成する。
 *
 * id 内に出現し得ない区切り文字（`\u0000`）を用いて、異なる入力が同一文字列に
 * 衝突する可能性を減らす。{@link ../domain/DailyPickSelector} の入力構成と同じ思想。
 *
 * @param id 相棒 Character の id
 * @param day 端末ローカルの暦日
 * @param salt 引き直し用の salt
 * @returns ハッシュ入力用に連結した文字列
 */
function buildLineHashInput(id: string, day: CalendarDay, salt: number): string {
  const dayPart = `${day.year}-${day.month}-${day.day}`;
  return `${dayPart}\u0000${id}\u0000${salt}`;
}

/**
 * 「今日の相棒」の一言（Daily_Line）を決定的に生成する。
 *
 * アルゴリズム（design.md「Daily_Line の決定的選出」）:
 * 1. 相棒の名前が空（空文字・空白のみ）なら名前なしテンプレート集、そうでなければ
 *    名前差し込みテンプレート集を用いる（要件16.6）。
 * 2. 暦日（year/month/day）+ 相棒 id + salt を連結した文字列を FNV-1a 32bit の決定的
 *    ハッシュ `h` にし（{@link fnv1a32}）、`index = h mod テンプレート数` でテンプレートを
 *    1 つ選ぶ（要件16.2）。`Math.random()` は使用しない。
 * 3. 名前差し込みテンプレートの場合、固定部分の長さを差し引いた残量で名前を切り詰めてから
 *    `{name}` へ差し込む。最終的に一言全体を必ず上限（50 コードポイント）で切り詰め、
 *    **任意の入力に対して常に長さ 50 以下** を保証する（要件16.4、要件5.5）。
 *
 * 同一の `{ id, day, salt }` では常に同一の一言を返す純粋関数であり（決定的、要件16.2）、
 * 外部送信・副作用を持たない（要件16.5、要件3.8）。名前が空でも空でない一言を返す（要件16.6）。
 *
 * @param input 相棒 Character の id と名前（名前は未入力・空白のみ可）
 * @param day 端末ローカルの暦日
 * @param salt 引き直し用 salt（呼び出し側が管理）
 * @returns 最大 50 文字（コードポイント数）の、空でない Daily_Line
 */
export function buildDailyLine(
  input: { id: string; name: string },
  day: CalendarDay,
  salt: number,
): string {
  const trimmed = input.name.trim();
  const hash = fnv1a32(buildLineHashInput(input.id, day, salt));

  if (trimmed.length === 0) {
    // 名前なし: 名前を差し込まないテンプレートから決定的に 1 つ選ぶ（要件16.6）。
    const index = hash % WITHOUT_NAME_TEMPLATES.length;
    const line = WITHOUT_NAME_TEMPLATES[index];
    // 不変条件（<=50字）を保証するため最後に必ず切り詰める。
    return truncateToCodePoints(line, MAX_MESSAGE_LENGTH);
  }

  // 名前あり: 名前差し込みテンプレートから決定的に 1 つ選ぶ。
  const index = hash % WITH_NAME_TEMPLATES.length;
  const template = WITH_NAME_TEMPLATES[index];

  // テンプレートの固定部分（`{name}` を除いた部分）の長さを算出し、名前へ割り当てられる
  // 残量を求める。名前が長い場合はこの残量まで切り詰めてから差し込む。
  const PLACEHOLDER = '{name}';
  const fixedText = template.replace(PLACEHOLDER, '');
  const fixedLength = codePointLength(fixedText);
  const nameBudget = Math.max(0, MAX_MESSAGE_LENGTH - fixedLength);
  const nameForLine = truncateToCodePoints(trimmed, nameBudget);

  const line = template.replace(PLACEHOLDER, nameForLine);

  // テンプレート自体が上限を超える設計変更等に備え、最終的に必ず上限で切り詰める（不変条件の保証）。
  return truncateToCodePoints(line, MAX_MESSAGE_LENGTH);
}
