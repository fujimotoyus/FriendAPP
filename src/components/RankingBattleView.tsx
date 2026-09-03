/**
 * RankingBattleView（ランキング対戦）— 勝ち抜きトーナメントの自動判定・自動進行 UI。
 *
 * {@link useRankingBattle} に接続し、現在の {@link BattlePair} 2 件を写真（{@link PhotoFrame}）・
 * 名前とともに並べて表示する（要件4.1）。**勝敗は利用者が選ばず、アプリが rng で自動判定する。**
 * 利用者の操作は「対戦開始」「次へ進める」「自動再生」「もう一度」のみで、勝敗の選択ボタンは
 * 置かない（要件4.2, 4.3）。各対戦では実行のたびにランダムに変わる実況（`currentCommentary.commentary`）
 * と勝敗結果を表示して自動進行し（要件4.3, 4.4）、最終勝者（champion）を「最も好きなキャラ」として
 * 写真・名前とともに表示する（要件4.7）。Character が 2 件未満のときは対戦を開始せず、2 件以上の
 * 登録が必要である旨のメッセージと登録導線を表示する（canStart=false を利用、要件4.8）。
 *
 * 本コンポーネントはロジックを持たず、hook から受け取った状態を描画するのみとする
 * （design.md「UI 層」「Components and Interfaces / RankingBattleView」「Key Flows / フロー3」）。
 * 名前が未入力（空文字）の場合は「名前未設定」を代替表示する（要件1.9 と整合）。
 * 進行状態は非永続のため、画面を離れて戻る（再マウント）と初期化される（要件4.9）。
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8
 */
import { useEffect, useState } from 'react';
import type { Character } from '../domain/types';
import { useRankingBattle } from '../hooks/useRankingBattle';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';

export interface RankingBattleViewProps {
  /** 一覧など前の画面へ戻る操作のハンドラ。 */
  onBack: () => void;
  /** 2 件未満のときに登録フォームへ遷移する導線のハンドラ（要件4.8）。 */
  onRegister: () => void;
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

export function RankingBattleView({
  onBack,
  onRegister,
}: RankingBattleViewProps): JSX.Element {
  const {
    currentPair,
    currentPairCharacters,
    currentCommentary,
    champion,
    canStart,
    start,
    advance,
    reset,
  } = useRankingBattle();

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

  return (
    <main className="ranking-battle">
      <header className="ranking-battle__header">
        <PastelButton variant="secondary" onClick={onBack}>
          ← 一覧へ戻る
        </PastelButton>
        <h1>ランキング対戦</h1>
      </header>

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

      {/* 対戦中: 現在のペア 2 件を並べて表示（勝敗選択ボタンは置かない）。要件4.1, 4.2 */}
      {canStart && currentPairCharacters != null ? (
        <section className="ranking-battle__arena" aria-label="対戦中のペア">
          <div className="ranking-battle__contestant">
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

          <div className="ranking-battle__contestant">
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
      ) : null}

      {/* 実況＋勝敗結果: 直近の対戦の実況テキストを表示（実行ごとに変動しうる）。要件4.3, 4.5 */}
      {canStart && currentCommentary != null ? (
        <p className="ranking-battle__commentary" role="status">
          {currentCommentary.commentary}
        </p>
      ) : null}

      {/* 進行操作: 勝敗選択はせず「次へ進める」で自動判定を進める（要件4.2〜4.4）。 */}
      {canStart && currentPair != null ? (
        <div className="ranking-battle__controls">
          <PastelButton onClick={advance}>次の対戦へ ⚔️</PastelButton>
        </div>
      ) : null}

      {/* 最終勝者: 勝ち残り 1 件を「最も好きなキャラ」として表示する（要件4.7）。 */}
      {canStart && champion != null ? (
        <section className="ranking-battle__champion" aria-label="最も好きなキャラ">
          <p className="ranking-battle__champion-title">最も好きなキャラ 👑</p>
          <PhotoFrame
            photo={champion.photo}
            alt={displayNameOf(champion)}
            className="ranking-battle__champion-photo"
          />
          <h2 className="ranking-battle__champion-name">
            {displayNameOf(champion)}
          </h2>
          <PastelButton onClick={handleRestart}>もう一度対戦 🔄</PastelButton>
        </section>
      ) : null}
    </main>
  );
}
