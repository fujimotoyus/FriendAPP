/**
 * CharacterCard — 図鑑一覧の 1 件を表すカード。
 *
 * 写真枠（`PhotoFrame`、角丸大 `--radius-large`）・名前・（登録があれば）ニックネームを
 * 表示する（要件2.3, 2.5, 2.6）。写真のデコード失敗時は `PhotoFrame` 側でプレースホルダーに
 * フォールバックする（要件2.4）。`.card` によりパステル面・角丸大・柔らかい影のポップな見た目に
 * する（design.md「Design Theme and Design System」）。
 *
 * `onClick` が与えられた場合、カード全体を最小 44×44 CSS px のタップ領域（`.touch-target`）を
 * 持つボタンとして描画し、詳細表示への導線にする（要件2.8, 7.7）。
 *
 * Requirements: 2.3, 2.5, 2.6
 */
import type { Character } from '../domain/types';
import { PhotoFrame } from './PhotoFrame';

export interface CharacterCardProps {
  /** 表示対象の Character。 */
  character: Character;
  /** カードが選択されたときのハンドラ。省略時はカードを非インタラクティブに描画する。 */
  onClick?: (character: Character) => void;
}

/**
 * カードの内容（写真・名前・ニックネーム）。ボタン/非ボタンの両方から共有する。
 * 名前が未入力（空文字）の場合は「名前未設定」を代替表示する（要件1.9, 2.5）。
 * ニックネームは登録がある場合のみ表示する（要件2.6）。
 */
function CharacterCardContent({ character }: { character: Character }): JSX.Element {
  const displayName = character.name.trim().length > 0 ? character.name : '名前未設定';
  const hasNickname = character.nickname.trim().length > 0;

  return (
    <>
      <PhotoFrame
        photo={character.photo}
        alt={displayName}
        className="character-card__photo"
      />
      <div className="character-card__body">
        <span className="character-card__name">{displayName}</span>
        {hasNickname ? (
          <span className="character-card__nickname">{character.nickname}</span>
        ) : null}
      </div>
    </>
  );
}

export function CharacterCard({ character, onClick }: CharacterCardProps): JSX.Element {
  // タップ可能な場合はカード全体をボタン化し、44px 以上のタッチ領域を確保する（要件7.7）。
  if (onClick != null) {
    return (
      <button
        type="button"
        className="card character-card character-card--interactive touch-target"
        onClick={() => onClick(character)}
      >
        <CharacterCardContent character={character} />
      </button>
    );
  }

  return (
    <div className="card character-card">
      <CharacterCardContent character={character} />
    </div>
  );
}
