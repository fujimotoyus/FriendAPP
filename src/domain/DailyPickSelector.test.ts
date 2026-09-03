/**
 * DailyPickSelector のプロパティテスト（fast-check + Vitest）
 *
 * Property 14: 今日の一枚は暦日内で決定的かつコレクションの要素。
 * 参照: design.md「Correctness Properties / Property 14」、要件5.1, 5.2, 5.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pick } from './DailyPickSelector';
import type { CalendarDay } from './types';

/** 一意な id 群（1 件以上）を生成するアービトラリ。 */
const nonEmptyIds = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 12 }), {
    minLength: 1,
    maxLength: 30,
  });

/** 妥当な範囲の CalendarDay を生成するアービトラリ。 */
const calendarDay: fc.Arbitrary<CalendarDay> = fc.record({
  year: fc.integer({ min: 1970, max: 3000 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 31 }),
});

/** salt を生成するアービトラリ（非負整数）。 */
const salt = fc.nat({ max: 100000 });

describe('DailyPickSelector.pick — Property 14', () => {
  // Feature: chara-collection, Property 14: 今日の一枚は暦日内で決定的かつコレクションの要素
  it('同一 day + salt では常に同一 id を返し、その id は常にコレクションの要素である', () => {
    fc.assert(
      fc.property(nonEmptyIds, calendarDay, salt, salt, (ids, day, s1, s2) => {
        const first = pick(ids, day, s1);
        const second = pick(ids, day, s1);

        // 決定性: 同一入力（同一 day + 同一 salt）は常に同一 id（再計算・再呼び出しでも不変）。
        expect(second).toBe(first);

        // 要素性: 返り値は必ずコレクションに属する（空でないため null にならない）。
        expect(first).not.toBeNull();
        expect(ids).toContain(first as string);

        // 引き直し（salt 変更）後の結果も常にコレクションの要素である。
        const rerolled = pick(ids, day, s2);
        expect(rerolled).not.toBeNull();
        expect(ids).toContain(rerolled as string);
      }),
      { numRuns: 100 },
    );
  });

  it('空コレクションでは null を返す', () => {
    fc.assert(
      fc.property(calendarDay, salt, (day, s) => {
        expect(pick([], day, s)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
