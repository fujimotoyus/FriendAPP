/**
 * BattleCommentator — ランキング対戦の実況テキスト生成（純粋 TypeScript ドメインモジュール）
 *
 * ランキング対戦（勝ち抜きトーナメント）の各対戦で勝敗が決まると、その様子を
 * 「それっぽい実況テキスト（Battle_Commentary）」として生成する（要件4.3）。
 * 複数の実況テンプレートを持ち、注入された乱数生成器 `rng` でテンプレートを 1 つ
 * 選び、勝者・敗者の名前を差し込んだ文字列を返す。テンプレートが複数あるため、
 * **同一の対戦結果でも rng の値が変われば異なる実況文面が生成されうる**（実行の
 * たびにランダムに変わる、要件4.5）。
 *
 * 本モジュールは React / DOM / IndexedDB に一切依存しない純粋関数で構成する。
 * 乱数生成器（rng: () => number, [0,1) の一様乱数）を外部注入することで副作用を
 * 持たず、固定/シード rng を渡せば決定的に出力を検証できる（property-based testing
 * 対応、Correctness Property 14）。本番は `Math.random` を注入する。
 *
 * 差し込む `winner` / `loser` は表示用の名前文字列である（id → 名前解決は呼び出し側
 * ＝ useRankingBattle の責務）。design.md では `pair: { winner, loser }` を受け取る形で
 * 定義されており、それに従う。
 *
 * イテレーション10（要件19）では、対戦の**状況区分 Battle_Situation**（`'favored'`＝順当／
 * `'upset'`＝番狂わせ／`'even'`＝互角）を受け取って状況別のテンプレート集から選べるよう
 * `narrate` を拡張した。状況は勝者・敗者の Favorite_Level の比較から呼び出し側が
 * {@link deriveBattleSituation} で導出して渡す。`situation` 省略時は従来相当の汎用テンプレート
 * を用いる（**後方互換**：既存呼び出し `narrate(pair, rng)` は不変）。状況区分は実況の出し分け
 * にのみ用い、勝敗の自動判定（要件4.2 の rng 50/50）には一切影響しない（要件19.4）。
 *
 * 参照: design.md「Components and Interfaces / BattleCommentator」「Algorithms /
 * 対戦実況（Battle_Commentary）の生成」「イテレーション10」、要件4.3, 4.5, 19、
 * Correctness Property 14, 25
 */

import type { BattleSituation } from './types';

/**
 * 実況テンプレートの引数（差し込む名前）。
 *
 * design.md の `narrate(pair: { winner: string; loser: string }, ...)` に対応する。
 * ここでの `winner` / `loser` は id ではなく表示用の名前文字列である。
 */
export interface BattleNames {
  /** 勝者の表示名 */
  winner: string;
  /** 敗者の表示名 */
  loser: string;
}

/**
 * 実況テンプレート集。
 *
 * 各テンプレートは勝者名 `w` と敗者名 `l` を受け取り、実況文字列を返す純粋関数。
 * バリエーションを持たせるため複数（5 個以上）を用意する。すべてのテンプレートは
 * 勝者名 `w` を必ず含み、非空文字列を返す（Correctness Property 14 の不変条件）。
 *
 * テンプレートを関数として持つことで、名前の差し込み位置や語順を柔軟にできる。
 */
const TEMPLATES: ReadonlyArray<(w: string, l: string) => string> = [
  (w, l) => `${w} が ${l} を圧倒！ 完全勝利だ！`,
  (w, l) => `接戦の末、${w} が ${l} を下した！`,
  (w, l) => `${w} の勝ち！ ${l} は惜しくも敗退…`,
  (w, l) => `激闘を制したのは ${w}！ ${l} もよく頑張った！`,
  (w, l) => `${w} が ${l} に競り勝った！ さすがの実力！`,
  (w, l) => `勝者は ${w}！ ${l} との一戦に決着がついた！`,
  (w, l) => `${w}、${l} を退けて次のステージへ！`,
];

/**
 * 状況別（Battle_Situation）の実況テンプレート集（要件19.2, 19.3）。
 *
 * - `favored`（順当）: 実力どおりの勝利を強調する文面。
 * - `upset`  （番狂わせ）: 下馬評を覆した意外な勝利を強調する文面。
 * - `even`   （互角）: 実力伯仲・紙一重の接戦を強調する文面。
 *
 * 各状況につき複数（最低 4 個）を用意し、すべて勝者名 `w` を必ず含み非空を返す
 * （Correctness Property 25 の不変条件）。`situation` が渡されたときに当該集合から
 * rng で 1 つ選ぶ。
 */
const SITUATION_TEMPLATES: Readonly<
  Record<BattleSituation, ReadonlyArray<(w: string, l: string) => string>>
> = {
  favored: [
    (w, l) => `順当だ！ ${w} が実力どおり ${l} を下した！`,
    (w, l) => `格の違いを見せつけた！ ${w} が ${l} を危なげなく撃破！`,
    (w, l) => `本命 ${w} が期待に応える！ ${l} は一歩及ばず…`,
    (w, l) => `王道の勝利！ ${w} が ${l} を退けて盤石の勝ち上がり！`,
    (w, l) => `${w} が実力を証明！ ${l} も善戦したが順当な結果に！`,
  ],
  upset: [
    (w, l) => `番狂わせだ！ ${w} が下馬評を覆して ${l} を撃破！`,
    (w, l) => `まさかの展開！ ${w} が格上の ${l} を打ち破った！`,
    (w, l) => `大金星！ ${w} が ${l} を相手に大健闘の勝利！`,
    (w, l) => `会場がどよめく！ ${w} が ${l} をまさかの下克上！`,
    (w, l) => `伏兵 ${w} が主役に！ ${l} は思わぬ落とし穴に沈む！`,
  ],
  even: [
    (w, l) => `大接戦！ 互角の戦いを ${w} が ${l} から制した！`,
    (w, l) => `紙一重だった！ ${w} が ${l} との死闘をものにした！`,
    (w, l) => `甲乙つけがたい一戦、最後に笑ったのは ${w}！ ${l} も見事！`,
    (w, l) => `五分五分の勝負を ${w} が辛くも制す！ ${l} も譲らなかった！`,
    (w, l) => `どちらが勝ってもおかしくない！ ${w} が ${l} を振り切った！`,
  ],
};

/**
 * [0,1) を想定した rng からテンプレート配列のインデックスを安全に導出する。
 *
 * 範囲外・NaN・非有限が渡されても 0..length-1 に収まるようクランプする
 * （既存 {@link narrate} の実装と同一のロジックを共有し挙動を揃える）。
 */
function indexFromRng(rng: () => number, length: number): number {
  const raw = rng();
  const normalized = Number.isFinite(raw) ? raw : 0;
  const fraction = normalized - Math.floor(normalized); // [0,1) に正規化（負値・>=1 でも安全）
  let index = Math.floor(fraction * length);
  if (index < 0) {
    index = 0;
  } else if (index >= length) {
    index = length - 1;
  }
  return index;
}

/**
 * 対戦実況テキストを生成する。
 *
 * アルゴリズム（design.md「対戦実況（Battle_Commentary）の生成」）:
 * 1. 複数の実況テンプレート集から、`rng` を用いて 1 つを選ぶ。
 * 2. 選んだテンプレートに勝者・敗者の名前を差し込み、実況文字列を返す。
 * 3. テンプレートが複数あるため、同一の対戦結果でも rng の値が変われば異なる文面に
 *    なりうる（要件4.5）。
 *
 * `rng` は [0,1) の一様乱数を返す関数を想定するが、範囲外の値が渡されても安全に
 * インデックスが範囲内へ収まるようクランプする（`Math.floor` 後に 0..length-1 へ丸め）。
 * 純粋関数であり、`rng` 以外に副作用を持たない。
 *
 * `situation`（Battle_Situation、要件19）が渡された場合は、当該状況（favored/upset/even）の
 * 実況テンプレート集から rng で 1 つを選ぶ。省略時は従来相当の汎用テンプレート（{@link TEMPLATES}）
 * を用いる（**後方互換**：既存呼び出し `narrate(pair, rng)` は挙動不変）。いずれの場合も勝者名を
 * 必ず含む非空文字列を返す（要件19.2, 19.3、Correctness Property 14, 25）。
 *
 * @param pair 勝者・敗者の表示名（{@link BattleNames}）
 * @param rng [0,1) の一様乱数を返す関数（本番は `Math.random`、テストは固定/シード rng）
 * @param situation 対戦の状況区分（省略時は汎用テンプレートを使用＝後方互換）
 * @returns 勝者名を必ず含む非空の実況文字列
 */
export function narrate(
  pair: BattleNames,
  rng: () => number,
  situation?: BattleSituation,
): string {
  const { winner, loser } = pair;

  // 状況が指定されていれば状況別テンプレート、省略時は従来相当の汎用テンプレートを使う。
  const templates = situation ? SITUATION_TEMPLATES[situation] : TEMPLATES;
  // rng からテンプレート番号を導出する。範囲外・NaN でも安全に 0..length-1 へ収める。
  const index = indexFromRng(rng, templates.length);

  return templates[index](winner, loser);
}

/**
 * 勝者・敗者の Favorite_Level から対戦の状況区分（{@link BattleSituation}）を導出する（要件19.1, 19.5）。
 *
 * - `winnerFavoriteLevel > loserFavoriteLevel` → `'favored'`（順当勝ち）
 * - `winnerFavoriteLevel < loserFavoriteLevel` → `'upset'`（番狂わせ）
 * - 両者が同値、またはいずれかが比較不能（NaN/非有限）→ `'even'`（互角）
 *
 * Battle_Commentary の出し分けにのみ用いる純粋関数であり、勝敗の自動判定（要件4.2）や
 * 各 Character の勝率には一切影響しない（要件19.4）。副作用を持たない。
 *
 * @param winnerFavoriteLevel 勝者の Favorite_Level
 * @param loserFavoriteLevel 敗者の Favorite_Level
 * @returns 対戦の状況区分
 */
export function deriveBattleSituation(
  winnerFavoriteLevel: number,
  loserFavoriteLevel: number,
): BattleSituation {
  // どちらかが比較不能（NaN/非有限）なら互角として扱う（要件19.5）。
  if (!Number.isFinite(winnerFavoriteLevel) || !Number.isFinite(loserFavoriteLevel)) {
    return 'even';
  }
  if (winnerFavoriteLevel > loserFavoriteLevel) {
    return 'favored';
  }
  if (winnerFavoriteLevel < loserFavoriteLevel) {
    return 'upset';
  }
  return 'even';
}

/**
 * 利用可能な実況テンプレートの総数。
 *
 * テンプレートが複数存在する（rng により文面が変動しうる）ことを外部から確認する
 * 用途に用いる（要件4.5、Correctness Property 14）。
 */
export const TEMPLATE_COUNT = TEMPLATES.length;

/**
 * 状況別（Battle_Situation）テンプレートの各件数（要件19.2, 19.3、Correctness Property 25）。
 *
 * 各状況にテンプレートが複数存在する（rng により文面が変動しうる）ことを外部から確認する
 * 用途に用いる。
 */
export const SITUATION_TEMPLATE_COUNTS: Readonly<Record<BattleSituation, number>> = {
  favored: SITUATION_TEMPLATES.favored.length,
  upset: SITUATION_TEMPLATES.upset.length,
  even: SITUATION_TEMPLATES.even.length,
};
