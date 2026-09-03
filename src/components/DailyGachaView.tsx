/**
 * DailyGachaView（今日の一枚ガチャ）— 「今日の相棒」の表示と引き直し。
 *
 * {@link useDailyGacha} に接続し、当日の「今日の相棒」を写真（{@link PhotoFrame}）・
 * 名前・短いメッセージ（最大50文字）とともに表示する（要件5.4, 5.5）。「引き直し」
 * （{@link PastelButton}）で新たに 1 件を選び直す（要件5.3）。Character が 0 件のときは
 * {@link EmptyStateView} で先に登録が必要である旨と登録導線を表示する（要件5.6）。
 *
 * 本コンポーネントはロジックを持たず、hook から受け取った状態を描画するのみとする
 * （design.md「UI 層」）。名前が未入力（空文字）の場合は「名前未設定」を代替表示する
 * （要件1.9 と整合）。読み込み中・失敗時はそれぞれ簡潔な状態表示を出す。
 *
 * Requirements: 5.3, 5.4, 5.5, 5.6
 */
import { useDailyGacha } from '../hooks/useDailyGacha';
import { EmptyStateView } from './EmptyStateView';
import { PastelButton } from './PastelButton';
import { PhotoFrame } from './PhotoFrame';

export interface DailyGachaViewProps {
  /** 一覧など前の画面へ戻る操作のハンドラ。 */
  onBack: () => void;
  /** 0 件時に登録フォームへ遷移する導線のハンドラ（要件5.6）。 */
  onRegister: () => void;
}

export function DailyGachaView({
  onBack,
  onRegister,
}: DailyGachaViewProps): JSX.Element {
  const { partner, message, state, needsRegistration, reroll } = useDailyGacha();

  const displayName =
    partner != null && partner.name.trim().length > 0
      ? partner.name
      : '名前未設定';

  return (
    <main className="daily-gacha">
      <header className="daily-gacha__header">
        <PastelButton variant="secondary" onClick={onBack}>
          ← 一覧へ戻る
        </PastelButton>
        <h1>今日の相棒</h1>
      </header>

      {/* 0 件: 先に登録が必要である旨と登録導線を表示する（要件5.6）。 */}
      {needsRegistration ? (
        <EmptyStateView
          message="まだキャラクターが登録されていません。先にお気に入りを登録すると「今日の相棒」を引けます。"
          actionLabel="新規登録"
          onAction={onRegister}
        />
      ) : null}

      {/* 読み込み失敗: 保存済みデータは保持しつつ簡潔に通知する。 */}
      {state === 'failed' ? (
        <div className="daily-gacha__error" role="alert">
          <p>読み込みに失敗しました。もう一度お試しください。</p>
        </div>
      ) : null}

      {/* 読み込み中（初回選出前）の簡易表示。 */}
      {state === 'loading' && partner == null ? (
        <p className="daily-gacha__loading">今日の相棒を選んでいます…</p>
      ) : null}

      {/* 今日の相棒: 写真・名前・短いメッセージと引き直し導線（要件5.3, 5.4, 5.5）。 */}
      {partner != null ? (
        <div className="daily-gacha__partner">
          <PhotoFrame
            photo={partner.photo}
            alt={displayName}
            className="daily-gacha__photo"
          />
          <h2 className="daily-gacha__name">{displayName}</h2>
          <p className="daily-gacha__message">{message}</p>
          <PastelButton onClick={() => void reroll()}>引き直し 🎲</PastelButton>
        </div>
      ) : null}
    </main>
  );
}
