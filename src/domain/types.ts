/**
 * ドメインの型定義（Character と補助値型）
 *
 * 本モジュールは React / IndexedDB / File API に依存しない純粋な TypeScript の
 * 型定義のみを提供する（design.md「Data Models」参照）。ドメインロジック
 * （バリデーション・決定的選出・トーナメント・写真処理）や永続化層は、これらの
 * 型を共有して実装される。
 */

/**
 * 写真データ（バイト列 + MIME）。
 *
 * 写真は `Blob` ではなく ArrayBuffer（バイト列）+ MIME 文字列として保持・保存する。
 * IndexedDB に `Blob` / `File` を直接保存すると iOS WebKit の既知バグで
 * `UnknownError: Error preparing Blob/File data to be stored in object store`
 * が発生し保存に失敗する（一覧で写真が表示できない）ため、これを回避する。
 * 表示時は `new Blob([data], { type })` で都度 Blob を生成して Object URL 化する。
 *
 * 参照: design.md「写真ストレージ戦略」、要件1.8, 3.3
 */
export interface PhotoData {
  /** 画像のバイト列。IndexedDB には ArrayBuffer のまま構造化複製で保存される。 */
  data: ArrayBuffer;
  /** 画像の MIME タイプ（例: 'image/jpeg'）。表示時の Blob 生成に用いる。 */
  type: string;
}

/**
 * イメージカラーのプリセット列挙（要件15）。
 *
 * `'none'` は縁取りなし（既定値）。5 色は大人かわいいテーマ（Adult_Cute_Theme）の
 * トークン由来のパステルで、各色は `tokens.css` の `--image-color-{color}`
 * （例 `--image-color-rose`）に対応する。`CharacterCard` の枠・`CharacterDetailView`
 * の写真枠の縁取りへ `deriveImageColorStyle` を介してトークン経由で反映する。
 *
 * 参照: design.md「Data Models」「イメージカラートークン」、要件15.1, 15.4, 15.7〜15.9
 */
export type ImageColor = 'none' | 'rose' | 'mint' | 'lavender' | 'butter' | 'sky';

/**
 * 登録された 1 件のお気に入りキャラクター（ドメインの中心エンティティ）。
 * IndexedDB の `characters` オブジェクトストアに `keyPath: 'id'` で永続化される。
 *
 * 参照: design.md「Data Models / Character 型」、要件1.4, 1.5, 1.6, 1.7, 1.8, 2.1
 */
export interface Character {
  /** UUID（`crypto.randomUUID()`）。各 Character の一意な同定に用いる。決定的選出・トーナメントのキー。 */
  id: string;
  /** 名前。0〜50 文字・任意（未入力可）。要件1.4, 1.9 */
  name: string;
  /** ニックネーム。0〜50 文字。空文字は「未登録」として扱う。要件1.5, 2.6 */
  nickname: string;
  /** メモ。0〜500 文字。要件1.6, 2.8 */
  memo: string;
  /** お気に入り度。1〜5 の整数。範囲外・非整数は保存拒否。要件1.7, 8.1 */
  favoriteLevel: number;
  /** 写真（必須）。ArrayBuffer(バイト列)+MIME として IndexedDB に格納する。要件1.8, 3.3 */
  photo: PhotoData;
  /** 登録日時（epoch ミリ秒）。一覧の並び順（新しい順）・暦日固定選出の安定キー。要件2.1, 5.2 */
  createdAt: number;
  /**
   * 出会った日（任意）。ISO 8601 の `YYYY-MM-DD`。未設定は `undefined`。
   * 詳細画面でのみ表示し、一覧・ガチャ・対戦には出さない。旧データ（未設定）は
   * `IndexedDbCharacterStore.fetchAll` の読み出し時に `undefined` へ正規化する。
   * 要件14.1, 14.5〜14.8, 14.11
   */
  metOn?: string;
  /**
   * イメージカラー（プリセット列挙）。既定は `'none'`（縁取りなし）。
   * 旧データ（未設定/不正値）は読み出し時に `'none'` へ正規化する。要件15.1, 15.5
   */
  imageColor: ImageColor;
}

/**
 * 登録 / 編集フォームの入力保持用の値型（永続化しない）。
 * 保存失敗・写真取得キャンセル/ブロック・不正画像時にも入力内容を破棄しないために用いる。
 *
 * 参照: design.md「補助的な値型」、要件1.3, 1.11, 1.12, 8.3〜8.5
 */
export interface CharacterDraft {
  /** 名前（0〜50 文字・任意）。要件1.4, 1.9 */
  name: string;
  /** ニックネーム（0〜50 文字）。要件1.5 */
  nickname: string;
  /** メモ（0〜500 文字）。要件1.6 */
  memo: string;
  /** お気に入り度（整数 1〜5）。要件1.7, 8.1 */
  favoriteLevel: number;
  /** 写真。ArrayBuffer(バイト列)+MIME。未取得は null（写真は登録時に必須）。要件1.3, 1.8 */
  photo: PhotoData | null;
  /**
   * 出会った日の入力（`<input type="date">` の値 `YYYY-MM-DD`）。空/未入力は `undefined`。
   * 要件14.1
   */
  metOn?: string;
  /** イメージカラーの選択。既定は `'none'`。要件15.1 */
  imageColor: ImageColor;
  /** 未指定なら新規登録、値ありなら当該 id の Character を編集。要件6.1 */
  editingId?: string;
}

/**
 * 端末ローカルの暦日。今日の一枚ガチャの決定的選出キーに用いる。
 *
 * 参照: design.md「補助的な値型」、要件5.2
 */
export interface CalendarDay {
  /** 西暦年 */
  year: number;
  /** 月（1〜12） */
  month: number;
  /** 日（1〜31） */
  day: number;
}

/**
 * ランキング対戦で同時に提示される 2 件の組。
 * 不戦勝（奇数の余り 1 件）の場合は Pair を生成しない。
 *
 * 参照: design.md「補助的な値型」、要件4.1, 4.2, 4.4
 */
export interface BattlePair {
  /** 左側に提示する Character の id */
  left: string;
  /** 右側に提示する Character の id */
  right: string;
}

/**
 * ランキング対戦の 1 対戦の結果（実況テキストを含む）。
 *
 * 勝敗は利用者が選ぶのではなく Chara_App が rng を用いて自動判定するため、
 * 旧 `BattleSide`（利用者の左右選択）は廃止した。`winner` / `loser` は勝者・敗者
 * Character の **id** を保持し（要件4.2）、`commentary` には {@link ../domain/BattleCommentator.narrate}
 * が生成した、実行のたびに変動しうる実況テキストを保持する（要件4.3, 4.5）。
 *
 * 参照: design.md「補助的な値型 / BattleOutcome」、要件4.2, 4.3, 4.5
 */
export interface BattleOutcome {
  /** 勝者 Character の id。要件4.2 */
  winner: string;
  /** 敗者 Character の id */
  loser: string;
  /** 実行のたびにランダムに変わる実況テキスト。要件4.3, 4.5 */
  commentary: string;
}

/**
 * トーナメント表（Tournament_Bracket、要件18）の 1 対戦（match）を表す読み取り専用レコード。
 *
 * TournamentEngine が対戦の進行に応じて id ベースで蓄積・公開する勝ち上がり履歴の要素。
 * 通常の対戦（`bye: false`）は `left`/`right` の 2 件から rng で 1 件を勝者に確定し、
 * 不戦勝（Bye、`bye: true`）は奇数の余り 1 件（`left`）が対戦せず次ラウンドへ繰り上がる
 * （このとき `right === null` かつ `winner === left`）。表示（読み取り専用の可視化）
 * のみに用い、対戦の判定結果や Character_Store のデータは変更しない。
 *
 * 参照: design.md「トーナメント表（Tournament_Bracket）」、要件18.1〜18.4, 4.6, 4.7
 */
export interface BracketMatch {
  /** ラウンド番号（0 始まり）。初期ラウンドが 0、勝ち上がりで 1, 2, … と増加する。 */
  round: number;
  /** 対戦者 id（不戦勝の場合は繰り上がる 1 件）。 */
  left: string;
  /** 対戦相手 id。不戦勝（Bye）は `null`。 */
  right: string | null;
  /** 確定した勝者 id（不戦勝は `left` がそのまま winner）。 */
  winner: string | null;
  /** `true` のとき不戦勝（Bye）。 */
  bye: boolean;
}

/**
 * ラウンド順・各ラウンド内の対戦順に並んだ確定済み {@link BracketMatch} の列（要件18）。
 *
 * 各対戦の `winner`（および不戦勝の `left`）が次ラウンド（round+1）の対戦者として現れ、
 * 最終的に bracket の頂点（最後に確定した勝者）が champion と一致する（要件18.2, 18.3）。
 */
export type TournamentBracket = BracketMatch[];

/**
 * 対戦の状況区分（Battle_Situation、要件19）。
 *
 * 各 Battle_Pair の勝敗が決まったときに、勝者と敗者の Favorite_Level の比較から導く
 * （{@link ../domain/BattleCommentator.deriveBattleSituation}）区分。
 *
 * - `'favored'`: 勝者の Favorite_Level が敗者より高い（順当勝ち）
 * - `'upset'`  : 勝者の Favorite_Level が敗者より低い（番狂わせ）
 * - `'even'`   : 両者が同値、または比較不能（NaN/非有限など）（互角）
 *
 * Battle_Commentary（実況テキスト）の出し分けにのみ用い、勝敗の自動判定（要件4.2 の
 * rng による 50/50）や各 Character の勝率には一切影響しない（要件19.4）。
 *
 * 参照: design.md「Data Models」「イテレーション10」、要件19.1, 19.5、Correctness Property 25
 */
export type BattleSituation = 'favored' | 'upset' | 'even';

/**
 * 表示用に id を Character へ解決した bracket の match（hooks / UI で使用、要件18 の可視化用）。
 *
 * TournamentEngine が公開する id ベースの {@link BracketMatch} を、`useRankingBattle` が
 * 取得済みの Character へ解決して公開する。`TournamentBracketView` がこれを受け取り、
 * 名前/写真付きで勝ち上がりを可視化する（要件18.1〜18.3）。
 *
 * 参照: design.md「ResolvedBracketMatch」、要件18.1〜18.3
 */
export interface ResolvedBracketMatch {
  /** ラウンド番号（0 始まり）。{@link BracketMatch.round} と同一。 */
  round: number;
  /** 対戦者 Character（不戦勝の場合は繰り上がる 1 件）。 */
  left: Character;
  /** 対戦相手 Character。不戦勝（Bye）は `null`。 */
  right: Character | null;
  /** 確定した勝者 Character（不戦勝は `left` がそのまま winner）。 */
  winner: Character | null;
  /** `true` のとき不戦勝（Bye）。 */
  bye: boolean;
}

/**
 * 成功 / 失敗を型で表す判別可能ユニオン（例外の代替）。
 * ドメイン層（例: PhotoProcessor）の戻り値に用いる。
 *
 * 参照: design.md「補助的な値型」
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * 永続化（Character_Store）に関するエラーの判別可能ユニオン。
 * IndexedDB の例外・書き込み失敗・容量超過・上限到達を正規化する。
 *
 * 参照: design.md「補助的な値型」「エラー変換」、要件3.2, 2.2, 8.4, 8.5
 */
export type StoreError =
  | { kind: 'quotaExceeded' }
  | { kind: 'writeFailed' }
  | { kind: 'loadFailed' }
  | { kind: 'capacityReached' };

/**
 * 写真の取り込み・検証に関するエラーの判別可能ユニオン。
 *
 * 参照: design.md「補助的な値型」、要件1.10, 1.11, 8.2, 8.3
 */
export type PhotoError =
  | { kind: 'unsupportedFormat' }
  | { kind: 'tooLarge' }
  | { kind: 'acquisitionFailed' }
  | { kind: 'cancelled' };

/**
 * 入力検証（CharacterValidator）が返すフィールド単位のエラー。
 *
 * 参照: design.md「補助的な値型」、要件1.3〜1.7, 6.2, 8.1
 */
export interface FieldError {
  /** エラー対象のフィールド */
  field: 'name' | 'nickname' | 'memo' | 'favoriteLevel' | 'photo' | 'metOn' | 'imageColor';
  /** ユーザー向けの説明メッセージ */
  message: string;
}

/**
 * 一覧の並び順（要件11）。表示順のみに作用し、Character の内容やストアを変更しない。
 *
 * - `'newest'`  : 登録日時（createdAt）の新しい順
 * - `'favorite'`: お気に入り度（favoriteLevel）の高い順
 * - `'name'`    : 名前の Unicode コードポイント順（昇順、空名は後方）
 * - `'metOn'`   : 出会った日（Met_On）の新しい順。Met_On 降順、未設定は後方
 *
 * 参照: design.md「補助的な値型 / SortOrder」「sortCharacters」、要件11.2〜11.6
 */
export type SortOrder = 'newest' | 'favorite' | 'name' | 'metOn';

/**
 * 関係タグ（Relationship_Tag、要件22.2, 22.3）。
 *
 * 各無向の線に付く関係の種類（5 種）。登録データ（`imageColor` / `metOn` /
 * `favoriteLevel`）には一切依存せず、無向ペア `{a, b}`（`a < b` に正規化）の id を
 * 連結した文字列の決定的ハッシュ（`fnv1a32`）を `mod TAGS.length` した結果で 1 つを選ぶ（要件22.3）。
 *
 * 表示ラベル（日本語）と表示色（テーマトークン）は UI/定数側で対応付ける（型は英語 enum）:
 * - `'friend'`    : 仲良し
 * - `'rival'`     : ライバル
 * - `'fighting'`  : 喧嘩中
 * - `'crush'`     : 気になる存在
 * - `'buddy'`     : 相棒
 * - `'bestfriend'`: 親友
 * - `'admire'`    : 尊敬している
 * - `'frenemy'`   : ライバル兼友達
 * - `'mystery'`   : 謎めいた存在
 * - `'oshi'`      : 推し
 *
 * 参照: design.md「Data Models」「イテレーション14（キャラ相関図、要件22）」
 */
export type RelationshipTag =
  | 'friend'
  | 'rival'
  | 'fighting'
  | 'crush'
  | 'buddy'
  | 'bestfriend'
  | 'admire'
  | 'frenemy'
  | 'mystery'
  | 'oshi';

/**
 * 関係の線（Relationship_Edge、要件22）。id ベースの無向の線。
 *
 * `a` / `b` は結ぶ 2 件の {@link Character} の id で、常に `a < b`（id 昇順）に正規化する
 * （自己ループなし・同一無向ペアは高々 1 本、要件22.10）。`tag` は当該ペアに id 由来で
 * 決定的に選ばれた関係タグ（要件22.2）、`impressionAtoB` / `impressionBtoA` は向きを持つ
 * 印象（それぞれ a→b / b→a、いずれも非空、要件22.4〜22.6）、`score` は「つながり」を
 * 決めるための内部スコア（`fnv1a32` 由来・登録データ非依存、要件22.7, 22.8）。
 * `buildRelationshipMap` が各 Character の id（および id 集合）のみから決定的に生成する
 * 読み取り専用の値で、Character_Store のデータを一切変更しない（要件22.13）。
 *
 * 参照: design.md「Data Models」「イテレーション14」、要件22.1, 22.2, 22.4, 22.10
 */
export interface RelationshipEdge {
  /** 一方の Character の id（`a < b` に正規化）。要件22.10 */
  a: string;
  /** もう一方の Character の id（`a < b` に正規化）。要件22.10 */
  b: string;
  /** 当該ペアの関係タグ（id 由来で決定的に 1 つ、要件22.2）。 */
  tag: RelationshipTag;
  /** a→b の向きあり印象（印象テンプレート集の非空要素、要件22.4, 22.5）。 */
  impressionAtoB: string;
  /** b→a の向きあり印象（印象テンプレート集の非空要素、要件22.4, 22.5）。 */
  impressionBtoA: string;
  /** つながり決定用の内部スコア（`fnv1a32` 由来・決定的・登録データ非依存、要件22.7, 22.8）。 */
  score: number;
}

/**
 * 相関図（Relationship_Map、要件22）。`buildRelationshipMap` の戻り値。
 *
 * 次数上限3・両端合意を満たす最終の線の列を保持する。順序は決定的（`a` 昇順 → `b` 昇順）で、
 * 同一の id 集合からは常に同一の相関図を返す（要件22.9）。
 *
 * 参照: design.md「Data Models」「イテレーション14」、要件22.1, 22.9, 22.10
 */
export interface RelationshipMap {
  /** 次数上限3・両端合意を満たす最終の線。決定的順序（`a` 昇順 → `b` 昇順）。 */
  edges: RelationshipEdge[];
}

/**
 * 表示用に id を {@link Character} へ解決した関係の線（`useRelationshipMap` が公開）。
 *
 * {@link RelationshipEdge} の `a` / `b`（id）を対応する Character へ解決したもので、
 * `RelationshipMapView` が関係タグの色付きバッジと双方向の印象付きで関係を可視化するために
 * 用いる（要件22 の可視化用）。
 *
 * 参照: design.md「Data Models」「RelationshipMapView」、要件22.1
 */
export interface ResolvedRelationshipEdge {
  /** 一方の Character（{@link RelationshipEdge.a} を解決）。 */
  a: Character;
  /** もう一方の Character（{@link RelationshipEdge.b} を解決）。 */
  b: Character;
  /** 当該ペアの関係タグ（要件22.2）。 */
  tag: RelationshipTag;
  /** a→b の向きあり印象（非空、要件22.4）。 */
  impressionAtoB: string;
  /** b→a の向きあり印象（非空、要件22.4）。 */
  impressionBtoA: string;
  /** つながり決定用の内部スコア（要件22.7, 22.8）。 */
  score: number;
}
