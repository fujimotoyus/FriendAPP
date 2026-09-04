/**
 * PhotoFrame — 角丸の写真表示枠。
 *
 * {@link PhotoData}（ArrayBuffer + MIME）または null を受け取り、表示のたびに
 * `new Blob([data], { type })` で Blob を生成し `URL.createObjectURL` で Object URL を
 * 生成して表示する。ここで生成する Blob は表示（URL 生成）専用であり、IndexedDB には
 * 保存しない（保存されるのは ArrayBuffer のまま。iOS WebKit の Blob/File 保存バグ回避）。
 * `photo` が変わったときとアンマウント時に `URL.revokeObjectURL` で URL を解放し、
 * Object URL の蓄積によるメモリリークを防ぐ（design.md「写真ストレージ戦略」）。
 * 写真が null / data が空の場合、または `<img onError>` でデコードに失敗した場合は
 * プレースホルダー表示にフォールバックする（要件2.4）。
 *
 * 角丸はデザインシステムの `.photo-frame`（`--radius-large`）で表現する
 * （design.md「Design Theme and Design System」、要件7.5）。
 *
 * Requirements: 2.4, 7.5
 */
import { useEffect, useState } from 'react';
import type { PhotoData } from '../domain/types';

export interface PhotoFrameProps {
  /** 表示する写真（ArrayBuffer + MIME）。未取得・未設定は null（プレースホルダー表示）。 */
  photo: PhotoData | null;
  /** 画像の代替テキスト（アクセシビリティ）。省略時は空文字。 */
  alt?: string;
  /** ルート要素に付与する追加クラス名（レイアウト調整用）。 */
  className?: string;
}

/**
 * 写真が無い / 読み込みに失敗したときに表示するプレースホルダー。
 * 他カードの表示継続を妨げないよう、当該枠のみに描画される（要件2.4）。
 */
function PhotoPlaceholder(): JSX.Element {
  return (
    <div className="photo-frame__placeholder" role="img" aria-label="写真なし">
      <span className="photo-frame__placeholder-icon" aria-hidden="true">
        🐾
      </span>
    </div>
  );
}

export function PhotoFrame({ photo, alt = '', className }: PhotoFrameProps): JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  // 画像デコード失敗（onError）時にプレースホルダーへフォールバックする（要件2.4）。
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // 写真が無い / バイト列が空なら Object URL を生成しない。
    if (photo == null || photo.data == null || photo.data.byteLength === 0) {
      setObjectUrl(null);
      setHasError(false);
      return;
    }

    // 表示専用の Blob を ArrayBuffer から都度生成し、Object URL を作る。
    // この Blob は保存しない（IndexedDB には ArrayBuffer のまま保存される）。
    const blob = new Blob([photo.data], { type: photo.type });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    setHasError(false);

    // photo 変更時・アンマウント時に URL を解放してメモリリークを防ぐ。
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  const showPlaceholder = photo == null || hasError || objectUrl == null;

  return (
    <div className={className ? `photo-frame ${className}` : 'photo-frame'}>
      {showPlaceholder ? (
        <PhotoPlaceholder />
      ) : (
        <img src={objectUrl} alt={alt} onError={() => setHasError(true)} />
      )}
    </div>
  );
}
