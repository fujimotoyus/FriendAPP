/**
 * PhotoFrame — 角丸の写真表示枠。
 *
 * Blob（または null）を受け取り、`URL.createObjectURL` で Object URL を生成して
 * 表示する。Blob が変わったときとアンマウント時に `URL.revokeObjectURL` で URL を
 * 解放し、Object URL の蓄積によるメモリリークを防ぐ（design.md「写真ストレージ戦略
 * / Blob と Object URL」）。写真が null の場合、または `<img onError>` でデコードに
 * 失敗した場合はプレースホルダー表示にフォールバックする（要件2.4）。
 *
 * 角丸はデザインシステムの `.photo-frame`（`--radius-large`）で表現する
 * （design.md「Design Theme and Design System」、要件7.5）。
 *
 * Requirements: 2.4, 7.5
 */
import { useEffect, useState } from 'react';

export interface PhotoFrameProps {
  /** 表示する写真の Blob。未取得・未設定は null（プレースホルダー表示）。 */
  photo: Blob | null;
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
    // 写真が無ければ Object URL を生成しない。
    if (photo == null) {
      setObjectUrl(null);
      setHasError(false);
      return;
    }

    // Blob から Object URL を生成し、新しい写真になるたびにエラー状態をリセットする。
    const url = URL.createObjectURL(photo);
    setObjectUrl(url);
    setHasError(false);

    // Blob 変更時・アンマウント時に URL を解放してメモリリークを防ぐ。
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
