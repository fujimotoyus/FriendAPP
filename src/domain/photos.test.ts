// Feature: chara-collection, Property 33: 複数写真の取り込みは順序を保ち5枚に制限する
/**
 * addPhotos（複数写真の取り込み・連結・5枚制限）のプロパティテスト（fast-check + Vitest）
 *
 * Property 33: 任意の既存写真列 current（0〜5枚の PhotoData[]）と取り込み写真列 incoming
 * （任意枚数の PhotoData[]）について、addPhotos(current, incoming) は次を満たす。
 *   (a) 順序保存: 戻り値 photos は current の全要素に続けて incoming の要素を取り込み順に
 *       連結した列の、先頭から最大 PHOTOS_MAX（= 5）枚の prefix に等しい。
 *   (b) 上限: photos.length <= 5 を常に満たす。
 *   (c) truncated: current.length + incoming.length > 5 のとき true、そうでなければ false。
 *   (d) 入力不変: current / incoming（配列および各 PhotoData）を一切変更しない（純粋関数）。
 *
 * Validates: Requirements 23.2, 23.3, 23.14
 * 参照: design.md「イテレーション15」「Correctness Properties / Property 33」「addPhotos」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { addPhotos, PHOTOS_MAX } from './photos';
import type { PhotoData } from './types';

// --- ジェネレータ -------------------------------------------------------------

/** ダミー写真データ（小さな ArrayBuffer + MIME）。 */
const photoDataArb: fc.Arbitrary<PhotoData> = fc
  .record({
    bytes: fc.uint8Array({ minLength: 0, maxLength: 6 }),
    type: fc.constantFrom('image/png', 'image/jpeg', 'image/webp'),
  })
  .map(({ bytes, type }) => ({ data: bytes.slice().buffer, type }));

/** current: 0〜5 枚（上限ちょうど・超過直前を踏みやすくする）。 */
const currentArb: fc.Arbitrary<PhotoData[]> = fc.array(photoDataArb, {
  minLength: 0,
  maxLength: PHOTOS_MAX,
});

/** incoming: 0〜8 枚（連結後に上限超過が起こりやすい範囲）。 */
const incomingArb: fc.Arbitrary<PhotoData[]> = fc.array(photoDataArb, {
  minLength: 0,
  maxLength: 8,
});

// --- ヘルパ -------------------------------------------------------------------

function toBytes(p: PhotoData): number[] {
  return Array.from(new Uint8Array(p.data));
}

/** PhotoData を内容（バイト列 + MIME）で比較する。 */
function samePhoto(a: PhotoData, b: PhotoData): boolean {
  if (a.type !== b.type) return false;
  const ba = toBytes(a);
  const bb = toBytes(b);
  if (ba.length !== bb.length) return false;
  for (let i = 0; i < ba.length; i += 1) {
    if (ba[i] !== bb[i]) return false;
  }
  return true;
}

/** PhotoData[] を内容ベースのスナップショットへ変換（入力不変の検証用）。 */
function snapshot(photos: readonly PhotoData[]): { type: string; bytes: number[] }[] {
  return photos.map((p) => ({ type: p.type, bytes: toBytes(p) }));
}

// --- プロパティ ---------------------------------------------------------------

describe('addPhotos — Property 33: 複数写真の取り込みは順序を保ち5枚に制限する', () => {
  it('(a) 順序保存: photos は current+incoming の先頭から最大5枚の prefix に等しい', () => {
    fc.assert(
      fc.property(currentArb, incomingArb, (current, incoming) => {
        const combined = [...current, ...incoming];
        const expected = combined.slice(0, PHOTOS_MAX);
        const { photos } = addPhotos(current, incoming);
        expect(photos.length).toBe(expected.length);
        photos.forEach((p, i) => {
          expect(samePhoto(p, expected[i])).toBe(true);
        });
      }),
      { numRuns: 100 },
    );
  });

  it('(b) 上限: photos.length <= PHOTOS_MAX（= 5）を常に満たす', () => {
    fc.assert(
      fc.property(currentArb, incomingArb, (current, incoming) => {
        const { photos } = addPhotos(current, incoming);
        expect(photos.length).toBeLessThanOrEqual(PHOTOS_MAX);
      }),
      { numRuns: 100 },
    );
  });

  it('(c) truncated: current.length + incoming.length > 5 と一致する', () => {
    fc.assert(
      fc.property(currentArb, incomingArb, (current, incoming) => {
        const { truncated } = addPhotos(current, incoming);
        expect(truncated).toBe(current.length + incoming.length > PHOTOS_MAX);
      }),
      { numRuns: 100 },
    );
  });

  it('(d) 入力不変: current / incoming（配列・各 PhotoData）を変更しない', () => {
    fc.assert(
      fc.property(currentArb, incomingArb, (current, incoming) => {
        const currentBefore = snapshot(current);
        const incomingBefore = snapshot(incoming);
        const currentLen = current.length;
        const incomingLen = incoming.length;

        addPhotos(current, incoming);

        // 配列長・順序・内容が不変。
        expect(current.length).toBe(currentLen);
        expect(incoming.length).toBe(incomingLen);
        expect(snapshot(current)).toEqual(currentBefore);
        expect(snapshot(incoming)).toEqual(incomingBefore);
      }),
      { numRuns: 100 },
    );
  });
});
