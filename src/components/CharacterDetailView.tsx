/**
 * CharacterDetailView（詳細）— 選択された Character の詳細表示。
 *
 * 写真（{@link PhotoFrame}）・名前・ニックネーム・メモ・お気に入り度を表示する
 * （要件2.8）。一覧へ戻る導線を提供する。編集・削除の導線は後続タスク（16）で
 * 追加するため、本コンポーネントでは実装しない。
 *
 * 本コンポーネントはロジックを持たず、渡された Character を描画するのみとする
 * （design.md「UI 層」）。名前が未入力（空文字）の場合は「名前未設定」を、
 * ニックネームが未登録の場合は「未登録」を代替表示する（要件1.9, 2.6）。
 *
 * Requirements: 2.8
 */
import type { Character } from '../domain/types';
import { FavoriteLevelPicker } from './FavoriteLevelPicker';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';

export interface CharacterDetailViewProps {
  /** 表示対象の Character。 */
  character: Character;
  /** 一覧へ戻る操作のハンドラ。 */
  onBack: () => void;
}

export function CharacterDetailView({
  character,
  onBack,
}: CharacterDetailViewProps): JSX.Element {
  const displayName =
    character.name.trim().length > 0 ? character.name : '名前未設定';
  const hasNickname = character.nickname.trim().length > 0;
  const hasMemo = character.memo.trim().length > 0;

  return (
    <main className="character-detail">
      <header className="character-detail__header">
        <PastelButton variant="secondary" onClick={onBack}>
          ← 一覧へ戻る
        </PastelButton>
      </header>

      <PhotoFrame
        photo={character.photo}
        alt={displayName}
        className="character-detail__photo"
      />

      <div className="character-detail__body">
        <h1 className="character-detail__name">{displayName}</h1>

        <div className="character-detail__field">
          <span className="character-detail__label">ニックネーム</span>
          <span className="character-detail__value">
            {hasNickname ? character.nickname : '未登録'}
          </span>
        </div>

        <div className="character-detail__field">
          <span className="character-detail__label">メモ</span>
          <p className="character-detail__memo">
            {hasMemo ? character.memo : 'メモはありません。'}
          </p>
        </div>

        <div className="character-detail__field">
          <span className="character-detail__label">お気に入り度</span>
          {/* 表示専用: 変更は編集フォーム（後続タスク）で行うため onChange は空にする。 */}
          <FavoriteLevelPicker
            value={character.favoriteLevel}
            onChange={() => undefined}
          />
        </div>
      </div>
    </main>
  );
}
