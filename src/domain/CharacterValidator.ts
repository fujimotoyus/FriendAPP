/**
 * CharacterValidator — キャラクター入力の検証（純粋 TypeScript）
 *
 * 本モジュールは React / DOM / IndexedDB / File API に一切依存しない純粋関数を
 * 提供する（design.md「Domain モジュール / CharacterValidator」参照）。
 * `CharacterDraft` を検証し、違反したフィールドごとに日本語メッセージを持つ
 * `FieldError` の配列を返す。配列が空であれば入力は有効である。
 *
 * 検証ルール（design.md「Data Models」「Error Handling」、要件より）:
 * - name:          0〜50 文字。0 文字（未入力）も許可（任意項目）。要件1.4, 1.9
 * - nickname:      0〜50 文字。要件1.5
 * - memo:          0〜500 文字。要件1.6
 * - favoriteLevel: 1〜5 の整数。非整数・範囲外は不可。要件1.7, 8.1
 * - photo:         必須（null は不可）。要件1.3
 * - metOn:         任意。空/未設定は許可。値がある場合は `YYYY-MM-DD` の形式チェックのみ
 *                  行い、形式不正な非空値のみ FieldError を返す。実在日・範囲（1900-01-01〜
 *                  today）・未来日の厳密判定は `normalizeMetOn`（metOn.ts）へ委ねる。要件14.4
 * - imageColor:    プリセット許容値以外は FieldError を出さず `'none'` として扱う正規化方針。
 *                  許容判定 `isValidImageColor` / 正規化 `normalizeImageColor` を提供する。要件15.4
 *
 * 参照要件: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 6.2, 8.1, 14.4, 15.4
 */

import type { CharacterDraft, FieldError, ImageColor } from './types';

/** 名前の最大文字数（0 文字も許可）。要件1.4, 1.9 */
export const NAME_MAX_LENGTH = 50;
/** ニックネームの最大文字数。要件1.5 */
export const NICKNAME_MAX_LENGTH = 50;
/** メモの最大文字数。要件1.6 */
export const MEMO_MAX_LENGTH = 500;
/** お気に入り度の下限（含む）。要件1.7, 8.1 */
export const FAVORITE_LEVEL_MIN = 1;
/** お気に入り度の上限（含む）。要件1.7, 8.1 */
export const FAVORITE_LEVEL_MAX = 5;

/**
 * イメージカラーのプリセット許容値集合（`ImageColor` の全メンバ）。既定は `'none'`。
 * `isValidImageColor` / `normalizeImageColor` の判定基準に用いる。要件15.1, 15.4
 */
export const IMAGE_COLOR_VALUES: readonly ImageColor[] = [
  'none',
  'rose',
  'mint',
  'lavender',
  'butter',
  'sky',
];

/** 出会った日として受理する形式（`YYYY-MM-DD`）の軽量チェック用パターン。要件14.4 */
const MET_ON_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 値が `ImageColor` のプリセット許容値のいずれかであるかを判定する型ガード。
 *
 * 副作用を持たない純粋関数。後続の useRegistration / Persistence の正規化から再利用する。
 *
 * @param value 判定対象の任意の値
 * @returns プリセット許容値なら true（`value is ImageColor`）
 */
export function isValidImageColor(value: unknown): value is ImageColor {
  return (IMAGE_COLOR_VALUES as readonly unknown[]).includes(value);
}

/**
 * 任意の入力を `ImageColor` へ正規化する。許容値ならその値を、
 * 許容外・未設定・不正値は既定の `'none'`（縁取りなし）を返す。要件15.1, 15.4, 15.5
 *
 * 副作用を持たない純粋関数。旧データ読み出し・保存時の正規化から再利用する。
 *
 * @param value 正規化対象の任意の値
 * @returns 妥当な `ImageColor`（許容外・未設定は `'none'`）
 */
export function normalizeImageColor(value: unknown): ImageColor {
  return isValidImageColor(value) ? value : 'none';
}

/**
 * `CharacterDraft` を検証し、違反フィールドごとの `FieldError` を返す。
 * 副作用を持たず、引数 `draft` を変更しない純粋関数である（要件1.3: 入力内容は不変）。
 *
 * @param draft 検証対象の入力内容
 * @returns 違反した各フィールドの `FieldError` の配列（空配列 = 有効）
 */
export function validate(draft: CharacterDraft): FieldError[] {
  const errors: FieldError[] = [];

  // 名前: 0〜50 文字（0 文字は許可 = 任意項目）。要件1.4, 1.9
  if (draft.name.length > NAME_MAX_LENGTH) {
    errors.push({
      field: 'name',
      message: `名前は${NAME_MAX_LENGTH}文字以内で入力してください。`,
    });
  }

  // ニックネーム: 0〜50 文字。要件1.5
  if (draft.nickname.length > NICKNAME_MAX_LENGTH) {
    errors.push({
      field: 'nickname',
      message: `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください。`,
    });
  }

  // メモ: 0〜500 文字。要件1.6
  if (draft.memo.length > MEMO_MAX_LENGTH) {
    errors.push({
      field: 'memo',
      message: `メモは${MEMO_MAX_LENGTH}文字以内で入力してください。`,
    });
  }

  // お気に入り度: 1〜5 の整数。非整数・範囲外・数値以外はエラー。要件1.7, 8.1
  const level = draft.favoriteLevel;
  if (
    !Number.isInteger(level) ||
    level < FAVORITE_LEVEL_MIN ||
    level > FAVORITE_LEVEL_MAX
  ) {
    errors.push({
      field: 'favoriteLevel',
      message: `お気に入り度は${FAVORITE_LEVEL_MIN}〜${FAVORITE_LEVEL_MAX}の整数で選択してください。`,
    });
  }

  // 写真: 必須（null は不可）。要件1.3
  if (draft.photo == null) {
    errors.push({
      field: 'photo',
      message: '写真は必須です。写真を選択してください。',
    });
  }

  // 出会った日: 任意。空/未設定は許可。値がある場合のみ `YYYY-MM-DD` の
  // 形式（軽量）チェックを行い、形式不正な非空値のみエラーとする。実在日・範囲・
  // 未来日の厳密判定は normalizeMetOn（save 時に today と共に適用）へ委ねる。要件14.4
  if (
    draft.metOn !== undefined &&
    draft.metOn.length > 0 &&
    !MET_ON_FORMAT_PATTERN.test(draft.metOn)
  ) {
    errors.push({
      field: 'metOn',
      message: '出会った日は「YYYY-MM-DD」の形式で入力してください。',
    });
  }

  // イメージカラー: 許容外でも 'none' 扱いで保存を妨げないため、ここでは
  // FieldError を出さない（正規化は normalizeImageColor が担う）。要件15.4

  return errors;
}

/**
 * `validate` の結果が空（= 有効）かどうかを返す補助関数。
 *
 * @param draft 検証対象の入力内容
 * @returns 有効であれば true
 */
export function isValid(draft: CharacterDraft): boolean {
  return validate(draft).length === 0;
}
