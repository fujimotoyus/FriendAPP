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

  it('edges がある場合に関係（相手名・関係タグ）が表示される', async () => {
    // 新ルールでは 2 件以上あれば id 由来で必ず線が生成される（登録データ非依存）。
    // 各線には 5 種の関係タグ（仲良し/ライバル/喧嘩中/気になる存在/相棒）のいずれかが付く。
    mockSeed = [
      makeCharacter({ id: 'a', name: 'アルファ', favoriteLevel: 5, imageColor: 'rose' }),
      makeCharacter({ id: 'b', name: 'ベータ', favoriteLevel: 5, imageColor: 'rose' }),
    ];

    render(<RelationshipMapView />);

    // 読み込み完了後、両ノードに相手名が現れる。
    await waitFor(() => {
      expect(screen.getAllByText('アルファ').length).toBeGreaterThan(0);
    });

    // 相手名（両方の名前）が表示される。
    expect(screen.getAllByText('アルファ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ベータ').length).toBeGreaterThan(0);

    // 関係タグ（5 種のいずれか）が少なくとも 1 つ表示される（色だけに依存しないラベル併記）。
    const tagLabels = ['仲良し', 'ライバル', '喧嘩中', '気になる存在', '相棒'];
    const shownTags = tagLabels.filter((label) => screen.queryAllByText(label).length > 0);
    expect(shownTags.length).toBeGreaterThan(0);
  });

  it('関係タグバッジに種類別の色分けクラス（rel-tag--*）が付与される（要件22.18）', async () => {
    mockSeed = [
      makeCharacter({ id: 'a', name: 'アルファ', favoriteLevel: 5 }),
      makeCharacter({ id: 'b', name: 'ベータ', favoriteLevel: 5 }),
    ];

    render(<RelationshipMapView />);

    // 関係タグバッジ（.relationship-map__relation-label）が描画されるまで待つ。
    let labels: HTMLElement[] = [];
    await waitFor(() => {
      labels = Array.from(
        document.querySelectorAll<HTMLElement>('.relationship-map__relation-label'),
      );
      expect(labels.length).toBeGreaterThan(0);
    });

    // 各バッジは 5 種の色分けクラスのいずれかを 1 つ持つ（色はトークン経由で CSS が解決）。
    const tagClasses = [
      'rel-tag--friend',
      'rel-tag--rival',
      'rel-tag--fighting',
      'rel-tag--crush',
      'rel-tag--buddy',
    ];
    for (const label of labels) {
      const matched = tagClasses.filter((cls) => label.classList.contains(cls));
      expect(matched.length).toBe(1);
    }
  });

  it('A→B と B→A の印象が両方（向きあり）表示される（要件22.4, 22.6）', async () => {
    mockSeed = [
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
    ];

    render(<RelationshipMapView />);

    // 各ノードの関係に、双方向の印象（アルファ→ベータ／ベータ→アルファ）が両方現れる。
    await waitFor(() => {
      expect(screen.queryAllByText(/アルファ→ベータ/).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/アルファ→ベータ/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/ベータ→アルファ/).length).toBeGreaterThan(0);
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

  it('2 件以上のとき（登録データに関わらず）id 由来で関係が生成され表示される（要件22.15）', async () => {
    // 新ルールでは登録データ（favoriteLevel/imageColor/metOn）に依存せず、id から必ず線が生成される。
    mockSeed = [
      makeCharacter({ id: 'a', name: 'エー', favoriteLevel: 1, imageColor: 'none' }),
      makeCharacter({ id: 'b', name: 'ビー', favoriteLevel: 2, imageColor: 'none' }),
    ];

    render(<RelationshipMapView />);

    await waitFor(() => {
      expect(screen.getAllByText('エー').length).toBeGreaterThan(0);
    });
    // 「関係が見つかりませんでした」空状態は出ない（線が生成されるため）。
    expect(screen.queryByText(/関係が見つかりませんでした/)).not.toBeInTheDocument();
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
