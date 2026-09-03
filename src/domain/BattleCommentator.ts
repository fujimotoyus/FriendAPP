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
 * 参照: design.md「Components and Interfaces / BattleCommentator」「Algorithms /
 * 対戦実況（Battle_Commentary）の生成」、要件4.3, 4.5、Correctness Property 14
 */

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
 * @param pair 勝者・敗者の表示名（{@link BattleNames}）
 * @param rng [0,1) の一様乱数を返す関数（本番は `Math.random`、テストは固定/シード rng）
 * @returns 勝者名を必ず含む非空の実況文字列
 */
export function narrate(pair: BattleNames, rng: () => number): string {
  const { winner, loser } = pair;

  // rng からテンプレート番号を導出する。範囲外・NaN でも安全に 0..length-1 へ収める。
  const raw = rng();
  const normalized = Number.isFinite(raw) ? raw : 0;
  const fraction = normalized - Math.floor(normalized); // [0,1) に正規化（負値・>=1 でも安全）
  let index = Math.floor(fraction * TEMPLATES.length);
  if (index < 0) {
    index = 0;
  } else if (index >= TEMPLATES.length) {
    index = TEMPLATES.length - 1;
  }

  return TEMPLATES[index](winner, loser);
}

/**
 * 利用可能な実況テンプレートの総数。
 *
 * テンプレートが複数存在する（rng により文面が変動しうる）ことを外部から確認する
 * 用途に用いる（要件4.5、Correctness Property 14）。
 */
export const TEMPLATE_COUNT = TEMPLATES.length;
