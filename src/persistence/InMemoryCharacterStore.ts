/**
 * インメモリ（Map ベース）による Character_Store 実装（テスト用）
 *
 * IndexedDB を用いずにメモリ上の {@link Map} で Character を保持する。
 * property-based testing / ユニットテストで {@link IndexedDbCharacterStore} を
 * 差し替えるために用いる（design.md「Persistence インターフェース」「Testing Strategy」）。
 *
 * エラーは {@link IndexedDbCharacterStore} と統一するため、同モジュールが export する
 * {@link StoreErrorException} ラッパを再利用して throw する。これにより hooks 層の
 * エラーハンドリングは実装差異を意識せずに済む。
 *
 * 参照: design.md「Persistence Design」「Testing Strategy（Property 5, 6, 8, 9）」、
 *       要件2.1, 2.2, 3.2, 6.3, 6.7, 8.4, 8.5
 */
import type { Character } from '../domain/types';
import type { CharacterStore } from './CharacterStore';
import { StoreErrorException } from './IndexedDbCharacterStore';

/** 保持可能な Character の上限（要件2.2）。実ストアと同じ値でミラーする。 */
const CAPACITY_LIMIT = 1000;

/**
 * {@link CharacterStore} のインメモリ実装。
 *
 * id をキーとする {@link Map} で Character を保持する。挿入順に依存せず、
 * `fetchAll` は都度 `createdAt` 降順に整列して返す。
 */
export class InMemoryCharacterStore implements CharacterStore {
  private readonly characters: Map<string, Character>;

  /**
   * @param seed テストの初期データ。渡された Character 群で Map を初期化する
   *   （id をキーに格納。id が重複する場合は後勝ち）。省略時は空。
   */
  constructor(seed: readonly Character[] = []) {
    this.characters = new Map(seed.map((character) => [character.id, character]));
  }

  /**
   * 全 Character を `createdAt` 降順（新しい順）で返す（要件2.1）。
   * 実ストアと同様に、入力集合の並べ替えのみを行い要素の過不足はない（Property 9）。
   */
  async fetchAll(): Promise<Character[]> {
    return [...this.characters.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 新しい Character を保存する。
   * 実ストアと同じ上限 1,000 件を保存前に確認し、到達時は `capacityReached` を throw する（要件2.2）。
   *
   * @throws StoreErrorException `{ kind: 'capacityReached' }` 上限到達時。
   */
  async insert(character: Character): Promise<void> {
    if (this.characters.size >= CAPACITY_LIMIT) {
      throw new StoreErrorException({ kind: 'capacityReached' });
    }
    this.characters.set(character.id, character);
  }

  /**
   * 既存 Character を上書き更新する（同一 `id` を上書き）。件数は不変（要件6.3, 6.4）。
   * id が存在しない場合も Map に追加されるが、更新ユースケースでは既存 id を渡す前提。
   */
  async update(character: Character): Promise<void> {
    this.characters.set(character.id, character);
  }

  /**
   * 指定 id の Character を削除する（要件6.7）。対象が存在しない場合は何もしない。
   */
  async delete(id: string): Promise<void> {
    this.characters.delete(id);
  }

  /**
   * 保存済みレコード数を返す（上限判定に使用）。
   */
  async count(): Promise<number> {
    return this.characters.size;
  }
}
