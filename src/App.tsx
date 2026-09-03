import { useState } from 'react';
import type { Character } from './domain/types';
import { CharacterDetailView } from './components/CharacterDetailView';
import { CollectionView } from './components/CollectionView';
import { RegistrationForm } from './components/RegistrationForm';

/**
 * 画面状態（ビュー）の種別。
 * - `list`:   図鑑一覧（{@link CollectionView}）
 * - `add`:    新規登録フォーム（{@link RegistrationForm}）
 * - `detail`: キャラクター詳細（{@link CharacterDetailView}）
 */
type View = 'list' | 'add' | 'detail';

/**
 * Application root. `useState` によるシンプルな画面遷移で 一覧 / 登録 / 詳細 を
 * 切り替える（design.md「フロー1」および要件2 の一覧・詳細導線）。
 *
 * 一覧は {@link CollectionView} 内の {@link useCollection} が保持する。新規登録の保存後は
 * 一覧を最新化する必要があるため、`listKey` をインクリメントして {@link CollectionView} を
 * 再マウントし、マウント時の読み込みで保存済みの新規キャラクターを反映する（要件2.1, 2.6）。
 * 既定の共有ストア（`defaultCharacterStore`）を一貫して用いるため、登録フォームの書き込みは
 * 再マウント後の一覧読み込みで可視化される。
 *
 * ガチャ・対戦・編集・削除の各画面は後続タスクで配線する。
 */
export default function App(): JSX.Element {
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Character | null>(null);
  // CollectionView を再マウントして一覧を最新化するためのキー（保存後にインクリメント）。
  const [listKey, setListKey] = useState(0);

  // 一覧へ戻る（詳細/登録から）。
  const goToList = (): void => {
    setView('list');
  };

  // 新規登録フォームを開く。
  const goToAdd = (): void => {
    setView('add');
  };

  // 一覧から 1 件を選択して詳細へ。
  const goToDetail = (character: Character): void => {
    setSelected(character);
    setView('detail');
  };

  // 保存成功: 一覧を再マウントで最新化してから一覧へ戻る（要件2.1）。
  const handleSaved = (): void => {
    setListKey((key) => key + 1);
    setView('list');
  };

  return (
    <div className="app">
      {view === 'list' ? (
        <CollectionView key={listKey} onAdd={goToAdd} onSelect={goToDetail} />
      ) : null}

      {view === 'add' ? (
        <RegistrationForm onSaved={handleSaved} onCancel={goToList} />
      ) : null}

      {view === 'detail' && selected != null ? (
        <CharacterDetailView character={selected} onBack={goToList} />
      ) : null}
    </div>
  );
}
