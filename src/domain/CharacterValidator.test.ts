/**
 * CharacterValidator（入力検証）のユニットテスト ＋ プロパティテスト（fast-check + Vitest）
 *
 * イテレーション15（複数写真対応、要件23）により写真は単数 `photo` から
 * `photos: PhotoData[]`（1枚以上・最大5枚）へ拡張された。本テストは `validate` の
 * 写真チェックが「1枚以上必須／上限超過はエラー」へ更新されたことを検証する。
 *
 * Property 3: 写真は1枚以上必須。
 * 任意の有効な draft（他フィールドは妥当）について、`draft.photos.length` が 0 のとき
 * `field: 'photo'` のエラーを必ず返し、1〜PHOTOS_MAX 枚のとき photo エラーを返さず、
 * PHOTOS_MAX 超過のとき `field: 'photo'`（上限超過）エラーを返す。いずれの場合も
 * `validate` は入力 draft（および photos 配列）を変更しない。
 *
 * Validates: Requirements 23.4, 23.13
 * 参照: design.md「Correctness Properties / Property 3」「イテレーション15」「CharacterValidator」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validate, isValid } from './CharacterValidator';
import { PHOTOS_MAX } from './photos';
import type { CharacterDraft, ImageColor, PhotoData } from './types';

// --- ヘルパ / ジェネレータ ----------------------------------------------------

/** ダミー写真（小さな ArrayBuffer + MIME）。写真チェックは枚数のみを見る。 */
function makePhoto(byte = 1): PhotoData {
  return { data: new Uint8Array([byte]).buffer, type: 'image/png' };
}

/** 枚数 n の photos 配列を作る。 */
function makePhotos(n: number): PhotoData[] {
  return Array.from({ length: n }, (_, i) => makePhoto(i + 1));
}

const IMAGE_COLOR_PRESETS: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

/** 他フィールドが妥当な draft を作るファクトリ（写真枚数のみ可変）。 */
function makeValidDraft(photoCount: number): CharacterDraft {
  return {
    name: 'ゆうき',
    nickname: 'ゆう',
    memo: 'メモ',
    favoriteLevel: 3,
    photos: makePhotos(photoCount),
    metOn: undefined,
    imageColor: 'none',
  };
}

// --- ユニットテスト（代表例・エッジ） ----------------------------------------

describe('validate（写真は1枚以上必須・最大5枚）', () => {
  it('写真0枚のとき field: photo のエラーを返す', () => {
    const draft = makeValidDraft(0);
    const errors = validate(draft);
    const photoErrors = errors.filter((e) => e.field === 'photo');
    expect(photoErrors).toHaveLength(1);
    expect(photoErrors[0].message).toContain('1枚以上');
    expect(isValid(draft)).toBe(false);
  });

  it('写真1枚のとき photo エラーを返さない', () => {
    const draft = makeValidDraft(1);
    expect(validate(draft).some((e) => e.field === 'photo')).toBe(false);
    expect(isValid(draft)).toBe(true);
  });

  it('写真5枚（上限ちょうど）のとき photo エラーを返さない', () => {
    const draft = makeValidDraft(PHOTOS_MAX);
    expect(validate(draft).some((e) => e.field === 'photo')).toBe(false);
    expect(isValid(draft)).toBe(true);
  });

  it('写真6枚（上限超過）のとき field: photo の上限超過エラーを返す', () => {
    const draft = makeValidDraft(PHOTOS_MAX + 1);
    const errors = validate(draft);
    const photoErrors = errors.filter((e) => e.field === 'photo');
    expect(photoErrors).toHaveLength(1);
    expect(photoErrors[0].message).toContain(`${PHOTOS_MAX}`);
    expect(isValid(draft)).toBe(false);
  });

  it('他フィールドの検証は写真と独立（名前超過と写真0枚が両方出る）', () => {
    const draft: CharacterDraft = {
      ...makeValidDraft(0),
      name: 'あ'.repeat(51),
    };
    const errors = validate(draft);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
    expect(errors.some((e) => e.field === 'photo')).toBe(true);
  });
});

// --- Property 3 ---------------------------------------------------------------

// Feature: chara-collection, Property 3: 写真は1枚以上必須（0枚でエラー／1〜5枚で通過／超過でエラー）
describe('Property 3: validate の写真は1枚以上必須・入力不変', () => {
  it('0枚でphotoエラー／1〜PHOTOS_MAXで通過／超過で上限エラー、かつ入力不変', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ maxLength: 50 }),
          nickname: fc.string({ maxLength: 50 }),
          memo: fc.string({ maxLength: 500 }),
          favoriteLevel: fc.integer({ min: 1, max: 5 }),
          // 0〜PHOTOS_MAX+3 枚（境界 0/1/PHOTOS_MAX/超過 を踏む）
          photoCount: fc.integer({ min: 0, max: PHOTOS_MAX + 3 }),
          imageColor: fc.constantFrom(...IMAGE_COLOR_PRESETS),
        }),
        ({ name, nickname, memo, favoriteLevel, photoCount, imageColor }) => {
          const draft: CharacterDraft = {
            name,
            nickname,
            memo,
            favoriteLevel,
            photos: makePhotos(photoCount),
            metOn: undefined,
            imageColor,
          };
          const beforeLength = draft.photos.length;

          const errors = validate(draft);
          const photoErrors = errors.filter((e) => e.field === 'photo');

          if (photoCount < 1) {
            // 0枚: 写真必須エラーがちょうど1件
            expect(photoErrors).toHaveLength(1);
            expect(photoErrors[0].message.length).toBeGreaterThan(0);
          } else if (photoCount > PHOTOS_MAX) {
            // 超過: 上限超過エラーがちょうど1件
            expect(photoErrors).toHaveLength(1);
            expect(photoErrors[0].message.length).toBeGreaterThan(0);
          } else {
            // 1〜PHOTOS_MAX: 写真起因のエラーなし
            expect(photoErrors).toHaveLength(0);
          }

          // 入力不変: photos 配列の長さは変化しない
          expect(draft.photos.length).toBe(beforeLength);
        },
      ),
      { numRuns: 100 },
    );
  });
});
