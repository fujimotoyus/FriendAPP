/**
 * TournamentBracketView — 勝ち上がり（トーナメント表）を可視化する読み取り専用コンポーネント（要件18）。
 *
 * {@link useRankingBattle} の `bracket`（{@link ResolvedBracketMatch}[]）を受け取り、各 match を
 * `round` ごとにグルーピングしてラウンド順（round 昇順）に縦積みで表示する。各対戦は
 * 「left の名前 vs right の名前」（不戦勝は right 無しで『不戦勝（Bye）』表記）で並べ、勝者側に
 * 👑 と強調クラス（`--winner`）を付ける。`winnerHighlightId` が指定され、その match の勝者が
 * 一致する場合は最終優勝者として軽い強調（`--champion`）を添える。
 *
 * **読み取り専用の可視化のみ**であり、操作要素を置かず対戦結果や Character_Store を変更しない
 * （要件18.4）。ビューポート幅 320〜430 CSS px でも横スクロールを発生させないよう、ラウンドを
 * 縦積みにし各行を `width:100%` で収める（要件18.5, 9.7）。配色・角丸・影・余白は大人かわいい
 * テーマのトークン（`--color-*` / `--radius-*` / `--shadow-*` / `--space-*`）経由で適用する（要件9）。
 *
 * `matches` が空のときは何も描画しない（`null` を返す）。
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 7.6, 7.7, 9.6, 9.7
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

      {orderedRounds.map(([round, roundMatches]) => (
        <div className="tournament-bracket__round" key={round}>
          <h3 className="tournament-bracket__round-label">
            {roundLabel(round, lastRound)}
          </h3>

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
                  {/* left（不戦勝はこの単独者が勝者として繰り上がる）。 */}
                  <span
                    className={
                      'tournament-bracket__competitor' +
                      (leftIsWinner
                        ? ' tournament-bracket__competitor--winner'
                        : '')
                    }
                  >
                    {leftIsWinner ? (
                      <span
                        className="tournament-bracket__crown"
                        aria-hidden="true"
                      >
                        👑
                      </span>
                    ) : null}
                    {displayNameOf(match.left)}
                  </span>

                  {match.bye || match.right == null ? (
                    // 不戦勝（Bye）: 対戦相手がいない。
                    <span className="tournament-bracket__bye">不戦勝（Bye）</span>
                  ) : (
                    <>
                      <span
                        className="tournament-bracket__versus"
                        aria-hidden="true"
                      >
                        vs
                      </span>
                      <span
                        className={
                          'tournament-bracket__competitor' +
                          (rightIsWinner
                            ? ' tournament-bracket__competitor--winner'
                            : '')
                        }
                      >
                        {rightIsWinner ? (
                          <span
                            className="tournament-bracket__crown"
                            aria-hidden="true"
                          >
                            👑
                          </span>
                        ) : null}
                        {displayNameOf(match.right)}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
