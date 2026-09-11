/**
 * BattleCommentator の状況別実況（Battle_Situation、要件19）のプロパティテスト
 * （fast-check + Vitest）
 *
 * Property 25: 状況別実況は妥当で状況を反映しつつ勝率に影響しない。
 * 任意の勝者/敗者名・rng・situation（favored/upset/even/省略）について、
 *   (a) `deriveBattleSituation` が Favorite_Level 比較で状況を正しく分類する
 *       （winner>loser→favored、winner<loser→upset、同値/比較不能→even）
 *   (b) `narrate(names, rng, situation)` は非空で勝者名を含む文字列を返す
 *   (c) 各状況にテンプレートが複数存在し、rng を変えると異なる文面が生じうる
 *   (d) situation は実況選択のみに用い、勝敗の自動判定には影響しない（deriveBattleSituation は
 *       純粋な比較であり、勝敗そのものを変えない）
 *
 * Validates: Requirements 19, 4.3, 4.5
 * 参照: design.md「Correctness Properties / Property 25」「BattleCommentator」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  narrate,
  deriveBattleSituation,
  SITUATION_TEMPLATE_COUNTS,
} from './BattleCommentator';
import type { BattleSituation } from './types';

const name = fc.string({ minLength: 1, maxLength: 20 });
const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });
const situationArb: fc.Arbitrary<BattleSituation | undefined> = fc.constantFrom(
  'favored',
  'upset',
  'even',
  undefined,
);

// Feature: chara-collection, Property 25: 状況別実況は妥当で状況を反映しつつ勝率に影響しない
describe('BattleCommentator situation (Property 25)', () => {
  it('deriveBattleSituation の分類が妥当で narrate が非空かつ勝者名を含む', () => {
    fc.assert(
      fc.property(name, name, unit, situationArb, (winner, loser, r, situation) => {
        const text = narrate({ winner, loser }, () => r, situation);
        // (b) 非空・勝者名を含む。
        expect(text.length).toBeGreaterThan(0);
        expect(text.includes(winner)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('deriveBattleSituation が Favorite_Level 比較で状況を正しく分類する', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (w, l) => {
          // (a) 比較に基づく分類。
          const s = deriveBattleSituation(w, l);
          if (w > l) expect(s).toBe('favored');
          else if (w < l) expect(s).toBe('upset');
          else expect(s).toBe('even');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('比較不能（NaN/非有限）は even として扱う', () => {
    expect(deriveBattleSituation(NaN, 3)).toBe('even');
    expect(deriveBattleSituation(3, NaN)).toBe('even');
    expect(deriveBattleSituation(Infinity, 3)).toBe('even');
    expect(deriveBattleSituation(3, -Infinity)).toBe('even');
  });

  it('各状況にテンプレートが複数存在し rng を変えると異なる文面が生じうる', () => {
    // (c) 各状況にテンプレートが複数存在する。
    (['favored', 'upset', 'even'] as const).forEach((s) => {
      expect(SITUATION_TEMPLATE_COUNTS[s]).toBeGreaterThan(1);
      // rng を配列全域に振ると 2 種類以上の文面が生じうる。
      const count = SITUATION_TEMPLATE_COUNTS[s];
      const variants = new Set<string>();
      for (let i = 0; i < count; i++) {
        const r = (i + 0.5) / count; // 各インデックスの中央値
        variants.add(narrate({ winner: 'A', loser: 'B' }, () => r, s));
      }
      expect(variants.size).toBeGreaterThan(1);
    });
  });
});
