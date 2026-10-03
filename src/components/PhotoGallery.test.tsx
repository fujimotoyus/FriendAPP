/**
 * PhotoGallery のユニットテスト（詳細ギャラリーの構造、要件23.8, 23.9, 23.10）。
 *
 * - 複数写真を取り込み順に各 `.photo-gallery__item` として並べ、各写真を PhotoFrame で
 *   描画すること（枚数分のスライド、要件23.8）。
 * - コンテナ `.photo-gallery` が横スクロールを自身に限定する（`overflow-x` を持つ）こと
 *   （要件23.9）。本格スタイルはタスク78だが、最低限の指定を確認する。
 * - 写真 0 枚（想定外）のときは PhotoFrame のプレースホルダー（aria-label「写真なし」）へ
 *   フォールバックすること（要件23.10 の読み替え）。
 * - `style` でコンテナへ縁取り等のスタイルを渡せること（要件23.8 の配線準備）。
 *
 * 画像デコード（Object URL 生成）は jsdom では行われないため、ここでは DOM 構造と
 * 枚数・プレースホルダーの有無に焦点を当てる。
 *
 * 参照: design.md「イテレーション15（複数写真対応）」、要件23.8, 23.9, 23.10
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PhotoData } from '../domain/types';
import { PhotoGallery } from './PhotoGallery';

/** テスト用の最小 PhotoData を作る。 */
function makePhoto(byte: number): PhotoData {
  return { data: new Uint8Array([byte]).buffer, type: 'image/png' };
}

describe('PhotoGallery', () => {
  it('複数写真を取り込み順に .photo-gallery__item として並べる', () => {
    const photos = [makePhoto(1), makePhoto(2), makePhoto(3)];
    const { container } = render(<PhotoGallery photos={photos} />);
    const items = container.querySelectorAll('.photo-gallery__item');
    expect(items).toHaveLength(3);
    // 各スライドは PhotoFrame（.photo-frame）を含む。
    expect(container.querySelectorAll('.photo-gallery__item .photo-frame')).toHaveLength(3);
  });

  it('写真 1 枚でもスライド 1 枚として表示する', () => {
    const { container } = render(<PhotoGallery photos={[makePhoto(1)]} />);
    expect(container.querySelectorAll('.photo-gallery__item')).toHaveLength(1);
  });

  it('コンテナ .photo-gallery は横スクロールを自身に限定する（overflow-x）', () => {
    const { container } = render(<PhotoGallery photos={[makePhoto(1)]} />);
    const gallery = container.querySelector('.photo-gallery') as HTMLElement;
    expect(gallery).not.toBeNull();
    expect(gallery.style.overflowX).toBe('auto');
  });

  it('写真 0 枚のときはプレースホルダー 1 枚へフォールバックする', () => {
    const { container } = render(<PhotoGallery photos={[]} />);
    expect(container.querySelectorAll('.photo-gallery__item')).toHaveLength(1);
    // PhotoFrame の null プレースホルダーは aria-label「写真なし」を持つ。
    expect(screen.getByLabelText('写真なし')).toBeInTheDocument();
  });

  it('style でコンテナへ追加スタイル（縁取り色など）を渡せる', () => {
    const { container } = render(
      <PhotoGallery photos={[makePhoto(1)]} style={{ borderColor: 'var(--image-color-rose)' }} />,
    );
    const gallery = container.querySelector('.photo-gallery') as HTMLElement;
    expect(gallery.style.borderColor).toBe('var(--image-color-rose)');
    // overflow-x（本体の限定指定）も維持される。
    expect(gallery.style.overflowX).toBe('auto');
  });
});
