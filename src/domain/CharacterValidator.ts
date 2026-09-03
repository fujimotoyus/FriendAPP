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
 *
 * 参照要件: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 6.2, 8.1
 */

import type { CharacterDraft, FieldError } from './types';

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
