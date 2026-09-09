/**
 * deriveCardDisplay — 一覧カードの表示モデル導出（純粋 TypeScript ドメインモジュール）
 *
 * 図鑑一覧（Collection_View）の各カードでは、二人だけの呼び方であるニックネームを
 * 目立たせるため、ニックネームを主表示（`primary`）に優先する（要件10）。表示テキストの
 * 決定を UI から切り出した純粋関数として定義し、React / DOM / IndexedDB に依存しない。
 * property-based testing の対象である（Correctness Property 18）。
 *
 * 空判定は前後空白を除去（trim）した結果が空文字かどうかで行う（空白のみは「空」とみなす）。
 *
 * - ニックネームが空でない（trim 後も空でない）→ `primary` = ニックネーム。
 *   加えて名前が空でなければ `secondary` = 名前（名前も trim で空判定し、空なら副表示なし）。要件10.1
 * - ニックネームが空 かつ 名前が空でない → `primary` = 名前（副表示なし）。要件10.2
 * - ニックネームと名前がともに空 → `primary` = '名前未設定'（副表示なし）。要件10.3
 *
 * 返す表示テキストには元の（trim していない）文字列を用いる。空判定にのみ trim を使う。
 *
 * 参照: design.md「Domain 層 / deriveCardDisplay」、要件10.1, 10.2, 10.3、Correctness Property 18
 */
import type { Character } from './types';

/** 一覧カードの表示モデル。`primary` を主表示、`secondary`（あれば）を副表示に用いる。 */
export interface CardDisplay {
  /** 主表示テキスト（先頭・大きい文字サイズで表示、要件10.4）。 */
  primary: string;
  /** 副表示テキスト（主表示に続けて補助的に表示、要件10.4）。無い場合は省略。 */
  secondary?: string;
}

/**
 * Character から一覧カードの主表示/副表示を導出する純粋関数。
 * 要件10.1〜10.3 の分岐に従う（Correctness Property 18）。
 */
export function deriveCardDisplay(character: Character): CardDisplay {
  const hasNickname = character.nickname.trim().length > 0;
  const hasName = character.name.trim().length > 0;

  if (hasNickname) {
    // 要件10.1: ニックネームを主表示。名前が空でなければ副表示に名前。
    return hasName
      ? { primary: character.nickname, secondary: character.name }
      : { primary: character.nickname };
  }

  if (hasName) {
    // 要件10.2: ニックネームが空かつ名前が非空なら名前を主表示（副表示なし）。
    return { primary: character.name };
  }

  // 要件10.3: 両方空なら「名前未設定」を主表示（副表示なし）。
  return { primary: '名前未設定' };
}
