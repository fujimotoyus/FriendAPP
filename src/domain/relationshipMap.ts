/**
 * relationshipMap — キャラ相関図（Relationship_Map）の関係生成（純粋 TypeScript）
 *
 * 登録済み Character 集合から、既存フィールド（`imageColor` / `metOn` / `favoriteLevel`）
 * のみを用いて 3 軸（`same-color` / `same-period` / `same-favorite`）の無向スコア付き
 * エッジ（Relationship_Edge）を **決定的** に生成する。副作用を持たず、入力の `characters`
 * 配列および各 Character オブジェクトを一切変更しない読み取り専用の純粋関数。
 * `Math.random()` は用いず、外部サーバーへの送信も行わない（端末内完結・要件22.16, 22.17, 3.8）。
 *
 * 手順（すべて決定的）:
 *   1. すべての無向ペア（i < j で id 昇順に正規化 = a < b）について 3 軸を判定する。
 *      - same-color   : ca.imageColor === cb.imageColor かつ 'none' でない（要件22.2, 22.3）
 *      - same-period  : ca/cb の metOn がともに設定済み（undefined でない）かつ
 *                       年月（先頭 'YYYY-MM'）が一致（要件22.4, 22.5）
 *      - same-favorite: ca.favoriteLevel === cb.favoriteLevel（同値）。両者 >= 4 なら
 *                       ラベル「両想い級」、それ以外の同値なら「気になる存在」（要件22.6〜22.8）
 *   2. 該当軸が 1 つ以上あるペアを 1 本のエッジに集約し、該当軸の基準スコアを合算する（要件22.9）。
 *      基準スコア（決定的）: same-favorite(両想い級)=4, same-color=3, same-period=2,
 *      same-favorite(気になる存在)=1。代表ラベル（label）は軸優先順位
 *      （same-favorite(両想い級) > same-color > same-period > same-favorite(気になる存在)）で
 *      最上位の軸のラベルを採用する。axes は判定順（same-color, same-period, same-favorite）で保持する。
 *   3. 各ノード（Character）視点で、接続エッジをスコア降順（同点は相手 id 昇順）で並べ、上位3本を
 *      「採用候補」とする。両端のノードでともに上位3本（採用候補）に入るエッジのみを最終エッジとして
 *      採用する（両端合意方式）。これにより各ノードの次数は 3 以下になる（要件22.10, 22.11, 22.12）。
 *   4. 自己ループ（i === j）は生成しない。エッジは常に相異なる 2 件を結ぶ無向関係（a < b、要件22.13）。
 *   返り値の edges は決定的な順序（a 昇順 → b 昇順）に整列して返す。
 *
 * 参照: design.md「イテレーション14（キャラ相関図、要件22）」「buildRelationshipMap」、
 * 要件22.1〜22.13, 22.16, 22.17、Correctness Property 30〜32
 */

import type {
  Character,
  RelationshipAxis,
  RelationshipEdge,
  RelationshipMap,
} from './types';

/** 各ノードに残せるエッジ本数の上限（次数上限）。要件22.10 */
const MAX_DEGREE = 3;

/** 関係ラベル文言（Relationship_Label）。要件22.9 */
const LABEL_MUTUAL = '両想い級'; // same-favorite で両者 >= 4
const LABEL_COLOR = 'おそろいカラー'; // same-color
const LABEL_PERIOD = '同期'; // same-period
const LABEL_CRUSH = '気になる存在'; // same-favorite で上記以外の同値

/** お気に入り度の「両想い級」しきい値（この値以上の同値で両想い級）。要件22.7 */
const MUTUAL_FAVORITE_THRESHOLD = 4;

/** 基準スコア（決定的）。要件22.9 */
const SCORE_MUTUAL = 4; // same-favorite（両想い級）
const SCORE_COLOR = 3; // same-color
const SCORE_PERIOD = 2; // same-period
const SCORE_CRUSH = 1; // same-favorite（気になる存在）

/**
 * metOn の年月（`YYYY-MM`、先頭 7 文字）を返す。未設定（undefined）は null。
 * 入力は正規化済みの `YYYY-MM-DD` を前提とする（`normalizeMetOn` 通過値）。
 */
function yearMonth(metOn: string | undefined): string | null {
  if (metOn === undefined) {
    return null;
  }
  return metOn.slice(0, 7);
}

/** 2 件の Character が same-favorite で「両想い級」条件（両者 >= 4）を満たすか。 */
function isMutualFavorite(ca: Character, cb: Character): boolean {
  return (
    ca.favoriteLevel >= MUTUAL_FAVORITE_THRESHOLD &&
    cb.favoriteLevel >= MUTUAL_FAVORITE_THRESHOLD
  );
}

/**
 * 2 件の Character（すでに a < b に正規化済み）から関係エッジを導出する。
 * 該当軸が 1 つもなければ null（エッジを作らない）。
 */
function deriveEdge(a: string, b: string, ca: Character, cb: Character): RelationshipEdge | null {
  const axes: RelationshipAxis[] = [];
  let score = 0;

  // 軸判定は判定順（same-color, same-period, same-favorite）で行い、axes もこの順で保持する。
  const sameColor = ca.imageColor === cb.imageColor && ca.imageColor !== 'none';
  const ym = yearMonth(ca.metOn);
  const samePeriod = ym !== null && ym === yearMonth(cb.metOn);
  const sameFavorite = ca.favoriteLevel === cb.favoriteLevel;
  const mutual = sameFavorite && isMutualFavorite(ca, cb);

  if (sameColor) {
    axes.push('same-color');
    score += SCORE_COLOR;
  }
  if (samePeriod) {
    axes.push('same-period');
    score += SCORE_PERIOD;
  }
  if (sameFavorite) {
    axes.push('same-favorite');
    score += mutual ? SCORE_MUTUAL : SCORE_CRUSH;
  }

  if (axes.length === 0) {
    return null;
  }

  // 代表ラベル（label）: 軸優先順位で最上位の軸のラベルを採用する（要件22.9）。
  //   同期(両想い級) > おそろいカラー > 同期 > 気になる存在
  let label: string;
  if (sameFavorite && mutual) {
    label = LABEL_MUTUAL;
  } else if (sameColor) {
    label = LABEL_COLOR;
  } else if (samePeriod) {
    label = LABEL_PERIOD;
  } else {
    // ここに来るのは sameFavorite（気になる存在）のみが該当するケース。
    label = LABEL_CRUSH;
  }

  return { a, b, axes, score, label };
}

/**
 * エッジをノード視点で並べるための比較。スコア降順 → 相手 id 昇順（要件22.11）。
 * `self` はこのノードの id で、相手 id を比較する。
 */
function compareForNode(self: string, x: RelationshipEdge, y: RelationshipEdge): number {
  if (x.score !== y.score) {
    return y.score - x.score; // スコア降順
  }
  const otherX = x.a === self ? x.b : x.a;
  const otherY = y.a === self ? y.b : y.a;
  if (otherX < otherY) return -1;
  if (otherX > otherY) return 1;
  return 0;
}

/**
 * 登録済み Character 集合から相関図（Relationship_Map）を決定的に生成する。
 * 副作用なし・入力を変更しない純粋関数。
 *
 * @param characters 登録済み Character の読み取り専用配列
 * @returns 次数上限3・両端合意を満たす最終エッジ（a 昇順 → b 昇順）を持つ相関図
 */
export function buildRelationshipMap(characters: readonly Character[]): RelationshipMap {
  // 0/1 件では関係を作れない（要件22.14）。
  if (characters.length < 2) {
    return { edges: [] };
  }

  // 1. 全無向ペアを生成し、a < b（id 昇順）に正規化して軸判定・集約する。
  const candidateEdges: RelationshipEdge[] = [];
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const ci = characters[i];
      const cj = characters[j];
      // id 昇順に (a, b) を決める。自己ループ（同一 id）は作らない。
      if (ci.id === cj.id) {
        continue;
      }
      const [ca, cb] = ci.id < cj.id ? [ci, cj] : [cj, ci];
      const edge = deriveEdge(ca.id, cb.id, ca, cb);
      if (edge !== null) {
        candidateEdges.push(edge);
      }
    }
  }

  // 3. 各ノード視点で上位3本を採用候補とし、両端合意のエッジのみ最終採用する。
  //    ノードごとに接続エッジをスコア降順→相手 id 昇順で並べ、上位3本の集合を作る。
  const acceptedByNode = new Map<string, Set<RelationshipEdge>>();
  const incident = new Map<string, RelationshipEdge[]>();
  const addIncident = (node: string, edge: RelationshipEdge): void => {
    const list = incident.get(node);
    if (list === undefined) {
      incident.set(node, [edge]);
    } else {
      list.push(edge);
    }
  };
  for (const edge of candidateEdges) {
    addIncident(edge.a, edge);
    addIncident(edge.b, edge);
  }
  for (const [node, edges] of incident) {
    const sorted = edges.slice().sort((x, y) => compareForNode(node, x, y));
    const top = new Set(sorted.slice(0, MAX_DEGREE));
    acceptedByNode.set(node, top);
  }

  // 両端のノードでともに上位3本に入るエッジのみを最終エッジとして採用する（両端合意方式）。
  const finalEdges = candidateEdges.filter((edge) => {
    const aTop = acceptedByNode.get(edge.a);
    const bTop = acceptedByNode.get(edge.b);
    return aTop !== undefined && bTop !== undefined && aTop.has(edge) && bTop.has(edge);
  });

  // 6. a 昇順 → b 昇順で決定的に整列して返す。
  finalEdges.sort((x, y) => {
    if (x.a < y.a) return -1;
    if (x.a > y.a) return 1;
    if (x.b < y.b) return -1;
    if (x.b > y.b) return 1;
    return 0;
  });

  return { edges: finalEdges };
}
