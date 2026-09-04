/**
 * IndexedDB による Character_Store の既定実装（idb 経由）
 *
 * `idb` の薄い Promise ラッパを用いて IndexedDB に Character を永続化する。
 * 写真は ArrayBuffer(バイト列)+MIME（{@link PhotoData}）として `Character.photo` に格納する。
 * IndexedDB に Blob/File を直接保存すると iOS WebKit の既知バグ
 * （UnknownError: Error preparing Blob/File data...）で保存に失敗するため、ArrayBuffer で保存する。
 * 旧バージョンで Blob として保存された写真は fetchAll 読み出し時に PhotoData へ正規化する。
 * IndexedDB / idb の例外はすべて {@link StoreError} に正規化して throw する。
 *
 * 参照: design.md「Persistence Design」「Data Models / IndexedDB オブジェクトストアスキーマ」、
 *       要件2.1, 2.2, 3.1, 3.2, 3.3, 3.6, 6.3, 6.7, 8.4, 8.5
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Character, PhotoData, StoreError } from '../domain/types';
import type { CharacterStore } from './CharacterStore';

/**
 * 読み出した Character の photo を {@link PhotoData} 形（ArrayBuffer + MIME）へ正規化する。
 *
 * 旧バージョンでは写真を `Blob` として保存していたため、IndexedDB に Blob が残っている
 * 可能性がある。読み出し時に以下のように正規化して、旧データでも表示が壊れないようにする:
 * - 既に PhotoData 形（data:ArrayBuffer, type:string）ならそのまま。
 * - Blob なら `{ data: await blob.arrayBuffer(), type: blob.type }` へ変換する。
 * - それ以外（想定外）は空の PhotoData として扱い、プレースホルダー表示に委ねる。
 */
async function normalizePhoto(photo: unknown): Promise<PhotoData> {
  // 既に PhotoData 形（ArrayBuffer + type）ならそのまま返す。
  if (
    photo != null &&
    typeof photo === 'object' &&
    'data' in photo &&
    (photo as { data?: unknown }).data instanceof ArrayBuffer
  ) {
    const p = photo as { data: ArrayBuffer; type?: unknown };
    return { data: p.data, type: typeof p.type === 'string' ? p.type : '' };
  }

  // 旧データ: Blob として保存されていた写真を ArrayBuffer へ変換する。
  if (typeof Blob !== 'undefined' && photo instanceof Blob) {
    return { data: await photo.arrayBuffer(), type: photo.type };
  }

  // 想定外の値は空の PhotoData として扱う（PhotoFrame がプレースホルダー表示）。
  return { data: new ArrayBuffer(0), type: '' };
}

/**
 * 読み出した Character の photo を正規化した新しい Character を返す。
 */
async function normalizeCharacter(character: Character): Promise<Character> {
  const photo = await normalizePhoto((character as { photo?: unknown }).photo);
  return { ...character, photo };
}

/** データベース名（design.md「IndexedDB スキーマとバージョニング」）。 */
const DB_NAME = 'chara-collection';
/** スキーマバージョン。初版は 1（単一ストア）。 */
const DB_VERSION = 1;
/** オブジェクトストア名。 */
const STORE_NAME = 'characters';
/** `createdAt` を対象とするインデックス名（降順取得・並び替えに使用）。 */
const CREATED_AT_INDEX = 'by-createdAt';
/** 保持可能な Character の上限（要件2.2）。 */
const CAPACITY_LIMIT = 1000;

/**
 * `chara-collection` データベースの型付きスキーマ。
 * `characters` ストアは `keyPath: 'id'`、`by-createdAt` インデックスを持つ。
 */
interface CharaCollectionDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: Character;
    indexes: { [CREATED_AT_INDEX]: number };
  };
}

/**
 * `StoreError` を生成するヘルパ。判別可能ユニオンを throw 可能にする薄いラッパ。
 * 例外オブジェクトとして識別できるよう `Error` を継承する。
 */
class StoreErrorException extends Error {
  constructor(readonly storeError: StoreError) {
    super(storeError.kind);
    this.name = 'StoreError';
  }
}

/**
 * 与えられた値が `StoreError` を包む例外かどうかを判定する。
 */
function isStoreErrorException(value: unknown): value is StoreErrorException {
  return value instanceof StoreErrorException;
}

/**
 * 書き込み系の例外を `StoreError` に正規化する。
 * `QuotaExceededError`（容量超過）は `quotaExceeded`、それ以外は `writeFailed`。
 *
 * 参照: 要件3.2, 8.4, 8.5
 */
function toWriteStoreError(error: unknown): StoreError {
  if (isQuotaExceeded(error)) {
    return { kind: 'quotaExceeded', detail: describeError(error) };
  }
  return { kind: 'writeFailed', detail: describeError(error) };
}

/**
 * 【一時デバッグ】元例外の name / message を文字列化する。原因確定後に削除する。
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
 * 例外が IndexedDB の容量超過（`QuotaExceededError`）かどうかを判定する。
 * ブラウザ差異を吸収するため `name` 一致でも判定する。
 */
function isQuotaExceeded(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError';
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'QuotaExceededError'
  );
}

/**
 * IndexedDB を用いた {@link CharacterStore} の実装。
 *
 * DB 接続は遅延生成し、同一インスタンス内で使い回す。
 */
export class IndexedDbCharacterStore implements CharacterStore {
  private dbPromise: Promise<IDBPDatabase<CharaCollectionDB>> | null = null;

  /**
   * DB 接続を取得（初回のみ `openDB` を実行し、以降はキャッシュを返す）。
   * `upgrade` で `characters` ストアと `by-createdAt` インデックスを作成する。
   */
  private getDb(): Promise<IDBPDatabase<CharaCollectionDB>> {
    if (this.dbPromise === null) {
      this.dbPromise = openDB<CharaCollectionDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex(CREATED_AT_INDEX, 'createdAt');
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * 全 Character を `createdAt` 降順（新しい順）で返す（要件2.1, 3.6）。
   * `by-createdAt` インデックスで昇順取得し、反転して降順化する。
   *
   * @throws StoreError `{ kind: 'loadFailed' }` 読み込みに失敗した場合。
   */
  async fetchAll(): Promise<Character[]> {
    try {
      const db = await this.getDb();
      const ascending = await db.getAllFromIndex(STORE_NAME, CREATED_AT_INDEX);
      // インデックスは createdAt 昇順で返すため、反転して降順にする。
      const descending = ascending.reverse();
      // 各 photo を PhotoData へ正規化（旧 Blob データの後方互換）。
      return await Promise.all(descending.map((c) => normalizeCharacter(c)));
    } catch {
      throw new StoreErrorException({ kind: 'loadFailed' });
    }
  }

  /**
   * 新しい Character を保存する（要件3.1, 3.3）。
   * 保存前に上限 1,000 件を確認し、到達時は保存しない（要件2.2）。
   *
   * @throws StoreError `{ kind: 'capacityReached' }` 上限到達時。
   * @throws StoreError `{ kind: 'quotaExceeded' }` 容量超過時（要件3.2, 8.4）。
   * @throws StoreError `{ kind: 'writeFailed' }` その他の書き込み失敗時（要件3.2, 8.5）。
   */
  async insert(character: Character): Promise<void> {
    // 上限判定は保存前に行う。件数取得の失敗は読み込み失敗として扱う。
    let current: number;
    try {
      const db = await this.getDb();
      current = await db.count(STORE_NAME);
    } catch {
      throw new StoreErrorException({ kind: 'loadFailed' });
    }

    if (current >= CAPACITY_LIMIT) {
      throw new StoreErrorException({ kind: 'capacityReached' });
    }

    try {
      const db = await this.getDb();
      await db.add(STORE_NAME, character);
    } catch (error) {
      throw new StoreErrorException(toWriteStoreError(error));
    }
  }

  /**
   * 既存 Character を上書き更新する（同一 `id` を `put`）。件数は不変（要件6.3, 6.4）。
   *
   * @throws StoreError `{ kind: 'quotaExceeded' }` 容量超過時。
   * @throws StoreError `{ kind: 'writeFailed' }` その他の書き込み失敗時。
   */
  async update(character: Character): Promise<void> {
    try {
      const db = await this.getDb();
      await db.put(STORE_NAME, character);
    } catch (error) {
      throw new StoreErrorException(toWriteStoreError(error));
    }
  }

  /**
   * 指定 id の Character を削除する（要件6.7）。
   *
   * @throws StoreError `{ kind: 'writeFailed' }` 削除に失敗した場合。
   */
  async delete(id: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.delete(STORE_NAME, id);
    } catch {
      throw new StoreErrorException({ kind: 'writeFailed' });
    }
  }

  /**
   * 保存済みレコード数を返す（上限判定に使用）。
   *
   * @throws StoreError `{ kind: 'loadFailed' }` 件数取得に失敗した場合。
   */
  async count(): Promise<number> {
    try {
      const db = await this.getDb();
      return await db.count(STORE_NAME);
    } catch {
      throw new StoreErrorException({ kind: 'loadFailed' });
    }
  }
}

export { StoreErrorException, isStoreErrorException };
