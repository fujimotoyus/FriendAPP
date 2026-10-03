/**
 * PhotoGallery — 複数写真の横スクロールギャラリー（詳細画面用、要件23.8）。
 *
 * `photos: PhotoData[]` を取り込み順に、横スクロール可能な scroll-snap ギャラリーとして
 * 並べて表示する。各写真は既存の {@link PhotoFrame} を再利用して描画するため、各写真の
 * Object URL 生成/解放・`onError` によるプレースホルダーフォールバック（要件23.10）は
 * PhotoFrame 側の既存挙動がそのまま効く。
 *
 * 横スクロールはギャラリーのコンテナ（`.photo-gallery`）内に限定し、画面全体には溢れさせ
 * ない（要件23.9）。本格的なスタイル（scroll-snap・各スライド幅・余白等）はタスク78で
 * `global.css` にトークン経由で定義する。本コンポーネントはクラス付与と構造、および
 * 最低限のインラインスタイル（`overflowX: 'auto'`）のみを担い、ロジックは持たず表示に徹する。
 *
 * - 写真が 1 枚のときはスクロール不要でそのまま表示する。
 * - 写真が 0 枚（想定外）のときは `PhotoFrame photo={null}` 1 枚でプレースホルダー表示に
 *   フォールバックする。
 *
 * イメージカラーの縁取り（`deriveImageColorStyle` 由来の border 色）は、呼び出し側から
 * `style` でコンテナへ渡せる（配線はタスク77）。
 *
 * Requirements: 23.8, 23.9, 23.10, 23.16
 */
import type { CSSProperties } from 'react';
import type { PhotoData } from '../domain/types';
import { PhotoFrame } from './PhotoFrame';

export interface PhotoGalleryProps {
  /** 表示する写真の配列（取り込み順）。空配列のときはプレースホルダー1枚にフォールバック。 */
  photos: PhotoData[];
  /** 各画像の代替テキスト（アクセシビリティ）。省略時は空文字。 */
  alt?: string;
  /**
   * ギャラリーのコンテナ（`.photo-gallery`）に付与する追加インラインスタイル。
   * 詳細の写真枠の縁取り色（イメージカラー）をトークン経由で渡すために用いる（要件23.8）。
   */
  style?: CSSProperties;
  /** ルート要素に付与する追加クラス名（レイアウト調整用）。 */
  className?: string;
}

export function PhotoGallery({ photos, alt = '', style, className }: PhotoGalleryProps): JSX.Element {
  const containerClassName = className ? `photo-gallery ${className}` : 'photo-gallery';

  // 0 枚（想定外）はプレースホルダー 1 枚へフォールバックする。
  const items = photos.length > 0 ? photos : [null];

  return (
    <div
      className={containerClassName}
      // 本格スタイルはタスク78に委ねる。ここでは横スクロールをコンテナ内に限定する
      // 最低限の指定のみを置く（要件23.9）。
      style={{ overflowX: 'auto', ...style }}
    >
      {items.map((photo, index) => (
        <div className="photo-gallery__item" key={index}>
          <PhotoFrame photo={photo} alt={alt} />
        </div>
      ))}
    </div>
  );
}
