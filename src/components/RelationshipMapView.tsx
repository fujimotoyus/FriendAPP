/**
 * RelationshipMapView（キャラ相関図）— 登録済み Character 同士の関係の読み取り専用可視化。
 *
 * {@link useRelationshipMap} が公開する `{ loadState, characters, edges, hasEnough, reload }`
 * に基づき、各 Character（ノード）ごとに「関係のある相手」を列挙する**リストベースのカード表示**
 * を描画する（要件22.1, 22.16, 22.20）。**追加ライブラリを用いない軽量な自前描画**とし、
 * **横スクロールを一切出さない**方針（`TournamentBracketView` と整合）。ロジックは持たず、
 * hook から受け取ったデータを描画するのみとする（意思決定は Domain 層の `buildRelationshipMap`）。
 *
 * 各ノードカードは当該 Character の名前（`deriveCardDisplay` の主表示相当）を見出しにし、
 * そのノードに接続する関係（無向エッジ `edges` の端点 a/b のいずれかが当該ノード）を、
 * 相手 Character の表示名・関係タグ（`tag`）・双方向の印象付きで縦積みに列挙する。
 *
 * 空状態（要件22.14, 22.15）:
 * - `hasEnough === false`（Character が 0/1 件）→ 「関係を作るには 2 件以上の登録が必要」旨を
 *   {@link EmptyStateView} で表示する。
 * - 2 件以上あっても `edges` が空 → 「関係が見つからなかった」旨の空状態を表示する。
 * - `loadState === 'failed'` → 保持済みデータを破棄せず、再試行導線（`reload`）を提示する（要件2.9）。
 * - `loadState === 'loading'` かつ未読み込み → 簡易ローディング表示。
 *
 * 配色・角丸・影・余白・トランジションは大人かわいいテーマのトークン経由で `.relationship-map*`
 * クラス（global.css 側で定義）に適用する。操作要素は最小 44×44 CSS px（`.touch-target` /
 * {@link PastelButton}）・横スクロールなし・rem 追従を満たす（要件22.19, 22.21, 9）。
 * 読み取り専用で Character_Store を変更せず、外部送信も行わない（要件22.16, 22.17, 3.8）。
 *
 * Requirements: 22.1, 22.14, 22.15, 22.16, 22.17, 22.18, 22.19, 22.20, 22.21, 2.9, 9
 */
import type { Character, RelationshipTag, ResolvedRelationshipEdge } from '../domain/types';
import { deriveCardDisplay } from '../domain/deriveCardDisplay';
import { useRelationshipMap } from '../hooks/useRelationshipMap';
import { storeErrorMessage } from '../hooks/errorMessages';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';

export interface RelationshipMapViewProps {
  /** 一覧など前の画面へ戻る操作のハンドラ（任意）。ナビゲーションバーからの遷移では省略可。 */
  onBack?: () => void;
}

/**
 * 関係タグ（{@link RelationshipTag}）を利用者向けの短い日本語ラベルへ写像する。
 * 表示専用（色/記号のみに依存しないよう文字で意味を伝える。要件22.18 / 9.7）。
 */
const TAG_LABELS: Record<RelationshipTag, string> = {
  friend: '仲良し',
  rival: 'ライバル',
  fighting: '喧嘩中',
  crush: '気になる存在',
  buddy: '相棒',
};

/**
 * 関係タグ（{@link RelationshipTag}）を種類ごとの色分けクラスへ写像する（要件22.18）。
 * 実際の色はすべて CSS 側（global.css の `.rel-tag--*`）でテーマトークン経由に解決し、
 * ここでは色値をハードコードせずクラス名の対応のみを持つ。色対応（design.md「表示ラベルと
 * 色トークン」）: friend=--color-primary / rival=--image-color-butter /
 * fighting=--color-text-secondary / crush=--image-color-lavender / buddy=--image-color-mint。
 * 色だけに依存しないよう {@link TAG_LABELS} の日本語ラベルを必ず併記する（要件22.17 / 9.7）。
 */
const TAG_CLASS: Record<RelationshipTag, string> = {
  friend: 'rel-tag--friend',
  rival: 'rel-tag--rival',
  fighting: 'rel-tag--fighting',
  crush: 'rel-tag--crush',
  buddy: 'rel-tag--buddy',
};

/** Character の主表示テキスト（`deriveCardDisplay` の primary）を返す。 */
function primaryNameOf(character: Character): string {
  return deriveCardDisplay(character).primary;
}

/**
 * あるノード（`self`）から見た 1 本の関係を表す表示用の値。
 * 無向エッジの相手側 Character・関係ラベル・関係軸をまとめる。
 */
interface NodeRelation {
  /** 関係の相手側 Character。 */
  other: Character;
  /** 当該ペアの関係タグ。 */
  tag: RelationshipTag;
  /** このノード → 相手 の印象（非空）。 */
  impressionToOther: string;
  /** 相手 → このノード の印象（非空）。 */
  impressionFromOther: string;
  /** つながりスコア。 */
  score: number;
}

/**
 * あるノードに接続する関係を、相手側 Character 付きで抽出する。
 * `edges` は無向（端点 a/b）なので、当該ノードが a なら相手は b、b なら相手は a。
 * 向きあり印象は、当該ノードが a のとき「自分→相手」= impressionAtoB、
 * 「相手→自分」= impressionBtoA。b のときは逆に対応付ける（要件22.4〜22.6）。
 * 出現順は `edges` の決定的順序（a 昇順 → b 昇順）を保つ。
 */
function relationsForNode(
  self: Character,
  edges: readonly ResolvedRelationshipEdge[],
): NodeRelation[] {
  const relations: NodeRelation[] = [];
  for (const edge of edges) {
    if (edge.a.id === self.id) {
      relations.push({
        other: edge.b,
        tag: edge.tag,
        impressionToOther: edge.impressionAtoB,
        impressionFromOther: edge.impressionBtoA,
        score: edge.score,
      });
    } else if (edge.b.id === self.id) {
      relations.push({
        other: edge.a,
        tag: edge.tag,
        impressionToOther: edge.impressionBtoA,
        impressionFromOther: edge.impressionAtoB,
        score: edge.score,
      });
    }
  }
  return relations;
}

export function RelationshipMapView({ onBack }: RelationshipMapViewProps): JSX.Element {
  const { loadState, characters, edges, hasEnough, reload } = useRelationshipMap();

  // 関係を持つノードのみを見出しに立て、関係リストを縦積みに列挙する。
  // 表示順は characters の並び（fetchAll の createdAt 降順）を保つ。
  const nodesWithRelations = characters
    .map((character) => ({ character, relations: relationsForNode(character, edges) }))
    .filter((node) => node.relations.length > 0);

  return (
    <main className="relationship-map">
      <header className="relationship-map__header">
        {onBack != null ? (
          <PastelButton variant="secondary" onClick={onBack}>
            ← 一覧へ戻る
          </PastelButton>
        ) : null}
        <h1 className="relationship-map__title">キャラ相関図</h1>
      </header>

      {/* 読み込み失敗: 保持済みデータは破棄せず再試行導線を提示する（要件2.9）。 */}
      {loadState === 'failed' ? (
        <div className="relationship-map__error" role="alert">
          <p>{storeErrorMessage({ kind: 'loadFailed' })}</p>
          <PastelButton variant="secondary" onClick={() => void reload()}>
            再試行
          </PastelButton>
        </div>
      ) : null}

      {/* 未読み込みの読み込み中は簡易表示。読み込み済み後の再読み込みでは既存表示を保つ。 */}
      {loadState === 'loading' && characters.length === 0 ? (
        <p className="relationship-map__loading">相関図を作成しています…</p>
      ) : null}

      {/* 空状態1: Character が 0/1 件なら関係を作れない（要件22.14）。 */}
      {loadState !== 'failed' && loadState !== 'loading' && !hasEnough ? (
        <EmptyStateView
          icon="🔗"
          message="関係を作るには2件以上の登録が必要です。お友達をもう1人登録すると相関図が見られます。"
        />
      ) : null}

      {/* 空状態2: 2 件以上あるが関係が 1 本も見つからない（要件22.15）。 */}
      {loadState !== 'failed' &&
      loadState !== 'loading' &&
      hasEnough &&
      edges.length === 0 ? (
        <EmptyStateView
          icon="🔍"
          message="関係が見つかりませんでした。"
        />
      ) : null}

      {/* 関係あり: 各ノードに接続する関係を相手・ラベル・軸付きで縦積み列挙（横スクロールなし）。 */}
      {loadState !== 'failed' && hasEnough && edges.length > 0 ? (
        <ul className="relationship-map__nodes">
          {nodesWithRelations.map(({ character, relations }) => (
            <li key={character.id} className="relationship-map__node-item">
              <section
                className="card relationship-map__node"
                aria-label={`${primaryNameOf(character)} の関係`}
              >
                <h2 className="relationship-map__node-name">
                  {primaryNameOf(character)}
                </h2>
                <ul className="relationship-map__relations">
                  {relations.map((relation) => (
                    <li
                      key={relation.other.id}
                      className="relationship-map__relation"
                    >
                      <span className="relationship-map__relation-other">
                        {primaryNameOf(relation.other)}
                      </span>
                      <span
                        className={`relationship-map__relation-label ${TAG_CLASS[relation.tag]}`}
                      >
                        {TAG_LABELS[relation.tag]}
                      </span>
                      <span className="relationship-map__relation-impressions">
                        <span className="relationship-map__impression">
                          {primaryNameOf(character)}→{primaryNameOf(relation.other)}:{' '}
                          {relation.impressionToOther}
                        </span>
                        <span className="relationship-map__impression">
                          {primaryNameOf(relation.other)}→{primaryNameOf(character)}:{' '}
                          {relation.impressionFromOther}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
