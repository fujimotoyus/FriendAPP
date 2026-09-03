/**
 * PhotoInput — 写真取り込み用の `<input type="file">` ラッパ。
 *
 * `source` によって取り込み元を切り替える（要件1.2）:
 * - `camera`:  `<input type="file" accept="image/*" capture="environment">`。
 *              モバイルではカメラ（写真撮影）を起動する。
 * - `library`: `<input type="file" accept="image/*">`（capture なし）。
 *              端末の写真ライブラリ / ファイルから選ぶ（フォトからアップロード）。
 *
 * ネイティブ input を隠しつつ、かわいいタップ可能なラベルで包む。ラベルは最小
 * 44×44 CSS px のタッチ領域を確保する（要件7.7）。デザインシステムのトークン
 * （`--color-*`・`--radius-*`）でパステル・角丸のポップな見た目にする（要件7.5）。
 *
 * ファイル選択の結果は呼び出し側へコールバックで通知する。ファイルが選択されれば
 * `onSelect(file)`、キャンセル（空の FileList / 選択なし）やブラウザによるアクセス
 * ブロックの場合は `onCancel()` を呼ぶ。これにより呼び出し側は「写真が取り込まれ
 * なかった」旨を伝え、入力内容を保持したまま再取得を促せる（要件1.11）。
 *
 * Requirements: 1.2, 1.11, 7.5, 7.7
 */
import { useId } from 'react';
import type { ChangeEvent } from 'react';

/** 取り込み元。camera=写真撮影 / library=フォトから選択。 */
export type PhotoSource = 'camera' | 'library';

export interface PhotoInputProps {
  /** ファイルが選択されたときに、その File を受け取るコールバック。 */
  onSelect: (file: File) => void;
  /**
   * ファイル選択がキャンセルされた、またはアクセスがブロックされて
   * 何も取得できなかったときに呼ばれるコールバック（要件1.11）。省略可。
   */
  onCancel?: () => void;
  /** 取り込み元。省略時は 'library'（フォトから選択）。要件1.2 */
  source?: PhotoSource;
  /** ラベル/ボタンに表示する文言。省略時は source に応じた既定の文言。 */
  label?: string;
  /** ルート要素に付与する追加クラス名。 */
  className?: string;
}

/** source ごとの既定ラベル。 */
const DEFAULT_LABELS: Record<PhotoSource, string> = {
  camera: '写真をとる 📷',
  library: 'フォトからえらぶ 🖼️',
};

export function PhotoInput({
  onSelect,
  onCancel,
  source = 'library',
  label,
  className,
}: PhotoInputProps): JSX.Element {
  // label の htmlFor と input の id を紐づけ、複数配置時の衝突を避ける。
  const inputId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.target.files;

    // 空の FileList / 選択なし = キャンセル、またはアクセスブロック（要件1.11）。
    if (files == null || files.length === 0) {
      onCancel?.();
    } else {
      onSelect(files[0]);
    }

    // 同じファイルを再選択しても change が発火するよう入力値をリセットする。
    // これにより再取得（やり直し）の導線が常に機能する（要件1.11）。
    event.target.value = '';
  };

  const text = label ?? DEFAULT_LABELS[source];

  return (
    <div className={className ? `photo-input ${className}` : 'photo-input'}>
      <label htmlFor={inputId} className="photo-input__label touch-target">
        {text}
      </label>
      <input
        id={inputId}
        className="photo-input__field"
        type="file"
        accept="image/*"
        // camera のときだけ capture を付与してカメラ起動を促す（要件1.2）。
        {...(source === 'camera' ? { capture: 'environment' as const } : {})}
        onChange={handleChange}
      />
    </div>
  );
}
