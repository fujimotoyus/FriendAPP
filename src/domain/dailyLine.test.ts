/**
 * dailyLine のプロパティテスト（fast-check + Vitest）
 *
 * Property 23: 今日の相棒の一言（Daily_Line）は決定的・要素妥当・50文字以下。
 * イテレーション8（要件16）で追加した `buildDailyLine`（相棒本人のセリフ風の一言）を
 * 検証する。決定性（同一 { id, name, day, salt } では常に同一）・50文字以下・非空を
 * 単一プロパティで確認し、Property 16（長さのみ）と相補的に働く。既存
 * `dailyMessage.test.ts`（Property 16）は変更しない。
 *
 * 参照: design.md「Correctness Properties / Property 23」、要件5.5, 16.1, 16.2, 16.4, 16.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CalendarDay } from './types';
import { buildDailyLine, MAX_MESSAGE_LENGTH } from './dailyMessage';

describe('buildDailyLine — Property 23', () => {
  // Feature: chara-collection, Property 23: 今日の一言は決定的・要素妥当・50文字以下
  it('任意の相棒（id/name）・暦日・saltに対して、生成される一言は決定的・50文字以下・非空である', () => {
    const dayArb = fc.record<CalendarDay>({
      year: fc.integer({ min: 1970, max: 3000 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 31 }),
    });
    // 名前は空文字・空白のみ・絵文字/サロゲートペア・長文・通常文字列を混在させる。
    const nameArb = fc.oneof(
      fc.constant(''),
      fc.constant('   '),
      fc.string({ maxLength: 200 }),
      fc.fullUnicodeString({ maxLength: 200 }),
      fc.constant('🌸✨🐱💕🎀'),
      fc.constant('あいうえお'.repeat(40)),
    );
    fc.assert(
      fc.property(
        fc.string({ maxLength: 64 }),
        nameArb,
        dayArb,
        fc.integer({ min: 0, max: 1_000_000 }),
        (id, name, day, salt) => {
          const first = buildDailyLine({ id, name }, day, salt);
          const second = buildDailyLine({ id, name }, day, salt);
          const third = buildDailyLine({ id, name }, day, salt);

          // (a) 決定性: 同一入力では常に同一文字列を返す。
          expect(second).toBe(first);
          expect(third).toBe(first);

          // (b) 50文字以下: Unicode コードポイント数で数える（サロゲートペア対応）。
          expect([...first].length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);

          // (c) 非空: 名前が空・空白のみでも空でない一言を返す。
          expect(first.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
