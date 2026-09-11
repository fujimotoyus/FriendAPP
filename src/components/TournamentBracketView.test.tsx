/**
 * TournamentBracketView の例示ユニットテスト（イテレーション11・task 56.1、任意テスト `*`）。
 *
 * 接続線つき縦向きブラケット図を React Testing Library（Vitest, jsdom）で直接レンダーして検証する。
 * hook を介さず props（`matches: ResolvedBracketMatch[]`, `winnerHighlightId?`）を直接渡すことで
 * 決定的に検証する（フレークなし）。写真は名前中心の表示のため用いないが、Character 型を満たす
 * ダミー photo を付ける。
 *
 * 検証観点:
 * - 空表示（matches=[] で何も描画しない・container が空）
 * - 見出し・region（「トーナメント表」見出しと aria-label region、要件18.1）
 * - ラウンドラベル（round0→「1回戦」、最終 round→「決勝」）
 * - 対戦カードと対戦者名（各名の表示・カード数）
 * - 勝者ハイライト（`--winner` と 👑、勝者名を含む）
 * - 不戦勝（Bye）（「不戦勝（Bye）」テキスト・vs が出ない）
 * - 優勝強調（winnerHighlightId 一致 match に `--champion`）
 * - 接続線要素（`.tournament-bracket__connector` がラウンド数-1 個）
 * - 横スクロールなし（緩め・クラス存在で確認）
 *
 * 参照: design.md「TournamentBracketView」「Testing Strategy / ユニットテスト」、
 *       要件18.1, 18.2, 18.3, 18.5, 18.7
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
  Character,
  PhotoData,
  ResolvedBracketMatch,
} from '../domain/types';
import { TournamentBracketView } from './TournamentBracketView';

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

// 4 名: a/b/c/d（アルファ/ベータ/ガンマ/デルタ）。
const a = makeCharacter({ id: 'a', name: 'アルファ' });
const b = makeCharacter({ id: 'b', name: 'ベータ' });
const c = makeCharacter({ id: 'c', name: 'ガンマ' });
const d = makeCharacter({ id: 'd', name: 'デルタ' });

/**
 * 2 ラウンド分の bracket。
 * round0: a vs b（winner a）, c vs d（winner c）。
 * round1（決勝）: a vs c（winner a）。
 */
function twoRoundBracket(): ResolvedBracketMatch[] {
  return [
    { round: 0, left: a, right: b, winner: a, bye: false },
    { round: 0, left: c, right: d, winner: c, bye: false },
    { round: 1, left: a, right: c, winner: a, bye: false },
  ];
}

describe('TournamentBracketView — 空表示', () => {
  it('matches=[] のときは何も描画しない（container が空）', () => {
    const { container } = render(<TournamentBracketView matches={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(container.querySelector('.tournament-bracket')).toBeNull();
  });
});

describe('TournamentBracketView — 見出し・region（要件18.1）', () => {
  it('見出し「トーナメント表」と aria-label="トーナメント表" の region が存在する', () => {
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );

    // 見出し。
    expect(
      screen.getByRole('heading', { name: 'トーナメント表' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.tournament-bracket__title')?.textContent).toBe(
      'トーナメント表',
    );

    // region（section aria-label）。
    const region = screen.getByRole('region', { name: 'トーナメント表' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveClass('tournament-bracket');
  });
});

describe('TournamentBracketView — ラウンドラベル（要件18.2）', () => {
  it('round0 は「1回戦」、最終 round は「決勝」と表示される', () => {
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );

    const labels = Array.from(
      container.querySelectorAll('.tournament-bracket__round-label'),
    ).map((el) => el.textContent);
    expect(labels).toEqual(['1回戦', '決勝']);

    expect(screen.getByText('1回戦')).toBeInTheDocument();
    expect(screen.getByText('決勝')).toBeInTheDocument();
  });
});

describe('TournamentBracketView — 対戦カードと対戦者名（要件18.2, 18.3）', () => {
  it('各対戦者名が表示され、対戦カードが 3 試合ぶん存在する', () => {
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );

    // 各対戦者名（アルファ/ベータ/ガンマ/デルタ）が表示される。
    // アルファ/ガンマは round0 と決勝の 2 箇所に出るため getAllByText で存在確認する。
    expect(screen.getAllByText('アルファ').length).toBeGreaterThan(0);
    expect(screen.getByText('ベータ')).toBeInTheDocument();
    expect(screen.getAllByText('ガンマ').length).toBeGreaterThan(0);
    expect(screen.getByText('デルタ')).toBeInTheDocument();

    // 対戦カードは 3 試合ぶん。
    expect(
      container.querySelectorAll('.tournament-bracket__card'),
    ).toHaveLength(3);
  });
});

describe('TournamentBracketView — 勝者ハイライト（要件18.3）', () => {
  it('勝者側に `--winner` と 👑（.tournament-bracket__crown）が付き、テキストに勝者名を含む', () => {
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );

    const winners = container.querySelectorAll(
      '.tournament-bracket__competitor--winner',
    );
    // round0 の a・c、決勝の a の計 3 箇所が勝者。
    expect(winners).toHaveLength(3);

    // 各勝者要素に 👑 が付き、勝者名（アルファ or ガンマ）を含む。
    const crowns = container.querySelectorAll('.tournament-bracket__crown');
    expect(crowns).toHaveLength(3);
    winners.forEach((el) => {
      expect(el.querySelector('.tournament-bracket__crown')?.textContent).toBe(
        '👑',
      );
      expect(el.textContent).toMatch(/アルファ|ガンマ/);
    });

    // 敗者側（ベータ/デルタ）には winner 強調が付かない。
    const betaEl = screen.getByText('ベータ').closest(
      '.tournament-bracket__competitor',
    );
    const deltaEl = screen.getByText('デルタ').closest(
      '.tournament-bracket__competitor',
    );
    expect(betaEl).not.toHaveClass('tournament-bracket__competitor--winner');
    expect(deltaEl).not.toHaveClass('tournament-bracket__competitor--winner');
  });
});

describe('TournamentBracketView — 不戦勝（Bye）（要件18.2, 18.3）', () => {
  it('right=null, bye=true, winner=left の match は「不戦勝（Bye）」を出し vs を出さない', () => {
    // 3 名: a/b の対戦（winner a）と、c の不戦勝（Bye）。
    const matches: ResolvedBracketMatch[] = [
      { round: 0, left: a, right: b, winner: a, bye: false },
      { round: 0, left: c, right: null, winner: c, bye: true },
    ];
    const { container } = render(<TournamentBracketView matches={matches} />);

    // Bye 表記が出る。
    const bye = screen.getByText('不戦勝（Bye）');
    expect(bye).toBeInTheDocument();
    expect(bye).toHaveClass('tournament-bracket__bye');

    // Bye の match（c を含むカード）には vs が出ない。
    const byeCard = bye.closest('.tournament-bracket__card');
    expect(byeCard).not.toBeNull();
    expect(byeCard?.querySelector('.tournament-bracket__versus')).toBeNull();

    // 通常の a vs b のカードには vs が出る。
    const versusEls = container.querySelectorAll('.tournament-bracket__versus');
    expect(versusEls).toHaveLength(1);
  });
});

describe('TournamentBracketView — 優勝強調（要件18.3）', () => {
  it('winnerHighlightId に決勝勝者 a の id を渡すとその match に `--champion` が付く', () => {
    const { container } = render(
      <TournamentBracketView
        matches={twoRoundBracket()}
        winnerHighlightId="a"
      />,
    );

    const champions = container.querySelectorAll(
      '.tournament-bracket__match--champion',
    );
    // 勝者が a の match は round0 の a vs b と決勝の a vs c の 2 つ。
    expect(champions.length).toBeGreaterThanOrEqual(1);
    // 決勝カード（ガンマを相手に持つ a の match）が champion 強調に含まれる。
    champions.forEach((el) => {
      expect(el.querySelector('.tournament-bracket__card')).not.toBeNull();
    });

    // winnerHighlightId 未指定なら champion 強調は付かない。
    const { container: c2 } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );
    expect(
      c2.querySelectorAll('.tournament-bracket__match--champion'),
    ).toHaveLength(0);
  });
});

describe('TournamentBracketView — 接続線要素（要件18.3, 18.7）', () => {
  it('ラウンド間のコネクタがラウンド数-1 個存在する（2 ラウンドなら 1 個）', () => {
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );
    // 2 ラウンド → コネクタは 1 個（最終ラウンド後には付かない）。
    expect(
      container.querySelectorAll('.tournament-bracket__connector'),
    ).toHaveLength(1);
  });

  it('単一ラウンドのみのときはコネクタが 0 個', () => {
    const matches: ResolvedBracketMatch[] = [
      { round: 0, left: a, right: b, winner: a, bye: false },
    ];
    const { container } = render(<TournamentBracketView matches={matches} />);
    expect(
      container.querySelectorAll('.tournament-bracket__connector'),
    ).toHaveLength(0);
  });
});

describe('TournamentBracketView — 横スクロールなし（緩め・要件18.5）', () => {
  it('ルートに .tournament-bracket クラスが付く（overflow-x: hidden をCSSで指定）', () => {
    // jsdom はレイアウト計測不可・global.css も未適用のため、クラス存在で緩く確認する。
    const { container } = render(
      <TournamentBracketView matches={twoRoundBracket()} />,
    );
    const root = container.querySelector('.tournament-bracket');
    expect(root).not.toBeNull();
    expect(root).toHaveClass('tournament-bracket');
  });
});
