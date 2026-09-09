/**
 * CollectionView / useCollection のユニットテスト（並び順選択 UI の構成と初期並び順）
 *
 * task 36.1。イテレーション7 で並び順選択から「新しい順」を除き、左から「名前順」→
 * 「お気に入り順」→「出会った日順」の 3 種に再構成したこと、および初期並び順を名前昇順
 * （sortOrder === 'name'）へ変更したことを、例示・エッジケースで検証する
 * （要件2.1, 11.1, 11.2）。
 *
 * - 並び順 UI（role="group" aria-label="並び順" 内のボタン）の構成・順序・選択状態は、
 *   CollectionView をレンダリングして検証する。並び順 UI は characters が 1 件以上のときのみ
 *   表示されるため、CollectionView が引数なしで用いる既定ストア（defaultCharacterStore）を
 *   {@link InMemoryCharacterStore}（seed 付き）へモック差し替えして表示させる。
 * - hook の初期 sortOrder は、{@link useCollection} を InMemoryCharacterStore を DI して
 *   renderHook で直接駆動して検証する（要件11.2）。
 *
 * ドメインの並べ替えの網羅的性質（sortCharacters）は Property 17 等で別途担保する。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」、要件2.1, 11.1, 11.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, renderHook } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';

/**
 * CollectionView は `useCollection()` を引数なしで呼び、既定ストア
 * （{@link defaultCharacterStore}）に依存する。並び順 UI の表示には 1 件以上の
 * Character が必要なため、既定ストアをテスト用の InMemoryCharacterStore へ差し替える。
 * seed はモジュールスコープの mutable な配列とし、各テストの beforeEach で差し替える。
 */
let mockSeed: Character[] = [];
vi.mock('../persistence/defaultStore', () => ({
  get defaultCharacterStore() {
    return new InMemoryCharacterStore(mockSeed);
  },
}));

// モックを宣言した後にインポートする（useCollection 経由で差し替え済みストアを使う）。
import { CollectionView } from './CollectionView';
import { useCollection } from '../hooks/useCollection';

/** テスト用のダミー写真データ（PhotoData）。 */
function makePhoto(): PhotoData {
  return { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };
}

/** テスト用の Character を生成する。 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'あいうえお',
    nickname: '',
    memo: '',
    favoriteLevel: 3,
    photo: makePhoto(),
    createdAt: 1000,
    imageColor: 'none',
    ...overrides,
  };
}

describe('CollectionView 並び順選択 UI（task 36 / 要件11.1, 11.2）', () => {
  beforeEach(() => {
    mockSeed = [
      makeCharacter({ id: 'a', name: 'アルファ', createdAt: 1000 }),
      makeCharacter({ id: 'b', name: 'ベータ', createdAt: 2000 }),
    ];
  });

  it('並び順ボタンが左から「名前順」→「お気に入り順」→「出会った日順」の 3 種で表示される（要件11.1）', async () => {
    render(<CollectionView onAdd={() => {}} onSelect={() => {}} />);

    // 1 件以上の読み込みが完了すると並び順 UI が表示される。
    const group = await screen.findByRole('group', { name: '並び順' });
    const buttons = within(group).getAllByRole('button');

    expect(buttons.map((b) => b.textContent)).toEqual([
      '名前順',
      'お気に入り順',
      '出会った日順',
    ]);
  });

  it('「新しい順」ボタンは存在しない（task 36）', async () => {
    render(<CollectionView onAdd={() => {}} onSelect={() => {}} />);

    await screen.findByRole('group', { name: '並び順' });
    expect(screen.queryByText('新しい順')).toBeNull();
  });

  it('初期状態では「名前順」のみ aria-pressed="true"、他は "false"（要件11.2）', async () => {
    render(<CollectionView onAdd={() => {}} onSelect={() => {}} />);

    const group = await screen.findByRole('group', { name: '並び順' });
    const nameBtn = within(group).getByRole('button', { name: '名前順' });
    const favBtn = within(group).getByRole('button', { name: 'お気に入り順' });
    const metOnBtn = within(group).getByRole('button', { name: '出会った日順' });

    expect(nameBtn).toHaveAttribute('aria-pressed', 'true');
    expect(favBtn).toHaveAttribute('aria-pressed', 'false');
    expect(metOnBtn).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('useCollection 初期並び順（task 36 / 要件2.1, 11.2）', () => {
  it('初期 sortOrder は "name"（名前昇順）である', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
    ]);
    const { result } = renderHook(() => useCollection(store));

    // マウント時の初期化（reload）が終わるまで待ってから初期並び順を検証する。
    await waitFor(() => expect(result.current.loadState).toBe('loaded'));
    expect(result.current.sortOrder).toBe('name');
  });
});
