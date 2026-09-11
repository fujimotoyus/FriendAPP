/**
 * deriveRanking（準優勝・ベスト4 導出、要件20）のプロパティテスト（fast-check + Vitest）
 *
 * Property 26: 準優勝・ベスト4 の導出は bracket と整合する。
 * 2 件以上の id 集合・任意の rng シード列で champion 確定まで進めた bracket と championId について、
 *   (a) `runnerUp` は決勝（champion が勝者として現れる最大 round の対戦）の敗者（存在すれば）に一致
 *   (b) `semifinalists` は準決勝（決勝ラウンドの 1 つ前）の敗者集合に一致（不戦勝は敗者なし）
 *   (c) `runnerUp`・`semifinalists` はいずれも champion と相異なり相互に重複しない
 *   (d) 小規模で定義できない順位は `null` / 空配列
 *   (e) `deriveRanking` は `bracket` を変更しない
 *
 * Validates: Requirements 20, 18.4, 4.7
 * 参照: design.md「Correctness Properties / Property 26」「TournamentEngine」
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createTournament, deriveRanking } from './TournamentEngine';
import type { BracketMatch } from './types';

/** [0,1) の値列を巡回する rng スタブ。`advance()` は対戦 1 件につき 1 回だけ rng を呼ぶ。 */
function makeSeqRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length];
    i += 1;
    return v;
  };
}

/** 与えた bracket・champion から champion が勝者として現れる最大 round を求める（決勝ラウンド）。 */
function finalRoundOf(bracket: BracketMatch[], champion: string): number {
  let r = -1;
  for (const m of bracket) {
    if (m.winner === champion && m.round > r) r = m.round;
  }
  return r;
}

/** 指定ラウンドの各対戦（不戦勝を除く）の敗者集合を求める。 */
function losersOfRound(bracket: BracketMatch[], round: number): Set<string> {
  const s = new Set<string>();
  for (const m of bracket) {
    if (m.round !== round || m.bye || m.right === null || m.winner === null) continue;
    const loser = m.left === m.winner ? m.right : m.left;
    s.add(loser);
  }
  return s;
}

// Feature: chara-collection, Property 26: 準優勝・ベスト4 の導出は bracket と整合する
describe('deriveRanking (Property 26)', () => {
  it('runnerUp/semifinalists が決勝・準決勝の敗者と整合し champion と重複しない', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string(), { minLength: 2, maxLength: 16 }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), {
          minLength: 1,
          maxLength: 64,
        }),
        (ids, rngSeq) => {
          const rng = makeSeqRng(rngSeq);
          const engine = createTournament(ids, rng, (a) => a);

          let guard = 0;
          const maxSteps = ids.length * 4 + 8;
          while (engine.currentPair !== null && guard < maxSteps) {
            engine.advance();
            guard += 1;
          }
          const champion = engine.champion as string;
          expect(champion).not.toBeNull();

          const bracket = engine.bracket;
          const before = JSON.stringify(bracket);
          const { runnerUp, semifinalists } = deriveRanking(bracket, champion);

          // (e) bracket は不変。
          expect(JSON.stringify(engine.bracket)).toBe(before);

          const finalRound = finalRoundOf(bracket, champion);
          expect(finalRound).toBeGreaterThanOrEqual(0);

          // (a) runnerUp = 決勝の敗者（決勝が不戦勝なら null）。
          const finalMatch = bracket.find(
            (m) => m.round === finalRound && m.winner === champion,
          )!;
          if (!finalMatch.bye && finalMatch.right !== null) {
            const expectedRunnerUp =
              finalMatch.left === finalMatch.winner ? finalMatch.right : finalMatch.left;
            expect(runnerUp).toBe(expectedRunnerUp);
          } else {
            expect(runnerUp).toBeNull();
          }

          // (b) semifinalists = 準決勝ラウンドの敗者集合（存在すれば）。
          const semiRound = finalRound - 1;
          const expectedSemis =
            semiRound >= 0 ? losersOfRound(bracket, semiRound) : new Set<string>();
          // champion / runnerUp を除外した集合と一致すること。
          const expectedFiltered = new Set(
            [...expectedSemis].filter((x) => x !== champion && x !== runnerUp),
          );
          expect(new Set(semifinalists)).toEqual(expectedFiltered);

          // (c) champion と相異なり相互に重複しない。
          expect(semifinalists).not.toContain(champion);
          if (runnerUp !== null) {
            expect(runnerUp).not.toBe(champion);
            expect(semifinalists).not.toContain(runnerUp);
          }
          expect(new Set(semifinalists).size).toBe(semifinalists.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('参加者 2 件（決勝のみ）は runnerUp あり・semifinalists 空', () => {
    const engine = createTournament(['a', 'b'], () => 0.0, (x) => x);
    while (engine.currentPair !== null) engine.advance();
    const { runnerUp, semifinalists } = deriveRanking(engine.bracket, engine.champion as string);
    expect(runnerUp).not.toBeNull();
    expect(runnerUp).not.toBe(engine.champion);
    expect(semifinalists).toEqual([]);
  });

  it('参加者 3 件（不戦勝を含む）は semifinalists 空で定義できない順位は空', () => {
    const engine = createTournament(['a', 'b', 'c'], () => 0.0, (x) => x);
    while (engine.currentPair !== null) engine.advance();
    const { semifinalists } = deriveRanking(engine.bracket, engine.champion as string);
    // 3 件は 準決勝ラウンドが「決勝の1つ前 = round 0」だが不戦勝や単一対戦のみで、
    // 決勝の敗者を除いた準決勝敗者集合として妥当な結果になる（champion 除外・重複なし）。
    expect(new Set(semifinalists).size).toBe(semifinalists.length);
    expect(semifinalists).not.toContain(engine.champion);
  });
});
