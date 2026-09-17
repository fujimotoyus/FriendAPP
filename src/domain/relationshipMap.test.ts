/**
 * relationshipMap（キャラ相関図の関係生成）のプロパティテスト（fast-check + Vitest）
 *
 * イテレーション14（キャラ相関図、要件22）で id 由来・決定的・登録データ非依存に作り替えた
 * 純粋関数 `buildRelationshipMap` を property-based testing で検証する。
 * Correctness Property 30〜32 に対応する。
 *
 * - Property 30: 決定的・要素妥当・入力不変・0/1件で edges 空・登録データ非依存
 * - Property 31: 次数上限3・無向対称/正規化・自己ループなし
 * - Property 32: 関係タグ/向きあり印象の id 由来決定性・妥当性・方向性・読み取り専用
 *
 * ジェネレータは design.md「ジェネレータ網羅」の相関図分に従い、0/1/多数の Character・
 * id の多様さ（辞書順が入れ替わる組・区切り文字を含む・空文字近縁）・次数超過が起きる密な
 * 集合を網羅する。登録データ非依存の検証のため「同一 id 集合を持ち imageColor/metOn/
 * favoriteLevel だけ差し替えた対の集合」を生成して比較する。
 *
 * オラクルは実装が export する定数（`TAGS`/`IMPRESSIONS`）とハッシュ（`fnv1a32`）を import して
 * 使い、実装内部の再実装（重複定義）に依存しないようにする。
 *
 * 参照: design.md「Correctness Properties / Property 30〜32」「buildRelationshipMap」、
 * 要件22.1〜22.14
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  buildRelationshipMap,
  TAGS,
  IMPRESSIONS,
  pickTag,
  pickImpression,
} from './relationshipMap';
import { fnv1a32 } from './DailyPickSelector';
import type { Character, ImageColor, PhotoData } from './types';

const MAX_DEGREE = 3;

const IMAGE_COLOR_PRESETS: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

// --- ジェネレータ -------------------------------------------------------------

/** ダミー写真データ（小さな ArrayBuffer + MIME）。関係生成ロジックには影響しない。 */
const photoData: fc.Arbitrary<PhotoData> = fc
  .uint8Array({ minLength: 0, maxLength: 4 })
  .map((bytes) => ({ data: bytes.slice().buffer, type: 'image/png' }));

/** 妥当な metOn（`YYYY-MM-DD`）または undefined。登録データ非依存性の検証用に多様な値を生成。 */
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
 * id 集合を多様に生成する（0〜10 件・一意）。
 * - 辞書順が入れ替わる組（数字/英字混在・長短）
 * - 区切り文字（`\u0000`・`>`・`-`）を含む id
 * - 空文字に近い短い id
 * これらにより a<b 正規化・区切り衝突耐性・密な次数超過の集合を踏む。
 */
const idFragmentArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', 'a', 'b', 'z', '0', '10', '2', '>', '-', '\u0000', 'aa'),
  fc.string({ minLength: 0, maxLength: 4 }),
);

const idsArb: fc.Arbitrary<string[]> = fc.uniqueArray(
  fc
    .tuple(idFragmentArb, fc.integer({ min: 0, max: 9999 }))
    .map(([frag, seq]) => `${frag}#${seq}`),
  { minLength: 0, maxLength: 10, selector: (id) => id },
);

/** id 集合に対して、登録データ（favoriteLevel/metOn/imageColor）をランダムに割り当てた Character 配列を作る。 */
function charactersFromIds(
  ids: readonly string[],
  payloads: readonly {
    favoriteLevel: number;
    metOn: string | undefined;
    imageColor: ImageColor;
    photo: PhotoData;
    createdAt: number;
  }[],
): Character[] {
  return ids.map((id, i) => ({
    id,
    name: '',
    nickname: '',
    memo: '',
    favoriteLevel: payloads[i].favoriteLevel,
    photo: payloads[i].photo,
    createdAt: payloads[i].createdAt,
    metOn: payloads[i].metOn,
    imageColor: payloads[i].imageColor,
  }));
}

const payloadArb = fc.record({
  favoriteLevel: fc.integer({ min: 1, max: 5 }),
  metOn: metOnArb,
  imageColor: fc.constantFrom(...IMAGE_COLOR_PRESETS),
  photo: photoData,
  createdAt: fc.integer({ min: 0, max: 8 }),
});

/** 一意な id を持つ Character 配列を生成する（0〜10 件）。 */
const charactersArb: fc.Arbitrary<Character[]> = idsArb.chain((ids) =>
  fc
    .tuple(...ids.map(() => payloadArb))
    .map((payloads) => charactersFromIds(ids, payloads)),
);

/**
 * 同一 id 集合を持ち、登録データ（favoriteLevel/metOn/imageColor）だけが異なる 2 つの
 * Character 集合の対を生成する（登録データ非依存性の検証用）。
 */
const characterPairArb: fc.Arbitrary<[Character[], Character[]]> = idsArb.chain((ids) =>
  fc
    .tuple(
      fc.tuple(...ids.map(() => payloadArb)),
      fc.tuple(...ids.map(() => payloadArb)),
    )
    .map(([p1, p2]) => [charactersFromIds(ids, p1), charactersFromIds(ids, p2)]),
);

// --- 補助 ---------------------------------------------------------------------

/** Character を「関係生成に効く属性＋登録データ」を含めて深く比較するためのスナップショット。 */
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
  return arr.slice().reverse();
}

// --- Property 30 --------------------------------------------------------------

// Feature: chara-collection, Property 30: 相関図は決定的で要素妥当・入力を変更しない・登録データに依存しない
describe('Property 30: buildRelationshipMap は決定的・要素妥当・入力不変・登録データ非依存', () => {
  it('決定性・要素妥当性・入力不変・0/1件で空・登録データ非依存を満たす', () => {
    fc.assert(
      fc.property(characterPairArb, ([characters, variant]) => {
        const before = snapshot(characters);
        const ids = new Set(characters.map((c) => c.id));

        const map1 = buildRelationshipMap(characters);

        // (c) 入力不変（配列内容が変化しない）。
        expect(snapshot(characters)).toBe(before);

        // (a) 決定性: 同一入力で再度呼んでも同一結果。
        const map2 = buildRelationshipMap(characters);
        expect(map2).toStrictEqual(map1);

        // (a) 入力順を変えても同一結果（決定的順序）。
        const map3 = buildRelationshipMap(reorder(characters));
        expect(map3).toStrictEqual(map1);

        // (d) 0/1 件なら edges は空。
        if (characters.length < 2) {
          expect(map1.edges).toEqual([]);
        }

        // (b) 要素妥当性。
        for (const e of map1.edges) {
          expect(ids.has(e.a)).toBe(true);
          expect(ids.has(e.b)).toBe(true);
          expect(TAGS.includes(e.tag)).toBe(true);
          expect(e.impressionAtoB.length).toBeGreaterThanOrEqual(1);
          expect(e.impressionBtoA.length).toBeGreaterThanOrEqual(1);
          expect(typeof e.score).toBe('number');
          expect(Number.isNaN(e.score)).toBe(false);
        }

        // (e) 登録データ非依存: 同一 id 集合で色/日付/お気に入り度を変えても完全一致。
        const mapVariant = buildRelationshipMap(variant);
        expect(mapVariant).toStrictEqual(map1);
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

        const seenPairs = new Set<string>();
        const degree = new Map<string, number>();
        for (const e of edges) {
          // (c) 自己ループなし。
          expect(e.a).not.toBe(e.b);
          // (b) a < b に正規化。
          expect(e.a < e.b).toBe(true);

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

// Feature: chara-collection, Property 32: 相関図の関係タグと向きあり印象は id 由来で決定的・妥当
describe('Property 32: buildRelationshipMap の関係タグ・向きあり印象の id 由来決定性/妥当性', () => {
  it('タグ/印象の決定性・妥当性・方向性・読み取り専用を満たす', () => {
    fc.assert(
      fc.property(charactersArb, (characters) => {
        const before = snapshot(characters);
        const { edges } = buildRelationshipMap(characters);

        // (d) 読み取り専用（入力不変）。
        expect(snapshot(characters)).toBe(before);

        for (const e of edges) {
          // (a) 関係タグの決定性・妥当性: id のみ由来のハッシュ mod 5。
          const expectedTag = TAGS[fnv1a32(`${e.a}\u0000${e.b}`) % TAGS.length];
          expect(e.tag).toBe(expectedTag);
          expect(e.tag).toBe(pickTag(e.a, e.b));
          expect(TAGS.includes(e.tag)).toBe(true);

          // (b) 向きあり印象の決定性・妥当性: from>to 順のハッシュ、テンプレート集の非空要素。
          const expectedAtoB = IMPRESSIONS[fnv1a32(`${e.a}>${e.b}`) % IMPRESSIONS.length];
          const expectedBtoA = IMPRESSIONS[fnv1a32(`${e.b}>${e.a}`) % IMPRESSIONS.length];
          expect(e.impressionAtoB).toBe(expectedAtoB);
          expect(e.impressionBtoA).toBe(expectedBtoA);
          expect(e.impressionAtoB).toBe(pickImpression(e.a, e.b));
          expect(e.impressionBtoA).toBe(pickImpression(e.b, e.a));
          expect(IMPRESSIONS.includes(e.impressionAtoB)).toBe(true);
          expect(IMPRESSIONS.includes(e.impressionBtoA)).toBe(true);
          expect(e.impressionAtoB.length).toBeGreaterThanOrEqual(1);
          expect(e.impressionBtoA.length).toBeGreaterThanOrEqual(1);

          // (c) 方向性: 同一有向ペアは常に同一（決定的）。
          expect(pickImpression(e.a, e.b)).toBe(pickImpression(e.a, e.b));
          expect(pickImpression(e.b, e.a)).toBe(pickImpression(e.b, e.a));
        }
      }),
      { numRuns: 100 },
    );
  });
});
