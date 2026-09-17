/**
 * relationshipMap — キャラ相関図（Relationship_Map）の関係生成（純粋 TypeScript）
 *
 * 登録済み Character 集合から、各 Character の **id（および id 集合）のみ** を用いて
 * 無向の線（Relationship_Edge）を **決定的** に生成する。登録データの内容
 * （`imageColor` / `metOn` / `favoriteLevel`）には一切依存しない（要件22.3）。
 * 副作用を持たず、入力の `characters` 配列および各 Character オブジェクトを一切変更しない
 * 読み取り専用の純粋関数。`Math.random()` は用いず、外部サーバーへの送信も行わない
 * （端末内完結・要件22.13, 22.14, 3.8）。
 *
 * ハッシュは既存 `DailyPickSelector` と同じ FNV-1a 32bit（{@link fnv1a32}）を流用する。
 *
 * 手順（すべて決定的・id のみ依存）:
 *   1. すべての無向ペア（i < j、id 昇順に正規化して a < b、a === b は作らない）について、
 *      以下を id から求める。
 *      - 関係タグ tag: `TAGS[fnv1a32(a + '\u0000' + b) mod 5]`（要件22.2, 22.3）。
 *      - 向きあり印象: `impressionAtoB = IMPRESSIONS[fnv1a32(a + '>' + b) mod len]`、
 *        `impressionBtoA = IMPRESSIONS[fnv1a32(b + '>' + a) mod len]`（要件22.4〜22.6）。
 *        a→b と b→a は入力が異なるため一般に別の一言になりうる。
 *      - つながりスコア score: `fnv1a32(CONNECT_SALT + a + '\u0000' + b)`
 *        （関係タグ選択とは別 salt、登録データ非依存、要件22.7）。
 *   2. どの線を残すか（各ノード最大3本、要件22.7, 22.8）: 各ノード視点で接続する線を
 *      score 降順（同点は相手 id 昇順）で並べ、上位3本を「採用候補」とする。両端のノードで
 *      ともに上位3本（採用候補）に入る線のみを最終の線として採用する（両端合意方式）。
 *      これにより各ノードの次数は 3 以下になり、取捨は決定的（要件22.8, 22.9）。
 *   3. 自己ループ（i === j）は生成しない。線は常に相異なる 2 件を結ぶ無向関係（a < b、要件22.10）。
 *   返り値の edges は決定的な順序（a 昇順 → b 昇順）に整列して返す（要件22.9）。
 *   全 Character が 0/1 件のときは edges は空（要件22.11）。
 *
 * 参照: design.md「イテレーション14（キャラ相関図、要件22）」「buildRelationshipMap」、
 * 要件22.1〜22.14、Correctness Property 30〜32
 */

import type { Character, RelationshipEdge, RelationshipMap, RelationshipTag } from './types';
import { fnv1a32 } from './DailyPickSelector';

/** 各ノードに残せる線の本数の上限（次数上限）。要件22.7 */
const MAX_DEGREE = 3;

/**
 * 関係タグの固定順（`fnv1a32(a + '\u0000' + b) mod 5` のインデックスに対応）。要件22.2
 * 順序を変えると既存の割り当てが変わるため、固定の並びを維持する。
 */
export const TAGS: readonly RelationshipTag[] = [
  'friend',
  'rival',
  'fighting',
  'crush',
  'buddy',
];

/**
 * 向きあり印象のテンプレート集（要件22.4, 22.5）。
 *
 * かわいい内輪ノリの非空の短文。名前を含まないため、名前が空の Character でも成立する。
 * `fnv1a32(from + '>' + to) mod IMPRESSIONS.length` で 1 つを決定的に選ぶ。
 * 順序を変えると既存の割り当てが変わるため、固定の並びを維持する。
 */
export const IMPRESSIONS: readonly string[] = [
  'あこがれてる',
  'ちょっと気になる',
  'いつも一緒にいたい',
  '実はライバル視してる',
  'なんだか放っておけない',
  '話してみたい',
  'いてくれると安心する',
  'ひそかに応援してる',
  'つい目で追っちゃう',
  '一緒にいると楽しい',
  'そばにいたい',
  '内心すごいと思ってる',
];

/**
 * つながりスコア用の salt（関係タグ選択の入力と衝突しないための接頭辞）。要件22.7
 * 末尾の `\u0000` により id との境界を明確にする。
 */
const CONNECT_SALT = 'score\u0000';

/**
 * 無向ペア（a < b 正規化済み）の関係タグを id のみから決定的に選ぶ。要件22.2, 22.3
 */
export function pickTag(a: string, b: string): RelationshipTag {
  return TAGS[fnv1a32(`${a}\u0000${b}`) % TAGS.length];
}

/**
 * 有向 (from, to) の向きあり印象を id のみから決定的に選ぶ。非空。要件22.4〜22.6
 */
export function pickImpression(from: string, to: string): string {
  return IMPRESSIONS[fnv1a32(`${from}>${to}`) % IMPRESSIONS.length];
}

/**
 * 無向ペア（a < b 正規化済み）のつながりスコアを id のみから決定的に計算する。要件22.7, 22.8
 */
export function connectScore(a: string, b: string): number {
  return fnv1a32(`${CONNECT_SALT}${a}\u0000${b}`);
}

/**
 * 線をノード視点で並べるための比較。score 降順 → 相手 id 昇順（要件22.7, 22.8）。
 * `self` はこのノードの id で、相手 id を比較する。
 */
function compareForNode(self: string, x: RelationshipEdge, y: RelationshipEdge): number {
  if (x.score !== y.score) {
    return y.score - x.score; // score 降順
  }
  const otherX = x.a === self ? x.b : x.a;
  const otherY = y.a === self ? y.b : y.a;
  if (otherX < otherY) return -1;
  if (otherX > otherY) return 1;
  return 0;
}

/**
 * 登録済み Character 集合から相関図（Relationship_Map）を決定的に生成する。
 * 各 Character の id（および id 集合）のみを用い、登録データには一切依存しない。
 * 副作用なし・入力を変更しない純粋関数。
 *
 * @param characters 登録済み Character の読み取り専用配列
 * @returns 次数上限3・両端合意を満たす最終の線（a 昇順 → b 昇順）を持つ相関図
 */
export function buildRelationshipMap(characters: readonly Character[]): RelationshipMap {
  // 0/1 件では関係を作れない（要件22.11）。
  if (characters.length < 2) {
    return { edges: [] };
  }

  // 1. 全無向ペアを生成し、a < b（id 昇順）に正規化して id のみから各線を求める。
  const candidateEdges: RelationshipEdge[] = [];
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const idI = characters[i].id;
      const idJ = characters[j].id;
      // 自己ループ（同一 id）は作らない。
      if (idI === idJ) {
        continue;
      }
      const a = idI < idJ ? idI : idJ;
      const b = idI < idJ ? idJ : idI;
      candidateEdges.push({
        a,
        b,
        tag: pickTag(a, b),
        impressionAtoB: pickImpression(a, b),
        impressionBtoA: pickImpression(b, a),
        score: connectScore(a, b),
      });
    }
  }

  // 2. 各ノード視点で上位3本を採用候補とし、両端合意の線のみ最終採用する。
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
  const acceptedByNode = new Map<string, Set<RelationshipEdge>>();
  for (const [node, edges] of incident) {
    const sorted = edges.slice().sort((x, y) => compareForNode(node, x, y));
    acceptedByNode.set(node, new Set(sorted.slice(0, MAX_DEGREE)));
  }

  // 両端のノードでともに上位3本に入る線のみを最終の線として採用する（両端合意方式）。
  const finalEdges = candidateEdges.filter((edge) => {
    const aTop = acceptedByNode.get(edge.a);
    const bTop = acceptedByNode.get(edge.b);
    return aTop !== undefined && bTop !== undefined && aTop.has(edge) && bTop.has(edge);
  });

  // 3. a 昇順 → b 昇順で決定的に整列して返す。
  finalEdges.sort((x, y) => {
    if (x.a < y.a) return -1;
    if (x.a > y.a) return 1;
    if (x.b < y.b) return -1;
    if (x.b > y.b) return 1;
    return 0;
  });

  return { edges: finalEdges };
}
