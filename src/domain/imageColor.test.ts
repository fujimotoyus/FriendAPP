/**
 * imageColor のプロパティテスト（fast-check + Vitest）
 *
 * Property 22: イメージカラーの正規化と縁取り導出。
 * 参照: design.md「Correctness Properties / Property 22」、要件15.4, 15.6, 15.7, 15.8
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { deriveImageColorStyle } from './imageColor';
import type { ImageColor } from './types';

/** 縁取り対象のプリセット5色。 */
const PRESET_COLORS = ['rose', 'mint', 'lavender', 'butter', 'sky'] as const;

/** プリセット5色（縁取りあり）を生成するアービトラリ。 */
const presetColor = fc.constantFrom(...PRESET_COLORS);

/**
 * 許容値以外の任意文字列を生成するアービトラリ。
 * プリセット5色に一致する文字列は除外する（それらは縁取りありのため）。
 */
const nonPresetString = fc
  .string()
  .filter((s) => !(PRESET_COLORS as readonly string[]).includes(s));

describe('deriveImageColorStyle — Property 22', () => {
  // Feature: chara-collection, Property 22: イメージカラーの正規化と縁取り導出（プリセット5色はちょうど対応する --image-color-{color} を伴い hasBorder === true）
  it('プリセット5色は hasBorder === true かつ borderVarName === `--image-color-${color}` を返す', () => {
    fc.assert(
      fc.property(presetColor, (color) => {
        const style = deriveImageColorStyle(color);
        expect(style.hasBorder).toBe(true);
        expect(style.borderVarName).toBe(`--image-color-${color}`);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: chara-collection, Property 22: イメージカラーの正規化と縁取り導出（'none'/許容値以外は hasBorder === false かつ borderVarName === undefined）
  it("'none' および許容値以外の任意文字列は hasBorder === false かつ borderVarName === undefined を返す", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant('none'), nonPresetString), (value) => {
        // 不正値も含めた堅牢性の検証のため、型アサーションで渡す。
        const style = deriveImageColorStyle(value as ImageColor);
        expect(style.hasBorder).toBe(false);
        expect(style.borderVarName).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
