/**
 * RankingBattleView / useRankingBattle の統合的ユニットテスト（対戦の進行フェーズ・遷移・ブラケット表示）
 *
 * task 45.1（イテレーション9「対戦を魅せる」、任意テスト）。RankingBattleView が hook の
 * フェーズ（pair → result → champion）に従って表示を切り替えること、勝者ハイライト、
 * トーナメント表（TournamentBracketView）の表示、2 件未満ガード、自動再生しないことを
 * React Testing Library（Vitest, jsdom）で例示検証する。
 *
 * - RankingBattleView は内部で `useRankingBattle(store, rng)` を呼ぶが、task 45.1 の最小拡張で
 *   `store?` / `rng?` の optional props を受け取れるようにしたため、テストでは InMemoryCharacterStore
 *   と固定 rng を DI して勝者・フェーズ遷移を決定的に検証する（本番の App.tsx は props 省略で不変）。
 * - 勝者は shuffle（既定は Math.random ベース）によって left/right のどちらに並ぶかが変わりうるため、
 *   「勝者名を含む要素に --winner クラスが付く」形で shuffle 非依存に検証する。rng は常に 0 を返す
 *   スタブ（rng() < 0.5 が真 → 各対戦で left が勝つ）を用い、勝敗の決定性を確保する。
 * - jsdom には URL.createObjectURL / revokeObjectURL が無いが、src/test/setup.ts で PhotoFrame 用の
 *   ダミー実装が用意済みのため追加モックは不要。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」、要件17.1, 17.3, 17.4, 17.5, 18.1, 18.2, 18.3, 4.8
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';
import { RankingBattleView } from './RankingBattleView';

/** テスト用のダミー写真データ（PhotoData）。表示の実体は jsdom では検証しない。 */
function makePhoto(): PhotoData {
  return { data: new ArrayBuffer(1), type: 'image/png' };
}

/** テスト用の Character を生成する。 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'テスト太郎',
    nickname: '',
    memo: '',
    favoriteLevel: 3,
    photo: makePhoto(),
    createdAt: 1000,
    metOn: undefined,
    imageColor: 'none',
    ...overrides,
  };
}

/** 常に 0 を返す rng（各対戦で rng() < 0.5 が真 → left が勝つ）。勝敗を決定的にする。 */
function alwaysZeroRng(): number {
  return 0;
}

describe('RankingBattleView — 2 件未満ガード（要件4.8）', () => {
  it('Character 1 件のとき「2 件以上の登録が必要」メッセージを表示し、対戦エリアを出さない', async () => {
    const store = new InMemoryCharacterStore([makeCharacter({ id: 'a' })]);
    render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    // 開始試行が完了すると空状態メッセージ（EmptyStateView）が表示される。
    await screen.findByText(/2 件以上の登録が必要/);
    // 対戦エリア（「勝負！」ボタン）は出ない。
    expect(screen.queryByRole('button', { name: /勝負/ })).toBeNull();
    // トーナメント表も出ない。
    expect(screen.queryByRole('heading', { name: 'トーナメント表' })).toBeNull();
  });

  it('Character 0 件のときも「2 件以上の登録が必要」メッセージを表示する', async () => {
    const store = new InMemoryCharacterStore([]);
    render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    await screen.findByText(/2 件以上の登録が必要/);
    expect(screen.queryByRole('button', { name: /勝負/ })).toBeNull();
  });
});

describe('RankingBattleView — フェーズ遷移 pair → result → champion（要件17.1, 17.3, 17.4）', () => {
  it('Character 2 件・rng 固定で開始すると pair → result → champion と遷移する', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
    ]);
    render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    // pair: 開始後にまず「勝負！」ボタンが見える（要件17.1）。
    const fightButton = await screen.findByRole('button', { name: /勝負/ });
    expect(fightButton).toBeInTheDocument();
    // まだ「次へ」も優勝発表も出ていない。
    expect(screen.queryByRole('button', { name: /次へ/ })).toBeNull();
    expect(screen.queryByText('最も好きなキャラ 👑')).toBeNull();

    // 「勝負！」→ result: 実況（role=status）と「次へ」ボタンが見える（要件17.3）。
    fireEvent.click(fightButton);
    const nextButton = await screen.findByRole('button', { name: /次へ/ });
    expect(nextButton).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    // 「次へ」→ champion: 2 件なら 1 試合で優勝が決まる（要件17.4）。
    fireEvent.click(nextButton);
    const championTitle = await screen.findByText('最も好きなキャラ 👑');
    expect(championTitle).toBeInTheDocument();
    // 「もう一度対戦」ボタンが見える。
    expect(
      screen.getByRole('button', { name: /もう一度対戦/ }),
    ).toBeInTheDocument();
    // 優勝者名（left が勝つので rng 固定なら決定的だが、shuffle 非依存に
    // 「アルファ」か「ベータ」のいずれかが champion 見出し領域に出る）。
    const champion = screen.getByLabelText('最も好きなキャラ');
    expect(champion.textContent).toMatch(/アルファ|ベータ/);
  });
});

describe('RankingBattleView — 勝者ハイライト（要件17.2）', () => {
  it('result フェーズで勝者側に --winner、敗者側に --loser クラスが付く', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
    ]);
    const { container } = render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    const fightButton = await screen.findByRole('button', { name: /勝負/ });
    fireEvent.click(fightButton);
    // result への遷移を待つ。
    await screen.findByRole('button', { name: /次へ/ });

    const winnerEl = container.querySelector(
      '.ranking-battle__contestant--winner',
    );
    const loserEl = container.querySelector(
      '.ranking-battle__contestant--loser',
    );
    expect(winnerEl).not.toBeNull();
    expect(loserEl).not.toBeNull();
    // 勝者要素・敗者要素はそれぞれ登録名（アルファ/ベータ）のいずれかを含む。
    expect(winnerEl?.textContent).toMatch(/アルファ|ベータ/);
    expect(loserEl?.textContent).toMatch(/アルファ|ベータ/);
    // 勝者と敗者は異なる名前を持つ（同一要素ではない）。
    expect(winnerEl?.textContent).not.toEqual(loserEl?.textContent);
  });
});

describe('RankingBattleView — トーナメント表の表示（要件18.1〜18.3）', () => {
  it('対戦（1 試合）確定後に「トーナメント表」見出しが表示され、champion 確定後にブラケットへ 👑 と champion 名が出る', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
    ]);
    render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    // 対戦を 1 試合確定させると、その match が bracket に記録されトーナメント表が現れる（要件18.1）。
    // （偶数トーナメントの開始直後は bracket が空のため、TournamentBracketView は未表示）。
    fireEvent.click(await screen.findByRole('button', { name: /勝負/ }));
    await screen.findByRole('button', { name: /次へ/ });
    const bracket = screen.getByRole('region', { name: 'トーナメント表' });
    expect(bracket).toBeInTheDocument();
    // 見出し「トーナメント表」も存在する（要件18.1）。
    expect(
      screen.getByRole('heading', { name: 'トーナメント表' }),
    ).toBeInTheDocument();

    // 「次へ」で champion 確定。
    fireEvent.click(screen.getByRole('button', { name: /次へ/ }));
    await screen.findByText('最も好きなキャラ 👑');

    // champion 名（勝者）を取得する。
    const championName = screen
      .getByLabelText('最も好きなキャラ')
      .querySelector('.ranking-battle__champion-name')?.textContent;
    expect(championName).toBeTruthy();

    // ブラケット内に champion 名（勝者）と 👑（勝者表示）が現れる（要件18.2, 18.3）。
    const bracketRegion = screen.getByRole('region', { name: 'トーナメント表' });
    expect(bracketRegion.textContent).toContain(championName as string);
    expect(bracketRegion.textContent).toContain('👑');
  });
});

describe('RankingBattleView — 自動再生しない（要件17.5）', () => {
  it('「勝負！」を押さずに待っても pair のまま（result へ自動遷移しない）', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
    ]);
    render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    // pair 到達（「勝負！」ボタンが見える）まで待つ。
    await screen.findByRole('button', { name: /勝負/ });

    // 操作せずに一定時間待つ。コンポーネントはタイマー等の自動進行を持たないため、
    // フェーズは pair のまま（result への遷移＝「次へ」ボタン出現は起きない）。要件17.5
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.getByRole('button', { name: /勝負/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /次へ/ })).toBeNull();
    expect(screen.queryByText('最も好きなキャラ 👑')).toBeNull();
  });
});
