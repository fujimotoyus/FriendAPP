/**
 * useCollection — キャラクター一覧（図鑑）の View-State（ViewModel 相当）
 *
 * Collection_View / CharacterDetailView が用いる hook（design.md「Hooks / View-State」）。
 * {@link CharacterStore} から全 Character を読み込み、並び順（sortOrder）に応じて
 * 並べ替えた一覧・読み込み状態・並び順の変更（setSortOrder）・再試行（reload）・
 * 削除（remove）を提供する。並べ替えはドメインの純粋関数 {@link sortCharacters} に委譲し、
 * 本 hook は Persistence 層の調停とビュー状態の保持のみを担う。並び順の変更は再フェッチを
 * 伴わず、保持済みデータの再ソートのみで行う（表示順のみ変更、ストア/データは不変。要件11.5, 11.6）。
 *
 * 設計方針:
 * - ストアは引数（DI）で受け取り、テスト時に {@link InMemoryCharacterStore} 等へ差し替え可能。
 *   省略時は共有シングルトン {@link defaultCharacterStore}（IndexedDB）を用いる。
 * - マウント時に一度読み込む（再オープン時の復元表示、要件3.6）。
 * - 読み込み失敗時は `loadState` を `'failed'` にし、それまでに読み込めていたデータは
 *   破棄せず保持する。`reload()` を再試行手段として提供する（要件2.9）。
 * - `remove(id)` は `CharacterStore.delete` の後に一覧を再読み込みして整合させる（要件6.7）。
 *
 * 参照: design.md「Hooks / View-State」「Error Handling」、要件2.1, 2.9, 3.6, 6.7
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Character, SortOrder } from '../domain/types';
import { sortCharacters } from '../domain/sortCharacters';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';

/**
 * 一覧の読み込み状態（design.md「Hooks / View-State」の `LoadState`）。
 * - `idle`:    初期化前（マウント直後、初回読み込み開始前）
 * - `loading`: 読み込み中
 * - `loaded`:  読み込み成功
 * - `failed`:  読み込み失敗（保持済みデータは破棄しない。要件2.9）
 */
export type LoadState = 'idle' | 'loading' | 'loaded' | 'failed';

/**
 * {@link useCollection} の戻り値。
 */
export interface UseCollectionResult {
  /**
   * 表示用の Character 一覧。現在の {@link sortOrder} に従って {@link sortCharacters}
   * で並べ替えた結果を返す（表示順のみ。ストア/データは不変。要件11.5, 11.6）。
   * 初期の並び順は `'name'`（名前の昇順）。要件2.1, 11.2
   */
  characters: Character[];
  /** 現在の読み込み状態。要件2.9 */
  loadState: LoadState;
  /** 現在の一覧の並び順（初期値 `'name'`）。要件11.1, 11.2 */
  sortOrder: SortOrder;
  /**
   * 一覧の並び順を変更する。再フェッチはせず、保持済みデータを並べ替えるのみ
   * （無駄な再読み込みを避ける。表示順のみ変更でストア/データは不変。要件11.5, 11.6）。
   */
  setSortOrder: (order: SortOrder) => void;
  /** 一覧を（再）読み込みする。読み込み失敗時の再試行手段。要件2.9, 3.6 */
  reload: () => Promise<void>;
  /** 指定 id の Character を削除し、一覧を再読み込みする。要件6.7 */
  remove: (id: string) => Promise<void>;
}

/**
 * キャラクター一覧の読み込み・削除・再試行を提供する hook。
 *
 * @param store 永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @returns 一覧・読み込み状態・再読み込み・削除。
 */
export function useCollection(
  store: CharacterStore = defaultCharacterStore,
): UseCollectionResult {
  // fetchAll で取得した元データ（並べ替え前）を内部に保持する。返す `characters` は
  // これに `sortCharacters` を適用した結果とし、並び順変更時は再フェッチせず再ソートのみ行う。
  const [source, setSource] = useState<Character[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [sortOrder, setSortOrder] = useState<SortOrder>('name');

  /**
   * ストアから全 Character を読み込み、状態を更新する。
   * 失敗時は `loadState` を `'failed'` にし、保持済みデータは変更しない（要件2.9）。
   */
  const reload = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const all = await store.fetchAll();
      setSource(all);
      setLoadState('loaded');
    } catch {
      // 読み込み失敗。既に読み込めていたデータは破棄せず保持する（要件2.9）。
      setLoadState('failed');
    }
  }, [store]);

  /**
   * 表示用の並べ替え済み一覧。元データ（source）と sortOrder のいずれかが変わったときのみ
   * 再計算する。表示順のみに作用し、ストア/元データは不変（要件11.5, 11.6）。
   */
  const characters = useMemo(
    () => sortCharacters(source, sortOrder),
    [source, sortOrder],
  );

  /**
   * 指定 id の Character を削除し、削除後の一覧を反映する（要件6.7）。
   * 削除に成功したら `reload()` で最新状態へ整合させる。削除自体が失敗した場合は
   * 例外を呼び出し側へ伝播する（画面側でメッセージ表示できるようにする）。
   */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      await store.delete(id);
      await reload();
    },
    [store, reload],
  );

  // マウント時に一度読み込む（再オープン時の復元表示。要件3.6）。
  useEffect(() => {
    void reload();
  }, [reload]);

  return { characters, loadState, sortOrder, setSortOrder, reload, remove };
}
