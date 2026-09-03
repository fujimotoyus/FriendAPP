/**
 * 保存が必ず失敗する Character_Store スタブ（テスト用）
 *
 * `insert` / `update` が常に指定した {@link StoreError} を throw する失敗スタブ。
 * 保存失敗時の原子性・入力保持（Property 7、要件1.12, 3.2, 8.4, 8.5）を検証する
 * テストで用いる。読み取り系（`fetchAll` / `count`）は任意の初期データを返す妥当な
 * 既定挙動を提供し、任意で内部の {@link InMemoryCharacterStore} へ委譲できる。
 *
 * エラーは {@link IndexedDbCharacterStore} と統一するため、同モジュールが export する
 * {@link StoreErrorException} ラッパを再利用して throw する。
 *
 * 参照: design.md「Testing Strategy（Property 7）」「Error Handling」、要件3.2, 8.4, 8.5
 */
import type { Character, StoreError } from '../domain/types';
import type { CharacterStore } from './CharacterStore';
import { StoreErrorException } from './IndexedDbCharacterStore';
import { InMemoryCharacterStore } from './InMemoryCharacterStore';

/**
 * 書き込み（`insert` / `update`）が常に失敗する {@link CharacterStore} スタブ。
 *
 * 読み取り（`fetchAll` / `count`）と `delete` は内部の {@link InMemoryCharacterStore}
 * へ委譲するため、保存失敗テストで「件数が変化しないこと」を確認できる。
 */
export class FailingCharacterStore implements CharacterStore {
  private readonly failWith: StoreError;
  private readonly backing: InMemoryCharacterStore;

  /**
   * @param failWith `insert` / `update` が throw する {@link StoreError}。
   *   既定は `{ kind: 'writeFailed' }`（要件8.5）。容量超過テストでは
   *   `{ kind: 'quotaExceeded' }` を渡す（要件8.4）。
   * @param seed 読み取り系が返す初期データ。内部ストアの初期化に用いる。
   */
  constructor(
    failWith: StoreError = { kind: 'writeFailed' },
    seed: readonly Character[] = [],
  ) {
    this.failWith = failWith;
    this.backing = new InMemoryCharacterStore(seed);
  }

  /**
   * 内部ストアの全 Character を `createdAt` 降順で返す（委譲）。
   */
  async fetchAll(): Promise<Character[]> {
    return this.backing.fetchAll();
  }

  /**
   * 常に失敗する。設定された {@link StoreError} を throw し、内部状態は変更しない
   * （保存失敗の原子性、要件1.12, 3.2, 8.4, 8.5）。
   *
   * @throws StoreErrorException 構築時に指定した {@link StoreError}。
   */
  async insert(_character: Character): Promise<void> {
    throw new StoreErrorException(this.failWith);
  }

  /**
   * 常に失敗する。設定された {@link StoreError} を throw し、内部状態は変更しない。
   *
   * @throws StoreErrorException 構築時に指定した {@link StoreError}。
   */
  async update(_character: Character): Promise<void> {
    throw new StoreErrorException(this.failWith);
  }

  /**
   * 内部ストアから削除する（委譲）。書き込み失敗の対象外。
   */
  async delete(id: string): Promise<void> {
    return this.backing.delete(id);
  }

  /**
   * 内部ストアのレコード数を返す（委譲）。保存失敗後も件数が不変であることの確認に使う。
   */
  async count(): Promise<number> {
    return this.backing.count();
  }
}
