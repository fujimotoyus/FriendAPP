/**
 * useRelationshipMap — キャラ相関図（Relationship_Map）の読み取り専用 View-State
 *
 * RelationshipMapView が用いる hook（design.md「Hooks / View-State」）。
 * {@link CharacterStore} から全 Character を読み込み、ドメインの純粋関数
 * {@link buildRelationshipMap} で id ベースの関係エッジ（{@link RelationshipEdge}）を
 * 決定的に導出したのち、各 id を取得済み Character へ解決して
 * `edges: ResolvedRelationshipEdge[]` として公開する。本 hook は Persistence 層の
 * 読み取り（`fetchAll`）とビュー状態の保持のみを担い、Character_Store のデータを
 * 一切変更しない読み取り専用の view-state である（要件22.16）。導出は端末内の
 * 純粋関数のみで行い、外部サーバーへ送信しない（要件22.17, 3.8）。
 *
 * 設計方針（{@link useCollection} と同一の慣習に合わせる）:
 * - ストアは引数（DI）で受け取り、テスト時に {@link InMemoryCharacterStore} 等へ
 *   差し替え可能。省略時は共有シングルトン {@link defaultCharacterStore}（IndexedDB）。
 * - マウント時に一度読み込む（再オープン時の復元表示。要件3.6）。
 * - 読み込み失敗時は `loadState` を `'failed'` にし、それまでに読み込めていた
 *   データ（characters / edges）は破棄せず保持する。`reload()` を再試行手段として
 *   提供する（要件2.9, 22.16）。
 * - Character が 0/1 件なら `hasEnough=false` かつ `edges=[]`（空状態は UI が表示、
 *   要件22.14）。2 件以上でも関係が無ければ `edges=[]`（関係なしの空状態は UI が
 *   表示、要件22.15）。
 *
 * 参照: design.md「Hooks / View-State」「イテレーション14（キャラ相関図、要件22）」、
 * 要件22.1, 22.14, 22.15, 22.16, 22.17, 2.9, 3.6, 3.8
 */
import { useCallback, useEffect, useState } from 'react';
import type { Character, ResolvedRelationshipEdge } from '../domain/types';
import { buildRelationshipMap } from '../domain/relationshipMap';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';
import type { LoadState } from './useCollection';

/** 関係を作るために必要な最小の Character 件数。1 件以下では関係を作れない（要件22.14）。 */
const MIN_CHARACTERS_FOR_MAP = 2;

/**
 * {@link useRelationshipMap} の戻り値（design.md「Hooks / View-State」の定義に一致）。
 */
export interface UseRelationshipMapResult {
  /** 現在の読み込み状態。要件2.9, 22.16 */
  loadState: LoadState;
  /** 取得済みの全 Character（ノード解決用）。要件22.1 */
  characters: Character[];
  /**
   * 関係エッジ（id を Character へ解決済み）。Character が 0/1 件、または 2 件以上でも
   * 関係が無い場合は空配列。要件22.1, 22.14, 22.15
   */
  edges: ResolvedRelationshipEdge[];
  /** Character が 2 件以上か（1 件以下なら関係を作れない）。要件22.14 */
  hasEnough: boolean;
  /** 相関図を（再）読み込みする。読み込み失敗時の再試行手段。要件2.9, 3.6, 22.16 */
  reload: () => Promise<void>;
}

/**
 * キャラ相関図（Relationship_Map）の読み取り専用 view-state を提供する hook。
 *
 * @param store 永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @returns 読み込み状態・取得済み Character・解決済み関係エッジ・件数十分フラグ・再読み込み。
 */
export function useRelationshipMap(
  store: CharacterStore = defaultCharacterStore,
): UseRelationshipMapResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [edges, setEdges] = useState<ResolvedRelationshipEdge[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');

  /**
   * ストアから全 Character を読み込み（読み取りのみ・要件22.16）、
   * {@link buildRelationshipMap} で id ベースの関係エッジを決定的に導出し、
   * 各 id を取得済み Character へ解決して状態を更新する（要件22.1）。
   * 失敗時は `loadState` を `'failed'` にし、保持済みデータは変更しない（要件2.9）。
   */
  const reload = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const all = await store.fetchAll();

      // id → Character の解決表を作る。
      const byId = new Map<string, Character>();
      for (const c of all) {
        byId.set(c.id, c);
      }

      // id ベースの関係エッジを純粋関数で決定的に導出する（端末内・外部送信なし。要件22.17, 3.8）。
      const { edges: idEdges } = buildRelationshipMap(all);

      // 各 id を Character へ解決する。防御的に、解決できない id を含むエッジはスキップする
      // （buildRelationshipMap は入力 id のみを返す前提のため基本発生しない。安全側の措置）。
      const resolved: ResolvedRelationshipEdge[] = [];
      for (const edge of idEdges) {
        const ca = byId.get(edge.a);
        const cb = byId.get(edge.b);
        if (ca === undefined || cb === undefined) {
          continue;
        }
        resolved.push({
          a: ca,
          b: cb,
          axes: edge.axes,
          score: edge.score,
          label: edge.label,
        });
      }

      setCharacters(all);
      setEdges(resolved);
      setLoadState('loaded');
    } catch {
      // 読み込み失敗。既に読み込めていたデータは破棄せず保持する（要件2.9, 22.16）。
      setLoadState('failed');
    }
  }, [store]);

  // マウント時に一度読み込む（再オープン時の復元表示。要件3.6）。
  useEffect(() => {
    void reload();
  }, [reload]);

  const hasEnough = characters.length >= MIN_CHARACTERS_FOR_MAP;

  return { loadState, characters, edges, hasEnough, reload };
}
