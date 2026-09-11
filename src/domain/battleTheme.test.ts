/**
 * pickBattleTheme（対戦のお題、要件21）のプロパティテスト（fast-check + Vitest）
 *
 * Property 27: 対戦のお題は非空でお題集合の要素であり rng で変動しうる。
 * 任意の rng について、
 *   (a) `pickBattleTheme` は非空文字列を返す
 *   (b) 返り値は必ずお題集合（テンプレート配列）の要素である
 *   (c) rng を変えると複数の異なるお題が生じうる（テンプレートが複数存在する）
 *
 * Validates: Requirements 21
 * 参照: design.md「Correctness Properties / Property 27」「battleTheme」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pickBattleTheme, BATTLE_THEME_COUNT } from './battleTheme';

// テンプレート配列は non-export のため、全域 rng で得られる集合を「お題集合」として再構成する。
function allThemes(): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < BATTLE_THEME_COUNT; i++) {
    const r = (i + 0.5) / BATTLE_THEME_COUNT;
    s.add(pickBattleTheme(() => r));
  }
  return s;
}

const unit = fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true });

// Feature: chara-collection, Property 27: 対戦のお題は非空でお題集合の要素であり rng で変動しうる
describe('pickBattleTheme (Property 27)', () => {
  it('非空でお題集合の要素を返す', () => {
    const themes = allThemes();
    fc.assert(
      fc.property(unit, (r) => {
        const theme = pickBattleTheme(() => r);
        // (a) 非空。
        expect(theme.length).toBeGreaterThan(0);
        // (b) お題集合の要素。
        expect(themes.has(theme)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('お題が複数存在し rng を変えると異なるお題が生じうる', () => {
    // (c) テンプレートが複数・全域 rng で 2 種類以上生じうる。
    expect(BATTLE_THEME_COUNT).toBeGreaterThan(1);
    expect(allThemes().size).toBeGreaterThan(1);
  });
});
