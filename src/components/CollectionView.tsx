/**
 * CollectionView（図鑑一覧）— 登録済み Character の一覧表示。
 *
 * {@link useCollection} から一覧・読み込み状態・再試行（reload）を受け取り、
 * `createdAt` 降順で {@link CharacterCard} をグリッド表示する（要件2.1, 2.3, 2.5, 2.6）。
 * 読み込み失敗時は再試行導線（reload）を提示し（要件2.9）、0 件時は {@link EmptyStateView}
 * と「新規登録」の CTA を表示する（要件2.7, 8.6）。カード選択で詳細へ遷移する
 * （遷移自体は App が担い、コールバックで受け取る）。図鑑 / 今日の相棒 / トーナメント /
 * 新規登録 への導線は共通の下部ナビゲーションバー（{@link NavigationBar}）が担うため、
 * ヘッダーは見出し「お友達図鑑」のみとする（要件13）。
 *
 * 本コンポーネントはロジックを持たず、hook から受け取った状態を描画するのみとする
 * （design.md「UI 層」）。
 *
 * Requirements: 2.1, 2.3, 2.5, 2.6, 2.7, 2.9, 8.6
 */
import type { Character, SortOrder } from '../domain/types';
import { useCollection } from '../hooks/useCollection';
import { storeErrorMessage } from '../hooks/errorMessages';
import { CharacterCard } from './CharacterCard';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';

export interface CollectionViewProps {
  /** 「新規登録」導線が押されたときのハンドラ（登録フォームへ遷移）。要件2.7, 8.6 */
  onAdd: () => void;
  /** 一覧内の 1 件が選択されたときのハンドラ（詳細へ遷移）。要件2.8 */
  onSelect: (character: Character) => void;
}

/** 並び順選択 UI に表示する 3 種のオプション（表示ラベルと値）。要件11.1〜11.4 */
const SORT_OPTIONS: ReadonlyArray<{ value: SortOrder; label: string }> = [
  { value: 'newest', label: '新しい順' },
  { value: 'favorite', label: 'お気に入り順' },
  { value: 'name', label: '名前順' },
];

export function CollectionView({
  onAdd,
  onSelect,
}: CollectionViewProps): JSX.Element {
  const { characters, loadState, sortOrder, setSortOrder, reload } =
    useCollection();

  return (
    <main className="collection-view">
      <header className="collection-view__header">
        <h1>お友達図鑑</h1>
      </header>

      {/* 並び順選択（セグメント風）。1 件以上あるときのみ表示し、空状態と干渉させない
          （要件11.1）。各ボタンは最小 44×44 CSS px（.touch-target）で、選択中は
          aria-pressed と選択スタイルで視覚的に区別する（要件9.6, 9.7, 11.1）。
          選択で setSortOrder を呼び、並べ替えは hook（sortCharacters）が担う。 */}
      {characters.length > 0 ? (
        <div
          className="collection-view__sort"
          role="group"
          aria-label="並び順"
        >
          {SORT_OPTIONS.map((option) => {
            const selected = option.value === sortOrder;
            return (
              <button
                key={option.value}
                type="button"
                className={`collection-view__sort-option touch-target${
                  selected ? ' collection-view__sort-option--selected' : ''
                }`}
                aria-pressed={selected}
                onClick={() => setSortOrder(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* 読み込み失敗: 保存済みデータは保持しつつ再試行手段を提示する（要件2.9）。 */}
      {loadState === 'failed' ? (
        <div className="collection-view__error" role="alert">
          <p>{storeErrorMessage({ kind: 'loadFailed' })}</p>
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

      {/* 一覧: 選択中の並び順（hook が sortCharacters で保証）。CollectionView 側では
          再ソートしない。写真・名前・ニックネームを表示（要件2.1, 2.3, 2.5, 2.6, 11.2〜11.4）。 */}
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

