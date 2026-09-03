/**
 * ドメインの型定義（Character と補助値型）
 *
 * 本モジュールは React / IndexedDB / File API に依存しない純粋な TypeScript の
 * 型定義のみを提供する（design.md「Data Models」参照）。ドメインロジック
 * （バリデーション・決定的選出・トーナメント・写真処理）や永続化層は、これらの
 * 型を共有して実装される。
 */

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
  /** 写真バイナリ（必須）。IndexedDB に Blob として直接格納する。要件1.8, 3.3 */
  photo: Blob;
  /** 登録日時（epoch ミリ秒）。一覧の並び順（新しい順）・暦日固定選出の安定キー。要件2.1, 5.2 */
  createdAt: number;
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
  /** 写真。未取得は null（写真は登録時に必須）。要件1.3, 1.8 */
  photo: Blob | null;
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
  field: 'name' | 'nickname' | 'memo' | 'favoriteLevel' | 'photo';
  /** ユーザー向けの説明メッセージ */
  message: string;
}
