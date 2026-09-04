/**
 * RegistrationForm — キャラクターの新規登録 / 編集フォーム。
 *
 * {@link useRegistration} を用いて入力保持用の {@link CharacterDraft} を編集し、
 * 名前・ニックネーム・メモ・お気に入り度（{@link FavoriteLevelPicker}）・写真
 * （{@link PhotoInput} + {@link PhotoFrame} プレビュー）を入力させる（要件1.2, 1.4〜1.7）。
 * ドメインロジック（検証・画像判定・保存）は hook に委譲し、本コンポーネントは
 * 描画とユーザー操作の受け取りのみを担う（design.md「UI 層」「フロー1」）。
 *
 * 失敗時の挙動（design.md「Error Handling」）:
 * - 検証エラー（写真必須・文字数超過・お気に入り度範囲外）は該当欄にメッセージを
 *   表示し、入力を保持する（要件1.3, 8.1）。
 * - 写真の取り込みキャンセル/ブロック・非対応形式・過大サイズは写真エラーとして
 *   メッセージを表示し、入力を保持する（要件1.10, 1.11, 8.2, 8.3）。
 * - 保存失敗（容量超過・書き込み失敗・上限到達）はストアエラーとしてメッセージを
 *   表示し、入力を保持する（要件1.12, 2.2, 3.2, 8.4, 8.5）。
 * - `save()` が `'saved'` を返したときのみ {@link RegistrationFormProps.onSaved} を呼ぶ。
 *
 * 編集モード（要件6.1）は `editing` を hook へ渡すことで対応する。完全な編集 UI の
 * 仕上げは後続タスク（16）で行うが、本コンポーネントは prop を受け取れるようにする。
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12
 */
import type { FormEvent } from 'react';
import { useRegistration } from '../hooks/useRegistration';
import { photoErrorMessage, storeErrorMessage } from '../hooks/errorMessages';
import type { Character, FieldError } from '../domain/types';
import {
  MEMO_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '../domain/CharacterValidator';
import { FavoriteLevelPicker } from './FavoriteLevelPicker';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';
import { PhotoInput } from './PhotoInput';

export interface RegistrationFormProps {
  /** 保存成功（`save()` が `'saved'`）時に呼ばれる。呼び出し側は一覧へ戻す。要件1.8 */
  onSaved: () => void;
  /** キャンセル操作時に呼ばれる。呼び出し側は一覧へ戻す。 */
  onCancel: () => void;
  /** 編集対象の Character（省略時は新規登録）。hook へそのまま渡す。要件6.1 */
  editing?: Character;
}

/** 指定フィールドの検証エラーメッセージを返す（無ければ null）。 */
function fieldErrorMessage(
  errors: FieldError[],
  field: FieldError['field'],
): string | null {
  const found = errors.find((error) => error.field === field);
  return found ? found.message : null;
}

export function RegistrationForm({
  onSaved,
  onCancel,
  editing,
}: RegistrationFormProps): JSX.Element {
  const {
    draft,
    fieldErrors,
    photoError,
    storeError,
    storeErrorDetail,
    setField,
    pickPhoto,
    save,
  } = useRegistration(editing);

  const isEditing = editing != null;

  // フォーム送信: 検証・保存を行い、成功時のみ一覧へ戻す（要件1.8）。
  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const result = await save();
    if (result === 'saved') {
      onSaved();
    }
    // 'invalid' / 'storeError' の場合はここに留まり、hook のエラー状態が表示される
    // （入力は保持される。要件1.3, 1.12, 8.1〜8.5）。
  };

  // PhotoInput からのファイル選択・キャンセルを hook の pickPhoto に集約する。
  // PhotoInput は onSelect(file) / onCancel() を提供するため、それぞれ FileList 相当へ
  // 変換して pickPhoto を呼ぶ（キャンセルは null を渡し acquisitionFailed になる）。
  const handlePhotoSelect = (file: File): void => {
    const list = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    void pickPhoto(list);
  };

  const handlePhotoCancel = (): void => {
    void pickPhoto(null);
  };

  const nameError = fieldErrorMessage(fieldErrors, 'name');
  const nicknameError = fieldErrorMessage(fieldErrors, 'nickname');
  const memoError = fieldErrorMessage(fieldErrors, 'memo');
  const favoriteLevelError = fieldErrorMessage(fieldErrors, 'favoriteLevel');
  const photoFieldError = fieldErrorMessage(fieldErrors, 'photo');

  return (
    <main className="registration-form">
      <h1>{isEditing ? 'キャラクターを編集' : 'キャラクターを登録'}</h1>

      <form
        className="registration-form__form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {/* 写真: プレビュー + 取り込み（要件1.2, 1.8） */}
        <div className="registration-form__field">
          <span className="registration-form__label">写真（必須）</span>
          <PhotoFrame
            photo={draft.photo}
            alt="登録する写真のプレビュー"
            className="registration-form__photo-preview"
          />
          <div className="registration-form__photo-actions">
            <PhotoInput
              source="camera"
              onSelect={handlePhotoSelect}
              onCancel={handlePhotoCancel}
            />
            <PhotoInput
              source="library"
              onSelect={handlePhotoSelect}
              onCancel={handlePhotoCancel}
            />
          </div>
          {photoFieldError ? (
            <p className="registration-form__error" role="alert">
              {photoFieldError}
            </p>
          ) : null}
          {photoError ? (
            <p className="registration-form__error" role="alert">
              {photoErrorMessage(photoError)}
            </p>
          ) : null}
        </div>

        {/* 名前（0〜50 文字・任意）。要件1.4, 1.9 */}
        <div className="registration-form__field">
          <label className="registration-form__label" htmlFor="registration-name">
            名前（任意・{NAME_MAX_LENGTH}文字まで）
          </label>
          <input
            id="registration-name"
            type="text"
            value={draft.name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => setField('name', event.target.value)}
          />
          {nameError ? (
            <p className="registration-form__error" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        {/* ニックネーム（0〜50 文字）。要件1.5 */}
        <div className="registration-form__field">
          <label className="registration-form__label" htmlFor="registration-nickname">
            ニックネーム（{NICKNAME_MAX_LENGTH}文字まで）
          </label>
          <input
            id="registration-nickname"
            type="text"
            value={draft.nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(event) => setField('nickname', event.target.value)}
          />
          {nicknameError ? (
            <p className="registration-form__error" role="alert">
              {nicknameError}
            </p>
          ) : null}
        </div>

        {/* メモ（0〜500 文字）。要件1.6 */}
        <div className="registration-form__field">
          <label className="registration-form__label" htmlFor="registration-memo">
            メモ（{MEMO_MAX_LENGTH}文字まで）
          </label>
          <textarea
            id="registration-memo"
            className="registration-form__textarea"
            value={draft.memo}
            maxLength={MEMO_MAX_LENGTH}
            rows={4}
            onChange={(event) => setField('memo', event.target.value)}
          />
          {memoError ? (
            <p className="registration-form__error" role="alert">
              {memoError}
            </p>
          ) : null}
        </div>

        {/* お気に入り度（1〜5）。要件1.7 */}
        <div className="registration-form__field">
          <span className="registration-form__label">お気に入り度</span>
          <FavoriteLevelPicker
            value={draft.favoriteLevel}
            onChange={(level) => setField('favoriteLevel', level)}
          />
          {favoriteLevelError ? (
            <p className="registration-form__error" role="alert">
              {favoriteLevelError}
            </p>
          ) : null}
        </div>

        {/* 保存失敗メッセージ（入力は保持される。要件1.12, 8.4, 8.5） */}
        {storeError ? (
          <p className="registration-form__error" role="alert">
            {storeErrorMessage(storeError)}
          </p>
        ) : null}

        {/* 【一時デバッグ】保存失敗の真因（元例外）を画面に表示する。原因確定後に削除する。 */}
        {storeErrorDetail ? (
          <p
            className="registration-form__error"
            role="alert"
            style={{ fontSize: '0.75rem', opacity: 0.8, wordBreak: 'break-all' }}
          >
            [debug] {storeErrorDetail}
          </p>
        ) : null}

        {/* アクション: 保存 / キャンセル */}
        <div className="registration-form__actions">
          <PastelButton type="submit">
            {isEditing ? '更新する' : '登録する'}
          </PastelButton>
          <PastelButton type="button" variant="secondary" onClick={onCancel}>
            キャンセル
          </PastelButton>
        </div>
      </form>
    </main>
  );
}

