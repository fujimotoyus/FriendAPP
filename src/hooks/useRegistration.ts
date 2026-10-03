/**
 * useRegistration — キャラクター登録 / 編集の View-State（ViewModel 相当）
 *
 * RegistrationForm が用いる hook（design.md「Hooks / View-State」「フロー1: 写真付き登録」
 * 「イテレーション15（複数写真対応、要件23）」）。入力保持用の CharacterDraft を保持し、
 * ドメイン層（CharacterValidator・PhotoProcessor・photos.addPhotos）と永続化層
 * （CharacterStore）を調停する。
 *
 * 写真は複数（最大 {@link PHOTOS_MAX} = 5 枚）保持する。`pickPhotos` は選択された
 * 複数ファイルを個別に検証して成功分を取り込み（`addPhotos` で既存へ連結・5枚で切り詰め）、
 * `removePhoto` は index 指定で 1 枚削除する。写真は 1 枚以上必須で、0 枚で保存しようとすると
 * `validate` が弾く（要件23.4, 23.13）。
 *
 * 参照: design.md「Hooks / View-State」「フロー1」「イテレーション15」「Error Handling」、
 *       要件23.1, 23.3, 23.4, 23.6, 23.11, 23.13、1.3, 1.8, 1.10, 1.11, 1.12, 2.2, 3.1, 3.2,
 *       8.1, 8.2, 8.3, 8.4, 8.5
 */
import { useCallback, useState } from 'react';
import { normalizeImageColor, validate } from '../domain/CharacterValidator';
import { normalizeMetOn } from '../domain/metOn';
import { addPhotos } from '../domain/photos';
import { validateAndProcess } from '../domain/PhotoProcessor';
import type {
  CalendarDay,
  Character,
  CharacterDraft,
  FieldError,
  PhotoData,
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
 * 端末ローカルの現在日から今日の暦日（CalendarDay）を作る。
 * normalizeMetOn の上限（未来日クリア）判定に用いる（要件14.10）。純粋関数ではないが、
 * ドメイン関数 normalizeMetOn へ渡す値を作るだけで副作用は持たない。
 */
function localToday(): CalendarDay {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

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
 * - invalid:    入力検証エラー（要件1.3, 8.1、写真0枚＝要件23.13）。
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
  /**
   * 直近の `pickPhotos` で、取り込み後の総数が {@link PHOTOS_MAX}（= 5）を超えて
   * 超過分の取り込みを一部拒否したとき `true`（要件23.3）。UI（タスク77）が「写真は
   * 最大5枚まで」のメッセージ表示に用いる。新たな取り込み・削除・保存の都度リセットする。
   */
  photosTruncated: boolean;
  storeError: StoreError | null;
  setField: <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => void;
  /**
   * 選択された複数ファイルを取り込む（要件23.1, 23.3, 23.6）。各 File を
   * `PhotoProcessor.validateAndProcess` で検証し、成功分を `addPhotos` で既存 `draft.photos`
   * へ連結する（5枚上限・超過は `photosTruncated` を立てる）。null/0 件はキャンセル扱い
   * （`photoError = acquisitionFailed`）で draft は破棄しない。非対応形式/過大/読み出し失敗は
   * `photoError` に種別を残す（成功分があれば取り込んだ上でエラーも保持）。
   */
  pickPhotos: (files: FileList | null) => Promise<void>;
  /** `draft.photos` から index 指定の 1 枚を削除する（要件23.1）。 */
  removePhoto: (index: number) => void;
  save: () => Promise<SaveResult>;
}

/**
 * editing（編集対象の Character）または既定値から初期 draft を生成する。
 * 編集時は既存の複数写真 `photos` をそのまま初期化する（要件23.11）。
 */
function createInitialDraft(editing?: Character): CharacterDraft {
  if (editing) {
    return {
      name: editing.name,
      nickname: editing.nickname,
      memo: editing.memo,
      favoriteLevel: editing.favoriteLevel,
      photos: editing.photos,
      metOn: editing.metOn,
      imageColor: editing.imageColor,
      editingId: editing.id,
    };
  }
  return {
    name: '',
    nickname: '',
    memo: '',
    favoriteLevel: DEFAULT_FAVORITE_LEVEL,
    photos: [],
    imageColor: 'none',
  };
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
  const [photosTruncated, setPhotosTruncated] = useState<boolean>(false);
  const [storeError, setStoreError] = useState<StoreError | null>(null);

  const setField = useCallback(
    <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]): void => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const pickPhotos = useCallback(
    async (files: FileList | null): Promise<void> => {
      // キャンセル / ブロック（null または 0 件）: draft を破棄せず取得失敗を通知する
      // （要件23.6、要件1.11/8.3 の複数適用）。超過フラグはこの時点で解除する。
      setPhotosTruncated(false);
      if (files === null || files.length === 0) {
        setPhotoError({ kind: 'acquisitionFailed' });
        return;
      }

      const accepted: PhotoData[] = [];
      let lastError: PhotoError | null = null;

      // 各 File を個別に検証する。成功分は取り込み、非対応/過大/読み出し失敗は
      // 種別を保持する（成功分があっても最後のエラーは photoError に残す。要件23.6）。
      for (const file of Array.from(files)) {
        let result;
        try {
          result = await validateAndProcess(file);
        } catch {
          // 画像の読み出し（ArrayBuffer 変換）自体が失敗した場合（要件1.11, 8.3）。
          lastError = { kind: 'acquisitionFailed' };
          continue;
        }
        if (result.ok) {
          accepted.push(result.value);
        } else {
          lastError = result.error;
        }
      }

      // 成功分を既存 photos へ連結し 5 枚へ切り詰める（要件23.2, 23.3）。
      if (accepted.length > 0) {
        setDraft((prev) => {
          const { photos, truncated } = addPhotos(prev.photos, accepted);
          if (truncated) {
            setPhotosTruncated(true);
          }
          return { ...prev, photos };
        });
      }

      // 問題のあったファイルがあればその種別を残す。全て成功なら photoError はクリア。
      setPhotoError(lastError);
    },
    [],
  );

  const removePhoto = useCallback((index: number): void => {
    setPhotosTruncated(false);
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    setStoreError(null);
    setPhotosTruncated(false);

    // 写真が 0 枚（全削除含む）の場合もここで invalid となり保存を保留する（要件23.4, 23.13）。
    const errors = validate(draft);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return 'invalid';
    }
    setFieldErrors([]);

    const photos = draft.photos;
    const isEditing = draft.editingId !== undefined;

    // 出会った日を確定する（要件14.10）。空/形式不正/実在しない日/範囲外/未来日は
    // undefined（未設定）へ正規化される。イメージカラーは許容外を 'none' に落とす（要件15.2, 15.3）。
    const metOn = normalizeMetOn(draft.metOn, localToday());
    const imageColor = normalizeImageColor(draft.imageColor);

    if (!isEditing) {
      try {
        const current = await store.count();
        if (current >= CAPACITY_LIMIT) {
          setStoreError({ kind: 'capacityReached' });
          return 'storeError';
        }
      } catch (error) {
        setStoreError(readStoreError(error));
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
          photos,
          createdAt: editing?.createdAt ?? Date.now(),
          metOn,
          imageColor,
        };
        await store.update(character);
      } else {
        const character: Character = {
          id: generateId(),
          name: draft.name,
          nickname: draft.nickname,
          memo: draft.memo,
          favoriteLevel: draft.favoriteLevel,
          photos,
          createdAt: Date.now(),
          metOn,
          imageColor,
        };
        await store.insert(character);
      }
      return 'saved';
    } catch (error) {
      setStoreError(readStoreError(error));
      return 'storeError';
    }
  }, [draft, store, editing]);

  return {
    draft,
    fieldErrors,
    photoError,
    photosTruncated,
    storeError,
    setField,
    pickPhotos,
    removePhoto,
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
