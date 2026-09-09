/**
 * NavigationBar — 画面下部に固定表示する共通タブナビゲーション（要件13）。
 *
 * 「図鑑」「今日の相棒」「トーナメント」「新規登録」の 4 項目を提供し、それぞれ
 * Collection_View / Daily_Gacha / Ranking_Battle / Registration_Form（新規登録）への
 * 到達手段になる（要件13.1〜13.5）。現在表示中の画面に対応するタブを選択状態として
 * 視覚的に区別する（`aria-current="page"`。要件13.6）。新規登録タブはアクション導線の
 * ため選択状態を持たない。
 *
 * 各タブは最小 44×44 CSS px のタッチ領域を持ち（要件13.8 / 7.7）、ビューポート
 * 320〜430 px の縦向きでも横スクロールを発生させずに 4 項目が収まる（各タブ flex:1・
 * 折り返さない・ラベル小さめ。要件13.9 / 7.6）。大人かわいいテーマのトークン（色/角丸/
 * 影/余白/トランジション）に整合した外観を持つ（要件13.10 / 要件9）。
 *
 * 本コンポーネントは表示と操作受け取りのみを担い、画面遷移の責務は App が持つ。
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.8, 13.9, 13.10
 */

/** Navigation_Bar が選択状態として区別できる主要画面。 */
export type NavigationActive = 'list' | 'gacha' | 'battle';

/** タブ選択で通知する遷移先。新規登録（'add'）は選択状態を持たないアクション導線。 */
export type NavigationTarget = 'list' | 'gacha' | 'battle' | 'add';

export interface NavigationBarProps {
  /** 現在表示中の主要画面。対応するタブを選択状態にする（要件13.6）。 */
  active: NavigationActive;
  /** タブ選択時に遷移先を通知するコールバック。 */
  onNavigate: (target: NavigationTarget) => void;
}

/** タブ定義。target が active と一致するタブを選択状態にする（'add' は非選択）。 */
interface NavigationItem {
  target: NavigationTarget;
  label: string;
  icon: string;
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { target: 'list', label: '図鑑', icon: '📖' },
  { target: 'gacha', label: '今日の相棒', icon: '💛' },
  { target: 'battle', label: 'トーナメント', icon: '🏆' },
  { target: 'add', label: '新規登録', icon: '➕' },
];

export function NavigationBar({ active, onNavigate }: NavigationBarProps): JSX.Element {
  return (
    <nav className="navigation-bar" aria-label="メインナビゲーション">
      <ul className="navigation-bar__list">
        {NAVIGATION_ITEMS.map((item) => {
          // 新規登録（'add'）は選択状態を持たないアクション導線（要件13.5）。
          const isActive = item.target === active;
          const classes = [
            'navigation-bar__item',
            'touch-target',
            isActive ? 'navigation-bar__item--active' : null,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li key={item.target} className="navigation-bar__list-item">
              <button
                type="button"
                className={classes}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.target)}
              >
                <span className="navigation-bar__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="navigation-bar__label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
