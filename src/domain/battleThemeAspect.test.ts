/**
 * お題の観点ワード（Theme_Aspect）を織り込んだ実況（要件19.6, 21）のプロパティテスト
 * （fast-check + Vitest）
 *
 * Property 28: お題の観点ワードを織り込んだ実況。
 * 任意の勝者/敗者名・rng・situation（favored/upset/even/省略）・aspect（非空文字列）について、
 *   (a) `getBattleThemeAspect` は既存8お題ラベルおよび対応未定義の任意文字列（空文字含む）に
 *       対し常に非空の観点ワードを返す
 *   (b) `narrate(pair, rng, situation, aspect)` は非空で勝者名を含む文字列を返す
 *   (c) aspect を指定すると観点を織り込んだ文面を生成しうる（aspect 入りテンプレートが存在し、
 *       少なくとも 1 つの rng で aspect を含む出力になる）
 *   (d) rng を変えると同一入力でも複数の異なる文面が生じうる
 *   (e) aspect 省略時は従来挙動（Property 25 相当：非空・勝者名含む）を保つ
 *
 * Validates: Requirements 19.6, 21
 * 参照: design.md「Correctness Properties / Property 28」「battleTheme」「BattleCommentator」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getBattleThemeAspect,
  BATTLE_THEME_COUNT,
  pickBattleTheme,
} from './battleTheme';
import { narrate, SITUATION_TEMPLATE_COUNTS } from './BattleCommentator';
import type { BattleSituation } from './types';

const name = fc.string({ minLength: 1, maxLength: 20 });
const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });
const aspectArb = fc.string({ minLength: 1, maxLength: 12 });
const situationArb: fc.Arbitrary<BattleSituation | undefined> = fc.constantFrom(
  'favored',
  'upset',
  'even',
  undefined,
);

// 全域 rng で得られる既存8お題ラベルの集合を再構成する。
function allThemes(): string[] {
  const s = new Set<string>();
  for (let i = 0; i < BATTLE_THEME_COUNT; i++) {
    const r = (i + 0.5) / BATTLE_THEME_COUNT;
    s.add(pickBattleTheme(() => r));
  }
  return [...s];
}

// Feature: chara-collection, Property 28: お題の観点ワードを織り込んだ実況
describe('battleTheme aspect + narrate (Property 28)', () => {
  it('(a) getBattleThemeAspect は既存8お題および任意ラベルにも非空の観点ワードを返す', () => {
    // 既存8お題は例示で確認。
    for (const theme of allThemes()) {
      expect(getBattleThemeAspect(theme).length).toBeGreaterThan(0);
    }
    // 対応未定義の任意文字列（空文字含む）でも常に非空。
    fc.assert(
      fc.property(fc.string(), (label) => {
        expect(getBattleThemeAspect(label).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) narrate(pair, rng, situation, aspect) は非空で勝者名を含む', () => {
    fc.assert(
      fc.property(name, name, unit, situationArb, aspectArb, (winner, loser, r, situation, aspect) => {
        const text = narrate({ winner, loser }, () => r, situation, aspect);
        expect(text.length).toBeGreaterThan(0);
        expect(text.includes(winner)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('(c) aspect を指定すると観点を織り込んだ文面が生成されうる', () => {
    // aspect は名前と混ざらないよう識別しやすいマーカーを用いる。
    const aspect = 'ASPECT_MARK';
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !s.includes(aspect)),
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => !s.includes(aspect)),
        situationArb,
        (winner, loser, situation) => {
          // 各テンプレート集全域の rng を試し、少なくとも 1 つで aspect を含む出力になる。
          // aspect 入りテンプレートは各集合すべての要素が aspect を差し込むため、
          // どの rng でも aspect を含む（存在性を強めに確認）。
          const found = [0.05, 0.3, 0.55, 0.8, 0.95].some((r) => {
            const text = narrate({ winner, loser }, () => r, situation, aspect);
            return text.includes(aspect);
          });
          expect(found).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(d) rng を変えると同一入力でも複数の異なる文面が生じうる', () => {
    const aspect = '観点';
    (['favored', 'upset', 'even'] as const).forEach((s) => {
      const variants = new Set<string>();
      // 状況別 aspect テンプレートは複数存在するので、全域 rng で 2 種類以上生じうる。
      const probe = Math.max(SITUATION_TEMPLATE_COUNTS[s], 4);
      for (let i = 0; i < probe; i++) {
        const r = (i + 0.5) / probe;
        variants.add(narrate({ winner: 'A', loser: 'B' }, () => r, s, aspect));
      }
      expect(variants.size).toBeGreaterThan(1);
    });
  });

  it('(e) aspect 省略時は従来挙動（非空・勝者名含む）を保つ', () => {
    fc.assert(
      fc.property(name, name, unit, situationArb, (winner, loser, r, situation) => {
        // aspect 未指定・空文字はいずれも従来経路へフォールバック。
        const omitted = narrate({ winner, loser }, () => r, situation);
        const empty = narrate({ winner, loser }, () => r, situation, '');
        expect(omitted.length).toBeGreaterThan(0);
        expect(omitted.includes(winner)).toBe(true);
        // 空文字 aspect は省略と同一挙動（従来経路）。
        expect(empty).toBe(omitted);
      }),
      { numRuns: 100 },
    );
  });
});
