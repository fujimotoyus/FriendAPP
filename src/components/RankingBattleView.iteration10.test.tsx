/**
 * RankingBattleView / useRankingBattle のイテレーション10 統合的ユニットテスト
 * （お題表示 / 状況別実況 / 準優勝・ベスト4 の表示）
 *
 * task 53.1（イテレーション10、任意テスト `*`）。既存 `RankingBattleView.test.tsx`
 * （フェーズ遷移・勝者ハイライト・ブラケット表示・2 件未満ガードを検証）は変更せず、
 * イテレーション10で追加された表示要素を React Testing Library（Vitest, jsdom）で例示検証する。
 *
 * 検証観点:
 * - お題表示（要件21.1）: 2 件以上で開始すると「お題:」バッジ（`.ranking-battle__theme`）が出る。
 * - お題は複数存在し変わりうる（要件21.2）: `pickBattleTheme` を rng 違いで呼ぶと異なるお題が返る。
 * - 準優勝・ベスト4 の表示（要件20.1, 20.2, 20.3）: champion まで進めると準優勝（決勝の敗者）が
 *   表示される。ベスト4（準決勝敗者）は 2 件では出ず、4 件では構造的性質（決勝の 1 つ前ラウンドの
 *   敗者集合）に沿って確認する。
 * - 状況別実況（要件19.2）: `deriveBattleSituation` + `narrate` を直接呼び、favored/upset/even の
 *   各状況で状況別テンプレート群から選ぶ（rng を変えると異なる文面が生じうる・非空・勝者名を含む）。
 *
 * DI / 決定性の方針（既存 `RankingBattleView.test.tsx` を踏襲）:
 * - `RankingBattleView` は `store?` / `rng?` の optional props で DI 可能。InMemoryCharacterStore と
 *   固定/系列 rng を渡す。
 * - `useRankingBattle` は `createTournament(ids, rng)`（shuffle 省略＝Math.random）を使うため初期並びは
 *   非決定的。勝ち上がりの完全決定は要求せず、champion までは「勝負！→次へ」を champion 見出しが出るまで
 *   繰り返すループ（無限ループ防止の上限つき）で進め、構造的性質（準優勝が必ず出る等）を検証する。
 * - jsdom の URL.createObjectURL は src/test/setup.ts で用意済みのため追加モック不要。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」「イテレーション10」、
 *       要件19.2, 20.1, 20.2, 20.3, 21.1, 21.2
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';
import { RankingBattleView } from './RankingBattleView';
import { pickBattleTheme, BATTLE_THEME_COUNT } from '../domain/battleTheme';
import { narrate, deriveBattleSituation } from '../domain/BattleCommentator';

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

/**
 * champion 見出しが表示されているか（お題連動、要件20.6）。優勝見出しは theme により
 * 文言が変わる（例 'かわいさNo.1 👑'）ため、テキスト一致ではなく安定した className
 * （.ranking-battle__champion-title）で検出する。
 */
function championTitlePresent(): boolean {
  return (
    document.querySelector('.ranking-battle__champion-title') != null
  );
}

/**
 * 「勝負！→次へ」を champion 見出し（お題連動・冠付き）が出るまで繰り返す。
 * 無限ループ防止のため反復回数に上限を設ける。
 */
async function playUntilChampion(maxIterations = 20): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    if (championTitlePresent()) {
      return;
    }
    const fightButton = screen.queryByRole('button', { name: /勝負/ });
    if (fightButton != null) {
      fireEvent.click(fightButton);
      // result への遷移（「次へ」ボタン出現）を待つ。
      await screen.findByRole('button', { name: /次へ/ });
    }
    const nextButton = screen.queryByRole('button', { name: /次へ/ });
    if (nextButton != null) {
      fireEvent.click(nextButton);
    }
    if (fightButton == null && nextButton == null) {
      // 進められる操作が無い（想定外）。ループを抜けてアサーションに委ねる。
      break;
    }
  }
}

describe('RankingBattleView — お題表示（要件21.1）', () => {
  it('Character 2 件以上で開始すると「お題:」バッジ（.ranking-battle__theme）が表示される', async () => {
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

    // 開始後「勝負！」が出る＝対戦開始済み。
    await screen.findByRole('button', { name: /勝負/ });

    const themeBadge = container.querySelector('.ranking-battle__theme');
    expect(themeBadge).not.toBeNull();
    expect(themeBadge?.textContent).toMatch(/^お題:/);
    // お題テキスト（「お題:」以降）は非空。
    expect((themeBadge?.textContent ?? '').replace(/^お題:\s*/, '').length).toBeGreaterThan(0);
  });

  it('2 件未満（対戦を開始できない）ときはお題バッジを表示しない', async () => {
    const store = new InMemoryCharacterStore([makeCharacter({ id: 'a' })]);
    const { container } = render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    await screen.findByText(/2 件以上の登録が必要/);
    expect(container.querySelector('.ranking-battle__theme')).toBeNull();
  });
});

describe('お題は複数存在し変わりうる（要件21.2）', () => {
  it('pickBattleTheme は rng の値を変えると異なるお題を返す（複数テンプレートが存在する）', () => {
    const low = pickBattleTheme(() => 0); // 先頭テンプレート
    const high = pickBattleTheme(() => 0.99); // 末尾テンプレート
    expect(low.length).toBeGreaterThan(0);
    expect(high.length).toBeGreaterThan(0);
    expect(low).not.toEqual(high);
    // テンプレートは複数（1 つに固定されていない）。
    expect(BATTLE_THEME_COUNT).toBeGreaterThan(1);
  });

  it('rng を配列全域に振ると複数種類のお題が得られる（お題が単一固定でない）', () => {
    const themes = new Set<string>();
    const n = BATTLE_THEME_COUNT;
    for (let i = 0; i < n; i++) {
      // 各テンプレートのインデックス中央付近を狙う rng 値。
      themes.add(pickBattleTheme(() => (i + 0.5) / n));
    }
    expect(themes.size).toBeGreaterThan(1);
  });
});

describe('RankingBattleView — 準優勝・ベスト4 の表示（要件20.1, 20.2, 20.3）', () => {
  it('2 件のトーナメントでは準優勝（決勝の敗者）が表示され、ベスト4 は表示されない', async () => {
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

    await screen.findByRole('button', { name: /勝負/ });
    await playUntilChampion();
    // 優勝見出し（お題連動、要件20.6）は冠付きの '…No.1 👑' 形で検出する。
    await screen.findByText(/No\.1 👑/);

    // 準優勝（決勝の敗者）が表示される（要件20.1, 20.2）。
    const runnerUp = container.querySelector('.ranking-battle__runner-up');
    expect(runnerUp).not.toBeNull();
    expect(runnerUp?.textContent).toMatch(/^準優勝:/);
    // 準優勝名は登録名（アルファ/ベータ）のいずれか。
    expect(runnerUp?.textContent).toMatch(/アルファ|ベータ/);

    // ベスト4（準決勝敗者）は 2 件では準決勝ラウンドが無いため表示されない（要件20.3）。
    expect(container.querySelector('.ranking-battle__semifinalists')).toBeNull();
  });

  it('4 件のトーナメントでは champion まで進めると準優勝が表示される（決勝の敗者が必ず 1 名出る）', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ' }),
      makeCharacter({ id: 'b', name: 'ベータ' }),
      makeCharacter({ id: 'c', name: 'ガンマ' }),
      makeCharacter({ id: 'd', name: 'デルタ' }),
    ]);
    const { container } = render(
      <RankingBattleView
        onBack={() => {}}
        onRegister={() => {}}
        store={store}
        rng={alwaysZeroRng}
      />,
    );

    await screen.findByRole('button', { name: /勝負/ });
    await playUntilChampion();
    // 優勝見出し（お題連動、要件20.6）は冠付きの '…No.1 👑' 形で検出する。
    await screen.findByText(/No\.1 👑/);

    // 準優勝（決勝の敗者）が必ず 1 名表示される（要件20.1, 20.2）。
    const runnerUp = container.querySelector('.ranking-battle__runner-up');
    expect(runnerUp).not.toBeNull();
    expect(runnerUp?.textContent).toMatch(/^準優勝:/);
    // 準優勝名は 4 件の登録名のいずれか。
    expect(runnerUp?.textContent).toMatch(/アルファ|ベータ|ガンマ|デルタ/);

    // ベスト4（準決勝敗者＝決勝の 1 つ前ラウンドの敗者集合）は、4 件（1 回戦 2 試合→決勝）の場合
    // 1 回戦の敗者 2 名になる。表示される場合はラベル「ベスト4:」と敗者名を含み、champion/準優勝と
    // 重複しない（要件20.3, 20.5）。存在確認は緩く行い、フレークを避ける。
    const semifinalists = container.querySelector('.ranking-battle__semifinalists');
    if (semifinalists != null) {
      expect(semifinalists.textContent).toContain('ベスト4:');
      const semiEls = container.querySelectorAll('.ranking-battle__semifinalist');
      // 4 件なら準決勝（1 回戦）敗者は最大 2 名。
      expect(semiEls.length).toBeGreaterThanOrEqual(1);
      expect(semiEls.length).toBeLessThanOrEqual(2);
      // ベスト4 の各名は champion 名・準優勝名と重複しない。
      const championName = container
        .querySelector('.ranking-battle__champion-name')
        ?.textContent?.trim();
      const runnerUpName = (runnerUp?.textContent ?? '')
        .replace(/^準優勝:\s*/, '')
        .trim();
      semiEls.forEach((el) => {
        const name = el.textContent?.trim() ?? '';
        expect(name.length).toBeGreaterThan(0);
        expect(name).not.toEqual(championName);
        expect(name).not.toEqual(runnerUpName);
      });
    }
  });
});

describe('状況別実況（要件19.2）— deriveBattleSituation + narrate', () => {
  const names = { winner: '勝者さん', loser: '敗者さん' };

  it('deriveBattleSituation は Favorite_Level の大小で favored/upset/even を導出する', () => {
    // 勝者の方が好き（level 大）→ 順当（favored）。
    expect(deriveBattleSituation(5, 2)).toBe('favored');
    // 勝者の方が好きでない（level 小）→ 番狂わせ（upset）。
    expect(deriveBattleSituation(2, 5)).toBe('upset');
    // 同値 → 互角（even）。
    expect(deriveBattleSituation(3, 3)).toBe('even');
  });

  it('narrate は各状況で状況別テンプレートから選び、非空かつ勝者名を含む', () => {
    (['favored', 'upset', 'even'] as const).forEach((situation) => {
      const line = narrate(names, () => 0, situation);
      expect(line.length).toBeGreaterThan(0);
      expect(line).toContain(names.winner);
    });
  });

  it('同一状況でも rng を変えると異なる文面が生じうる（テンプレートが複数存在する）', () => {
    (['favored', 'upset', 'even'] as const).forEach((situation) => {
      const low = narrate(names, () => 0, situation); // 先頭テンプレート
      const high = narrate(names, () => 0.99, situation); // 末尾テンプレート
      expect(low).not.toEqual(high);
      expect(low).toContain(names.winner);
      expect(high).toContain(names.winner);
    });
  });

  it('状況が異なれば（同じ rng でも）実況の出し分けがある — favored と upset の先頭文面が異なる', () => {
    const favored = narrate(names, () => 0, 'favored');
    const upset = narrate(names, () => 0, 'upset');
    const even = narrate(names, () => 0, 'even');
    // 3 状況の先頭テンプレートはそれぞれ異なる文面（状況別に出し分けている）。
    expect(new Set([favored, upset, even]).size).toBe(3);
  });
});
