/**
 * metOn（出会った日）の正規化のプロパティテスト（fast-check + Vitest）
 *
 * Property 21: 出会った日の正規化の妥当性。
 * `normalizeMetOn(value, today)` は、入力が `YYYY-MM-DD` 形式かつ
 * 1900-01-01 以上 `today` 以下の実在する暦日である場合に限りその正規化済み
 * `YYYY-MM-DD` をそのまま返し、空文字・undefined・形式不正・実在しない日付・
 * 1900 以前・未来日はいずれも undefined を返す。
 *
 * 日付の生成・比較・整形はロケール/タイムゾーンに依存しないよう、すべて数値
 * （year/month/day）で組み立て、`new Date().toISOString()` のスライスには頼らない。
 *
 * 参照: design.md「Correctness Properties / Property 21」、要件14.2, 14.3, 14.4, 14.10, 14.11
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeMetOn } from './metOn';
import type { CalendarDay } from './types';

// --- TZ 非依存のヘルパ（テスト側の期待値算出用） -----------------------------

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

/** year/month/day を `YYYY-MM-DD`（ゼロ埋め 2 桁）へ整形する。 */
function formatIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 3 成分の暦日を大小比較するための序列値（year*10000 + month*100 + day）。 */
function ordinal(year: number, month: number, day: number): number {
  return year * 10000 + month * 100 + day;
}

const MIN = ordinal(1900, 1, 1);

/**
 * 実在する暦日（year/month/day）を生成する arbitrary。
 * 月に応じた日数・うるう年を考慮し、常に妥当な日付のみを返す。
 */
const realCalendarDayArb: fc.Arbitrary<{ year: number; month: number; day: number }> = fc
  .record({ year: fc.integer({ min: 1800, max: 2200 }), month: fc.integer({ min: 1, max: 12 }) })
  .chain(({ year, month }) =>
    fc
      .integer({ min: 1, max: daysInMonth(year, month) })
      .map((day) => ({ year, month, day })),
  );

describe('normalizeMetOn — Property 21: 出会った日の正規化の妥当性', () => {
  // Feature: chara-collection, Property 21: 出会った日の正規化の妥当性（YYYY-MM-DD かつ 1900-01-01〜today の実在日のみ保持、それ以外は undefined）
  it('妥当な入力は保持し、範囲外・未来日・不正形式・実在しない日・空/undefined は undefined になる', () => {
    fc.assert(
      fc.property(realCalendarDayArb, realCalendarDayArb, (input, todayDay) => {
        const today: CalendarDay = {
          year: todayDay.year,
          month: todayDay.month,
          day: todayDay.day,
        };
        const value = formatIso(input.year, input.month, input.day);
        const result = normalizeMetOn(value, today);

        const ord = ordinal(input.year, input.month, input.day);
        const inRange = ord >= MIN && ord <= ordinal(today.year, today.month, today.day);

        if (inRange) {
          // 1900-01-01 以上 today 以下の実在日 → そのまま保持。
          expect(result).toBe(value);
        } else {
          // 1900 未満、または未来日 → undefined。
          expect(result).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- 補助的なユニットテスト（Property 21 の代表例・エッジ） --------------------

describe('normalizeMetOn — 代表例とエッジケース', () => {
  const today: CalendarDay = { year: 2024, month: 6, day: 15 };

  it('妥当な過去日・当日を保持する', () => {
    expect(normalizeMetOn('2020-02-29', today)).toBe('2020-02-29'); // うるう年 2/29
    expect(normalizeMetOn('1900-01-01', today)).toBe('1900-01-01'); // 下限当日
    expect(normalizeMetOn('2024-06-15', today)).toBe('2024-06-15'); // today 当日
  });

  it('未来日は undefined', () => {
    expect(normalizeMetOn('2024-06-16', today)).toBeUndefined();
    expect(normalizeMetOn('2999-12-31', today)).toBeUndefined();
  });

  it('1900-01-01 未満（範囲外）は undefined', () => {
    expect(normalizeMetOn('1899-12-31', today)).toBeUndefined();
    expect(normalizeMetOn('1800-01-01', today)).toBeUndefined();
  });

  it('実在しない日付は undefined', () => {
    expect(normalizeMetOn('2023-02-30', today)).toBeUndefined();
    expect(normalizeMetOn('2021-04-31', today)).toBeUndefined();
    expect(normalizeMetOn('2019-02-29', today)).toBeUndefined(); // 非うるう年 2/29
    expect(normalizeMetOn('2023-13-01', today)).toBeUndefined(); // 月 13
    expect(normalizeMetOn('2023-00-10', today)).toBeUndefined(); // 月 0
    expect(normalizeMetOn('2023-05-00', today)).toBeUndefined(); // 日 0
  });

  it('不正形式は undefined', () => {
    expect(normalizeMetOn('2024/06/15', today)).toBeUndefined();
    expect(normalizeMetOn('2024-6-15', today)).toBeUndefined(); // ゼロ埋めなし
    expect(normalizeMetOn('abc', today)).toBeUndefined();
    expect(normalizeMetOn('20240615', today)).toBeUndefined();
    expect(normalizeMetOn(' 2024-06-15 ', today)).toBeUndefined();
  });

  it('空文字・undefined は undefined', () => {
    expect(normalizeMetOn('', today)).toBeUndefined();
    expect(normalizeMetOn(undefined, today)).toBeUndefined();
  });

  // Feature: chara-collection, Property 21: 不正形式の任意文字列は undefined
  it('YYYY-MM-DD にマッチしない任意文字列は常に undefined', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (s) => {
        fc.pre(!/^\d{4}-\d{2}-\d{2}$/.test(s));
        expect(normalizeMetOn(s, today)).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
