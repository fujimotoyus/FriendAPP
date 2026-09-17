/**
 * RelationshipMapView / NavigationBar 相関図導線のユニットテスト（task 68.1・任意）
 *
 * イテレーション14（キャラ相関図、要件22）の UI・ナビゲーション導線を、React Testing
 * Library + Vitest で例示・エッジケース検証する。ドメインの決定性・軸/スコア/ラベル判定は
 * Property 30〜32 で別途担保するため、ここでは表示と導線に絞る。
 *
 * (a) edges がある場合に関係（相手・ラベル・軸）が表示される（要件22.1）。
 * (b) Character 0/1 件時に「2 件以上必要」旨、2 件以上でも関係 0 件時に「関係が見つからな
 *     かった」旨の空状態が表示される（要件22.14, 22.15）。
 * (c) NavigationBar に「相関図」タブがあり、押下で goToRelationship（onNavigate('relationship')）
 *     が呼ばれる（要件22.18）。
 *
 * RelationshipMapView は `useRelationshipMap()` を引数なしで呼び、既定ストア
 * （defaultCharacterStore）に依存する。CollectionView.test と同じ手法で、既定ストアを
 * テスト用の {@link InMemoryCharacterStore}（seed 付き）へ差し替えて表示させる。
 *
 * 参照: design.md「RelationshipMapView」「App」、要件22.1, 22.14, 22.15, 22.18
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';

/**
 * RelationshipMapView 内の useRelationshipMap は既定ストアを用いるため、
 * defaultCharacterStore を seed 付き InMemoryCharacterStore へ差し替える。
 */
let mockSeed: Character[] = [];
vi.mock('../persistence/defaultStore', () => ({
  get defaultCharacterStore() {
    return new InMemoryCharacterStore(mockSeed);
  },
}));

import { RelationshipMapView } from './RelationshipMapView';
import { NavigationBar } from './NavigationBar';

/** テスト用のダミー写真データ（PhotoData）。 */
function makePhoto(): PhotoData {
  return { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };
}

/** テスト用の Character を生成する。 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'テスト',
    nickname: '',
    memo: '',
    favoriteLevel: 3,
    photo: makePhoto(),
    createdAt: 1000,
    imageColor: 'none',
    ...overrides,
  };
}

describe('RelationshipMapView 関係表示（task 68.1 / 要件22.1）', () => {
  beforeEach(() => {
    mockSeed = [];
  });

  it('edges がある場合に関係（相手名・ラベル・軸）が表示される', async () => {
    // 同一 favoriteLevel かつ ★4 以上の同値 → same-favorite「両想い級」の関係が生じる。
    // さらに同一プリセット色 → same-color「おそろいカラー」も該当し、複数軸で 1 本に集約される。
    mockSeed = [
      makeCharacter({ id: 'a', name: 'アルファ', favoriteLevel: 5, imageColor: 'rose' }),
      makeCharacter({ id: 'b', name: 'ベータ', favoriteLevel: 5, imageColor: 'rose' }),
    ];

    render(<RelationshipMapView />);

    // 読み込み完了後、両ノードに相手名が現れる。
    await waitFor(() => {
      expect(screen.getAllByText('両想い級').length).toBeGreaterThan(0);
    });

    // 相手名（両方の名前）が表示される。
    expect(screen.getAllByText('アルファ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ベータ').length).toBeGreaterThan(0);

    // 代表ラベルと軸バッジ（複数軸）が表示される。
    expect(screen.getAllByText('両想い級').length).toBeGreaterThan(0);
    expect(screen.getAllByText('おそろいカラー').length).toBeGreaterThan(0);
    expect(screen.getAllByText('お気に入り度が同じ').length).toBeGreaterThan(0);
  });
});

describe('RelationshipMapView 空状態（task 68.1 / 要件22.14, 22.15）', () => {
  it('Character 1 件のとき「2件以上必要」旨の空状態を表示する（要件22.14）', async () => {
    mockSeed = [makeCharacter({ id: 'a', name: 'ひとり' })];

    render(<RelationshipMapView />);

    await waitFor(() => {
      expect(screen.getByText(/2件以上の登録が必要/)).toBeInTheDocument();
    });
  });

  it('2 件以上でも関係 0 件のとき「関係が見つかりませんでした」旨の空状態を表示する（要件22.15）', async () => {
    // 異なる favoriteLevel・imageColor 'none'・metOn 未設定 → どの軸も該当せず edges は空。
    mockSeed = [
      makeCharacter({ id: 'a', name: 'エー', favoriteLevel: 1, imageColor: 'none' }),
      makeCharacter({ id: 'b', name: 'ビー', favoriteLevel: 2, imageColor: 'none' }),
    ];

    render(<RelationshipMapView />);

    await waitFor(() => {
      expect(screen.getByText(/関係が見つかりませんでした/)).toBeInTheDocument();
    });
  });
});

describe('NavigationBar 相関図タブ（task 68.1 / 要件22.18）', () => {
  it('「相関図」タブがあり、押下で onNavigate("relationship") が呼ばれる', () => {
    const onNavigate = vi.fn();
    render(<NavigationBar active="list" onNavigate={onNavigate} />);

    const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
    const relationshipTab = within(nav).getByRole('button', { name: /相関図/ });
    expect(relationshipTab).toBeInTheDocument();

    fireEvent.click(relationshipTab);
    expect(onNavigate).toHaveBeenCalledWith('relationship');
  });

  it('active="relationship" のとき相関図タブが選択状態（aria-current="page"）になる', () => {
    render(<NavigationBar active="relationship" onNavigate={() => {}} />);

    const relationshipTab = screen.getByRole('button', { name: /相関図/ });
    expect(relationshipTab).toHaveAttribute('aria-current', 'page');
  });
});
