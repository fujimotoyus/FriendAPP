/**
 * useRegistration — キャラクター登録 / 編集の View-State（ViewModel 相当）
 *
 * RegistrationForm が用いる hook（design.md「Hooks / View-State」「フロー1: 写真付き登録」）。
 * 入力保持用の CharacterDraft を保持し、ドメイン層（CharacterValidator・PhotoProcessor）と
 * 永続化層（CharacterStore）を調停する。
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
 * 一意な id を生成する。crypto.randomUUID() はセキュアコンテキスト（HTTPS）かつ
 * 対応ブラウザでのみ利用できるため、利用できない環境ではフォールバックで生成する。
 */
function generateId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * useRegistration.save の結果。
 * - saved:      保存に成功（要件1.8, 3.1）。
 * - invalid:    入力検証エラー（要件1.3, 8.1）。
 * - storeError: 容量到達またはストア保存失敗（要件1.12, 2.2, 3.2, 8.4, 8.5）。
 */
export type SaveResult = 'saved' | 'invalid' | 'storeError';

/**
 * useRegistration の戻り値。
 */
export interface UseRegistrationResult {
  draft: CharacterDraft;
  fieldErrors: FieldError[];
  photoError: PhotoError | null;
  storeError: StoreError | null;
  /**
   * 【一時デバッグ】本番PWAでの保存失敗の真因を特定するため、丸める前の元例外の
   * name / message を保持する。原因確定後に削除する。
   */
  storeErrorDetail: string | null;
  setField: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  pickPhoto: (files: FileList | null) => Promise<void>;
  save: () => Promise<SaveResult>;
}

/**
 * editing（編集対象の Character）または既定値から初期 draft を生成する。
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
 * 【一時デバッグ】捕捉した例外から、画面表示用の詳細文字列（name: message）を作る。
 * 原因確定後に削除する。
 */
function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const name = 'name' in error ? String((error as { name?: unknown }).name) : 'Error';
    const message =
      'message' in error ? String((error as { message?: unknown }).message) : '';
    return `${name}: ${message}`;
  }
  return String(error);
}

/**
 * キャラクターの新規登録 / 編集の View-State を提供する hook。
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
  // 【一時デバッグ】原因確定用の詳細（後で削除）。
  const [storeErrorDetail, setStoreErrorDetail] = useState<string | null>(null);

  const setField = useCallback(
    <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]): void => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const pickPhoto = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (files === null || files.length === 0) {
        setPhotoError({ kind: 'acquisitionFailed' });
        return;
      }

      const file = files[0];
      let result;
      try {
        result = await validateAndProcess(file);
      } catch (error) {
        // 画像の読み出し（ArrayBuffer 変換）自体が失敗した場合。
        setPhotoError({ kind: 'acquisitionFailed' });
        setStoreErrorDetail('pickPhoto: ' + describeError(error));
        return;
      }

      if (!result.ok) {
        setPhotoError(result.error);
        return;
      }

      setPhotoError(null);
      setDraft((prev) => ({ ...prev, photo: result.value }));
    },
    [],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    setStoreError(null);
    setStoreErrorDetail(null);

    const errors = validate(draft);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return 'invalid';
    }
    setFieldErrors([]);

    const photo = draft.photo as Blob;
    const isEditing = draft.editingId !== undefined;

    if (!isEditing) {
      try {
        const current = await store.count();
        if (current >= CAPACITY_LIMIT) {
          setStoreError({ kind: 'capacityReached' });
          return 'storeError';
        }
      } catch (error) {
        setStoreError(readStoreError(error));
        setStoreErrorDetail('count: ' + describeError(error));
        return 'storeError';
      }
    }

    try {
      if (isEditing) {
        const character: Character = {
          id: draft.editingId as string,
          name: draft.name,
          nickname: draft.nickname,
          memo: draft.memo,
          favoriteLevel: draft.favoriteLevel,
          photo,
          createdAt: editing?.createdAt ?? Date.now(),
        };
        await store.update(character);
      } else {
        const character: Character = {
          id: generateId(),
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
      setStoreError(readStoreError(error));
      setStoreErrorDetail('save: ' + describeError(error));
      return 'storeError';
    }
  }, [draft, store, editing]);

  return {
    draft,
    fieldErrors,
    photoError,
    storeError,
    storeErrorDetail,
    setField,
    pickPhoto,
    save,
  };
}

/**
 * 捕捉した例外を StoreError に正規化する。
 */
function readStoreError(error: unknown): StoreError {
  if (isStoreErrorException(error)) {
    return error.storeError;
  }
  return { kind: 'writeFailed' };
}