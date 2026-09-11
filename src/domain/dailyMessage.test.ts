/**
 * dailyMessage のプロパティテスト（fast-check + Vitest）
 *
 * Property 16: 今日の相棒の一言（Daily_Line）は常に50文字以下。
 * イテレーション8で対象を旧 `buildDailyMessage` から `buildDailyLine`（相棒本人の
 * セリフ風の一言）へ作り替えた。50文字以下の不変条件は維持する。
 * 参照: design.md「Correctness Properties / Property 16」、要件5.5, 16.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CalendarDay } from './types';
import { buildDailyLine, MAX_MESSAGE_LENGTH } from './dailyMessage';

describe('buildDailyLine — Property 16', () => {
  // Feature: chara-collection, Property 16: 今日の一言は50文字以下
  it('任意の相棒（id/name）・暦日・saltに対して、生成される一言の文字数は常に50以下である', () => {
    const dayArb = fc.record<CalendarDay>({
      year: fc.integer({ min: 1970, max: 3000 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 31 }),
    });
    fc.assert(
      fc.property(
        fc.string({ maxLength: 64 }),
        fc.string({ maxLength: 200 }),
        dayArb,
        fc.integer({ min: 0, max: 1_000_000 }),
        (id, name, day, salt) => {
          const line = buildDailyLine({ id, name }, day, salt);
          // 文字数は Unicode コードポイント数で数える（サロゲートペア対応）。
          const length = [...line].length;
          expect(length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
        },
      ),
      { numRuns: 100 },
    );
  });
});
