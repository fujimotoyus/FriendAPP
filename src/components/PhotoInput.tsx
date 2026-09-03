/**
 * PhotoInput — 写真取り込み用の `<input type="file">` ラッパ。
 *
 * `<input type="file" accept="image/*" capture="environment">` を隠しつつ、
 * かわいいタップ可能なラベル/ボタンで包む（要件1.2）。ラベルは最小 44×44 CSS px の
 * タッチ領域を確保する（要件7.7）。デザインシステムのトークン（`--color-*`・
 * `--radius-*`）でパステル・角丸のポップな見た目にする（要件7.5）。
 *
 * ファイル選択の結果は呼び出し側へコールバックで通知する。ファイルが選択されれば
 * `onSelect(file)`、キャンセル（空の FileList / 選択なし）やブラウザによるアクセス
 * ブロックの場合は `onCancel()` を呼ぶ。これにより呼び出し側は「写真が取り込まれ
 * なかった」旨を伝え、入力内容を保持したまま再取得を促せる（要件1.11）。
 *
 * Requirements: 1.2, 1.11, 7.5, 7.7
 */
import { useId, useRef } from 'react';
import type { ChangeEvent } from 'react';

export interface PhotoInputProps {
  /** ファイルが選択されたときに、その File を受け取るコールバック。 */
  onSelect: (file: File) => void;
  /**
   * ファイル選択がキャンセルされた、またはアクセスがブロックされて
   * 何も取得できなかったときに呼ばれるコールバック（要件1.11）。省略可。
   */
  onCancel?: () => void;
  /** ラベル/ボタンに表示する文言。省略時は既定の文言。 */
  label?: string;
  /** ルート要素に付与する追加クラス名。 */
  className?: string;
}

export function PhotoInput({
  onSelect,
  onCancel,
  label = '写真をえらぶ 📷',
  className,
}: PhotoInputProps): JSX.Element {
  // label の htmlFor と input の id を紐づけ、複数配置時の衝突を避ける。
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className={className ? `photo-input ${className}` : 'photo-input'}>
      <label htmlFor={inputId} className="photo-input__label touch-target">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="photo-input__field"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
      />
    </div>
  );
}
