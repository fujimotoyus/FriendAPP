/**
 * errorMessages — エラー種別からユーザー向けメッセージへの共通マッピング。
 *
 * design.md「Error Handling」の方針に従い、発生層で正規化された {@link StoreError} /
 * {@link PhotoError} を、要件に対応する日本語のユーザー向けメッセージへ変換する純粋関数群。
 * hooks 層・各画面（`RegistrationForm` / `CollectionView` / `DailyGachaView` /
 * `RankingBattleView`）が共通で参照し、文言のトーンと表記を一元管理する。
 *
 * 共通方針（design.md「Error Handling」）:
 * - エラー時も**入力内容と保存済みデータを破棄しない**（メッセージは再入力・再試行を促すのみ）。
 * - 容量超過は不要データ削除を促し、その他の保存失敗は再試行を促す。
 * - 読み込み失敗は保存済みデータを保持したまま再試行を促す。
 *
 * 依存: `../domain/types` の型定義のみ（React / IndexedDB / File API に非依存の純粋モジュール）。
 * 循環 import を避けるため、他の hooks / components には依存しない。
 *
 * Requirements: 1.10, 1.11, 1.12, 2.2, 2.9, 3.2, 3.7, 8.2, 8.3, 8.4, 8.5
 */
import type { PhotoError, StoreError } from '../domain/types';

/**
 * {@link StoreError} をユーザー向けメッセージへマッピングする。
 *
 * design.md「Error Handling」表に対応:
 * - `quotaExceeded`:  容量不足で保存できない旨と不要データ削除の促し（要件1.12, 3.2, 8.4）。
 * - `capacityReached`: 1,000 件上限に到達した旨と不要キャラ削除の促し（要件2.2）。
 * - `writeFailed`:    保存に失敗した旨と再試行の促し（要件3.2, 8.5）。
 * - `loadFailed`:     読み込み（復元）に失敗した旨と再試行の促し（要件2.9, 3.7）。
 *
 * いずれの文言も入力内容・保存済みデータを破棄しない前提のトーンとする。
 */
export function storeErrorMessage(error: StoreError): string {
  switch (error.kind) {
    case 'quotaExceeded':
      return '端末の空き容量が足りず保存できませんでした。不要なデータを削除してからお試しください。入力内容は保持されています。';
    case 'capacityReached':
      return '登録できるのは1,000件までです。不要なキャラクターを削除してからお試しください。入力内容は保持されています。';
    case 'writeFailed':
      return '保存に失敗しました。もう一度お試しください。入力内容は保持されています。';
    case 'loadFailed':
      return '読み込みに失敗しました。もう一度お試しください。保存済みのデータは消えていません。';
  }
}

/**
 * {@link PhotoError} をユーザー向けメッセージへマッピングする。
 *
 * design.md「Error Handling」表に対応:
 * - `unsupportedFormat`: 非対応形式の案内と対応形式（JPEG/PNG/WebP）の提示（要件1.10, 8.2）。
 * - `tooLarge`:          過大サイズの案内とやり直しの促し（要件1.10, 8.2）。
 * - `acquisitionFailed`: 写真を取り込めなかった旨と再取得の促し（要件1.11, 8.3）。
 * - `cancelled`:         写真が選択されなかった旨と再取得の促し（要件1.11, 8.3）。
 *
 * いずれの文言も入力内容を破棄しない前提のトーンとする。
 */
export function photoErrorMessage(error: PhotoError): string {
  switch (error.kind) {
    case 'unsupportedFormat':
      return '対応していない画像形式です。JPEG・PNG・WebP のいずれかを選んでください。';
    case 'tooLarge':
      return '画像サイズが大きすぎます。もう少し小さい画像を選んでください。';
    case 'acquisitionFailed':
      return '写真を取り込めませんでした。もう一度お試しください。';
    case 'cancelled':
      return '写真が選択されませんでした。もう一度写真を選んでください。';
  }
}
