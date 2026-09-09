/**
 * sortCharacters（一覧の決定的並び替え）のプロパティテスト（fast-check + Vitest）
 *
 * Property 17: 並び替えは決定的で要素を保存する。
 * 任意の Character 集合と任意の SortOrder について、`sortCharacters(characters, order)` は
 * 入力集合の並べ替え（要素の過不足がない同一の多重集合）を返し、入力配列を変更しない。
 * さらに各 SortOrder について決定的な順序を返す（同一入力・同一 order で何度呼んでも同一順序）。
 * 順序は order ごとのタイブレークに従う:
 *   - 'newest'  : createdAt 降順 → id 昇順
 *   - 'favorite': favoriteLevel 降順 → createdAt 降順 → id 昇順
 *   - 'name'    : 空名（trim==''）は後方 → Unicode コードポイント順昇順 → id 昇順
 *   - 'metOn'   : Met_On 設定済みが前・未設定は後方 → Met_On 降順 → createdAt 降順 → id 昇順
 *
 * Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 * 参照: design.md「Correctness Properties / Property 17」「sortCharacters」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortCharacters } from './sortCharacters';
import type { Character, ImageColor, PhotoData, SortOrder } from './types';

// --- ジェネレータ -------------------------------------------------------------

const IMAGE_COLOR_PRESETS: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

/** ダミー写真データ（小さな ArrayBuffer + MIME）。並び順ロジックには影響しない。 */
const photoData: fc.Arbitrary<PhotoData> = fc
  .uint8Array({ minLength: 0, maxLength: 4 })
  .map((bytes) => ({ data: bytes.slice().buffer, type: 'image/png' }));

/**
 * 妥当な metOn（`YYYY-MM-DD`）または undefined を生成する。
 * 同一 metOn がタイブレークで踏まれるよう範囲を狭める（year 2000〜2002）。
 */
const metOnArb: fc.Arbitrary<string | undefined> = fc.option(
  fc
    .record({
      year: fc.integer({ min: 2000, max: 2002 }),
      month: fc.integer({ min: 1, max: 3 }),
      day: fc.integer({ min: 1, max: 5 }),
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
 * 名前を生成する。空文字・空白のみ・小さな文字集合の非空を混在させ、
 * 空名の後方配置・同名（比較同値）のタイブレークを踏みやすくする。
 */
const nameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.stringOf(fc.constantFrom('a', 'b', 'c', 'あ', 'ん'), { minLength: 1, maxLength: 3 }),
);

/**
 * Character（並び順に関わる属性のみ意味を持つ）を生成するファクトリ。
 * id は一意化のため index を埋め込み、比較可能な文字列にする。
 * createdAt は小さめの整数域で同値が出やすくし、タイブレークを踏ませる。
 */
function characterArb(index: number): fc.Arbitrary<Character> {
  return fc.record({
    seq: fc.integer({ min: 0, max: 999 }),
    name: nameArb,
    favoriteLevel: fc.integer({ min: 1, max: 5 }),
    photo: photoData,
    createdAt: fc.integer({ min: 0, max: 8 }),
    metOn: metOnArb,
    imageColor: fc.constantFrom(...IMAGE_COLOR_PRESETS),
  }).map(({ seq, name, favoriteLevel, photo, createdAt, metOn, imageColor }) => ({
    // id は一意（index）かつ順序が揺れるよう seq を前置し、末尾に index で衝突を防ぐ。
    id: `c-${String(seq).padStart(3, '0')}-${String(index).padStart(3, '0')}`,
    name,
    nickname: '',
    memo: '',
    favoriteLevel,
    photo,
    createdAt,
    metOn,
    imageColor,
  }));
}

/** 一意な id を持つ Character 配列を生成する（0〜12 件）。 */
const charactersArb: fc.Arbitrary<Character[]> = fc
  .integer({ min: 0, max: 12 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => characterArb(i))));

/** 全 SortOrder を回すアービトラリ。 */
const orderArb: fc.Arbitrary<SortOrder> = fc.constantFrom(
  'newest',
  'favorite',
  'name',
  'metOn',
);

// --- ヘルパ -------------------------------------------------------------------

function isEmptyName(name: string): boolean {
  return name.trim() === '';
}

function idList(cs: readonly Character[]): string[] {
  return cs.map((c) => c.id);
}

/** 多重集合（id の出現回数）が一致するかを検証する。 */
function expectSameMultiset(a: readonly Character[], b: readonly Character[]): void {
  expect(a.length).toBe(b.length);
  const count = (cs: readonly Character[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const c of cs) m.set(c.id, (m.get(c.id) ?? 0) + 1);
    return m;
  };
  const ma = count(a);
  const mb = count(b);
  expect(ma.size).toBe(mb.size);
  for (const [id, n] of ma) {
    expect(mb.get(id)).toBe(n);
  }
}

/**
 * order に基づき、隣接ペア (prev, next) が「prev は next 以前に来てよい」順序制約を
 * 満たすかを判定する。満たすなら true。タイブレークの検証に用いる。
 */
function precedesOrEqual(prev: Character, next: Character, order: SortOrder): boolean {
  switch (order) {
    case 'newest': {
      if (prev.createdAt !== next.createdAt) return prev.createdAt > next.createdAt;
      return prev.id <= next.id;
    }
    case 'favorite': {
      if (prev.favoriteLevel !== next.favoriteLevel) {
        return prev.favoriteLevel > next.favoriteLevel;
      }
      if (prev.createdAt !== next.createdAt) return prev.createdAt > next.createdAt;
      return prev.id <= next.id;
    }
    case 'name': {
      const pe = isEmptyName(prev.name);
      const ne = isEmptyName(next.name);
      if (pe !== ne) return !pe; // 非空が前、空名が後方
      if (!pe && !ne && prev.name !== next.name) return prev.name < next.name;
      return prev.id <= next.id;
    }
    case 'metOn': {
      const pm = prev.metOn === undefined;
      const nm = next.metOn === undefined;
      if (pm !== nm) return !pm; // 設定済みが前、未設定が後方
      if (!pm && !nm && prev.metOn !== next.metOn) {
        return (prev.metOn as string) > (next.metOn as string); // 降順
      }
      if (prev.createdAt !== next.createdAt) return prev.createdAt > next.createdAt;
      return prev.id <= next.id;
    }
  }
}

// --- プロパティ ---------------------------------------------------------------

describe('sortCharacters — Property 17: 並び替えは決定的で要素を保存する', () => {
  // Feature: chara-collection, Property 17: 並び替えは決定的で要素を保存する（全 SortOrder で要素保存・元配列不変・決定的・タイブレーク順序を満たす）
  it('要素保存: 出力は入力集合の並べ替え（同一多重集合・長さ一致）', () => {
    fc.assert(
      fc.property(charactersArb, orderArb, (characters, order) => {
        const result = sortCharacters(characters, order);
        expectSameMultiset(result, characters);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: chara-collection, Property 17: 並び替えは決定的で要素を保存する（元配列を変更しない・要件11.5, 11.6）
  it('元配列不変: 呼び出し後も入力配列の順序・内容が変わらない', () => {
    fc.assert(
      fc.property(charactersArb, orderArb, (characters, order) => {
        const before = idList(characters);
        const beforeSnapshot = characters.map((c) => ({ ...c }));
        sortCharacters(characters, order);
        // id 列（順序）が不変。
        expect(idList(characters)).toEqual(before);
        // 各要素の内容も不変。
        characters.forEach((c, i) => {
          expect(c).toEqual(beforeSnapshot[i]);
        });
      }),
      { numRuns: 100 },
    );
  });

  // Feature: chara-collection, Property 17: 並び替えは決定的で要素を保存する（同一入力・同一 order で決定的）
  it('決定的: 同一入力・同一 order で 2 回呼ぶと同一順序（id 列一致）', () => {
    fc.assert(
      fc.property(charactersArb, orderArb, (characters, order) => {
        const first = sortCharacters(characters, order);
        const second = sortCharacters(characters, order);
        expect(idList(first)).toEqual(idList(second));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: chara-collection, Property 17: 並び替えは決定的で要素を保存する（各 order のタイブレークを隣接ペアで検証）
  it('タイブレーク: 出力の隣接ペアが order ごとの順序制約を満たす', () => {
    fc.assert(
      fc.property(charactersArb, orderArb, (characters, order) => {
        const result = sortCharacters(characters, order);
        for (let i = 0; i + 1 < result.length; i += 1) {
          expect(precedesOrEqual(result[i], result[i + 1], order)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
