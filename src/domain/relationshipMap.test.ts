/**
 * relationshipMap（キャラ相関図の関係生成）のプロパティテスト（fast-check + Vitest）
 *
 * イテレーション14（キャラ相関図、要件22）で追加した純粋関数 `buildRelationshipMap` を
 * property-based testing で検証する。Correctness Property 30〜32 に対応する。
 *
 * - Property 30: 決定的・要素妥当・入力不変・0/1件で edges 空
 * - Property 31: 次数上限3・無向対称/正規化・自己ループなし
 * - Property 32: 軸メンバーシップ・スコア集約・代表ラベル・読み取り専用
 *
 * ジェネレータは design.md「ジェネレータ網羅」の相関図分に従い、0/1/多数の Character・
 * ImageColor 各値（'none' 含む）・metOn 妥当/未設定/同一 YYYY-MM/異なる月・favoriteLevel 1〜5・
 * 同値・★4以上同値/★3以下同値・次数超過が起きる密な集合・関係ゼロ集合を網羅する。
 *
 * 参照: design.md「Correctness Properties / Property 30〜32」「buildRelationshipMap」、
 * 要件22.1〜22.13, 22.16
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildRelationshipMap } from './relationshipMap';
import type { Character, ImageColor, PhotoData, RelationshipAxis } from './types';

// --- 定数（実装と独立に再定義してオラクルとする） ------------------------------

const IMAGE_COLOR_PRESETS: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

const LABEL_MUTUAL = '両想い級';
const LABEL_COLOR = 'おそろいカラー';
const LABEL_PERIOD = '同期';
const LABEL_CRUSH = '気になる存在';
const MUTUAL_THRESHOLD = 4;
const MAX_DEGREE = 3;

// --- ジェネレータ -------------------------------------------------------------

/** ダミー写真データ（小さな ArrayBuffer + MIME）。関係生成ロジックには影響しない。 */
const photoData: fc.Arbitrary<PhotoData> = fc
  .uint8Array({ minLength: 0, maxLength: 4 })
  .map((bytes) => ({ data: bytes.slice().buffer, type: 'image/png' }));

/**
 * 妥当な metOn（`YYYY-MM-DD`）または undefined を生成する。
 * 年月を狭い範囲（year 2000〜2001、month 1〜3）に寄せて、同一 YYYY-MM・異なる月の
 * 双方が高確率で発生するようにする。day は 1〜28 でうるう年を気にせず妥当。
 */
const metOnArb: fc.Arbitrary<string | undefined> = fc.option(
  fc
    .record({
      year: fc.integer({ min: 2000, max: 2001 }),
      month: fc.integer({ min: 1, max: 3 }),
      day: fc.integer({ min: 1, max: 28 }),
    })
    .map(({ year, month, day }) => {
      const y = String(year).padStart(4, '0');
      const m = String(month).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }),
  { nil: undefined },
);

/**
 * Character（関係生成に関わる属性のみ意味を持つ）を生成するファクトリ。
 * id は一意化のため index を埋め込む。favoriteLevel は 1〜5（★4以上/★3以下の同値が
 * 踏めるよう全域）、imageColor は 'none' を含む全プリセット、metOn は妥当/未設定を混在。
 */
function characterArb(index: number): fc.Arbitrary<Character> {
  return fc
    .record({
      seq: fc.integer({ min: 0, max: 20 }),
      favoriteLevel: fc.integer({ min: 1, max: 5 }),
      photo: photoData,
      createdAt: fc.integer({ min: 0, max: 8 }),
      metOn: metOnArb,
      imageColor: fc.constantFrom(...IMAGE_COLOR_PRESETS),
    })
    .map(({ seq, favoriteLevel, photo, createdAt, metOn, imageColor }) => ({
      // id は一意（index を末尾に埋め込む）。seq を前置して順序を揺らす。
      id: `c-${String(seq).padStart(3, '0')}-${String(index).padStart(3, '0')}`,
      name: '',
      nickname: '',
      memo: '',
      favoriteLevel,
      photo,
      createdAt,
      metOn,
      imageColor,
    }));
}

/**
 * 一意な id を持つ Character 配列を生成する（0〜10 件）。
 * favoriteLevel が 1〜5 の 5 値・imageColor が 6 値と少ないため、10 件規模で
 * 同一 favoriteLevel・同一 imageColor が多数生じ、次数超過（>3）が起きる密な集合や、
 * 逆にほとんど関係が生じない集合の双方を網羅する。0/1 件も範囲に含む。
 */
const charactersArb: fc.Arbitrary<Character[]> = fc
  .integer({ min: 0, max: 10 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => characterArb(i))));

// --- オラクル（実装と独立な参照ロジック） ------------------------------------

function yearMonth(metOn: string | undefined): string | null {
  return metOn === undefined ? null : metOn.slice(0, 7);
}

/** ペア (ca, cb) の該当軸を判定順（same-color, same-period, same-favorite）で返す。 */
function expectedAxes(ca: Character, cb: Character): RelationshipAxis[] {
  const axes: RelationshipAxis[] = [];
  if (ca.imageColor === cb.imageColor && ca.imageColor !== 'none') {
    axes.push('same-color');
  }
  const ym = yearMonth(ca.metOn);
  if (ym !== null && ym === yearMonth(cb.metOn)) {
    axes.push('same-period');
  }
  if (ca.favoriteLevel === cb.favoriteLevel) {
    axes.push('same-favorite');
  }
  return axes;
}

function isMutual(ca: Character, cb: Character): boolean {
  return ca.favoriteLevel >= MUTUAL_THRESHOLD && cb.favoriteLevel >= MUTUAL_THRESHOLD;
}

function expectedScore(axes: readonly RelationshipAxis[], mutual: boolean): number {
  let score = 0;
  for (const axis of axes) {
    if (axis === 'same-color') score += 3;
    else if (axis === 'same-period') score += 2;
    else if (axis === 'same-favorite') score += mutual ? 4 : 1;
  }
  return score;
}

function expectedLabel(axes: readonly RelationshipAxis[], mutual: boolean): string {
  const hasFavorite = axes.includes('same-favorite');
  if (hasFavorite && mutual) return LABEL_MUTUAL;
  if (axes.includes('same-color')) return LABEL_COLOR;
  if (axes.includes('same-period')) return LABEL_PERIOD;
  return LABEL_CRUSH;
}

/** id → Character のインデックスを作る。 */
function byId(chars: readonly Character[]): Map<string, Character> {
  const m = new Map<string, Character>();
  for (const c of chars) m.set(c.id, c);
  return m;
}

/** Character を関係生成に効く属性だけで深く比較するためのスナップショット。 */
function snapshot(chars: readonly Character[]): string {
  return JSON.stringify(
    chars.map((c) => ({
      id: c.id,
      favoriteLevel: c.favoriteLevel,
      metOn: c.metOn ?? null,
      imageColor: c.imageColor,
      name: c.name,
      nickname: c.nickname,
      memo: c.memo,
      createdAt: c.createdAt,
    })),
  );
}

/** 配列の順序を決定的に入れ替える（内容は不変）。 */
function reorder<T>(arr: readonly T[]): T[] {
  // 逆順にするだけで「入力順が違う」ケースを作れる。
  return arr.slice().reverse();
}

// --- Property 30 --------------------------------------------------------------

// Feature: chara-collection, Property 30: 相関図は決定的で要素妥当・入力を変更しない
describe('Property 30: buildRelationshipMap は決定的・要素妥当・入力不変', () => {
  it('決定性・要素妥当性・入力不変・0/1件で空を満たす', () => {
    fc.assert(
      fc.property(charactersArb, (characters) => {
        const before = snapshot(characters);
        const ids = new Set(characters.map((c) => c.id));

        const map1 = buildRelationshipMap(characters);

        // (c) 入力不変（配列内容が変化しない）。
        expect(snapshot(characters)).toBe(before);

        // (a) 決定性: 同一入力で再度呼んでも同一結果。
        const map2 = buildRelationshipMap(characters);
        expect(map2).toStrictEqual(map1);

        // (a) 入力順を変えても内容が同じなら同一結果（決定的順序）。
        const reordered = reorder(characters);
        const map3 = buildRelationshipMap(reordered);
        expect(map3).toStrictEqual(map1);

        // (d) 0/1 件なら edges は空。
        if (characters.length < 2) {
          expect(map1.edges).toEqual([]);
        }

        // (b) 要素妥当性。
        for (const e of map1.edges) {
          expect(ids.has(e.a)).toBe(true);
          expect(ids.has(e.b)).toBe(true);
          expect(e.score).toBeGreaterThanOrEqual(1);
          expect(e.axes.length).toBeGreaterThanOrEqual(1);
          expect(e.label.length).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 31 --------------------------------------------------------------

// Feature: chara-collection, Property 31: 相関図のグラフ不変条件（次数上限3・無向対称・自己ループなし）
describe('Property 31: buildRelationshipMap のグラフ不変条件', () => {
  it('次数上限3・無向対称/正規化・自己ループなしを満たす', () => {
    fc.assert(
      fc.property(charactersArb, (characters) => {
        const { edges } = buildRelationshipMap(characters);

        // (c) 自己ループなし & (b) 正規化 a < b。
        const seenPairs = new Set<string>();
        const degree = new Map<string, number>();
        for (const e of edges) {
          expect(e.a).not.toBe(e.b); // 自己ループなし
          expect(e.a < e.b).toBe(true); // a < b に正規化

          // (b) 同一無向ペアは高々 1 本。
          const key = `${e.a}\u0000${e.b}`;
          expect(seenPairs.has(key)).toBe(false);
          seenPairs.add(key);

          degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
          degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
        }

        // (a) 次数上限3。
        for (const [, d] of degree) {
          expect(d).toBeLessThanOrEqual(MAX_DEGREE);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 32 --------------------------------------------------------------

// Feature: chara-collection, Property 32: 相関図の関係軸・スコア集約・ラベルの判定は定義どおり
describe('Property 32: buildRelationshipMap の軸・スコア・ラベル判定', () => {
  it('軸メンバーシップ・スコア集約・代表ラベル・読み取り専用を満たす', () => {
    fc.assert(
      fc.property(charactersArb, (characters) => {
        const before = snapshot(characters);
        const index = byId(characters);
        const { edges } = buildRelationshipMap(characters);

        // (d) 読み取り専用（入力不変）。
        expect(snapshot(characters)).toBe(before);

        for (const e of edges) {
          const ca = index.get(e.a)!;
          const cb = index.get(e.b)!;
          const axes = expectedAxes(ca, cb);
          const mutual = isMutual(ca, cb);

          // (a) 軸メンバーシップ: 実装の axes は定義どおりの該当軸集合と一致。
          expect(e.axes).toEqual(axes);
          // 該当軸が 1 つ以上あるからエッジが存在する（空はありえない）。
          expect(axes.length).toBeGreaterThanOrEqual(1);

          // (b) スコア集約。
          expect(e.score).toBe(expectedScore(axes, mutual));

          // (c) 代表ラベル。
          expect(e.label).toBe(expectedLabel(axes, mutual));
        }
      }),
      { numRuns: 100 },
    );
  });
});
