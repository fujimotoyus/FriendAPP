/**
 * 複数写真（Character_Photos、要件23）に関するドメイン定数・純粋関数。
 *
 * 本モジュールは React / IndexedDB / File API に依存しない純粋な TypeScript のみで構成する
 * （design.md「イテレーション15（複数写真対応、要件23）」参照）。写真は従来どおり
 * ArrayBuffer(バイト列)+MIME（{@link ./types.PhotoData}）として扱い、外部サーバーへは
 * 一切送信しない（要件23.15, 3.3, 3.8）。
 */

/**
 * 1 件の Character が保持できる写真（Character_Photo）の枚数上限（Character_Photos_Max）。
 *
 * Character は写真を 1 枚以上・最大 {@link PHOTOS_MAX} 枚（= 5）保持する。取り込み・追加で
 * この上限を超える分は拒否し、既存の写真と他の入力内容は保持する（要件23.2, 23.3）。
 *
 * 参照: design.md「イテレーション15」、要件23.2, 23.14
 */
export const PHOTOS_MAX = 5;
import type { PhotoData } from './types';

/**
 * 複数写真の取り込み結果（{@link addPhotos} の戻り値）。
 */
export interface AddPhotosResult {
  /** 連結して先頭から最大 {@link PHOTOS_MAX} 枚へ切り詰めた新しい写真配列（取り込み順を保持）。 */
  photos: PhotoData[];
  /** 連結後の総数が {@link PHOTOS_MAX} を超え、超過分を切り詰めたとき true。 */
  truncated: boolean;
}

/**
 * 既存写真列 `current` に取り込み写真列 `incoming` を取り込み順に連結し、先頭から最大
 * {@link PHOTOS_MAX}（= 5）枚へ切り詰めた新しい配列を返す純粋関数（Character_Photos、要件23.2, 23.3）。
 *
 * - **順序保存**: 戻り値 `photos` は `current` の全要素に続けて `incoming` の要素を取り込み順に
 *   連結した列の、先頭から最大 `PHOTOS_MAX` 枚の prefix に等しい（`current` が既に 5 枚以上なら
 *   `incoming` は一切追加されない）。
 * - **上限**: `photos.length <= PHOTOS_MAX` を常に満たす。
 * - **truncated**: `current.length + incoming.length > PHOTOS_MAX` のとき `true`、そうでなければ `false`。
 * - **入力不変**: `current` / `incoming`（配列および各 {@link PhotoData}）を一切変更しない（副作用なし）。
 *
 * 参照: design.md「イテレーション15」「Correctness Property 33」、要件23.2, 23.3, 23.14
 */
export function addPhotos(
  current: readonly PhotoData[],
  incoming: readonly PhotoData[],
): AddPhotosResult {
  const combined = [...current, ...incoming];
  const truncated = combined.length > PHOTOS_MAX;
  const photos = combined.slice(0, PHOTOS_MAX);
  return { photos, truncated };
}
