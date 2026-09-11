/**
 * TournamentEngine の勝ち上がり履歴（Tournament_Bracket、要件18）のプロパティテスト
 * （fast-check + Vitest）
 *
 * Property 24: トーナメント表は勝ち上がりと整合する。
 * 2 件以上（偶数/奇数、不戦勝を含む）の id 集合と任意の rng シード列で champion 確定まで
 * `advance()` を繰り返した後、`bracket` が次を満たす:
 *   (a) 各 match の勝者妥当（bye===false は winner が left/right のいずれか、
 *       bye===true は right===null かつ winner===left）
 *   (b) あるラウンド（round=r）の勝者集合（不戦勝は left）が、次ラウンド（round=r+1）の
 *       対戦者集合（left/right の非 null id）と一致する
 *   (c) bracket の最終到達点（最後に確定した勝者）＝ champion
 *   (d) advance() 系列（各 advance 後の lastResult の勝者・敗者）と bracket の対戦記録が矛盾しない
 *
 * rng スタブは `advance()` 内で対戦のたびに 1 回ずつ呼ばれる前提。テスト内で同じ rng 系列を
 * 使って engine を回し、bracket と lastResult 系列を突き合わせる。
 *
 * Validates: Requirements 4.6, 4.7, 18
 * 参照: design.md「Correctness Properties / Property 24」「TournamentEngine」「Tournament_Bracket」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createTournament } from './TournamentEngine';
import type { BracketMatch } from './types';

/**
 * [0,1) の値列を巡回する rng スタブを作る。`advance()` は対戦 1 件につき 1 回だけ rng を呼ぶ。
 * 値が尽きたら先頭へ巡回する（有限系列でも終了性は rng 値に依存しないため問題ない）。
 */
function makeSeqRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

// あるラウンド r の match 群から「勝者集合」を求める（不戦勝は left が勝者）。
function winnersOfRound(bracket: BracketMatch[], r: number): Set<string> {
  const s = new Set<string>();
  for (const m of bracket) {
    if (m.round === r && m.winner !== null) s.add(m.winner);
  }
  return s;
}

// あるラウンド r の match 群から「対戦者集合」を求める（left と、非 null の right）。
function contestantsOfRound(bracket: BracketMatch[], r: number): Set<string> {
  const s = new Set<string>();
  for (const m of bracket) {
    if (m.round !== r) continue;
    s.add(m.left);
    if (m.right !== null) s.add(m.right);
  }
  return s;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Feature: chara-collection, Property 24: トーナメント表は勝ち上がりと整合する
describe('TournamentEngine bracket (Property 24)', () => {
  it('bracket が勝ち上がり・不戦勝・champion・lastResult と整合する', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string(), { minLength: 2, maxLength: 16 }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), {
          minLength: 1,
          maxLength: 64,
        }),
        (ids, rngSeq) => {
          const rng = makeSeqRng(rngSeq);
          // 初期並びは恒等（決定的検証のため）。id 集合はそのまま初期ラウンドの対戦者。
          const engine = createTournament(ids, rng, (a) => a);

          // advance 後の lastResult を系列として収集し、bracket と突き合わせる。
          const results: { winner: string; loser: string }[] = [];
          // 終了性: 勝ち残りは単調減少するため有限回で champion が確定する。上限は安全弁。
          let guard = 0;
          const maxSteps = ids.length * 4 + 8;
          while (engine.currentPair !== null && guard < maxSteps) {
            engine.advance();
            if (engine.lastResult !== null) {
              results.push(engine.lastResult);
            }
            guard += 1;
          }

          const bracket = engine.bracket;
          expect(engine.champion).not.toBeNull();
          expect(bracket.length).toBeGreaterThan(0);

          // getter はコピーを返し外部改変を防ぐ（内部状態不変）。
          const snapshot = engine.bracket;
          snapshot.push({ round: 999, left: 'x', right: null, winner: 'x', bye: true });
          expect(engine.bracket.length).toBe(bracket.length);

          // (a) 各 match の勝者妥当。
          for (const m of bracket) {
            if (m.bye) {
              expect(m.right).toBeNull();
              expect(m.winner).toBe(m.left);
            } else {
              expect(m.right).not.toBeNull();
              expect(m.winner === m.left || m.winner === m.right).toBe(true);
            }
          }

          // (b) 各ラウンド r の勝者集合＝次ラウンド r+1 の対戦者集合。
          const rounds = Array.from(new Set(bracket.map((m) => m.round))).sort(
            (x, y) => x - y,
          );
          // ラウンド番号は 0 から連続していること。
          rounds.forEach((r, idx) => expect(r).toBe(idx));
          for (let i = 0; i < rounds.length - 1; i++) {
            const r = rounds[i];
            const winners = winnersOfRound(bracket, r);
            const nextContestants = contestantsOfRound(bracket, r + 1);
            expect(setsEqual(winners, nextContestants)).toBe(true);
          }

          // (c) 最終ラウンドの勝者はちょうど 1 件で、それが champion。
          const lastRound = rounds[rounds.length - 1];
          const finalWinners = winnersOfRound(bracket, lastRound);
          expect(finalWinners.size).toBe(1);
          expect(finalWinners.has(engine.champion as string)).toBe(true);
          // bracket の最後に確定した match の勝者も champion に一致する。
          expect(bracket[bracket.length - 1].winner).toBe(engine.champion);

          // (d) 対戦（bye:false）の記録順と lastResult 系列が一致する（勝者・敗者ともに）。
          const battleMatches = bracket.filter((m) => !m.bye);
          expect(battleMatches.length).toBe(results.length);
          for (let i = 0; i < battleMatches.length; i++) {
            const m = battleMatches[i];
            const res = results[i];
            expect(m.winner).toBe(res.winner);
            const loser = m.left === res.winner ? m.right : m.left;
            expect(loser).toBe(res.loser);
            // lastResult の勝者・敗者は当該 match の対戦者（left/right）のいずれか。
            expect(res.winner === m.left || res.winner === m.right).toBe(true);
            expect(res.loser === m.left || res.loser === m.right).toBe(true);
          }

          // 参加者は全員 round 0 の対戦者集合に含まれる（過不足なし）。
          expect(setsEqual(contestantsOfRound(bracket, 0), new Set(ids))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
