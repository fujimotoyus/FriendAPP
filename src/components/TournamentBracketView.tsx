/**
 * TournamentBracketView — 勝ち上がり（トーナメント表）を可視化する読み取り専用コンポーネント（要件18）。
 *
 * {@link useRankingBattle} の `bracket`（{@link ResolvedBracketMatch}[]）を受け取り、各 match を
 * `round` ごとにグルーピングしてラウンド順（round 昇順）に **上から下へ縦向きのブラケット図** として
 * 表示する。各対戦は「対戦カード」として表し、カード内に left と right（不戦勝は right の代わりに
 * 『不戦勝（Bye）』表記）を縦に並べ、勝者側に 👑 と強調クラス（`--winner`）を付ける。
 * `winnerHighlightId` が指定され、その match の勝者が一致する場合は最終優勝者として軽い強調
 * （`--champion`）を添える。
 *
 * **勝ち上がりの流れ**は、ラウンド間に置いた接続表現（中央の縦コネクタ＋各カードから中央へ伸びる
 * 短い罫線）で視覚化する。あるラウンドの各対戦の勝者が次ラウンド（下）の対戦へ進むことを、厳密な
 * 1 対 1 の対応線ではなく「ラウンド間をつなぐ中央コネクタ」で簡略に示す（勝ち上がりの流れが
 * 視覚的に分かることが目的。要件18.1, 18.2, 18.3, 18.7）。接続線の色・寸法・角丸・影・余白は
 * すべて大人かわいいテーマのトークン（`--color-*` / `--radius-*` / `--shadow-*` / `--space-*`）経由で
 * CSS 側に定義する（要件9）。
 *
 * **読み取り専用の可視化のみ**であり、操作要素を置かず対戦結果や Character_Store を変更しない
 * （要件18.4）。ビューポート幅 320〜430 CSS px でも横スクロールを発生させないよう、ラウンドを
 * 縦積みにし各対戦カードを `width:100%` で収め、長い名前は折り返す（要件18.5, 18.7, 9.7）。
 *
 * `matches` が空のときは何も描画しない（`null` を返す）。
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.7, 7.6, 7.7, 9.6, 9.7, 9.1, 9.2
 */
import type { Character, ResolvedBracketMatch } from '../domain/types';

export interface TournamentBracketViewProps {
  /** 表示する勝ち上がり（id を Character へ解決済み）。空のときは何も描画しない。 */
  matches: ResolvedBracketMatch[];
  /** 最終優勝者の id（任意）。一致する match の勝者に軽い優勝強調を添える。 */
  winnerHighlightId?: string | null;
}

/**
 * 表示名を解決する。名前が空ならニックネーム、それも空なら代替表示（要件1.9 と整合）。
 * RankingBattleView の displayNameOf と同等のロジックをローカルに定義する（循環 import を避ける）。
 */
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
 * ラウンド番号からラウンドラベルを導出する。最終ラウンド（round === lastRound）は「決勝」、
 * それ以外は「{round + 1}回戦」とする（round は 0 始まり）。
 */
function roundLabel(round: number, lastRound: number): string {
  if (round === lastRound) {
    return '決勝';
  }
  return `${round + 1}回戦`;
}

/**
 * 1 名の対戦者（competitor）を描画する。勝者なら 👑 と `--winner` 強調を付ける。
 */
function Competitor({
  character,
  isWinner,
}: {
  character: Character;
  isWinner: boolean;
}): JSX.Element {
  return (
    <span
      className={
        'tournament-bracket__competitor' +
        (isWinner ? ' tournament-bracket__competitor--winner' : '')
      }
    >
      {isWinner ? (
        <span className="tournament-bracket__crown" aria-hidden="true">
          👑
        </span>
      ) : null}
      <span className="tournament-bracket__competitor-name">
        {displayNameOf(character)}
      </span>
    </span>
  );
}

export function TournamentBracketView({
  matches,
  winnerHighlightId,
}: TournamentBracketViewProps): JSX.Element | null {
  // 空のときは何も描画しない（要件: 空は null を返す）。
  if (matches.length === 0) {
    return null;
  }

  // round ごとにグルーピングする（Map は挿入順を保つが、明示的に round 昇順でソートして安定させる）。
  const rounds = new Map<number, ResolvedBracketMatch[]>();
  for (const match of matches) {
    const group = rounds.get(match.round);
    if (group) {
      group.push(match);
    } else {
      rounds.set(match.round, [match]);
    }
  }
  const orderedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);
  const lastRound = orderedRounds[orderedRounds.length - 1][0];

  return (
    <section className="tournament-bracket" aria-label="トーナメント表">
      <h2 className="tournament-bracket__title">トーナメント表</h2>

      {/* 縦向きブラケット: ラウンドを上から下へ縦積みし、ラウンド間を接続コネクタでつなぐ。 */}
      <div className="tournament-bracket__flow">
        {orderedRounds.map(([round, roundMatches], roundIndex) => (
          <div className="tournament-bracket__round" key={round}>
            <h3 className="tournament-bracket__round-label">
              {roundLabel(round, lastRound)}
            </h3>

            {/* 各対戦カードを中央コネクタに沿わせて配置する。 */}
            <ul className="tournament-bracket__matches">
              {roundMatches.map((match, index) => {
                const leftIsWinner =
                  match.winner != null && match.winner.id === match.left.id;
                const rightIsWinner =
                  match.right != null &&
                  match.winner != null &&
                  match.winner.id === match.right.id;
                const isChampionMatch =
                  winnerHighlightId != null &&
                  match.winner != null &&
                  match.winner.id === winnerHighlightId;

                return (
                  <li
                    className={
                      'tournament-bracket__match' +
                      (isChampionMatch
                        ? ' tournament-bracket__match--champion'
                        : '')
                    }
                    key={`${round}-${index}`}
                  >
                    {/* 対戦カード本体。left と right（または Bye）を縦に並べる。 */}
                    <div className="tournament-bracket__card">
                      <Competitor
                        character={match.left}
                        isWinner={leftIsWinner}
                      />

                      {match.bye || match.right == null ? (
                        // 不戦勝（Bye）: 対戦相手がいない。
                        <span className="tournament-bracket__bye">
                          不戦勝（Bye）
                        </span>
                      ) : (
                        <>
                          <span
                            className="tournament-bracket__versus"
                            aria-hidden="true"
                          >
                            vs
                          </span>
                          <Competitor
                            character={match.right}
                            isWinner={rightIsWinner}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* ラウンド間の接続コネクタ（最終ラウンドの後には置かない）。
                勝者が次ラウンド（下）の対戦へ進む流れを中央の縦線で視覚化する（要件18.3, 18.7）。 */}
            {roundIndex < orderedRounds.length - 1 ? (
              <div
                className="tournament-bracket__connector"
                aria-hidden="true"
              />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
