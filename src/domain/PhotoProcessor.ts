/**
 * PhotoProcessor: 写真ファイルの形式・サイズ検証（純粋 TypeScript ドメインモジュール）
 *
 * 端末の写真ライブラリ／カメラから取り込まれた画像ファイルを、Character として
 * 保存する前に検証する。対応 MIME（JPEG/PNG/WebP）判定とサイズ上限チェックを行い、
 * 非対応形式は `unsupportedFormat`、上限超過は `tooLarge` を `PhotoError` として返す。
 *
 * 本モジュールは React / IndexedDB には依存しない。ブラウザの `File` / `Blob` 型のみを
 * 用いる純粋関数で構成し、property-based testing の対象とする（design.md
 * 「Domain モジュール / PhotoProcessor」「写真ストレージ戦略」）。
 *
 * 参照: design.md「Components and Interfaces / Domain モジュール」「Persistence Design /
 * 写真ストレージ戦略」、要件1.10, 8.2、Correctness Property 4
 */

import type { PhotoError, Result } from './types';

/**
 * 対応する画像 MIME タイプ。ブラウザが標準で扱える形式（JPEG/PNG/WebP）に準ずる。
 * これ以外の形式は `unsupportedFormat` として取り込みを拒否する。
 *
 * 参照: 用語集「Character_Photo」、要件1.10, 8.2
 */
export const SUPPORTED_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * 写真1件あたりのサイズ上限（バイト）。
 *
 * 端末の写真1枚相当を目安とし、10 MiB（10 * 1024 * 1024 バイト）を上限とする。
 * これを超えるファイルは `tooLarge` として取り込みを拒否する。
 *
 * 参照: 用語集「Character_Photo」、要件1.10, 8.2
 */
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * 写真ファイルの形式・サイズを検証し、正常なら保存用の Blob を返す。
 *
 * 検証順序:
 * 1. MIME タイプが対応形式（{@link SUPPORTED_MIME_TYPES}）でなければ
 *    `{ ok: false, error: { kind: 'unsupportedFormat' } }` を返す（要件1.10, 8.2）。
 * 2. サイズが上限（{@link MAX_PHOTO_SIZE_BYTES}）を超えていれば
 *    `{ ok: false, error: { kind: 'tooLarge' } }` を返す（要件1.10, 8.2）。
 * 3. いずれも満たせば `{ ok: true, value: <Blob> }` を返す。
 *    `File` は `Blob` のサブタイプであり、ここでは重い再エンコードは行わず
 *    ファイルそのものを保存対象の Blob として返す（design.md「写真ストレージ戦略」）。
 *
 * @param file 取り込まれた画像ファイル
 * @returns 検証結果（成功時は保存用 Blob、失敗時は {@link PhotoError}）
 */
export function validateAndProcess(
  file: File,
): Promise<Result<Blob, PhotoError>> {
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return Promise.resolve({ ok: false, error: { kind: 'unsupportedFormat' } });
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return Promise.resolve({ ok: false, error: { kind: 'tooLarge' } });
  }

  return Promise.resolve({ ok: true, value: file });
}
