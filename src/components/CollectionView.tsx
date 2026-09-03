/**
 * CollectionView（図鑑一覧）— 登録済み Character の一覧表示。
 *
 * {@link useCollection} から一覧・読み込み状態・再試行（reload）を受け取り、
 * `createdAt` 降順で {@link CharacterCard} をグリッド表示する（要件2.1, 2.3, 2.5, 2.6）。
 * 読み込み失敗時は再試行導線（reload）を提示し（要件2.9）、0 件時は {@link EmptyStateView}
 * と「新規登録」の CTA を表示する（要件2.7, 8.6）。カード選択で詳細へ、ヘッダーの
 * 「新規登録」で登録フォームへ遷移する（遷移自体は App が担い、コールバックで受け取る）。
 *
 * 本コンポーネントはロジックを持たず、hook から受け取った状態を描画するのみとする
 * （design.md「UI 層」）。
 *
 * Requirements: 2.1, 2.3, 2.5, 2.6, 2.7, 2.9, 8.6
 */
import type { Character } from '../domain/types';
import { useCollection } from '../hooks/useCollection';
import { CharacterCard } from './CharacterCard';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';

export interface CollectionViewProps {
  /** 「新規登録」導線が押されたときのハンドラ（登録フォームへ遷移）。要件2.7, 8.6 */
  onAdd: () => void;
  /** 一覧内の 1 件が選択されたときのハンドラ（詳細へ遷移）。要件2.8 */
  onSelect: (character: Character) => void;
}

export function CollectionView({ onAdd, onSelect }: CollectionViewProps): JSX.Element {
  const { characters, loadState, reload } = useCollection();

  return (
    <main className="collection-view">
      <header className="collection-view__header">
        <h1>お友達図鑑</h1>
        <PastelButton onClick={onAdd}>新規登録 ✚</PastelButton>
      </header>

      {/* 読み込み失敗: 保存済みデータは保持しつつ再試行手段を提示する（要件2.9）。 */}
      {loadState === 'failed' ? (
        <div className="collection-view__error" role="alert">
          <p>読み込みに失敗しました。もう一度お試しください。</p>
          <PastelButton variant="secondary" onClick={() => void reload()}>
            再試行
          </PastelButton>
        </div>
      ) : null}

      {/* 0 件: 空状態メッセージと新規登録 CTA（要件2.7, 8.6）。
          読み込み失敗中は上のエラー表示を優先し、空状態は出さない。 */}
      {loadState !== 'failed' && characters.length === 0 ? (
        <EmptyStateView
          message="まだキャラクターが登録されていません。「新規登録」からお気に入りを追加しましょう。"
          actionLabel="新規登録"
          onAction={onAdd}
        />
      ) : null}

      {/* 一覧: createdAt 降順（hook が保証）。写真・名前・ニックネームを表示（要件2.1, 2.3, 2.5, 2.6）。 */}
      {characters.length > 0 ? (
        <ul className="collection-view__grid">
          {characters.map((character) => (
            <li key={character.id} className="collection-view__grid-item">
              <CharacterCard character={character} onClick={onSelect} />
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

