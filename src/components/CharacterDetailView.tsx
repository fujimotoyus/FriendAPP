/**
 * CharacterDetailView（詳細）— 選択された Character の詳細表示と編集・削除の導線。
 *
 * 写真（{@link PhotoFrame}）・名前・ニックネーム・メモ・お気に入り度を表示する
 * （要件2.8）。一覧へ戻る導線に加え、編集・削除の導線を提供する（要件6）。
 *
 * 編集・削除の実処理はロジック層（App 経由の {@link useRegistration} /
 * {@link useCollection} / {@link CharacterStore}）に委譲し、本コンポーネントは表示と
 * 操作の受け取り、および削除確認の UI 状態のみを持つ（design.md「UI 層」）。
 *
 * 削除フロー（要件6.5, 6.6, 6.7）:
 * - 「削除」押下でインラインの確認表示に切り替える（要件6.5）。ネイティブの
 *   `window.confirm` は使わず、コンポーネント内 state で制御する。
 * - 「キャンセル」で削除せず元の詳細表示に戻す（要件6.6）。
 * - 「削除する」で {@link CharacterDetailViewProps.onDelete} を呼び、実処理を App に委譲する。
 *   削除完了後の通知・一覧最新化は App 側で行う（要件6.7）。
 *
 * 名前が未入力（空文字）の場合は「名前未設定」を、ニックネームが未登録の場合は
 * 「未登録」を代替表示する（要件1.9, 2.6）。
 *
 * お気に入り度は一覧カードと同一の視覚表現（表示専用 {@link FavoriteLevelDisplay}）で
 * 表示する（要件12.2）。
 *
 * イメージカラーが設定されている場合、Domain 層の純粋関数 {@link deriveImageColorStyle} が
 * 返す `{ hasBorder, borderVarName }` に基づき、`hasBorder === true` のときのみ写真枠へ
 * 縁取りを適用する。縁取り色は `tokens.css` のイメージカラートークン（`--image-color-*`）を
 * `var(...)` 経由で `border-color` に参照し、ハードコードしない（要件15.9）。`'none'`・
 * 許容値以外（旧データ・不正値）は縁取りを一切付けない（要件15.7, 15.8）。角丸大
 * （`--radius-large`）は縁取り有無にかかわらず維持する。
 *
 * 「出会った日」（{@link Character.metOn}）は、妥当な `YYYY-MM-DD`（`normalizeMetOn` 通過値）
 * が設定されているときのみ {@link formatMetOn} で「YYYY年M月D日」として表示し、未設定
 * （`undefined`・不正値）のときは当該行を描画しない（要件14.5, 14.6）。この「出会った日」は
 * 詳細のみに表示し、Daily_Gacha / Ranking_Battle には表示しない（要件14.8）。
 *
 * Requirements: 2.8, 6.1, 6.5, 6.6, 6.7, 12.2, 14.5, 14.6, 14.8, 15.7, 15.9
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Character } from '../domain/types';
import { deriveImageColorStyle } from '../domain/imageColor';
import { formatMetOn } from '../domain/metOn';
import { FavoriteLevelDisplay } from './FavoriteLevelDisplay';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';

/** `metOn` が妥当な `YYYY-MM-DD` 形式かの簡易判定（表示時点の防御的チェック）。 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CharacterDetailViewProps {
  /** 表示対象の Character。 */
  character: Character;
  /** 一覧へ戻る操作のハンドラ。 */
  onBack: () => void;
  /** 編集操作のハンドラ。App が編集フォームを開く（要件6.1）。 */
  onEdit: (character: Character) => void;
  /** 削除確定のハンドラ。App が削除を実行し一覧を最新化する（要件6.7）。 */
  onDelete: (id: string) => void;
}

export function CharacterDetailView({
  character,
  onBack,
  onEdit,
  onDelete,
}: CharacterDetailViewProps): JSX.Element {
  const displayName =
    character.name.trim().length > 0 ? character.name : '名前未設定';
  const hasNickname = character.nickname.trim().length > 0;
  const hasMemo = character.memo.trim().length > 0;

  // イメージカラーから写真枠の縁取り有無・参照トークンを導出する（要件15.7, 15.8）。
  // hasBorder が true のときのみ縁取りクラスとトークン参照の border-color を付与し、
  // 'none'・不正値では一切付けない。色は var(--image-color-*) 経由でハードコードしない（要件15.9）。
  const imageColorStyle = deriveImageColorStyle(character.imageColor);
  const photoBorderClass = imageColorStyle.hasBorder
    ? 'character-detail__photo character-detail__photo--bordered'
    : 'character-detail__photo';
  const photoBorderStyle: CSSProperties | undefined = imageColorStyle.hasBorder
    ? { borderColor: `var(${imageColorStyle.borderVarName})` }
    : undefined;

  // 出会った日（要件14.5, 14.6）。妥当な YYYY-MM-DD のときのみ表示、未設定・不正値は非表示。
  const metOn = character.metOn;
  const hasMetOn = metOn !== undefined && ISO_DATE_PATTERN.test(metOn);

  // 削除確認の表示状態。true で確認 UI を表示する（要件6.5）。
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
        className={photoBorderClass}
        style={photoBorderStyle}
      />

      <div className="character-detail__body">
        <h1 className="character-detail__name">{displayName}</h1>

        <div className="character-detail__field">
          <span className="character-detail__label">ニックネーム</span>
          <span className="character-detail__value">
            {hasNickname ? character.nickname : '未登録'}
          </span>
        </div>

        {/* 出会った日は妥当値のときのみ行ごと表示する。未設定・不正値は非表示（要件14.6）。 */}
        {hasMetOn && metOn !== undefined ? (
          <div className="character-detail__field">
            <span className="character-detail__label">出会った日</span>
            <span className="character-detail__value">{formatMetOn(metOn)}</span>
          </div>
        ) : null}

        <div className="character-detail__field">
          <span className="character-detail__label">メモ</span>
          <p className="character-detail__memo">
            {hasMemo ? character.memo : 'メモはありません。'}
          </p>
        </div>

        <div className="character-detail__field">
          <span className="character-detail__label">お気に入り度</span>
          {/* 表示専用（要件12.2）。変更は編集フォームで行う。 */}
          <FavoriteLevelDisplay level={character.favoriteLevel} />
        </div>
      </div>

      {/* 編集・削除の導線（要件6）。削除は確認を挟む（要件6.5, 6.6, 6.7）。 */}
      {confirmingDelete ? (
        <div className="character-detail__confirm" role="alertdialog" aria-label="削除の確認">
          <p className="character-detail__confirm-message">
            「{displayName}」を削除しますか？この操作は取り消せません。
          </p>
          <div className="character-detail__actions">
            <PastelButton
              variant="secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              キャンセル
            </PastelButton>
            <PastelButton
              className="character-detail__delete"
              onClick={() => onDelete(character.id)}
            >
              削除する
            </PastelButton>
          </div>
        </div>
      ) : (
        <div className="character-detail__actions">
          <PastelButton onClick={() => onEdit(character)}>編集する</PastelButton>
          <PastelButton
            variant="secondary"
            className="character-detail__delete"
            onClick={() => setConfirmingDelete(true)}
          >
            削除する
          </PastelButton>
        </div>
      )}
    </main>
  );
}
