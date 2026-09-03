/**
 * FavoriteLevelPicker — お気に入り度（1〜5）を選ぶかわいい入力。
 *
 * 1〜5 のハート（🩷/🤍）で現在の度合いを表現し、各ハートを個別のボタンとして
 * 提供する。各選択肢は最小 44×44 CSS px のタッチ領域（`.touch-target`）を持ち、
 * `aria-label` でスクリーンリーダーにも度合いを伝える（要件1.7, 7.7）。
 *
 * 値は制御コンポーネントとして親が保持する（`value` / `onChange`）。
 *
 * Requirements: 1.7, 7.7
 */

/** 選択可能なお気に入り度（1〜5 の整数）。 */
const LEVELS = [1, 2, 3, 4, 5] as const;

export interface FavoriteLevelPickerProps {
  /** 現在のお気に入り度（1〜5 の整数）。要件1.7 */
  value: number;
  /** ハートが選択されたときに新しい度合い（1〜5）を通知するコールバック。 */
  onChange: (level: number) => void;
}

export function FavoriteLevelPicker({
  value,
  onChange,
}: FavoriteLevelPickerProps): JSX.Element {
  return (
    <div
      className="favorite-level-picker"
      role="group"
      aria-label="お気に入り度（1〜5）"
    >
      {LEVELS.map((level) => {
        // level 以下のハートを塗り、それより上を白抜きにして度合いを可視化する。
        const filled = level <= value;
        const selected = level === value;
        return (
          <button
            key={level}
            type="button"
            className={
              filled
                ? 'favorite-level-picker__item favorite-level-picker__item--filled touch-target'
                : 'favorite-level-picker__item touch-target'
            }
            aria-label={`お気に入り度 ${level}`}
            aria-pressed={selected}
            onClick={() => onChange(level)}
          >
            <span aria-hidden="true">{filled ? '🩷' : '🤍'}</span>
          </button>
        );
      })}
    </div>
  );
}
