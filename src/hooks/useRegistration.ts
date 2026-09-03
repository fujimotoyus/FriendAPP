/**
 * useRegistration — キャラクター登録 / 編集の View-State（ViewModel 相当）
 *
 * RegistrationForm が用いる hook（design.md「Hooks / View-State」「フロー1: 写真付き登録」）。
 * 入力保持用の {@link CharacterDraft} を保持し、ドメイン層（{@link CharacterValidator}・
 * {@link PhotoProcessor}）と永続化層（{@link CharacterStore}）を調停する。ロジックの中心
 * （検証・画像判定）は純粋ドメインモジュールに委譲し、本 hook はビュー状態の保持と
 * ユースケースの調停のみを担う。
 *
 * 設計方針:
 * - 失敗時（写真取得キャンセル/ブロック・不正画像・検証エラー・保存失敗）でも入力内容
 *   （draft）を破棄しない（要件1.3, 1.11, 1.12, 8.2〜8.5）。
 * - ストアは引数（DI）で受け取り、テスト時に InMemoryCharacterStore / FailingCharacterStore
 *   等へ差し替え可能。省略時は共有シングルトン {@link defaultCharacterStore}（IndexedDB）。
 * - `editing` が渡された場合は、その属性で draft を初期化する（編集モード再利用。要件6.1）。
 * - 写真エラー（{@link PhotoError}）・保存エラー（{@link StoreError}）はビュー状態として公開し、
 *   フォームが入力を保持したままメッセージを表示できるようにする。
 *
 * 参照: design.md「Hooks / View-State」「フロー1」「Error Handling」、
 *       要件1.3, 1.8, 1.10, 1.11, 1.12, 2.2, 3.1, 3.2, 8.1, 8.2, 8.3, 8.4, 8.5
 */
import { useCallback, useState } from 'react';
import { validate } from '../domain/CharacterValidator';
import { validateAndProcess } from '../domain/PhotoProcessor';
import type {
  Character,
  CharacterDraft,
  FieldError,
  PhotoError,
  StoreError,
} from '../domain/types';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';
import { isStoreErrorException } from '../persistence/IndexedDbCharacterStore';

/** 保持可能な Character の上限（要件2.2）。この件数に達している場合は新規登録を拒否する。 */
const CAPACITY_LIMIT = 1000;

/** 新規登録時の初期お気に入り度（1〜5 の中間値）。要件1.7 */
const DEFAULT_FAVORITE_LEVEL = 3;

/**
 * {@link useRegistration.save} の結果。
 * - `saved`:      検証・容量確認を通過し、ストアへの保存に成功した（要件1.8, 3.1）。
 * - `invalid`:    入力検証エラー（写真未指定・文字数超過・お気に入り度範囲外等）。要件1.3, 8.1
 * - `storeError`: 容量到達またはストア保存失敗。要件1.12, 2.2, 3.2, 8.4, 8.5
 */
export type SaveResult = 'saved' | 'invalid' | 'storeError';

/**
 * {@link useRegistration} の戻り値。
 */
export interface UseRegistrationResult {
  /** 入力保持用の draft（失敗時も破棄しない）。要件1.3, 1.11, 1.12, 8.3〜8.5 */
  draft: CharacterDraft;
  /** 直近の検証で検出されたフィールド単位のエラー。要件1.3〜1.7, 8.1 */
  fieldErrors: FieldError[];
  /** 写真の取り込み・検証で発生したエラー（無ければ null）。要件1.10, 1.11, 8.2, 8.3 */
  photoError: PhotoError | null;
  /** 保存で発生したエラー（無ければ null）。要件1.12, 2.2, 3.2, 8.4, 8.5 */
  storeError: StoreError | null;
  /** draft の 1 フィールドを更新する。写真は {@link pickPhoto} 経由で設定する。 */
  setField: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  /** ファイル選択の結果を受け取り、検証して draft.photo に反映する。キャンセル/ブロック/不正を扱う。 */
  pickPhoto: (files: FileList | null) => Promise<void>;
  /** 検証・容量確認の後に Character を作成しストアへ保存する。要件1.8, 2.2, 3.1 */
  save: () => Promise<SaveResult>;
}

/**
 * `editing`（編集対象の Character）または既定値から初期 draft を生成する。
 * 編集時は既存属性を初期表示し、`editingId` に id を設定する（要件6.1）。
 * 新規時は空文字・既定お気に入り度・写真 null とする。
 */
function createInitialDraft(editing?: Character): CharacterDraft {
  if (editing) {
    return {
      name: editing.name,
      nickname: editing.nickname,
      memo: editing.memo,
      favoriteLevel: editing.favoriteLevel,
      photo: editing.photo,
      editingId: editing.id,
    };
  }
  return {
    name: '',
    nickname: '',
    memo: '',
    favoriteLevel: DEFAULT_FAVORITE_LEVEL,
    photo: null,
  };
}

/**
 * キャラクターの新規登録 / 編集の View-State を提供する hook。
 *
 * @param editing 編集対象の Character（省略時は新規登録）。要件6.1
 * @param store   永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @returns draft・各種エラー状態・フィールド更新・写真取り込み・保存。
 */
export function useRegistration(
  editing?: Character,
  store: CharacterStore = defaultCharacterStore,
): UseRegistrationResult {
  const [draft, setDraft] = useState<CharacterDraft>(() =>
    createInitialDraft(editing),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [photoError, setPhotoError] = useState<PhotoError | null>(null);
  const [storeError, setStoreError] = useState<StoreError | null>(null);

  /**
   * draft の 1 フィールドを更新する。ジェネリクスにより型安全に key/value を対応付ける。
   * 入力保持が原則のため、ここでは既存の他フィールドを維持したまま該当フィールドのみ更新する。
   */
  const setField = useCallback(
    <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]): void => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /**
   * ファイル選択の結果を受け取り、写真を検証して draft に反映する（design.md「フロー1」）。
   *
   * - files が null または空（キャンセル / ブラウザのアクセスブロック）の場合、
   *   `acquisitionFailed` を写真エラーとして設定し、draft は保持する（要件1.11, 8.3）。
   * - ファイルがある場合は {@link PhotoProcessor.validateAndProcess} で検証し、
   *   非対応形式 / 過大サイズなら当該 {@link PhotoError} を設定して draft を保持する
   *   （要件1.10, 8.2）。
   * - 正常なら photoError をクリアし、draft.photo に処理済み Blob を格納する（要件1.8）。
   */
  const pickPhoto = useCallback(
    async (files: FileList | null): Promise<void> => {
      // キャンセル / アクセスブロック: 写真未取得を通知し、入力は保持（要件1.11, 8.3）。
      if (files === null || files.length === 0) {
        setPhotoError({ kind: 'acquisitionFailed' });
        return;
      }

      const file = files[0];
      const result = await validateAndProcess(file);

      if (!result.ok) {
        // 非対応形式 / 過大サイズ。入力を保持したままエラーを提示（要件1.10, 8.2）。
        setPhotoError(result.error);
        return;
      }

      // 正常取り込み。エラーをクリアし draft.photo に反映（要件1.8）。
      setPhotoError(null);
      setDraft((prev) => ({ ...prev, photo: result.value }));
    },
    [],
  );

  /**
   * 現在の draft を検証・容量確認の後に保存する（design.md「フロー1」）。
   *
   * 手順:
   * 1. {@link CharacterValidator.validate} で検証。エラーがあれば `fieldErrors` を設定し
   *    `'invalid'` を返す（入力保持。要件1.3, 8.1）。
   * 2. 新規登録時は `store.count()` を確認し、上限 1,000 件到達なら `capacityReached` を
   *    設定して `'storeError'` を返す（要件2.2）。編集時（editingId あり）は件数不変のため
   *    上限判定を行わない。
   * 3. Character を構築（新規は `crypto.randomUUID()` / `Date.now()`、編集は既存 id / createdAt を維持）し、
   *    新規は `store.insert`、編集は `store.update` を呼ぶ（要件1.8, 3.1, 6.3, 6.4）。
   * 4. {@link StoreError} が throw された場合は入力を保持したまま `storeError` を設定し
   *    `'storeError'` を返す（要件1.12, 3.2, 8.4, 8.5）。成功時は `'saved'` を返す。
   */
  const save = useCallback(async (): Promise<SaveResult> => {
    // 前回のエラー状態をクリアしてから再評価する。
    setStoreError(null);

    // 1. 入力検証（写真必須・文字数・お気に入り度）。要件1.3, 8.1
    const errors = validate(draft);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return 'invalid';
    }
    setFieldErrors([]);

    // 検証を通過した時点で photo は非 null（validate が写真必須を保証）。
    const photo = draft.photo as Blob;
    const isEditing = draft.editingId !== undefined;

    // 2. 容量上限確認（新規登録のみ）。要件2.2
    if (!isEditing) {
      try {
        const current = await store.count();
        if (current >= CAPACITY_LIMIT) {
          setStoreError({ kind: 'capacityReached' });
          return 'storeError';
        }
      } catch (error) {
        // 件数取得の失敗はストアエラーとして扱い、入力は保持する（要件8.5）。
        setStoreError(readStoreError(error));
        return 'storeError';
      }
    }

    // 3. Character を構築して保存する（新規: insert / 編集: update）。要件1.8, 3.1, 6.3, 6.4
    try {
      if (isEditing) {
        const character: Character = {
          id: draft.editingId as string,
          name: draft.name,
          nickname: draft.nickname,
          memo: draft.memo,
          favoriteLevel: draft.favoriteLevel,
          photo,
          // 編集では登録日時（並び順の安定キー）を維持する。既存値があればそれを、
          // 無ければ現在時刻を用いる。
          createdAt: editing?.createdAt ?? Date.now(),
        };
        await store.update(character);
      } else {
        const character: Character = {
          id: crypto.randomUUID(),
          name: draft.name,
          nickname: draft.nickname,
          memo: draft.memo,
          favoriteLevel: draft.favoriteLevel,
          photo,
          createdAt: Date.now(),
        };
        await store.insert(character);
      }
      return 'saved';
    } catch (error) {
      // 4. 保存失敗。入力を保持したまま失敗を提示する（要件1.12, 3.2, 8.4, 8.5）。
      setStoreError(readStoreError(error));
      return 'storeError';
    }
  }, [draft, store, editing]);

  return {
    draft,
    fieldErrors,
    photoError,
    storeError,
    setField,
    pickPhoto,
    save,
  };
}

/**
 * 捕捉した例外を {@link StoreError} に正規化する。
 * {@link IndexedDbCharacterStore} は {@link StoreError} を包む例外を throw するため、
 * {@link isStoreErrorException} で kind を読み取る。判別不能な例外は `writeFailed` として扱う（要件8.5）。
 */
function readStoreError(error: unknown): StoreError {
  if (isStoreErrorException(error)) {
    return error.storeError;
  }
  return { kind: 'writeFailed' };
}
