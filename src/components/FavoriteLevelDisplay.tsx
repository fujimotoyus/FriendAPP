/**
 * FavoriteLevelDisplay — お気に入り度の表示専用コンポーネント（要件12）。
 *
 * {@link FavoriteLevelPicker}（入力用）の readOnly 表示に相当する。合計 5 個の記号のうち
 * Favorite_Level と等しい個数を塗り記号（🩷）、残りを未塗り記号（🤍）で表示し、度合いを
 * 可視化する（要件12.1, 12.3）。表示個数・テキスト等価物は純粋な表示モデル導出関数
 * {@link deriveFavoriteLevelDisplay} の結果を描画する。
 *
 * 色/記号のみに依存せず度合いを判別できるよう、ルート要素に `role="img"` と
 * `aria-label={textEquivalent}`（「5段階中N」）を付与し、個々の記号は
 * `aria-hidden="true"` にしてスクリーンリーダーには等価テキストのみを伝える（要件12.3, 12.4）。
 *
 * これは表示専用（クリック不可）であり、入力用の {@link FavoriteLevelPicker} とは別物である。
 * `CharacterCard`（要件12.1）と `CharacterDetailView`（要件12.2）の双方で用いる。
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
import { deriveFavoriteLevelDisplay } from '../domain/deriveFavoriteLevelDisplay';

export interface FavoriteLevelDisplayProps {
  /** 表示対象のお気に入り度。範囲外/未設定/非整数は塗り 0 個で表示する（要件12.4）。 */
  level: number;
  /** ルート要素に付与する追加クラス名。 */
  className?: string;
}

export function FavoriteLevelDisplay({
  level,
  className,
}: FavoriteLevelDisplayProps): JSX.Element {
  const { filled, total, textEquivalent } = deriveFavoriteLevelDisplay(level);

  // 合計 total（=5）個の記号のうち、先頭 filled 個を塗り記号、残りを未塗り記号にする。
  const symbols = Array.from({ length: total }, (_, i) => i < filled);

  const rootClassName = className
    ? `favorite-level-display ${className}`
    : 'favorite-level-display';

  return (
    <span className={rootClassName} role="img" aria-label={textEquivalent}>
      {symbols.map((isFilled, i) => (
        <span key={i} aria-hidden="true">
          {isFilled ? '🩷' : '🤍'}
        </span>
      ))}
    </span>
  );
}
