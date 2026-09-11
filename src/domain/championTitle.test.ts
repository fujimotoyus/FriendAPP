/**
 * buildChampionTitle（優勝見出し、要件20.6, 21, 19.6）のプロパティテスト（fast-check + Vitest）
 *
 * Property 29: 優勝見出しはお題に連動し常に非空。
 * 任意の `theme` 文字列（既存8お題ラベル・対応未定義の任意ラベル・空文字を含む）について、
 *   (a) `buildChampionTitle(theme)` は常に非空文字列を返す
 *   (b) `theme` が空文字のとき既定見出し（「最も好きなキャラ」を含む）を返す
 *   (c) `theme` が非空のとき `getBattleThemeAspect(theme)` が返す観点ワードを含む
 *       「{観点}No.1」形式の見出しを返す
 * また、いずれの場合も見出しに冠 `👑` を含む。
 *
 * Validates: Requirements 20.6, 21, 19.6
 * 参照: design.md「Correctness Properties / Property 29」「battleTheme」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildChampionTitle, getBattleThemeAspect } from './battleTheme';

// 既存8お題ラベル（THEME_ASPECTS のキーと同一）。
const KNOWN_THEMES: ReadonlyArray<string> = [
  'かわいい選手権',
  'たよれる度No.1決定戦',
  '今いちばん会いたい子は？',
  'キュンとくるのは誰だ！？',
  '癒やしオーラ王者決定戦',
  'いっしょにいたい子グランプリ',
  'ときめきトーナメント',
  '推し度ナンバーワン決定戦',
];

// theme 生成器: 既存8お題ラベル・任意の未知文字列・空文字を含める。
const themeArb = fc.oneof(
  fc.constantFrom(...KNOWN_THEMES),
  fc.string(),
  fc.constant(''),
);

// Feature: chara-collection, Property 29: 優勝見出しはお題に連動し常に非空
describe('buildChampionTitle (Property 29)', () => {
  it('常に非空・冠付きで、お題に連動した見出しを返す', () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        const title = buildChampionTitle(theme);
        // (a) 常に非空文字列。
        expect(title.length).toBeGreaterThan(0);
        // 冠 👑 を必ず含む。
        expect(title).toContain('👑');
        if (theme === '') {
          // (b) 空文字は既定見出し（「最も好きなキャラ」を含む）。
          expect(title).toContain('最も好きなキャラ');
        } else {
          // (c) 非空なら観点ワードを含み「{観点}No.1」形式。
          const aspect = getBattleThemeAspect(theme);
          expect(title).toContain(aspect);
          expect(title).toContain(`${aspect}No.1`);
        }
      }),
      { numRuns: 100 },
    );
  });
});
