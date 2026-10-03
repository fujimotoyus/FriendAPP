/**
 * useRegistration のユニットテスト（複数写真の追加・削除・保存分岐）
 *
 * task 75（イテレーション15 / 要件23）。複数写真化後の View-State を例示・エッジケースで検証する。
 * ドメインの網羅的性質（addPhotos の切り詰め・validate の写真必須）は Property 33/34 等で別途担保する。
 *
 * 検証対象の分岐:
 * - 写真取得キャンセル/ブロック（null / 0 件）: 入力保持・`acquisitionFailed`（要件23.6, 1.11, 8.3）
 * - 非対応形式/過大: 該当 `PhotoError` 種別を保持しつつ成功分は取り込む（要件23.6, 8.2）
 * - 5 枚超過: 先頭 5 枚へ切り詰め・`photosTruncated` が立つ（要件23.2, 23.3）
 * - `removePhoto`: index 指定で 1 枚削除（要件23.1）
 * - `save`: 写真 0 枚（全削除含む）は `invalid` で保留（要件23.4, 23.13）、1 枚以上で保存成功
 * - 編集モードは既存 `photos` を初期化（要件23.11）
 *
 * 参照: design.md「イテレーション15」「Testing Strategy / ユニットテスト」、
 *       要件23.1, 23.3, 23.4, 23.6, 23.11, 23.13
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { PHOTOS_MAX } from '../domain/photos';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';
import { useRegistration } from './useRegistration';

/**
 * `validateAndProcess` が受け付ける最小限の File 互換オブジェクトを作る。
 * `type`・`size`・`arrayBuffer()` のみを備える（jsdom の File に依存しない）。
 */
function makeFile(
  type: string,
  bytes: number[] = [1, 2, 3],
  size?: number,
): File {
  const buffer = new Uint8Array(bytes).buffer;
  const fake = {
    type,
    size: size ?? bytes.length,
    arrayBuffer: async () => buffer,
  };
  return fake as unknown as File;
}

/**
 * File[] を FileList 風オブジェクトへ変換する（length + 数値インデックス + 反復可能）。
 */
function makeFileList(files: File[]): FileList {
  const list: Record<number, File> & {
    length: number;
    item: (i: number) => File | null;
    [Symbol.iterator]: () => IterableIterator<File>;
  } = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  };
  files.forEach((f, i) => {
    list[i] = f;
  });
  return list as unknown as FileList;
}

/** 1 枚分のダミー PhotoData。 */
function photo(byte = 9): PhotoData {
  return { data: new Uint8Array([byte]).buffer, type: 'image/png' };
}

/** 編集モード検証用の既存 Character（複数写真を持つ）。 */
function makeEditing(photos: PhotoData[]): Character {
  return {
    id: 'edit-1',
    name: '既存',
    nickname: '',
    memo: '',
    favoriteLevel: 4,
    photos,
    createdAt: 1000,
    imageColor: 'rose',
  };
}

describe('useRegistration（複数写真）', () => {
  it('新規の初期 draft は photos が空配列', () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));
    expect(result.current.draft.photos).toEqual([]);
    expect(result.current.photosTruncated).toBe(false);
  });

  it('pickPhotos は複数の対応画像を取り込み順に取り込む（要件23.1）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(
        makeFileList([makeFile('image/png'), makeFile('image/jpeg')]),
      );
    });

    expect(result.current.draft.photos).toHaveLength(2);
    expect(result.current.draft.photos[0].type).toBe('image/png');
    expect(result.current.draft.photos[1].type).toBe('image/jpeg');
    expect(result.current.photoError).toBeNull();
    expect(result.current.photosTruncated).toBe(false);
  });

  it('pickPhotos は追加呼び出しで既存 photos へ連結する（要件23.3）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/png')]));
    });
    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/webp')]));
    });

    expect(result.current.draft.photos).toHaveLength(2);
    expect(result.current.draft.photos[1].type).toBe('image/webp');
  });

  it('5 枚を超える取り込みは先頭5枚へ切り詰め photosTruncated が立つ（要件23.2, 23.3）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    const many = Array.from({ length: 7 }, () => makeFile('image/png'));
    await act(async () => {
      await result.current.pickPhotos(makeFileList(many));
    });

    expect(result.current.draft.photos).toHaveLength(PHOTOS_MAX);
    expect(result.current.photosTruncated).toBe(true);
  });

  it('null / 0 件はキャンセル扱いで入力を破棄せず acquisitionFailed（要件23.6, 1.11, 8.3）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    // 先に1枚取り込んでおく。
    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/png')]));
    });

    await act(async () => {
      await result.current.pickPhotos(null);
    });
    expect(result.current.photoError).toEqual({ kind: 'acquisitionFailed' });
    // 既存の取り込みは破棄されない。
    expect(result.current.draft.photos).toHaveLength(1);

    await act(async () => {
      await result.current.pickPhotos(makeFileList([]));
    });
    expect(result.current.photoError).toEqual({ kind: 'acquisitionFailed' });
    expect(result.current.draft.photos).toHaveLength(1);
  });

  it('非対応形式は unsupportedFormat を保持しつつ成功分は取り込む（要件23.6, 8.2）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(
        makeFileList([makeFile('image/png'), makeFile('image/gif')]),
      );
    });

    expect(result.current.draft.photos).toHaveLength(1);
    expect(result.current.photoError).toEqual({ kind: 'unsupportedFormat' });
  });

  it('過大サイズは tooLarge を保持する（要件23.6, 8.2）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    const huge = makeFile('image/jpeg', [1], 20 * 1024 * 1024);
    await act(async () => {
      await result.current.pickPhotos(makeFileList([huge]));
    });

    expect(result.current.draft.photos).toHaveLength(0);
    expect(result.current.photoError).toEqual({ kind: 'tooLarge' });
  });

  it('全て成功したときは photoError をクリアする（要件23.6）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    // 一度エラーを発生させる。
    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/gif')]));
    });
    expect(result.current.photoError).toEqual({ kind: 'unsupportedFormat' });

    // 成功のみの取り込みでクリアされる。
    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/png')]));
    });
    expect(result.current.photoError).toBeNull();
  });

  it('removePhoto は index 指定の1枚だけを削除する（要件23.1）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(
        makeFileList([
          makeFile('image/png', [1]),
          makeFile('image/jpeg', [2]),
          makeFile('image/webp', [3]),
        ]),
      );
    });
    expect(result.current.draft.photos).toHaveLength(3);

    act(() => {
      result.current.removePhoto(1);
    });

    expect(result.current.draft.photos).toHaveLength(2);
    expect(result.current.draft.photos[0].type).toBe('image/png');
    expect(result.current.draft.photos[1].type).toBe('image/webp');
  });

  it('写真0枚で save すると invalid で保留し保存されない（要件23.4, 23.13）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toBe('invalid');
    expect(result.current.fieldErrors.some((e) => e.field === 'photo')).toBe(true);
    expect(await store.count()).toBe(0);
  });

  it('全削除後の save も写真必須で弾かれる（要件23.13）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/png')]));
    });
    act(() => {
      result.current.removePhoto(0);
    });
    expect(result.current.draft.photos).toHaveLength(0);

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });
    expect(outcome).toBe('invalid');
    expect(await store.count()).toBe(0);
  });

  it('1枚以上あれば save が成功し photos を保存する（要件23.4）', async () => {
    const store = new InMemoryCharacterStore();
    const { result } = renderHook(() => useRegistration(undefined, store));

    await act(async () => {
      await result.current.pickPhotos(
        makeFileList([makeFile('image/png'), makeFile('image/jpeg')]),
      );
    });
    act(() => {
      result.current.setField('name', 'テスト');
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toBe('saved');
    const stored = await store.fetchAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].photos).toHaveLength(2);
    expect(stored[0].name).toBe('テスト');
  });

  it('編集モードは既存 photos を初期化する（要件23.11）', () => {
    const store = new InMemoryCharacterStore();
    const editing = makeEditing([photo(1), photo(2)]);
    const { result } = renderHook(() => useRegistration(editing, store));

    expect(result.current.draft.photos).toHaveLength(2);
    expect(result.current.draft.editingId).toBe('edit-1');
    expect(result.current.draft.imageColor).toBe('rose');
  });

  it('編集モードで save すると update され件数は不変（要件23.11）', async () => {
    const editing = makeEditing([photo(1)]);
    const store = new InMemoryCharacterStore([editing]);
    const { result } = renderHook(() => useRegistration(editing, store));

    await act(async () => {
      await result.current.pickPhotos(makeFileList([makeFile('image/jpeg')]));
    });
    act(() => {
      result.current.setField('name', '更新後');
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.save();
    });

    expect(outcome).toBe('saved');
    expect(await store.count()).toBe(1);
    const stored = await store.fetchAll();
    expect(stored[0].name).toBe('更新後');
    expect(stored[0].photos).toHaveLength(2);
  });
});
