/**
 * useRankingBattle — ランキング対戦の View-State（ViewModel 相当）
 *
 * RankingBattleView が用いる hook（design.md「Hooks / View-State」「フロー3」）。
 * {@link CharacterStore} から全 Character を取得し、勝ち抜きトーナメント
 * （{@link createTournament}）を用いて最も好きな 1 件を **自動判定・自動進行** で
 * 決める。勝敗は利用者が選ぶのではなく、rng（本番は `Math.random`）を注入した
 * {@link TournamentEngine} が各対戦でちょうど 1 件を勝者に自動決定する（要件4.2）。
 * 各対戦の勝敗が決まると {@link narrate}（{@link BattleCommentator}）で実況テキストを
 * 生成し、勝者・敗者の id とともに {@link currentCommentary} に反映する（要件4.3, 4.5）。
 *
 * 設計方針:
 * - ストアは引数（DI）で受け取り、テスト時に {@link InMemoryCharacterStore} 等へ差し替え可能。
 *   省略時は共有シングルトン {@link defaultCharacterStore}（IndexedDB）を用いる。
 * - rng も引数（DI）で受け取り、テストでは固定/シード rng を渡して決定的に検証できる。
 *   省略時は `Math.random`（実行のたびに勝者・実況が変動しうる。要件4.5）。
 * - `start()` は `fetchAll` で全 Character を取得し、2 件未満なら `canStart=false` のまま
 *   対戦を開始しない（要件4.8）。2 件以上なら `createTournament` を生成し、最初のペアを提示する。
 * - `advance()` は engine の `advance()` を呼んで現ペアの勝者を rng で自動判定し、
 *   `engine.lastResult`（勝者・敗者 id）を名前に解決して {@link narrate} で実況を生成し、
 *   `currentCommentary` に反映する。engine の champion 確定時は `champion` を Character として反映する。
 * - 進行状態は in-memory のみ（engine インスタンスと React state）で永続化しない。ページ再読み込み /
 *   再起動で hook が再マウントされれば初期状態に戻る（要件4.9）。`reset()` で明示的に初期化できる。
 *
 * 参照: design.md「Hooks / View-State / useRankingBattle」「フロー3」、
 *       要件4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9
 */
import { useCallback, useRef, useState } from 'react';
import type { BattleOutcome, BattlePair, Character } from '../domain/types';
import {
  createTournament,
  type Rng,
  type TournamentEngine,
} from '../domain/TournamentEngine';
import { narrate } from '../domain/BattleCommentator';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';

/**
 * {@link useRankingBattle} の戻り値。
 */
export interface UseRankingBattleResult {
  /** 現在提示中の対戦ペア（Character の id の組）。未開始・champion 確定後は `null`。要件4.1 */
  currentPair: BattlePair | null;
  /**
   * 現在提示中の対戦ペアの Character（写真・名前の表示用）。未開始・champion 確定後は `null`。
   *
   * `currentPair` は id のみを保持するため、RankingBattleView がペアの 2 キャラの写真・名前を
   * 表示するには id→Character の解決が必要になる。本 hook は既に `charactersByIdRef` に
   * id→Character 索引を保持している（start 時に構築）ため、その索引で `currentPair` の
   * left/right を解決した Character を最小限に公開する。design.md「Hooks / View-State /
   * useRankingBattle」の定義（currentPair は id）を壊さず、表示用の派生値として追加する。要件4.1
   */
  currentPairCharacters: { left: Character; right: Character } | null;
  /** 直近の対戦の実況 + 勝敗結果（勝者・敗者は id、`commentary` は実況文）。未対戦時は `null`。要件4.2, 4.3 */
  currentCommentary: BattleOutcome | null;
  /** 勝ち残り 1 件確定時の champion（Character）。未確定時は `null`。要件4.7 */
  champion: Character | null;
  /** 対戦を開始できるか（Character が 2 件以上か）。要件4.8 */
  canStart: boolean;
  /** 対戦を開始し、最初のペアを提示する。2 件未満なら開始しない（要件4.8）。要件4.1 */
  start: () => Promise<void>;
  /** 次の対戦へ進める。呼ぶたびに現ペアの勝者を rng で自動判定し実況を生成する。要件4.2〜4.4 */
  advance: () => void;
  /** 進行状態を初期化する（非永続。要件4.9）。 */
  reset: () => void;
}

/**
 * Character の表示名を解決する（実況への差し込み用）。
 *
 * 名前が空の場合はニックネーム、それも空なら代替表示（「名無しさん」）を用いる。
 * id に対応する Character が見つからない場合も代替表示にフォールバックする。
 *
 * @param id 解決対象の Character id
 * @param byId id → Character の索引
 * @returns 実況に差し込む表示名（非空）
 */
function resolveDisplayName(
  id: string,
  byId: Map<string, Character>,
): string {
  const character = byId.get(id);
  if (character == null) {
    return '名無しさん';
  }
  const name = character.name.trim();
  if (name.length > 0) {
    return name;
  }
  const nickname = character.nickname.trim();
  if (nickname.length > 0) {
    return nickname;
  }
  return '名無しさん';
}

/**
 * ランキング対戦の開始・進行・初期化を提供する hook。
 *
 * @param store 永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @param rng [0,1) の一様乱数生成器（DI）。省略時は `Math.random`。テストでは固定/シード rng を渡す。
 * @returns 対戦ペア・実況・champion・開始可否・開始/進行/初期化関数。
 */
export function useRankingBattle(
  store: CharacterStore = defaultCharacterStore,
  rng: Rng = Math.random,
): UseRankingBattleResult {
  const [currentPair, setCurrentPair] = useState<BattlePair | null>(null);
  const [currentPairCharacters, setCurrentPairCharacters] = useState<{
    left: Character;
    right: Character;
  } | null>(null);
  const [currentCommentary, setCurrentCommentary] =
    useState<BattleOutcome | null>(null);
  const [champion, setChampion] = useState<Character | null>(null);
  const [canStart, setCanStart] = useState<boolean>(false);

  // 進行状態は in-memory のみで永続化しない（要件4.9）。
  // engine と id→Character 索引は再描画をまたいで保持するため ref に置く。
  const engineRef = useRef<TournamentEngine | null>(null);
  const charactersByIdRef = useRef<Map<string, Character>>(new Map());

  /**
   * 現在の engine 状態（currentPair / champion）を React state へ反映する。
   * champion 確定時は id を Character に解決して反映する（要件4.7）。
   */
  const syncFromEngine = useCallback((engine: TournamentEngine): void => {
    const pair = engine.currentPair;
    setCurrentPair(pair);
    // currentPair の id を Character に解決して表示用の派生値を反映する（要件4.1）。
    // 両者が索引から解決できた場合のみ組を提示し、いずれか欠ける場合は null にする。
    if (pair == null) {
      setCurrentPairCharacters(null);
    } else {
      const left = charactersByIdRef.current.get(pair.left);
      const right = charactersByIdRef.current.get(pair.right);
      setCurrentPairCharacters(
        left != null && right != null ? { left, right } : null,
      );
    }
    const championId = engine.champion;
    if (championId == null) {
      setChampion(null);
    } else {
      setChampion(charactersByIdRef.current.get(championId) ?? null);
    }
  }, []);

  /**
   * 対戦を開始する。全 Character を取得し、2 件未満なら開始しない（要件4.8）。
   * 2 件以上なら {@link createTournament} を生成し、最初のペアを提示する（要件4.1）。
   */
  const start = useCallback(async (): Promise<void> => {
    let characters: Character[];
    try {
      characters = await store.fetchAll();
    } catch {
      // 読み込み失敗時は開始せず、開始不可のまま初期状態に戻す。
      engineRef.current = null;
      charactersByIdRef.current = new Map();
      setCurrentPair(null);
      setCurrentPairCharacters(null);
      setCurrentCommentary(null);
      setChampion(null);
      setCanStart(false);
      return;
    }

    // 2 件未満は開始せずメッセージ表示（呼び出し側は canStart=false で判断）。要件4.8
    if (characters.length < 2) {
      engineRef.current = null;
      charactersByIdRef.current = new Map();
      setCurrentPair(null);
      setCurrentPairCharacters(null);
      setCurrentCommentary(null);
      setChampion(null);
      setCanStart(false);
      return;
    }

    // id → Character 索引を構築（実況の名前解決・champion 解決に用いる）。
    const byId = new Map<string, Character>();
    for (const character of characters) {
      byId.set(character.id, character);
    }
    charactersByIdRef.current = byId;

    // rng を注入してトーナメントを生成し、最初のペアを提示する（要件4.1）。
    const engine = createTournament(
      characters.map((c) => c.id),
      rng,
    );
    engineRef.current = engine;
    setCanStart(true);
    setCurrentCommentary(null);
    syncFromEngine(engine);
  }, [store, rng, syncFromEngine]);

  /**
   * 次の対戦へ進める。engine の `advance()` で現ペアの勝者を rng で自動判定し
   * （要件4.2）、`lastResult`（勝者・敗者 id）を名前へ解決して {@link narrate} で実況を
   * 生成し、`currentCommentary` に反映する（要件4.3）。勝者は次ラウンドへ進み、
   * 次のペア or champion が確定する（要件4.4, 4.7）。
   */
  const advance = useCallback((): void => {
    const engine = engineRef.current;
    if (engine == null || engine.currentPair === null) {
      // 未開始 or 既に champion 確定済みなど、進行できない場合は何もしない。
      return;
    }

    engine.advance();
    const result = engine.lastResult;
    if (result != null) {
      // 勝者・敗者 id を表示名へ解決して実況を生成する（要件4.3）。
      const winnerName = resolveDisplayName(
        result.winner,
        charactersByIdRef.current,
      );
      const loserName = resolveDisplayName(
        result.loser,
        charactersByIdRef.current,
      );
      const commentary = narrate({ winner: winnerName, loser: loserName }, rng);
      // BattleOutcome の winner/loser は id を保持する（design.md の定義に従う）。
      setCurrentCommentary({
        winner: result.winner,
        loser: result.loser,
        commentary,
      });
    }

    // engine の現在状態（次ペア / champion）を反映する（要件4.4, 4.7）。
    syncFromEngine(engine);
  }, [rng, syncFromEngine]);

  /**
   * 進行状態を初期化する（非永続。要件4.9）。engine と索引を破棄し、
   * 表示状態を初期値へ戻す。
   */
  const reset = useCallback((): void => {
    engineRef.current = null;
    charactersByIdRef.current = new Map();
    setCurrentPair(null);
    setCurrentPairCharacters(null);
    setCurrentCommentary(null);
    setChampion(null);
    setCanStart(false);
  }, []);

  return {
    currentPair,
    currentPairCharacters,
    currentCommentary,
    champion,
    canStart,
    start,
    advance,
    reset,
  };
}
