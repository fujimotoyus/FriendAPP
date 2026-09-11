/**
 * battleTheme — ランキング対戦のお題（Battle_Theme）選択（純粋 TypeScript ドメインモジュール）
 *
 * ランキング対戦（Ranking_Battle）を開始するたびに、短いお題（例「かわいい選手権」
 * 「たよれる度No.1決定戦」等）を 1 つランダムに選んで対戦画面に表示する（要件21）。
 * 複数のお題テンプレートを持ち、注入された乱数生成器 `rng` で 1 つを選ぶため、
 * **開始のたびにお題が変わりうる**（決定的な固定はしない、要件21.1, 21.2）。
 *
 * 本モジュールは React / DOM / IndexedDB に一切依存しない純粋関数で構成する。乱数生成器
 * （rng: () => number, [0,1) の一様乱数）を外部注入することで副作用を持たず、固定/シード
 * rng を渡せば決定的に出力を検証できる（property-based testing 対応、Correctness Property 27）。
 * 本番は `Math.random` を注入する。お題は端末内で選び、いかなる外部サーバーへも送信しない
 * （要件21.3, 3.8）。
 *
 * 参照: design.md「イテレーション10 / 対戦のお題（Battle_Theme）」、要件21.1, 21.2, 21.3、
 * Correctness Property 27
 */

/**
 * お題テンプレート集（Battle_Theme、要件21）。
 *
 * 大人かわいいテーマに合う短い文言を複数（8 個）用意する。すべて非空文字列。
 * `pickBattleTheme` が rng でこの配列から 1 つを選んで返す。
 */
const BATTLE_THEMES: ReadonlyArray<string> = [
  'かわいい選手権',
  'たよれる度No.1決定戦',
  '今いちばん会いたい子は？',
  'キュンとくるのは誰だ！？',
  '癒やしオーラ王者決定戦',
  'いっしょにいたい子グランプリ',
  'ときめきトーナメント',
  '推し度ナンバーワン決定戦',
];

/**
 * 対戦のお題（Battle_Theme）を 1 つ選んで返す（要件21.1, 21.2）。
 *
 * `rng` を用いてお題テンプレート集から 1 つを選ぶ純粋関数。常に非空文字列（お題配列の
 * 要素）を返す。テンプレートが複数あるため、rng の値が変われば異なるお題が生じうる
 * （毎回ランダム、要件21.2）。`Math.random()` は使わず rng を外部注入する（要件21.3）。
 *
 * `rng` は [0,1) の一様乱数を想定するが、範囲外・NaN・非有限が渡されてもインデックスが
 * 範囲内へ収まるよう安全にクランプする（BattleCommentator と同様の正規化）。副作用なし。
 *
 * @param rng [0,1) の一様乱数を返す関数（本番は `Math.random`、テストは固定/シード rng）
 * @returns お題配列の要素（非空文字列）
 */
export function pickBattleTheme(rng: () => number): string {
  const raw = rng();
  const normalized = Number.isFinite(raw) ? raw : 0;
  const fraction = normalized - Math.floor(normalized); // [0,1) に正規化（負値・>=1 でも安全）
  let index = Math.floor(fraction * BATTLE_THEMES.length);
  if (index < 0) {
    index = 0;
  } else if (index >= BATTLE_THEMES.length) {
    index = BATTLE_THEMES.length - 1;
  }
  return BATTLE_THEMES[index];
}

/**
 * 利用可能なお題テンプレートの総数（要件21.2、Correctness Property 27）。
 *
 * お題が複数存在する（rng により変動しうる）ことを外部から確認する用途に用いる。
 */
export const BATTLE_THEME_COUNT = BATTLE_THEMES.length;

/**
 * お題ラベル → 観点ワード（Theme_Aspect）の対応表（要件19.6, 21）。
 *
 * 各お題ラベルに、実況へ織り込むための短い観点ワードを対応づける。`getBattleThemeAspect`
 * がこの表を引き、対応があればその観点ワードを返す。既存 8 お題すべてに定義する。
 */
const THEME_ASPECTS: Readonly<Record<string, string>> = {
  かわいい選手権: 'かわいさ',
  'たよれる度No.1決定戦': '頼れる度',
  '今いちばん会いたい子は？': '会いたい度',
  'キュンとくるのは誰だ！？': 'キュン度',
  癒やしオーラ王者決定戦: '癒やし度',
  いっしょにいたい子グランプリ: 'いっしょにいたい度',
  ときめきトーナメント: 'ときめき度',
  推し度ナンバーワン決定戦: '推し度',
};

/**
 * 対応が未定義のお題ラベルに対して返す汎用フォールバックの観点ワード（非空）。
 */
const DEFAULT_THEME_ASPECT = '魅力';

/**
 * お題（Battle_Theme）ラベルから観点ワード（Theme_Aspect）を導出する純粋関数（要件19.6, 21）。
 *
 * 既存 8 お題ラベルには対応表で定義した観点ワードを返し、対応が未定義の任意のラベル
 * （未知の文字列・空文字を含む）には汎用の非空フォールバック（`DEFAULT_THEME_ASPECT`）を
 * 返す。**常に非空文字列を返す**。副作用なし・外部送信なし。
 *
 * この観点ワードは `BattleCommentator.narrate` の `aspect` 引数へ渡され、お題に沿った
 * 実況文面（例「かわいさで {winner} が {loser} を圧倒！」）を生成するために使う。
 *
 * @param theme お題ラベル（`pickBattleTheme` の返り値など）
 * @returns 観点ワード（非空文字列）
 */
export function getBattleThemeAspect(theme: string): string {
  const aspect = THEME_ASPECTS[theme];
  return aspect && aspect.length > 0 ? aspect : DEFAULT_THEME_ASPECT;
}
