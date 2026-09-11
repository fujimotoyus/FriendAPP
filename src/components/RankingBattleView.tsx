/**
 * RankingBattleView（ランキング対戦）— 勝ち抜きトーナメントの自動判定 UI（試合ごとリザルト表示）。
 *
 * {@link useRankingBattle} に接続し、hook の {@link BattlePhase phase} に従って表示を切り替える
 * （イテレーション9「対戦を魅せる」、要件17）。**勝敗は利用者が選ばず、アプリが rng で自動判定する。**
 * 利用者の操作は「勝負！」（現ペアの勝者を判定して結果発表へ）→「次へ」（次ペア or 優勝発表へ）の
 * 2 段階に分かれ、勝敗の選択ボタンは置かない（要件4.2, 4.3, 17.1〜17.4）。
 *
 * - `phase==='pair'`   : 現在のペア 2 件を写真・名前で並べ、入場アニメ（`--enter`）を付ける。
 *                        操作は「勝負！」（{@link UseRankingBattleResult.resolveCurrentBattle}）。要件17.1
 * - `phase==='result'` : 今戦ったペア（{@link UseRankingBattleResult.currentPairCharacters}）を並べ、
 *                        `currentCommentary.winner`（id）と一致する側に勝者ハイライト（`--winner`）、
 *                        他方に敗者トーンダウン（`--loser`）を付ける。実況テキストを表示。
 *                        操作は「次へ」（{@link UseRankingBattleResult.next}）。要件17.2, 17.3, 4.3
 * - `phase==='champion'`: champion を大きく強調（`--celebrate`）し、紙吹雪演出を描画。
 *                         優勝見出しはお題連動（{@link buildChampionTitle}、要件20.6）。
 *                         操作は「もう一度対戦」。要件4.7, 17.4
 *
 * 本コンポーネントはロジックを持たず、hook から受け取った状態を描画するのみとする（勝者判定等は
 * hook/domain 側）。効果音は追加せず（要件17.6）、自動再生もしない（タイマー等を入れない、要件17.5）。
 * 操作要素は最小 44×44 CSS px（{@link PastelButton}）・横スクロールなしを維持する（要件17.10, 17.11）。
 * 進行状態は非永続のため、画面を離れて戻る（再マウント）と初期化される（要件4.9）。
 *
 * イテレーション10の追加表示（ロジックは持たず hook の値を描画するのみ）:
 * - お題バッジ（`theme`, `ranking-battle__theme`）: 対戦中にヘッダー直下へ表示（要件21.1）。
 * - 準優勝（`runnerUp`, `ranking-battle__runner-up`）・ベスト4（`semifinalists`,
 *   `ranking-battle__semifinalists`）: champion 発表内に表示。null/空なら非表示（要件20.1〜20.3）。
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.9, 4.7, 9.4, 20.1, 20.2, 20.3, 20.6, 21.1, 21.4, 21.5
 */
import { useEffect, useState } from 'react';
import type { Character } from '../domain/types';
import type { Rng } from '../domain/TournamentEngine';
import { useRankingBattle } from '../hooks/useRankingBattle';
import { buildChampionTitle } from '../domain/battleTheme';
import type { CharacterStore } from '../persistence/CharacterStore';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';
import { TournamentBracketView } from './TournamentBracketView';

export interface RankingBattleViewProps {
  /** 一覧など前の画面へ戻る操作のハンドラ。 */
  onBack: () => void;
  /** 2 件未満のときに登録フォームへ遷移する導線のハンドラ（要件4.8）。 */
  onRegister: () => void;
  /**
   * 永続化ストア（テスト用の DI）。省略時は `useRankingBattle` の既定
   * （共有シングルトン defaultCharacterStore = IndexedDB）を用いる。
   * App.tsx など本番の使用箇所は省略でよく、挙動は不変（後方互換）。
   */
  store?: CharacterStore;
  /**
   * [0,1) の一様乱数生成器（テスト用の DI）。省略時は `useRankingBattle` の既定
   * （`Math.random`）を用いる。テストで固定/シード rng を渡すと勝者・実況が決定的になる。
   */
  rng?: Rng;
}

/** 表示名を解決する。名前が空ならニックネーム、それも空なら代替表示（要件1.9 と整合）。 */
function displayNameOf(character: Character): string {
  const name = character.name.trim();
  if (name.length > 0) {
    return name;
  }
  const nickname = character.nickname.trim();
  if (nickname.length > 0) {
    return nickname;
  }
  return '名前未設定';
}

/**
 * 紙吹雪の各紙片に循環使用するテーマ色トークン（要件9.1 のトークン経由）。
 * inline style の background-color に `var(--...)` で適用する。
 */
const CONFETTI_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--image-color-rose)',
  'var(--image-color-butter)',
  'var(--image-color-sky)',
] as const;

/** 紙吹雪の紙片数（装飾。12〜20 個程度）。 */
const CONFETTI_PIECES = 16;

export function RankingBattleView({
  onBack,
  onRegister,
  store,
  rng,
}: RankingBattleViewProps): JSX.Element {
  // store/rng は省略時 undefined。useRankingBattle の既定引数
  // （defaultCharacterStore / Math.random）が適用されるため本番挙動は不変（後方互換）。
  const {
    currentPairCharacters,
    currentCommentary,
    champion,
    // 準優勝・ベスト4（champion 確定時のみ。定義できない小規模トーナメントは null/空。要件20）。
    runnerUp,
    semifinalists,
    // 今回のお題（start のたびに変わる。未開始/reset 後は空文字。要件21）。
    theme,
    canStart,
    phase,
    // 勝ち上がり（id を Character へ解決済み）。TournamentBracketView で可視化する（要件18.1）。
    bracket,
    start,
    resolveCurrentBattle,
    next,
    reset,
  } = useRankingBattle(store, rng);

  // 開始を一度試みたか（canStart=false が「2 件未満」なのか「未開始」なのかを区別するため）。
  const [hasAttempted, setHasAttempted] = useState(false);

  // 画面表示時に対戦を開始する（fetchAll → 2 件以上なら最初のペアを提示）。要件4.1
  // 進行状態は非永続のため、再マウントのたびに初期状態から開始し直す（要件4.9）。
  useEffect(() => {
    let cancelled = false;
    void start().finally(() => {
      if (!cancelled) {
        setHasAttempted(true);
      }
    });
    // アンマウント時に進行状態を破棄する（非永続。要件4.9）。
    return () => {
      cancelled = true;
      reset();
    };
    // start / reset は useCallback 済みで安定。マウント時に一度だけ実行する。
  }, [start, reset]);

  // 「もう一度」: 進行状態を初期化して最初から対戦をやり直す（要件4.9）。
  const handleRestart = (): void => {
    setHasAttempted(false);
    void start().finally(() => setHasAttempted(true));
  };

  // 対戦が始まっている（2 件以上あり、開始試行済み）か。対戦エリア/トーナメント表の表示条件。
  const battleStarted = hasAttempted && canStart;

  return (
    <main className="ranking-battle">
      <header className="ranking-battle__header">
        <PastelButton variant="secondary" onClick={onBack}>
          ← 一覧へ戻る
        </PastelButton>
        <h1>ランキング対戦</h1>
      </header>

      {/* お題バッジ（Battle_Theme、要件21.1）: 対戦が始まっており theme が非空のときのみ表示する。
          theme は hook が start のたびに選ぶため毎回変わりうる。ロジックは持たず値を描画するのみ。 */}
      {battleStarted && theme.length > 0 ? (
        <p className="ranking-battle__theme" aria-label={`お題: ${theme}`}>
          お題: {theme}
        </p>
      ) : null}

      {/* 2 件未満: 対戦を開始せず、2 件以上の登録が必要である旨と登録導線を表示する（要件4.8）。
          hasAttempted=true（start 完了後）かつ canStart=false のときにのみ確定表示する。 */}
      {hasAttempted && !canStart ? (
        <EmptyStateView
          message="対戦には 2 件以上の登録が必要です。お気に入りをもう少し登録すると、勝ち抜き対戦で一番を決められます。"
          actionLabel="新規登録"
          onAction={onRegister}
        />
      ) : null}

      {/* 開始準備中の簡易表示。 */}
      {!hasAttempted ? (
        <p className="ranking-battle__loading">対戦の準備をしています…</p>
      ) : null}

      {/* phase==='pair': 現在のペア 2 件を並べて表示し「勝負！」で勝者を判定する（要件17.1）。
          勝敗選択ボタンは置かない（自動判定。要件4.2）。入場アニメ用クラスを付与。 */}
      {battleStarted && phase === 'pair' && currentPairCharacters != null ? (
        <>
          <section
            className="ranking-battle__arena"
            aria-label="対戦中のペア"
          >
            <div className="ranking-battle__contestant ranking-battle__contestant--enter">
              <PhotoFrame
                photo={currentPairCharacters.left.photo}
                alt={displayNameOf(currentPairCharacters.left)}
                className="ranking-battle__photo"
              />
              <span className="ranking-battle__name">
                {displayNameOf(currentPairCharacters.left)}
              </span>
            </div>

            <span className="ranking-battle__versus" aria-hidden="true">
              VS
            </span>

            <div className="ranking-battle__contestant ranking-battle__contestant--enter">
              <PhotoFrame
                photo={currentPairCharacters.right.photo}
                alt={displayNameOf(currentPairCharacters.right)}
                className="ranking-battle__photo"
              />
              <span className="ranking-battle__name">
                {displayNameOf(currentPairCharacters.right)}
              </span>
            </div>
          </section>

          <div className="ranking-battle__controls">
            <PastelButton onClick={resolveCurrentBattle}>勝負！ ⚔️</PastelButton>
          </div>
        </>
      ) : null}

      {/* phase==='result': 今戦ったペアを並べ、勝者側を強調・敗者側をトーンダウンする。
          勝者判定は currentCommentary.winner（id）と各 Character.id の照合で行う（要件17.2, 17.3）。 */}
      {battleStarted &&
      phase === 'result' &&
      currentPairCharacters != null &&
      currentCommentary != null ? (
        <>
          <section
            className="ranking-battle__arena"
            aria-label="対戦結果"
          >
            <div
              className={
                'ranking-battle__contestant ' +
                (currentPairCharacters.left.id === currentCommentary.winner
                  ? 'ranking-battle__contestant--winner'
                  : 'ranking-battle__contestant--loser')
              }
            >
              <PhotoFrame
                photo={currentPairCharacters.left.photo}
                alt={displayNameOf(currentPairCharacters.left)}
                className="ranking-battle__photo"
              />
              <span className="ranking-battle__name">
                {displayNameOf(currentPairCharacters.left)}
              </span>
            </div>

            <span className="ranking-battle__versus" aria-hidden="true">
              VS
            </span>

            <div
              className={
                'ranking-battle__contestant ' +
                (currentPairCharacters.right.id === currentCommentary.winner
                  ? 'ranking-battle__contestant--winner'
                  : 'ranking-battle__contestant--loser')
              }
            >
              <PhotoFrame
                photo={currentPairCharacters.right.photo}
                alt={displayNameOf(currentPairCharacters.right)}
                className="ranking-battle__photo"
              />
              <span className="ranking-battle__name">
                {displayNameOf(currentPairCharacters.right)}
              </span>
            </div>
          </section>

          {/* 実況＋勝敗結果: 直近の対戦の実況テキスト（実行ごとに変動しうる）。要件4.3, 4.5 */}
          <p className="ranking-battle__commentary" role="status">
            {currentCommentary.commentary}
          </p>

          <div className="ranking-battle__controls">
            <PastelButton onClick={next}>次へ ▶</PastelButton>
          </div>
        </>
      ) : null}

      {/* phase==='champion': 最終勝者を「最も好きなキャラ」として大きく強調表示する（要件4.7）。
          登場アニメ（--celebrate）＋紙吹雪演出を添える（要件17.4）。 */}
      {battleStarted && phase === 'champion' && champion != null ? (
        <section
          className="ranking-battle__champion ranking-battle__champion--celebrate"
          aria-label="最も好きなキャラ"
        >
          {/* 紙吹雪（装飾）: スクリーンリーダーからは無視する。色はテーマ色トークンを循環使用し、
              位置（left）・遅延（animation-delay）は inline style で散らす。要件17.4, 9.1 */}
          <div className="ranking-battle__confetti" aria-hidden="true">
            {Array.from({ length: CONFETTI_PIECES }).map((_, index) => (
              <span
                key={index}
                className="ranking-battle__confetti-piece"
                style={{
                  left: `${(index * 100) / CONFETTI_PIECES}%`,
                  animationDelay: `${(index % 8) * 120}ms`,
                  backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                }}
              />
            ))}
          </div>

          {/* 優勝見出し（Champion_Title、要件20.6）: お題（theme）から buildChampionTitle で導出する。
              非空 theme → '{観点}No.1 👑'、空 theme（未開始/reset 後）→ '最も好きなキャラ 👑'。
              ロジックは持たず hook の theme を純粋関数へ渡して描画するのみ。 */}
          <p className="ranking-battle__champion-title">
            {buildChampionTitle(theme)}
          </p>
          <PhotoFrame
            photo={champion.photo}
            alt={displayNameOf(champion)}
            className="ranking-battle__champion-photo"
          />
          <h2 className="ranking-battle__champion-name">
            {displayNameOf(champion)}
          </h2>

          {/* 準優勝（要件20.1, 20.2）: 決勝の敗者。null（決勝が不戦勝等で定義できない）なら非表示（要件20.3）。 */}
          {runnerUp != null ? (
            <p className="ranking-battle__runner-up">
              準優勝: {displayNameOf(runnerUp)}
            </p>
          ) : null}

          {/* ベスト4（要件20.3）: 準決勝敗退者。準決勝ラウンドが無い小規模トーナメントは空で非表示。
              複数名は折り返して収める（CSS の flex-wrap）。各要素は displayNameOf で名前解決。 */}
          {semifinalists.length > 0 ? (
            <p className="ranking-battle__semifinalists">
              <span className="ranking-battle__semifinalists-label">ベスト4:</span>
              {semifinalists.map((character) => (
                <span
                  key={character.id}
                  className="ranking-battle__semifinalist"
                >
                  {displayNameOf(character)}
                </span>
              ))}
            </p>
          ) : null}

          <PastelButton onClick={handleRestart}>もう一度対戦 🔄</PastelButton>
        </section>
      ) : null}

      {/* トーナメント表: 対戦が始まっている間、対戦エリア/champion セクションの下に勝ち上がりを
          可視化する（要件18）。読み取り専用の表示のみで、対戦結果やストアは変更しない（要件18.4）。 */}
      {battleStarted ? (
        <TournamentBracketView
          matches={bracket}
          winnerHighlightId={champion?.id ?? null}
        />
      ) : null}
    </main>
  );
}
