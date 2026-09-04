/**
 * PhotoProcessor: 写真ファイルの形式・サイズ検証と保存用 PhotoData への正規化（純粋 TypeScript ドメインモジュール）
 *
 * 端末の写真ライブラリ／カメラから取り込まれた画像ファイルを、Character として
 * 保存する前に検証する。対応 MIME（JPEG/PNG/WebP）判定とサイズ上限チェックを行い、
 * 非対応形式は `unsupportedFormat`、上限超過は `tooLarge` を `PhotoError` として返す。
 *
 * 正常時は、`File` をそのまま返すのではなく、内容を ArrayBuffer に読み出し、
 * `{ data: <ArrayBuffer>, type: <MIME> }`（{@link PhotoData}）へ正規化して返す。
 * これは iOS Safari の PWA で `Blob` / `File` を IndexedDB に構造化複製で保存しようとすると
 * `UnknownError: Error preparing Blob/File data to be stored in object store` で失敗する
 * WebKit の既知バグを回避するためである。ArrayBuffer（バイト列）ならこのバグを踏まず、
 * 端末・環境を問わず安定して保存・復元できる。
 *
 * 本モジュールは React / IndexedDB には依存しない。ブラウザの `File` / `Blob` 型のみを
 * 用いる純粋関数で構成する（design.md「Domain モジュール / PhotoProcessor」「写真ストレージ戦略」）。
 *
 * 参照: design.md「Components and Interfaces / Domain モジュール」「Persistence Design /
 * 写真ストレージ戦略」、要件1.10, 8.2、Correctness Property 4
 */

import type { PhotoData, PhotoError, Result } from './types';

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
 * File / Blob の内容を ArrayBuffer に読み出す。
 *
 * `arrayBuffer()` が使えない古い環境向けに `FileReader` へフォールバックする。
 * どちらでも読み出せない場合は例外を送出する（呼び出し側で acquisitionFailed に変換）。
 */
async function readArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return await file.arrayBuffer();
  }

  // 古い環境向けフォールバック: FileReader で ArrayBuffer を読み出す。
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 写真ファイルの形式・サイズを検証し、正常なら保存用の {@link PhotoData} を返す。
 *
 * 検証順序:
 * 1. MIME タイプが対応形式（{@link SUPPORTED_MIME_TYPES}）でなければ
 *    `{ ok: false, error: { kind: 'unsupportedFormat' } }` を返す（要件1.10, 8.2）。
 * 2. サイズが上限（{@link MAX_PHOTO_SIZE_BYTES}）を超えていれば
 *    `{ ok: false, error: { kind: 'tooLarge' } }` を返す（要件1.10, 8.2）。
 * 3. いずれも満たせば内容を ArrayBuffer に読み出し
 *    `{ ok: true, value: { data: <ArrayBuffer>, type: file.type } }` を返す
 *    （iOS PWA での Blob/File 保存不具合の回避）。
 *
 * ArrayBuffer の読み出しに失敗した場合は例外を送出する（呼び出し側の pickPhoto が
 * acquisitionFailed として扱う）。
 *
 * @param file 取り込まれた画像ファイル
 * @returns 検証結果（成功時は保存用 PhotoData、失敗時は {@link PhotoError}）
 */
export async function validateAndProcess(
  file: File,
): Promise<Result<PhotoData, PhotoError>> {
  if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: { kind: 'unsupportedFormat' } };
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return { ok: false, error: { kind: 'tooLarge' } };
  }

  const data = await readArrayBuffer(file);
  return { ok: true, value: { data, type: file.type } };
}
