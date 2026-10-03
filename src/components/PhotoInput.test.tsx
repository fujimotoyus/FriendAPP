/**
 * PhotoInput のユニットテスト（複数選択対応 / 後方互換、要件23.1）。
 *
 * - 既存の単一選択モード（既定）では `accept="image/*"` を持ち `multiple` 属性を持たず、
 *   ファイル選択で `onSelect(file)`、空の FileList で `onCancel()` を呼ぶこと（後方互換、
 *   要件1.2, 1.11）。
 * - 複数選択モード（`multiple`）では `<input ... multiple>` を描画し、選択された FileList を
 *   `onSelectFiles(files)` でそのまま返すこと（`useRegistration.pickPhotos` へ直結、要件23.1）。
 * - `source="camera"` のとき `capture` 属性を付与すること（要件1.2）。
 *
 * 参照: design.md「イテレーション15（複数写真対応）」、要件1.2, 1.11, 23.1
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PhotoInput } from './PhotoInput';

/** label の表示文言から対応する `<input type="file">` を取得する。 */
function getFileInput(): HTMLInputElement {
  // 隠し input は label と htmlFor/id で紐づく。role を持たないため直接 DOM から取得する。
  const input = document.querySelector('input[type="file"]');
  if (input == null) throw new Error('file input not found');
  return input as HTMLInputElement;
}

describe('PhotoInput', () => {
  it('既定（単一選択）では accept="image/*" を持ち multiple 属性を持たない', () => {
    render(<PhotoInput onSelect={vi.fn()} />);
    const input = getFileInput();
    expect(input).toHaveAttribute('accept', 'image/*');
    expect(input).not.toHaveAttribute('multiple');
  });

  it('source="camera" のとき capture 属性を付与する', () => {
    render(<PhotoInput source="camera" onSelect={vi.fn()} />);
    const input = getFileInput();
    expect(input).toHaveAttribute('capture', 'environment');
  });

  it('単一選択でファイルが選ばれると onSelect に先頭ファイルを渡す', () => {
    const onSelect = vi.fn();
    render(<PhotoInput onSelect={onSelect} />);
    const input = getFileInput();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('空の FileList（選択なし/ブロック）では onCancel を呼ぶ', () => {
    const onCancel = vi.fn();
    render(<PhotoInput onSelect={vi.fn()} onCancel={onCancel} />);
    const input = getFileInput();
    fireEvent.change(input, { target: { files: [] } });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('multiple のとき input に multiple 属性を付与する', () => {
    render(<PhotoInput multiple onSelectFiles={vi.fn()} />);
    const input = getFileInput();
    expect(input).toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('multiple で複数ファイルが選ばれると onSelectFiles に FileList を渡す', () => {
    const onSelectFiles = vi.fn();
    render(<PhotoInput multiple onSelectFiles={onSelectFiles} />);
    const input = getFileInput();
    const f1 = new File(['1'], 'a.png', { type: 'image/png' });
    const f2 = new File(['2'], 'b.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [f1, f2] } });
    expect(onSelectFiles).toHaveBeenCalledTimes(1);
    const passed = onSelectFiles.mock.calls[0][0] as FileList;
    expect(passed).toHaveLength(2);
    expect(passed[0]).toBe(f1);
    expect(passed[1]).toBe(f2);
  });

  it('multiple でも空選択なら onCancel を呼び onSelectFiles は呼ばない', () => {
    const onSelectFiles = vi.fn();
    const onCancel = vi.fn();
    render(<PhotoInput multiple onSelectFiles={onSelectFiles} onCancel={onCancel} />);
    const input = getFileInput();
    fireEvent.change(input, { target: { files: [] } });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelectFiles).not.toHaveBeenCalled();
  });
});
