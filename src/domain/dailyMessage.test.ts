/**
 * dailyMessage のプロパティテスト（fast-check + Vitest）
 *
 * Property 15: 今日のメッセージは50文字以下。
 * 参照: design.md「Correctness Properties / Property 15」、要件5.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildDailyMessage, MAX_MESSAGE_LENGTH } from './dailyMessage';

describe('buildDailyMessage — Property 15', () => {
  // Feature: chara-collection, Property 15: 今日のメッセージは50文字以下
  it('任意の名前入力に対して、生成メッセージの文字数は常に50以下である', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (name) => {
        const message = buildDailyMessage(name);
        // 文字数は Unicode コードポイント数で数える（サロゲートペア対応）。
        const length = [...message].length;
        expect(length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
      }),
      { numRuns: 100 },
    );
  });
});
