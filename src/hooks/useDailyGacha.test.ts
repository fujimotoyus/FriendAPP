/**
 * useDailyGacha のユニットテスト（暦日固定・日付変化での salt リセット・0件ガード）
 *
 * task 11.3。決定的選出（{@link pick}）や localStorage・現在日時の副作用の調停が、
 * 要件5.2（同一暦日は固定・再オープンでも同じ）・要件5.6（0 件時は登録要求）を満たすことを
 * 例示・エッジケースで検証する。ドメインの網羅的性質は Property 14/15 のプロパティテストで別途担保する。
 *
 * - InMemoryCharacterStore を DI してストアを差し替える。
 * - `now` プロバイダを DI して暦日を固定・変更する。
 * - localStorage は jsdom 環境の実装を用い、各テスト前にクリアする。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」「フロー2」、要件5.2, 5.6
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Character } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';
import { useDailyGacha } from './useDailyGacha';

/**
 * テスト用の Character を生成する。写真はダミーの ArrayBuffer + MIME（PhotoData）。
 */
function makeCharacter(id: string, name = `name-${id}`): Character {
  return {
    id,
    name,
    nickname: '',
    memo: '',
    favoriteLevel: 3,
    photo: { data: new Uint8Array([120]).buffer, type: 'image/png' },
    createdAt: Number(id.replace(/\D/g, '')) || 1,
  };
}

/**
 * 指定した固定日時を返す `now` プロバイダを作る。
 */
function fixedNow(date: Date): () => Date {
  return () => date;
}

describe('useDailyGacha', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('同一暦日内の再 loadToday は同じ「今日の相棒」を返す（再オープン固定・要件5.2）', async () => {
    const characters = Array.from({ length: 8 }, (_, i) =>
      makeCharacter(`id-${i + 1}`),
    );
    const store = new InMemoryCharacterStore(characters);
    const now = fixedNow(new Date(2025, 0, 15)); // 2025-01-15（ローカル暦日）

    const { result } = renderHook(() => useDailyGacha(store, now));

    // 初回マウントでの自動読み込み完了を待つ。
    await waitFor(() => expect(result.current.state).toBe('loaded'));
    const firstId = result.current.partner?.id;
    expect(firstId).toBeDefined();

    // 再度 loadToday（アプリ再オープン相当）しても同じ結果になること。
    await act(async () => {
      await result.current.loadToday();
    });
    expect(result.current.partner?.id).toBe(firstId);

    // 別インスタンス（＝完全な再オープン相当）でも同じ salt/暦日なら同じ結果になること。
    const { result: result2 } = renderHook(() => useDailyGacha(store, now));
    await waitFor(() => expect(result2.current.state).toBe('loaded'));
    expect(result2.current.partner?.id).toBe(firstId);
  });

  it('日付が変わると salt がリセットされ、新しい暦日で選出し直す（要件5.2）', async () => {
    const characters = Array.from({ length: 6 }, (_, i) =>
      makeCharacter(`id-${i + 1}`),
    );
    const store = new InMemoryCharacterStore(characters);

    // Day1 で引き直しを複数回行い salt を進める。
    const day1 = fixedNow(new Date(2025, 0, 15));
    const { result } = renderHook(() => useDailyGacha(store, day1));
    await waitFor(() => expect(result.current.state).toBe('loaded'));

    await act(async () => {
      await result.current.reroll();
      await result.current.reroll();
    });
    // Day1 の salt が localStorage に 2 として記録されているはず。
    const day1Salt = JSON.parse(
      localStorage.getItem('chara-collection:daily-gacha-salt') ?? '{}',
    );
    expect(day1Salt.salt).toBe(2);
    expect(day1Salt.day).toEqual({ year: 2025, month: 1, day: 15 });

    // 翌日にすると loadToday で salt が 0 にリセットされること。
    const day2 = fixedNow(new Date(2025, 0, 16));
    const { result: result2 } = renderHook(() => useDailyGacha(store, day2));
    await waitFor(() => expect(result2.current.state).toBe('loaded'));

    const day2Salt = JSON.parse(
      localStorage.getItem('chara-collection:daily-gacha-salt') ?? '{}',
    );
    expect(day2Salt.salt).toBe(0);
    expect(day2Salt.day).toEqual({ year: 2025, month: 1, day: 16 });
  });

  it('reroll は salt を +1 して選出し直す（要件5.3）', async () => {
    const characters = Array.from({ length: 10 }, (_, i) =>
      makeCharacter(`id-${i + 1}`),
    );
    const store = new InMemoryCharacterStore(characters);
    const now = fixedNow(new Date(2025, 5, 1));

    const { result } = renderHook(() => useDailyGacha(store, now));
    await waitFor(() => expect(result.current.state).toBe('loaded'));

    await act(async () => {
      await result.current.reroll();
    });

    const stored = JSON.parse(
      localStorage.getItem('chara-collection:daily-gacha-salt') ?? '{}',
    );
    expect(stored.salt).toBe(1);
    // 選出結果はコレクションの要素であること（決定性の詳細は Property 14 で担保）。
    expect(result.current.partner).not.toBeNull();
    expect(characters.some((c) => c.id === result.current.partner?.id)).toBe(true);
  });

  it('Character が 0 件のときは登録要求状態になりガチャを実行しない（要件5.6）', async () => {
    const store = new InMemoryCharacterStore([]);
    const now = fixedNow(new Date(2025, 0, 15));

    const { result } = renderHook(() => useDailyGacha(store, now));

    await waitFor(() =>
      expect(result.current.state).toBe('needsRegistration'),
    );
    expect(result.current.needsRegistration).toBe(true);
    expect(result.current.partner).toBeNull();
    expect(result.current.message).toBe('');
  });
});
