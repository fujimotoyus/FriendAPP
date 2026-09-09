/**
 * InMemoryCharacterStore の保存・復元ラウンドトリッププロパティテスト（fast-check + Vitest）
 *
 * Property 20: 出会った日・イメージカラーを含む保存・復元ラウンドトリップ。
 * 任意の妥当な `metOn`（`YYYY-MM-DD` または `undefined`）と任意の `ImageColor` を持つ
 * Character を保存後に取得すると、写真バイト内容を含む全属性・`metOn`・`imageColor` が
 * 等価に復元される。加えて、これらの属性を持たない/不正値の旧データは読み出し時に
 * `metOn` 欠落/不正 → `undefined`、`imageColor` 欠落/不正 → `'none'` に正規化される。
 *
 * Validates: Requirements 14.2, 14.3, 14.11, 15.2, 15.3, 15.5
 * 参照: design.md「Correctness Properties / Property 20」「Persistence（後方互換正規化）」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { InMemoryCharacterStore } from './InMemoryCharacterStore';
import type { Character, ImageColor, PhotoData } from '../domain/types';

/** イメージカラーのプリセット許容値（`types.ts` の {@link ImageColor} と一致）。 */
const IMAGE_COLOR_PRESETS: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

/** 妥当な ImageColor プリセットを生成するアービトラリ。 */
const imageColor: fc.Arbitrary<ImageColor> = fc.constantFrom(...IMAGE_COLOR_PRESETS);

/** 写真データ（ArrayBuffer + MIME）を生成するアービトラリ。 */
const photoData: fc.Arbitrary<PhotoData> = fc.record({
  bytes: fc.uint8Array({ minLength: 0, maxLength: 64 }),
  type: fc.constantFrom('image/jpeg', 'image/png', 'image/webp'),
}).map(({ bytes, type }) => ({
  // ArrayBuffer として保持する（Uint8Array のバッキングバッファをコピーして切り出す）。
  data: bytes.slice().buffer,
  type,
}));

/**
 * 妥当な `metOn`（`YYYY-MM-DD`）または `undefined` を生成するアービトラリ。
 * fc.date から UTC ベースでゼロ埋めの `YYYY-MM-DD` を組む。
 */
const metOn: fc.Arbitrary<string | undefined> = fc.option(
  fc
    .date({
      min: new Date(Date.UTC(1900, 0, 1)),
      max: new Date(Date.UTC(2099, 11, 31)),
    })
    .map((d) => {
      const y = String(d.getUTCFullYear()).padStart(4, '0');
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }),
  { nil: undefined },
);

/** 妥当な Character を生成するアービトラリ（新フィールド metOn / imageColor を含む）。 */
const validCharacter: fc.Arbitrary<Character> = fc.record({
  id: fc.uuid(),
  name: fc.string({ maxLength: 50 }),
  nickname: fc.string({ maxLength: 50 }),
  memo: fc.string({ maxLength: 500 }),
  favoriteLevel: fc.integer({ min: 1, max: 5 }),
  photo: photoData,
  createdAt: fc.integer({ min: 0, max: 4_000_000_000_000 }),
  metOn,
  imageColor,
});

/** 一意な id を持つ Character 群を生成するアービトラリ。 */
const uniqueCharacters: fc.Arbitrary<Character[]> = fc.uniqueArray(validCharacter, {
  minLength: 1,
  maxLength: 20,
  selector: (c) => c.id,
});

/** ArrayBuffer のバイト内容が完全一致するかを検証するヘルパ。 */
function expectSamePhotoBytes(actual: ArrayBuffer, expected: ArrayBuffer): void {
  const a = new Uint8Array(actual);
  const e = new Uint8Array(expected);
  expect(a.length).toBe(e.length);
  for (let i = 0; i < e.length; i += 1) {
    expect(a[i]).toBe(e[i]);
  }
}

describe('InMemoryCharacterStore ラウンドトリップ — Property 20', () => {
  // Feature: chara-collection, Property 20: 出会った日・イメージカラーを含む保存・復元ラウンドトリップ
  it('妥当な Character を保存後に取得すると全属性・写真バイト・metOn・imageColor が等価に復元される', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueCharacters, async (characters) => {
        const store = new InMemoryCharacterStore();
        for (const character of characters) {
          await store.insert(character);
        }

        const fetched = await store.fetchAll();
        expect(fetched).toHaveLength(characters.length);

        const byId = new Map(fetched.map((c) => [c.id, c]));
        for (const original of characters) {
          const restored = byId.get(original.id);
          expect(restored).toBeDefined();
          if (!restored) return;

          // スカラー属性の等価復元。
          expect(restored.id).toBe(original.id);
          expect(restored.name).toBe(original.name);
          expect(restored.nickname).toBe(original.nickname);
          expect(restored.memo).toBe(original.memo);
          expect(restored.favoriteLevel).toBe(original.favoriteLevel);
          expect(restored.createdAt).toBe(original.createdAt);

          // 新フィールド（metOn / imageColor）の等価復元。妥当値なのでそのまま保持される。
          expect(restored.metOn).toBe(original.metOn);
          expect(restored.imageColor).toBe(original.imageColor);

          // 写真: MIME とバイト内容が完全一致する。
          expect(restored.photo.type).toBe(original.photo.type);
          expectSamePhotoBytes(restored.photo.data, original.photo.data);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: chara-collection, Property 20: 出会った日・イメージカラーを含む保存・復元ラウンドトリップ
  it('metOn 欠落/不正は undefined・imageColor 欠落/不正は none に読み出し時正規化される', async () => {
    // metOn を持たない/不正な旧データ相当の値。
    const rawMetOn = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('2024/03/05'),
      fc.constant('not-a-date'),
      fc.constant('20240305'),
      fc.integer(),
    );

    // imageColor を持たない/不正な旧データ相当の値（プリセット外）。
    const rawImageColor = fc.oneof(
      fc.constant(undefined),
      fc.constant(''),
      fc.constant('crimson'),
      fc.constant('NONE'),
      fc.integer(),
    );

    await fc.assert(
      fc.asyncProperty(
        validCharacter,
        rawMetOn,
        rawImageColor,
        async (base, badMetOn, badImageColor) => {
          // 型を緩めて「新フィールドが欠落/不正な旧データ」を構築する（as Character）。
          const legacy = {
            ...base,
            metOn: badMetOn,
            imageColor: badImageColor,
          } as unknown as Character;

          const store = new InMemoryCharacterStore([legacy]);
          const [restored] = await store.fetchAll();

          // metOn 欠落/形式不正 → undefined へ正規化（要件14.11）。
          expect(restored.metOn).toBeUndefined();

          // imageColor 欠落/不正 → 'none' へ正規化（要件15.2, 15.3, 15.5）。
          expect(restored.imageColor).toBe('none');

          // 正規化は新フィールド以外の属性を壊さない。
          expect(restored.id).toBe(base.id);
          expect(restored.favoriteLevel).toBe(base.favoriteLevel);
          expect(restored.photo.type).toBe(base.photo.type);
        },
      ),
      { numRuns: 100 },
    );
  });
});
