/**
 * EmptyStateView — 空状態の案内表示（任意で CTA 付き）。
 *
 * 一覧が 0 件のとき（要件2.7, 8.6）、ガチャの対象が 0 件のとき（要件5.6）などに、
 * フレンドリなメッセージと（任意の）行動導線を表示する。パステル基調・角丸の
 * やさしい見た目にする（design.md「Design Theme and Design System」）。
 *
 * `actionLabel` と `onAction` が両方与えられたときのみ CTA ボタンを描画する。
 *
 * Requirements: 2.7, 5.6, 8.6
 */
import { PastelButton } from './PastelButton';

export interface EmptyStateViewProps {
  /** 表示する案内メッセージ。 */
  message: string;
  /** CTA ボタンのラベル。`onAction` と併せて指定したときのみボタンを表示する。 */
  actionLabel?: string;
  /** CTA ボタン押下時のハンドラ。`actionLabel` と併せて指定する。 */
  onAction?: () => void;
  /** 見出しに添える絵文字/アイコン。省略時は既定の絵文字。 */
  icon?: string;
}

export function EmptyStateView({
  message,
  actionLabel,
  onAction,
  icon = '🐾',
}: EmptyStateViewProps): JSX.Element {
  // ラベルとハンドラが揃っているときだけ行動導線（CTA）を出す（要件2.7, 5.6, 8.6）。
  const showAction = actionLabel != null && onAction != null;

  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state__message">{message}</p>
      {showAction ? (
        <PastelButton onClick={onAction}>{actionLabel}</PastelButton>
      ) : null}
    </div>
  );
}
