/**
 * CharacterCard — 図鑑一覧の 1 件を表すカード。
 *
 * 写真枠（`PhotoFrame`、角丸大 `--radius-large`）・主表示/副表示を表示する
 * （要件2.3, 2.5, 2.6, 10.1〜10.4）。表示テキストは Domain 層の純粋関数
 * {@link deriveCardDisplay} が返す `{ primary, secondary? }` に基づく。ニックネームを
 * 主表示に優先し、主表示を先頭かつ副表示より大きい文字サイズで、副表示は主表示に続けて
 * 補助的に表示する（要件10.4）。写真のデコード失敗時は `PhotoFrame` 側でプレースホルダーに
 * フォールバックする（要件2.4）。`.card` によりパステル面・角丸大・柔らかい影のポップな見た目に
 * する（design.md「Design Theme and Design System」）。
 *
 * `onClick` が与えられた場合、カード全体を最小 44×44 CSS px のタップ領域（`.touch-target`）を
 * 持つボタンとして描画し、詳細表示への導線にする（要件2.8, 7.7）。
 *
 * お気に入り度は表示専用の {@link FavoriteLevelDisplay} で可視化する（要件12.1）。
 *
 * イメージカラーが設定されている場合、Domain 層の純粋関数 {@link deriveImageColorStyle} が
 * 返す `{ hasBorder, borderVarName }` に基づき、`hasBorder === true` のときのみカード枠へ
 * 縁取りを適用する。縁取り色は `tokens.css` のイメージカラートークン
 * （`--image-color-*`）を `var(...)` 経由で `border-color` に参照し、ハードコードしない
 * （要件15.9）。`'none'`・許容値以外（旧データ・不正値）は `hasBorder === false` となり、
 * 縁取りクラス・style を一切付けない（要件15.6, 15.8）。角丸大（`--radius-large`）・
 * 横スクロールなし・44×44 CSS px タッチ領域は縁取り有無にかかわらず維持する（要件14.7,
 * 15.10）。`metOn`（出会った日）は一覧カードには表示しない（詳細のみ、要件15.6）。
 *
 * Requirements: 2.3, 2.5, 2.6, 10.1, 10.2, 10.3, 10.4, 12.1, 14.7, 15.6, 15.8, 15.9, 15.10
 */
import type { CSSProperties } from 'react';
import type { Character } from '../domain/types';
import { deriveCardDisplay } from '../domain/deriveCardDisplay';
import { deriveImageColorStyle } from '../domain/imageColor';
import { FavoriteLevelDisplay } from './FavoriteLevelDisplay';
import { PhotoFrame } from './PhotoFrame';

export interface CharacterCardProps {
  /** 表示対象の Character。 */
  character: Character;
  /** カードが選択されたときのハンドラ。省略時はカードを非インタラクティブに描画する。 */
  onClick?: (character: Character) => void;
}

/**
 * カードの内容（写真・主表示/副表示）。ボタン/非ボタンの両方から共有する。
 * 表示テキストは {@link deriveCardDisplay} が返す `{ primary, secondary? }` に基づき、
 * ニックネームを主表示に優先する（要件10.1〜10.3）。主表示 `primary` は先頭かつ
 * 副表示より大きい文字サイズ（`.character-card__name`）、副表示 `secondary` は主表示に
 * 続けて補助的に小さめ（`.character-card__nickname`）で表示する（要件10.4）。
 */
function CharacterCardContent({ character }: { character: Character }): JSX.Element {
  const { primary, secondary } = deriveCardDisplay(character);

  return (
    <>
      <PhotoFrame
        photo={character.photo}
        alt={primary}
        className="character-card__photo"
      />
      <div className="character-card__body">
        <span className="character-card__name">{primary}</span>
        {secondary != null ? (
          <span className="character-card__nickname">{secondary}</span>
        ) : null}
        {/* お気に入り度を表示専用コンポーネントで可視化する（要件12.1）。 */}
        <FavoriteLevelDisplay
          level={character.favoriteLevel}
          className="character-card__favorite"
        />
      </div>
    </>
  );
}

export function CharacterCard({ character, onClick }: CharacterCardProps): JSX.Element {
  // イメージカラーから縁取りの有無・参照トークンを導出する（要件15.6, 15.8）。
  // hasBorder が true のときのみ縁取りクラスとトークン参照の border-color を付与し、
  // 'none'・不正値では一切付けない（縁取りなし）。色は var(--image-color-*) 経由（要件15.9）。
  const imageColorStyle = deriveImageColorStyle(character.imageColor);
  const borderedClass = imageColorStyle.hasBorder ? ' character-card--bordered' : '';
  const borderStyle: CSSProperties | undefined = imageColorStyle.hasBorder
    ? { borderColor: `var(${imageColorStyle.borderVarName})` }
    : undefined;

  // タップ可能な場合はカード全体をボタン化し、44px 以上のタッチ領域を確保する（要件7.7）。
  if (onClick != null) {
    return (
      <button
        type="button"
        className={`card character-card character-card--interactive touch-target${borderedClass}`}
        style={borderStyle}
        onClick={() => onClick(character)}
      >
        <CharacterCardContent character={character} />
      </button>
    );
  }

  return (
    <div className={`card character-card${borderedClass}`} style={borderStyle}>
      <CharacterCardContent character={character} />
    </div>
  );
}
