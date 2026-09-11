/**
 * TournamentEngine — ランキング対戦の勝ち抜きトーナメント（純粋 TypeScript ドメインモジュール）
 *
 * 全 Character を対象に勝ち抜き戦（トーナメント）を行い、最も好きな 1 件を
 * 自動判定する（要件4）。勝敗は利用者が選ぶのではなく、外部注入された乱数
 * 生成器 `rng: () => number`（[0,1) の一様乱数）を用いて Chara_App が
 * ちょうど 1 件を勝者に自動決定する（要件4.2）。
 *
 * 本番は `Math.random` を rng として渡し、テストは固定/シード rng を渡すことで
 * 決定的に検証できる。React / DOM / IndexedDB に依存しない純粋モジュールであり、
 * property-based testing の主対象である（Correctness Property 11〜13）。
 *
 * アルゴリズム（design.md「トーナメントのブラケット生成と自動勝敗判定・不戦勝処理」）:
 * 1. 開始時、`contestants` を注入シャッフルで一度だけ並べ替え、初期ラウンドの
 *    キューとする（テスト時は恒等/固定順を渡す）。
 * 2. 各ラウンドはキューから 2 件ずつ取り出して {@link BattlePair} を構成する。
 *    `advance()` を呼ぶと現ペアの 2 件から rng でちょうど 1 件を勝者に自動決定
 *    （`rng() < 0.5` で left、そうでなければ right）し、勝者を次ラウンドのキュー
 *    へ追加、敗者を除外する。決定した勝者・敗者は {@link lastResult} に反映する。
 * 3. ラウンドの残りが 1 件（奇数の余り）になった場合、その 1 件は対戦せず次
 *    ラウンドへそのまま繰り上げる（不戦勝 / Bye、要件4.6）。
 * 4. あるラウンドを消化し切ったら次ラウンドへ移り、勝ち残りが 1 件になった時点で
 *    その 1 件を champion とする（要件4.7）。
 * 5. 各対戦で敗者は除外され勝ち残り総数は単調減少するため、`N >= 2` の任意の
 *    コレクションと任意の rng 系列に対して有限回で champion が確定する。終了性は
 *    rng の値に依存しない。
 *
 * 参照: design.md「Domain モジュール / TournamentEngine」「Algorithms」、
 * 要件4.1, 4.2, 4.4, 4.6, 4.7、Correctness Property 11, 12, 13
 */

import type { BattlePair, BracketMatch, TournamentBracket } from './types';

/**
 * 確定済みの {@link TournamentBracket} と champion（優勝者）id から、
 * 準優勝（runnerUp）とベスト4（semifinalists）を導出する純粋関数（要件20）。
 *
 * 導出規則（design.md「イテレーション10」）:
 * - **決勝ラウンド**: champion が「勝者」として現れる match のうち、最大の `round`。
 *   （最終 round に不戦勝しか無いケースを避けるため、最終 round ではなく「champion が
 *   勝者として現れる round の最大」を決勝ラウンドとみなす。）
 * - **準優勝(runnerUp)**: 決勝の match（`bye: false`）の敗者（left/right のうち winner でない側）。
 *   決勝が不戦勝（`right === null`）または該当 match が無い場合は `null`。
 * - **ベスト4(semifinalists)**: 決勝ラウンドの 1 つ前のラウンド（準決勝）の各 match の敗者集合。
 *   不戦勝 match は敗者が無いため含めない。準決勝ラウンドが存在しない小規模トーナメント
 *   （参加者 2〜3 件など）では空配列。
 * - `runnerUp`・`semifinalists` の各要素は `championId` と異なり相互に重複しない（要件20.5）。
 *   通常は bracket 構造上自然に満たすが、念のため champion と一致するものは除外し、
 *   semifinalists は重複を除去する。
 *
 * `bracket` は変更しない（読み取り専用、要件20.4, 18.4）。`createTournament` の既存実装・
 * セマンティクスには一切影響しない（関数追加のみ）。
 *
 * @param bracket 確定済みのトーナメント表（{@link TournamentBracket}）
 * @param championId 優勝者の Character id
 * @returns 準優勝 id（無ければ `null`）とベスト4 id 群（無ければ空配列）
 */
export function deriveRanking(
  bracket: TournamentBracket,
  championId: string,
): { runnerUp: string | null; semifinalists: string[] } {
  // champion が「勝者」として現れる match のうち最大 round を決勝ラウンドとみなす。
  let finalRound = -1;
  for (const m of bracket) {
    if (m.winner === championId && m.round > finalRound) {
      finalRound = m.round;
    }
  }
  // champion が勝者として現れる match が無い（不整合な入力）場合は導出不能。
  if (finalRound < 0) {
    return { runnerUp: null, semifinalists: [] };
  }

  // 決勝: 決勝ラウンドで champion が勝者の match。通常はちょうど 1 件。
  const finalMatch = bracket.find(
    (m) => m.round === finalRound && m.winner === championId,
  );
  let runnerUp: string | null = null;
  if (finalMatch && !finalMatch.bye && finalMatch.right !== null) {
    // 敗者 = left/right のうち winner でない側。
    const loser = finalMatch.left === finalMatch.winner ? finalMatch.right : finalMatch.left;
    if (loser !== championId) {
      runnerUp = loser;
    }
  }

  // 準決勝 = 決勝ラウンドの 1 つ前のラウンド。存在しなければベスト4 は空。
  const semiRound = finalRound - 1;
  const semifinalists: string[] = [];
  if (semiRound >= 0) {
    const seen = new Set<string>();
    for (const m of bracket) {
      if (m.round !== semiRound) continue;
      // 不戦勝は敗者が無いため対象外。
      if (m.bye || m.right === null || m.winner === null) continue;
      const loser = m.left === m.winner ? m.right : m.left;
      // champion と一致するものは除外し、重複も除去する（要件20.5）。
      if (loser === championId || loser === runnerUp || seen.has(loser)) continue;
      seen.add(loser);
      semifinalists.push(loser);
    }
  }

  return { runnerUp, semifinalists };
}

/**
 * トーナメントエンジンの公開インターフェース。
 *
 * 勝者は rng を用いてアプリが自動判定するため、利用者による勝敗選択
 * （旧 `selectWinner` / `choose`）は存在しない。
 */
export interface TournamentEngine {
  /**
   * 現在提示中の対戦ペア。champion 確定後・進行不能時は `null`。
   * 不戦勝の 1 件はペアを構成せず自動で次ラウンドへ繰り上げられる（要件4.1, 4.6）。
   */
  readonly currentPair: BattlePair | null;
  /** 勝ち残りがちょうど 1 件に確定したときの champion の id。未確定時は `null`（要件4.7）。 */
  readonly champion: string | null;
  /** 直近の対戦で自動判定された勝者・敗者の id。まだ対戦がない場合は `null`。 */
  readonly lastResult: { winner: string; loser: string } | null;
  /**
   * 勝ち上がり履歴（Tournament_Bracket、要件18）。全ラウンドの対戦ペアと各対戦の勝者・
   * 不戦勝（Bye）を勝ち上がり順に表す読み取り専用の構造。`advance()` が現ペアの勝敗を
   * 確定した時点で当該 match（`bye: false`）を、不戦勝の繰り上げ時にその match
   * （`bye: true`）を蓄積する。外部からの改変を防ぐため内部配列のコピーを返す。
   * 追加的な読み取り専用情報であり、既存の `currentPair` / `champion` / `lastResult` /
   * `advance()` のセマンティクスには影響しない（既存 Property 11〜13 は不変）。
   */
  readonly bracket: TournamentBracket;
  /**
   * 現ペアの勝者を rng で自動決定し、勝者を次ラウンドへ進め敗者を除外して
   * 次状態（次のペア / 次ラウンド / champion 確定）へ遷移する（要件4.2, 4.4）。
   * 進行できる対戦が無い場合（champion 確定済み等）は何もしない。
   */
  advance(): void;
}

/** [0,1) の一様乱数を返す関数の型。本番は `Math.random`、テストは固定/シード rng。 */
export type Rng = () => number;

/** 配列を並べ替える関数の型（純粋である必要はないが、開始時に一度だけ呼ばれる）。 */
export type Shuffle = (a: string[]) => string[];

/**
 * 注入シャッフルの既定実装。Fisher-Yates シャッフルを `Math.random` で行う。
 *
 * 本番でランダムな初期ブラケットを得るための既定挙動。テスト時は恒等関数や
 * 固定順を返す関数を `createTournament` の第 3 引数に渡して決定性を確保する。
 *
 * @param a シャッフル対象の配列（この関数はコピーに対して操作し、元配列は変更しない）
 * @returns シャッフルされた新しい配列
 */
function defaultShuffle(a: string[]): string[] {
  const result = [...a];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * トーナメントエンジンを生成するファクトリ。
 *
 * @param contestants 対戦に参加する Character の id 配列
 * @param rng [0,1) の一様乱数生成器（本番は `Math.random`、テストは固定/シード rng）
 * @param shuffle 開始時の初期ブラケット並べ替え関数（省略時は `Math.random` ベースの
 *   Fisher-Yates。テスト時は恒等関数や固定順を渡して決定的に検証する）
 * @returns {@link TournamentEngine} 実装
 */
export function createTournament(
  contestants: string[],
  rng: Rng,
  shuffle: Shuffle = defaultShuffle,
): TournamentEngine {
  // 現ラウンドの待機キュー（対戦待ちの id 群）。開始時に一度だけ並べ替える。
  let queue: string[] = shuffle([...contestants]);
  // 現ラウンドで勝ち抜いた（次ラウンドへ進む）id 群。
  let nextRound: string[] = [];
  // 現在提示中の対戦ペア。
  let currentPair: BattlePair | null = null;
  // 直近の対戦結果。
  let lastResult: { winner: string; loser: string } | null = null;
  // champion（勝ち残り 1 件）確定時に設定。
  let champion: string | null = null;
  // 現在のラウンド番号（0 始まり）。次ラウンドのキューへ移行する瞬間にのみ +1 する。
  // 各 match は「その対戦（不戦勝の繰り上げ）が実際に行われたラウンド」を round として記録する。
  let round = 0;
  // 勝ち上がり履歴（Tournament_Bracket、要件18）。advance() の勝敗確定と不戦勝の繰り上げで追記する。
  const bracket: BracketMatch[] = [];

  /**
   * キュー・nextRound の状態から次に提示すべきペアを準備する。
   *
   * - キューに 2 件以上あれば先頭 2 件でペアを構成する。
   * - キューが 1 件（奇数の余り）なら不戦勝として nextRound へ繰り上げる。
   * - キューが空なら、nextRound を次ラウンドのキューへ移して繰り返す。
   * - 全体で勝ち残りが 1 件になれば champion を確定する。
   */
  function prepareNextPair(): void {
    // 現ラウンドのキューが尽きたら次ラウンドへ移行する（不戦勝の繰上げを含めて処理済み）。
    while (queue.length < 2) {
      if (queue.length === 1) {
        // 奇数の余り 1 件は不戦勝で次ラウンドへ繰り上げる（要件4.6）。
        // 不戦勝も match として現ラウンド（round）に記録する（Tournament_Bracket、要件18）。
        bracket.push({ round, left: queue[0], right: null, winner: queue[0], bye: true });
        nextRound.push(queue[0]);
        queue = [];
      }
      // ここで queue は空。次ラウンドの候補（nextRound）を確認する。
      const survivors = nextRound.length;
      if (survivors <= 1) {
        // 勝ち残りが 1 件（champion 確定）または 0 件（参加者無し）。
        champion = survivors === 1 ? nextRound[0] : null;
        currentPair = null;
        return;
      }
      // 次ラウンドへ移行: nextRound をキューへ、nextRound を空にし、ラウンド番号を進める。
      // この瞬間にのみ round を +1 することで、同一ラウンド内の対戦・不戦勝の round が揃う（要件18.2）。
      queue = nextRound;
      nextRound = [];
      round += 1;
    }
    // キューに 2 件以上ある: 先頭 2 件で対戦ペアを構成する。
    currentPair = { left: queue[0], right: queue[1] };
  }

  // 開始直後の初期ペアを準備する。
  // contestants が 1 件以下の場合はここで champion / null が確定する。
  prepareNextPair();

  return {
    get currentPair(): BattlePair | null {
      return currentPair;
    },
    get champion(): string | null {
      return champion;
    },
    get lastResult(): { winner: string; loser: string } | null {
      return lastResult;
    },
    get bracket(): TournamentBracket {
      // 内部配列のコピーを返し、外部からの改変を防ぐ（読み取り専用の勝ち上がり履歴、要件18）。
      return [...bracket];
    },
    advance(): void {
      // 提示中のペアが無い（champion 確定済み等）場合は何もしない。
      if (currentPair === null) {
        return;
      }
      const { left, right } = currentPair;
      // rng でちょうど 1 件を勝者に自動決定する（rng() < 0.5 で left、それ以外 right）。
      const leftWins = rng() < 0.5;
      const winner = leftWins ? left : right;
      const loser = leftWins ? right : left;
      lastResult = { winner, loser };
      // 確定した対戦を現ラウンド（round）の match として bracket へ記録する（Tournament_Bracket、要件18）。
      bracket.push({ round, left, right, winner, bye: false });
      // 勝者を次ラウンドへ進め、敗者は除外する（現ペアの 2 件をキュー先頭から取り除く）。
      nextRound.push(winner);
      queue = queue.slice(2);
      // 次に提示すべきペア（または次ラウンド / champion 確定）を準備する。
      prepareNextPair();
    },
  };
}
