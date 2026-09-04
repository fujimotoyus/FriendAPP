import { useState } from 'react';
import type { Character } from './domain/types';
import { CharacterDetailView } from './components/CharacterDetailView';
import { CollectionView } from './components/CollectionView';
import { DailyGachaView } from './components/DailyGachaView';
import { RankingBattleView } from './components/RankingBattleView';
import { RegistrationForm } from './components/RegistrationForm';
import { defaultCharacterStore } from './persistence/defaultStore';

/**
 * 画面状態（ビュー）の種別。
 * - `list`:   図鑑一覧（{@link CollectionView}）
 * - `add`:    新規登録 / 編集フォーム（{@link RegistrationForm}）
 * - `detail`: キャラクター詳細（{@link CharacterDetailView}）
 * - `gacha`:  今日の一枚ガチャ（{@link DailyGachaView}）
 * - `battle`: ランキング対戦（{@link RankingBattleView}）
 *
 * 登録フォームは新規登録と編集を兼用する（design.md「RegistrationForm（登録 / 編集）」）。
 * `add` ビューで `editingCharacter` が非 null なら編集、null なら新規登録として扱う。
 */
type View = 'list' | 'add' | 'detail' | 'gacha' | 'battle';

/**
 * Application root. `useState` によるシンプルな画面遷移で 一覧 / 登録 / 詳細 /
 * ガチャ / 対戦 を切り替える（design.md「フロー1」および要件2, 6 の導線）。
 *
 * 一覧は {@link CollectionView} 内の {@link useCollection} が保持する。新規登録・編集・
 * 削除のいずれかで一覧が変化した後は最新化する必要があるため、`listKey` をインクリメント
 * して {@link CollectionView} を再マウントし、マウント時の読み込みで最新状態を反映する
 * （要件2.1, 2.6, 6.3, 6.7）。既定の共有ストア（{@link defaultCharacterStore}）を一貫して
 * 用いるため、フォームの書き込み・削除は再マウント後の一覧読み込みで可視化される。
 *
 * 編集フロー（要件6.1〜6.4）: 詳細画面の「編集」導線で `editingCharacter` に対象を設定し、
 * `add` ビューへ遷移する。{@link RegistrationForm} に `editing` を渡すことで既存属性を初期
 * 表示し、保存成功（`onSaved`）で一覧を最新化して一覧へ戻る（要件6.3）。
 *
 * 削除フロー（要件6.5〜6.7）: 詳細画面で削除確認を経た後、App が {@link defaultCharacterStore}
 * の `delete` を呼び、一覧を再マウントして最新化したうえで一覧へ戻る（削除完了の反映。要件6.7）。
 * 一覧の {@link useCollection} は再マウント時の読み込みで削除結果を取り込む。
 *
 * 今日の一枚ガチャ画面（{@link DailyGachaView}）は一覧ヘッダーの「今日の相棒」導線から開き、
 * ランキング対戦画面（{@link RankingBattleView}）も一覧ヘッダーの「対戦」導線から開く。
 */
export default function App(): JSX.Element {
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Character | null>(null);
  // 編集対象の Character。null なら新規登録、非 null なら編集（要件6.1）。
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  // CollectionView を再マウントして一覧を最新化するためのキー（保存・削除後にインクリメント）。
  const [listKey, setListKey] = useState(0);

  // 一覧へ戻る（詳細/登録から）。編集状態もクリアする。
  const goToList = (): void => {
    setEditingCharacter(null);
    setView('list');
  };

  // 新規登録フォームを開く（編集状態をクリア）。
  const goToAdd = (): void => {
    setEditingCharacter(null);
    setView('add');
  };

  // 今日の一枚ガチャ画面を開く（要件5.4）。
  const goToGacha = (): void => {
    setView('gacha');
  };

  // ランキング対戦画面を開く（要件4.1）。
  const goToBattle = (): void => {
    setView('battle');
  };

  // 一覧から 1 件を選択して詳細へ。
  const goToDetail = (character: Character): void => {
    setSelected(character);
    setView('detail');
  };

  // 詳細から編集フォームを開く（既存属性を初期表示。要件6.1）。
  const goToEdit = (character: Character): void => {
    setEditingCharacter(character);
    setView('add');
  };

  // 保存成功（新規・編集とも）: 一覧を再マウントで最新化してから一覧へ戻る（要件2.1, 6.3）。
  const handleSaved = (): void => {
    setEditingCharacter(null);
    setListKey((key) => key + 1);
    setView('list');
  };

  // 削除確定: 共有ストアから削除し、一覧を再マウントで最新化して一覧へ戻る（要件6.7）。
  const handleDelete = async (id: string): Promise<void> => {
    await defaultCharacterStore.delete(id);
    setSelected(null);
    setListKey((key) => key + 1);
    setView('list');
  };

  return (
    <div className="app">
      {view === 'list' ? (
        <CollectionView
          key={listKey}
          onAdd={goToAdd}
          onSelect={goToDetail}
          onOpenGacha={goToGacha}
          onOpenBattle={goToBattle}
        />
      ) : null}

      {view === 'add' ? (
        <RegistrationForm
          onSaved={handleSaved}
          onCancel={goToList}
          editing={editingCharacter ?? undefined}
        />
      ) : null}

      {view === 'detail' && selected != null ? (
        <CharacterDetailView
          character={selected}
          onBack={goToList}
          onEdit={goToEdit}
          onDelete={(id) => void handleDelete(id)}
        />
      ) : null}

      {view === 'gacha' ? (
        <DailyGachaView onBack={goToList} onRegister={goToAdd} />
      ) : null}

      {view === 'battle' ? (
        <RankingBattleView onBack={goToList} onRegister={goToAdd} />
      ) : null}
    </div>
  );
}
