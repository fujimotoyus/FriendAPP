/**
 * PhotoProcessor: 写真ファイルの形式・サイズ検証と保存用 Blob への正規化（純粋 TypeScript ドメインモジュール）
 *
 * 端末の写真ライブラリ／カメラから取り込まれた画像ファイルを、Character として
 * 保存する前に検証する。対応 MIME（JPEG/PNG/WebP）判定とサイズ上限チェックを行い、
 * 非対応形式は `unsupportedFormat`、上限超過は `tooLarge` を `PhotoError` として返す。
 *
 * 正常時は、`File` をそのまま返すのではなく、内容を ArrayBuffer に読み出して
 * 素の `Blob`（`new Blob([bytes], { type })`）へ変換して返す。これは iOS Safari の
 * PWA で `input[type=file]` 由来の `File` を IndexedDB に構造化複製で保存しようとすると
 * put/add が失敗したり、保存できても再取得時に中身が失われる（画像が表示できない）
 * 既知の問題を回避するためである。素の Blob に正規化しておくことで、端末・環境を問わず
 * 安定して保存・復元できる。
 *
 * 本モジュールは React / IndexedDB には依存しない。ブラウザの `File` / `Blob` 型のみを
 * 用いる純粋関数で構成する（design.md「Domain モジュール / PhotoProcessor」「写真ストレージ戦略」）。
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
 * File / Blob を、IndexedDB に安定して保存できる素の Blob へ正規化する。
 *
 * 内容を ArrayBuffer に読み出し、同じ MIME タイプの新しい Blob を生成して返す。
 * `arrayBuffer()` が使えない古い環境向けに `FileReader` へフォールバックする。
 * 変換に失敗した場合は元の Blob をそのまま返す（最低限の後方互換）。
 *
 * iOS PWA での File 直接保存の不具合回避が目的（本モジュール冒頭の説明を参照）。
 */
async function toStorableBlob(file: Blob): Promise<Blob> {
  const type = file.type || 'application/octet-stream';
  try {
    if (typeof file.arrayBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      return new Blob([buffer], { type });
    }
  } catch {
    // 読み出しに失敗した場合は下のフォールバック、または元の Blob を返す。
  }

  // 古い環境向けフォールバック: FileReader で ArrayBuffer を読み出す。
  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
    return new Blob([buffer], { type });
  } catch {
    // どうしても変換できない場合は元の Blob を返す（保存を試みる）。
    return file;
  }
}

/**
 * 写真ファイルの形式・サイズを検証し、正常なら保存用の Blob を返す。
 *
 * 検証順序:
 * 1. MIME タイプが対応形式（{@link SUPPORTED_MIME_TYPES}）でなければ
 *    `{ ok: false, error: { kind: 'unsupportedFormat' } }` を返す（要件1.10, 8.2）。
 * 2. サイズが上限（{@link MAX_PHOTO_SIZE_BYTES}）を超えていれば
 *    `{ ok: false, error: { kind: 'tooLarge' } }` を返す（要件1.10, 8.2）。
 * 3. いずれも満たせば内容を素の Blob へ正規化して
 *    `{ ok: true, value: <Blob> }` を返す（iOS PWA での保存不具合回避）。
 *
 * @param file 取り込まれた画像ファイル
 * @returns 検証結果（成功時は保存用 Blob、失敗時は {@link PhotoError}）
 */
export async function validateAndProcess(
  file: File,
): Promise<Result<Blob, PhotoError>> {
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: { kind: 'unsupportedFormat' } };
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return { ok: false, error: { kind: 'tooLarge' } };
  }

  const blob = await toStorableBlob(file);
  return { ok: true, value: blob };
}