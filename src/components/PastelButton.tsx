/**
 * PastelButton — 主要アクション用のかわいくポップなボタン。
 *
 * パステルアクセント（既定は `--color-primary`）・角丸中（`--radius-medium`）・
 * 最小 44×44 CSS px のタッチ領域（`.touch-target`）を備える
 * （design.md「Design Theme and Design System」、要件7.5, 7.7）。
 * `variant` により主要（primary）/ 補助（secondary）のパステル配色を切り替える。
 *
 * Requirements: 7.5, 7.7
 */
import type { MouseEventHandler, ReactNode } from 'react';

/** ボタンの配色バリアント。primary=パステルピンク、secondary=パステルミント。 */
export type PastelButtonVariant = 'primary' | 'secondary';

export interface PastelButtonProps {
  /** ボタンに表示する内容（ラベル・アイコン等）。 */
  children: ReactNode;
  /** クリック時のハンドラ。 */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** ボタンの `type` 属性。省略時は 'button'（フォーム誤送信を避ける）。 */
  type?: 'button' | 'submit' | 'reset';
  /** 無効化フラグ。true で操作不可・淡色表示にする。 */
  disabled?: boolean;
  /** 配色バリアント。省略時は 'primary'。要件7.5 */
  variant?: PastelButtonVariant;
  /** ルート要素に付与する追加クラス名（レイアウト調整用）。 */
  className?: string;
}

export function PastelButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'primary',
  className,
}: PastelButtonProps): JSX.Element {
  // 基本クラス（角丸・44px タッチ領域）にバリアント別クラスと追加クラスを合成する。
  const classes = [
    'pastel-button',
    `pastel-button--${variant}`,
    'touch-target',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
