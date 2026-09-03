/**
 * 永続化抽象（Character_Store インターフェース）
 *
 * キャラクターデータの永続化を抽象化し、実装（IndexedDB）とテスト（インメモリ）を
 * 差し替え可能にする（design.md「Persistence インターフェース」参照）。
 * すべての操作は非同期（`Promise`）で定義する。
 *
 * 参照: design.md「Components and Interfaces / Persistence インターフェース」、
 *       「Persistence Design」、要件2.1, 2.2, 3.1, 3.3, 6.3, 6.7
 */
import type { Character } from '../domain/types';

/**
 * キャラクターデータを端末内に永続化する保存機構の抽象。
 *
 * 既定実装は {@link ./IndexedDbCharacterStore.IndexedDbCharacterStore}（idb 経由）、
 * テスト時は InMemoryCharacterStore に差し替える。
 */
export interface CharacterStore {
  /**
   * 保存された全 Character を取得する。
   * 結果は `createdAt` の降順（新しい順）に整列される（要件2.1）。
   *
   * @throws StoreError `{ kind: 'loadFailed' }` 読み込みに失敗した場合。
   */
  fetchAll(): Promise<Character[]>;

  /**
   * 新しい Character を保存する。
   * 保存前に上限（1,000 件）を確認し、到達している場合は保存しない（要件2.2）。
   *
   * @throws StoreError `{ kind: 'capacityReached' }` 上限 1,000 件に達している場合。
   * @throws StoreError `{ kind: 'quotaExceeded' }` ストレージ容量超過の場合（要件3.2）。
   * @throws StoreError `{ kind: 'writeFailed' }` その他の書き込み失敗の場合（要件3.2）。
   */
  insert(character: Character): Promise<void>;

  /**
   * 既存の Character を上書き更新する（同一 `id` を `put`）。写真差し替えを含む。
   * 件数は変化しない（要件6.3, 6.4）。
   *
   * @throws StoreError `{ kind: 'quotaExceeded' }` ストレージ容量超過の場合。
   * @throws StoreError `{ kind: 'writeFailed' }` その他の書き込み失敗の場合。
   */
  update(character: Character): Promise<void>;

  /**
   * 指定 id の Character を削除する（要件6.7）。
   *
   * @throws StoreError `{ kind: 'writeFailed' }` 削除に失敗した場合。
   */
  delete(id: string): Promise<void>;

  /**
   * 保存済みレコード数を返す（上限 1,000 件判定に用いる）。
   *
   * @throws StoreError `{ kind: 'loadFailed' }` 件数取得に失敗した場合。
   */
  count(): Promise<number>;
}
