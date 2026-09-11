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
 * - `advance()`【既存・保持】は engine の `advance()` を呼んで現ペアの勝者を rng で自動判定し、
 *   `engine.lastResult`（勝者・敗者 id）を名前に解決して {@link narrate} で実況を生成し、
 *   `currentCommentary` に反映する。engine の champion 確定時は `champion` を Character として反映する。
 * - 進行状態は in-memory のみ（engine インスタンスと React state）で永続化しない。ページ再読み込み /
 *   再起動で hook が再マウントされれば初期状態に戻る（要件4.9）。`reset()` で明示的に初期化できる。
 *
 * イテレーション9（対戦を魅せる、要件17, 18）の拡張（既存 start/advance/reset の互換に配慮した非破壊拡張）:
 * - 対戦フェーズ状態 {@link phase}（`'pair' | 'result' | 'champion'`）を持たせ、UI 進行を
 *   「勝負！」（{@link resolveCurrentBattle}）→「次へ」（{@link next}）の 2 段階に分ける（要件17.1〜17.5）。
 * - {@link resolveCurrentBattle} は内部で `engine.advance()` を呼び、現ペアの勝者を rng で自動判定・
 *   実況生成し `phase='result'` へ。`engine.advance()` は「次ペア準備」まで進めるため、result 中に
 *   勝者ハイライトの対象となる「今戦ったペア」を退避して {@link currentPairCharacters} に保持する。
 * - {@link next} は `engine.champion` 確定なら `phase='champion'`、そうでなければ次ペアを提示し `phase='pair'`。
 * - 表示用に id を Character へ解決した {@link bracket}（`ResolvedBracketMatch[]`）を公開する（要件18.1〜18.3）。
 * - 既存の `advance()` は残す（後方互換）。UI 進行の 2 段階化は `resolveCurrentBattle` が
 *   `advance()` を内部で呼ぶ形で吸収する（要件4 は非破壊）。
 *
 * 参照: design.md「Hooks / View-State / useRankingBattle」「フロー3」、
 *       要件4.1〜4.9、17.1, 17.3, 17.4, 17.5、18.1, 18.2, 18.3
 */
import { useCallback, useRef, useState } from 'react';
import type {
  BattleOutcome,
  BattlePair,
  BracketMatch,
  Character,
  ResolvedBracketMatch,
} from '../domain/types';
import {
  createTournament,
  deriveRanking,
  type Rng,
  type TournamentEngine,
} from '../domain/TournamentEngine';
import { narrate, deriveBattleSituation } from '../domain/BattleCommentator';
import { pickBattleTheme, getBattleThemeAspect } from '../domain/battleTheme';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';

/** 対戦フェーズ。`'pair'`=ペア提示中 / `'result'`=結果発表中 / `'champion'`=優勝発表（要件17）。 */
export type BattlePhase = 'pair' | 'result' | 'champion';

/**
 * {@link useRankingBattle} の戻り値。
 */
export interface UseRankingBattleResult {
  /** 現在提示中の対戦ペア（Character の id の組）。未開始・champion 確定後は `null`。要件4.1 */
  currentPair: BattlePair | null;
  /**
   * 表示中の対戦ペアの Character（写真・名前の表示用）。
   *
   * - `phase==='pair'` のときは `currentPair` に対応する「これから戦うペア」を指す。
   * - `phase==='result'` のときは `resolveCurrentBattle` を呼ぶ直前の「今戦ったペア」を指す
   *   （`engine.advance()` 後に `engine.currentPair` は既に次ペアを指すため、UI が勝者を
   *   `currentCommentary.winner`（id）と照合して勝者ハイライトできるよう、戦ったペアを退避して保持する）。
   * - 未開始・champion 確定後は `null`。
   *
   * `currentPair` は id のみを保持するため、RankingBattleView がペアの 2 キャラの写真・名前を
   * 表示するには id→Character の解決が必要になる。本 hook は `charactersByIdRef`（start 時に構築）で
   * left/right を解決した Character を最小限に公開する。design.md の定義（currentPair は id）を壊さず、
   * 表示用の派生値として追加する。要件4.1, 17.1, 17.2
   */
  currentPairCharacters: { left: Character; right: Character } | null;
  /** 直近の対戦の実況 + 勝敗結果（勝者・敗者は id、`commentary` は実況文）。未対戦時は `null`。要件4.2, 4.3 */
  currentCommentary: BattleOutcome | null;
  /** 勝ち残り 1 件確定時の champion（Character）。未確定時は `null`。要件4.7 */
  champion: Character | null;
  /**
   * 準優勝の Character（champion 確定時に {@link deriveRanking} で導出、要件20.1, 20.2）。
   * champion 未確定時・準優勝が導出できない（決勝が不戦勝等）場合は `null`。
   * `start`/`reset` で `null` に初期化する。
   */
  runnerUp: Character | null;
  /**
   * ベスト4（準決勝敗退者）の Character 群（champion 確定時に {@link deriveRanking} で導出、要件20.3）。
   * 準決勝ラウンドが無い小規模トーナメントや champion 未確定時は空配列。
   * `start`/`reset` で空配列に初期化する。
   */
  semifinalists: Character[];
  /**
   * 今回の対戦のお題（Battle_Theme、要件21）。`start()` のたびに {@link pickBattleTheme} で
   * 選び直すため毎回変わりうる（要件21.1, 21.2）。未開始・`reset()` 後は空文字。
   */
  theme: string;
  /** 対戦を開始できるか（Character が 2 件以上か）。要件4.8 */
  canStart: boolean;
  /**
   * 対戦フェーズ（イテレーション9、要件17）。
   * - `'pair'`   : ペア提示中（初期・開始直後・「次へ」で次ペアへ進んだ後）。
   * - `'result'` : 結果発表中（`resolveCurrentBattle` 実行後、勝者ハイライト＋実況）。
   * - `'champion'`: 優勝発表（champion 確定後）。
   * 未開始・2 件未満ガード時も `'pair'` のままでよい（UI は canStart 等で分岐する）。要件17.1〜17.4
   */
  phase: BattlePhase;
  /**
   * 勝ち上がりを可視化する表示用 bracket（`engine.bracket` の各 id を Character へ解決）。要件18.1〜18.3。
   * `right`/`winner` が null の match はそのまま null。`start`/`resolveCurrentBattle`/`next`/`reset` の
   * たびに最新の `engine.bracket` を反映する。未開始・初期化後は空配列。
   */
  bracket: ResolvedBracketMatch[];
  /** 対戦を開始し、最初のペアを提示する。2 件未満なら開始しない（要件4.8）。要件4.1 */
  start: () => Promise<void>;
  /**
   * 「勝負！」現ペアの勝者を rng で自動判定し結果発表フェーズへ（内部で `engine.advance()` を呼ぶ）。
   * `phase==='pair'` かつ `currentPair!=null` のときのみ有効。実況を生成し `currentCommentary` に反映し、
   * 勝者ハイライト用に「今戦ったペア」を保持しつつ `phase='result'` にする（要件17.1, 17.2, 4.2, 4.3）。
   */
  resolveCurrentBattle: () => void;
  /**
   * 「次へ」結果発表から次へ進める。`phase==='result'` のときのみ有効。
   * `engine.champion` 確定なら `phase='champion'`、そうでなければ次ペアを提示し `phase='pair'` に戻す
   * （要件17.3, 17.4, 4.4, 4.7）。
   */
  next: () => void;
  /**
   * 【既存・保持】次の対戦へ進める。呼ぶたびに現ペアの勝者を rng で自動判定し実況を生成する（要件4.2〜4.4）。
   * イテレーション9では `resolveCurrentBattle` が内部でこの処理を用いるが、`advance()` 単体でも従来通り動く。
   */
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
 * engine の id ベース bracket（{@link BracketMatch}[]）を、id→Character 索引で解決して
 * 表示用の {@link ResolvedBracketMatch}[] にする（要件18.1〜18.3）。
 *
 * `right`/`winner` が null の match はそのまま null にする。`left` が索引で解決できない
 * （通常は起きない）match は表示できないためスキップする。
 *
 * @param bracket engine の id ベース bracket
 * @param byId id → Character の索引
 * @returns 表示用に解決した bracket
 */
function resolveBracket(
  bracket: readonly BracketMatch[],
  byId: Map<string, Character>,
): ResolvedBracketMatch[] {
  const resolved: ResolvedBracketMatch[] = [];
  for (const match of bracket) {
    const left = byId.get(match.left);
    if (left == null) {
      // left が解決できない match は表示不能のためスキップ（通常は全 id が索引にある）。
      continue;
    }
    const right = match.right == null ? null : byId.get(match.right) ?? null;
    const winner = match.winner == null ? null : byId.get(match.winner) ?? null;
    resolved.push({
      round: match.round,
      left,
      right,
      winner,
      bye: match.bye,
    });
  }
  return resolved;
}

/**
 * ランキング対戦の開始・進行・初期化を提供する hook。
 *
 * @param store 永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @param rng [0,1) の一様乱数生成器（DI）。省略時は `Math.random`。テストでは固定/シード rng を渡す。
 * @returns 対戦ペア・実況・champion・開始可否・フェーズ・bracket・開始/勝負/次へ/進行/初期化関数。
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
  const [runnerUp, setRunnerUp] = useState<Character | null>(null);
  const [semifinalists, setSemifinalists] = useState<Character[]>([]);
  const [theme, setTheme] = useState<string>('');
  const [canStart, setCanStart] = useState<boolean>(false);
  const [phase, setPhase] = useState<BattlePhase>('pair');
  const [bracket, setBracket] = useState<ResolvedBracketMatch[]>([]);

  // 進行状態は in-memory のみで永続化しない（要件4.9）。
  // engine と id→Character 索引は再描画をまたいで保持するため ref に置く。
  const engineRef = useRef<TournamentEngine | null>(null);
  const charactersByIdRef = useRef<Map<string, Character>>(new Map());

  /** engine の最新 bracket を Character へ解決して state に反映する（要件18.1〜18.3）。 */
  const syncBracket = useCallback((engine: TournamentEngine): void => {
    setBracket(resolveBracket(engine.bracket, charactersByIdRef.current));
  }, []);

  /**
   * `currentPair` の id を Character に解決して表示用の派生値を反映する（要件4.1）。
   * 両者が索引から解決できた場合のみ組を提示し、いずれか欠ける場合は null にする。
   */
  const applyPairCharacters = useCallback((pair: BattlePair | null): void => {
    if (pair == null) {
      setCurrentPairCharacters(null);
      return;
    }
    const left = charactersByIdRef.current.get(pair.left);
    const right = charactersByIdRef.current.get(pair.right);
    setCurrentPairCharacters(
      left != null && right != null ? { left, right } : null,
    );
  }, []);

  /**
   * 現在の engine 状態（currentPair / champion）を React state へ反映する。
   * champion 確定時は id を Character に解決して反映する（要件4.7）。
   * 表示中ペア（currentPairCharacters）も現在の currentPair に合わせて更新する。
   */
  const syncFromEngine = useCallback(
    (engine: TournamentEngine): void => {
      const pair = engine.currentPair;
      setCurrentPair(pair);
      applyPairCharacters(pair);
      const championId = engine.champion;
      if (championId == null) {
        setChampion(null);
        // champion 未確定時は準優勝・ベスト4 も無い。
        setRunnerUp(null);
        setSemifinalists([]);
      } else {
        setChampion(charactersByIdRef.current.get(championId) ?? null);
        // champion 確定時、bracket から準優勝・ベスト4 を導出して Character へ解決する（要件20）。
        const { runnerUp: runnerUpId, semifinalists: semifinalistIds } =
          deriveRanking(engine.bracket, championId);
        setRunnerUp(
          runnerUpId == null
            ? null
            : charactersByIdRef.current.get(runnerUpId) ?? null,
        );
        const resolvedSemifinalists: Character[] = [];
        for (const id of semifinalistIds) {
          const character = charactersByIdRef.current.get(id);
          if (character != null) {
            resolvedSemifinalists.push(character);
          }
        }
        setSemifinalists(resolvedSemifinalists);
      }
    },
    [applyPairCharacters],
  );

  /**
   * 対戦を開始する。全 Character を取得し、2 件未満なら開始しない（要件4.8）。
   * 2 件以上なら {@link createTournament} を生成し、最初のペアを提示する（要件4.1）。
   * フェーズを `'pair'` に、bracket を最新（開始直後は空 or Bye 繰上げ分）に初期化する。
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
      setRunnerUp(null);
      setSemifinalists([]);
      setTheme('');
      setCanStart(false);
      setPhase('pair');
      setBracket([]);
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
      setRunnerUp(null);
      setSemifinalists([]);
      setTheme('');
      setCanStart(false);
      setPhase('pair');
      setBracket([]);
      return;
    }

    // id → Character 索引を構築（実況の名前解決・champion 解決・bracket 解決に用いる）。
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
    // 開始のたびにお題を選び直す（毎回変わりうる。要件21.1, 21.2）。
    setTheme(pickBattleTheme(rng));
    // 準優勝・ベスト4 は champion 確定時に導出するため開始時は初期化する（要件20）。
    setRunnerUp(null);
    setSemifinalists([]);
    setPhase('pair');
    syncFromEngine(engine);
    syncBracket(engine);
  }, [store, rng, syncFromEngine, syncBracket]);

  /**
   * 現ペアの勝者を rng で自動判定し実況を生成する共通処理（要件4.2, 4.3）。
   * engine の `advance()` を呼び、`lastResult`（勝者・敗者 id）を名前へ解決して
   * {@link narrate} で実況を生成し `currentCommentary` に反映する。engine の現在状態
   * （次ペア / champion）と bracket も反映する。進行できない場合は `false` を返す。
   *
   * @param engine 進行中のトーナメントエンジン
   * @returns 対戦を確定して進めたら `true`、進行できなかったら `false`
   */
  const runBattle = useCallback(
    (engine: TournamentEngine): boolean => {
      if (engine.currentPair === null) {
        // 未開始 or 既に champion 確定済みなど、進行できない場合は何もしない。
        return false;
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
        // 勝者・敗者の Character を解決し、Favorite_Level から状況区分を導出して
        // 状況別実況を出し分ける（要件19.1, 19.2, 19.3）。解決できない稀なケースは
        // situation 省略（従来の汎用実況）にフォールバックする。勝敗判定には影響しない（要件19.4）。
        const winnerCharacter = charactersByIdRef.current.get(result.winner);
        const loserCharacter = charactersByIdRef.current.get(result.loser);
        const situation =
          winnerCharacter != null && loserCharacter != null
            ? deriveBattleSituation(
                winnerCharacter.favoriteLevel,
                loserCharacter.favoriteLevel,
              )
            : undefined;
        const commentary = narrate(
          { winner: winnerName, loser: loserName },
          rng,
          situation,
          getBattleThemeAspect(theme),
        );
        // BattleOutcome の winner/loser は id を保持する（design.md の定義に従う）。
        setCurrentCommentary({
          winner: result.winner,
          loser: result.loser,
          commentary,
        });
      }
      // engine の現在状態（次ペア / champion）と bracket を反映する（要件4.4, 4.7, 18.1）。
      syncFromEngine(engine);
      syncBracket(engine);
      return true;
    },
    [rng, theme, syncFromEngine, syncBracket],
  );

  /**
   * 【既存・保持】次の対戦へ進める（要件4.2〜4.4）。engine の `advance()` を呼んで
   * 現ペアの勝者を rng で自動判定し、実況を `currentCommentary` に反映する。
   * 後方互換のため単体で従来通り使える（フェーズは変更しない）。
   */
  const advance = useCallback((): void => {
    const engine = engineRef.current;
    if (engine == null) {
      return;
    }
    runBattle(engine);
  }, [runBattle]);

  /**
   * 「勝負！」現ペアの勝者を rng で自動判定し結果発表フェーズへ移す（要件17.1, 17.2, 4.2, 4.3）。
   *
   * `phase==='pair'` かつ現ペアがあるときのみ有効。`engine.advance()`（{@link runBattle} 経由）は
   * 「次ペア準備」まで進めてしまうため、勝者ハイライトの対象となる「今戦ったペア」を
   * 呼ぶ前に退避して {@link currentPairCharacters} に保持し、`phase='result'` にする。
   * result 中は `currentPairCharacters`（今戦ったペア）と `currentCommentary.winner`（勝者 id）で
   * UI が勝者側を強調表示できる。
   */
  const resolveCurrentBattle = useCallback((): void => {
    const engine = engineRef.current;
    if (engine == null || phase !== 'pair' || engine.currentPair === null) {
      return;
    }
    // 「今戦うペア」を退避（advance 後は engine.currentPair が次ペアを指すため）。
    const foughtPair = engine.currentPair;
    const advanced = runBattle(engine);
    if (!advanced) {
      return;
    }
    // 退避した「今戦ったペア」を result 表示用に上書き反映する（勝者ハイライト対象）。
    applyPairCharacters(foughtPair);
    // 提示中ペア（次に戦う id）は currentPair state として保持しつつ、表示は今戦ったペアに固定。
    setCurrentPair(foughtPair);
    setPhase('result');
  }, [phase, runBattle, applyPairCharacters]);

  /**
   * 「次へ」結果発表から次へ進める（要件17.3, 17.4, 4.4, 4.7）。
   *
   * `phase==='result'` のときのみ有効。`engine.champion` が確定していれば `champion` を
   * 反映して `phase='champion'` にする。そうでなければ engine の次ペア（既に次を指している）を
   * `currentPair`/`currentPairCharacters` に反映し `phase='pair'` に戻す。
   */
  const next = useCallback((): void => {
    const engine = engineRef.current;
    if (engine == null || phase !== 'result') {
      return;
    }
    const championId = engine.champion;
    if (championId != null) {
      setChampion(charactersByIdRef.current.get(championId) ?? null);
      setCurrentPair(null);
      setCurrentPairCharacters(null);
      setPhase('champion');
      return;
    }
    // 次ペア（engine.currentPair は既に次を指す）を提示して pair フェーズへ戻す。
    const pair = engine.currentPair;
    setCurrentPair(pair);
    applyPairCharacters(pair);
    setPhase('pair');
  }, [phase, applyPairCharacters]);

  /**
   * 進行状態を初期化する（非永続。要件4.9）。engine と索引を破棄し、
   * 表示状態を初期値へ戻す。フェーズは `'pair'`、bracket は空に初期化する。
   */
  const reset = useCallback((): void => {
    engineRef.current = null;
    charactersByIdRef.current = new Map();
    setCurrentPair(null);
    setCurrentPairCharacters(null);
    setCurrentCommentary(null);
    setChampion(null);
    setRunnerUp(null);
    setSemifinalists([]);
    setTheme('');
    setCanStart(false);
    setPhase('pair');
    setBracket([]);
  }, []);

  return {
    currentPair,
    currentPairCharacters,
    currentCommentary,
    champion,
    runnerUp,
    semifinalists,
    theme,
    canStart,
    phase,
    bracket,
    start,
    resolveCurrentBattle,
    next,
    advance,
    reset,
  };
}
