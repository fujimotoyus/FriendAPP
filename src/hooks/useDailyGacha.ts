/**
 * useDailyGacha — 今日の一枚ガチャの View-State（ViewModel 相当）
 *
 * DailyGachaView が用いる hook（design.md「Hooks / View-State」「フロー2」）。
 * {@link CharacterStore} から Character の id を集め、当日暦日（端末ローカル）に紐づく
 * salt を `localStorage` から読み、{@link pick}（{@link DailyPickSelector}）で決定的に
 * 「今日の相棒」を選出する。選出結果は同一暦日内で固定され、アプリを再度開いても
 * 同じ Character を返す（要件5.2）。ドメインの決定的選出ロジックは純粋関数へ寄せ、
 * 本 hook は副作用（ストア読み込み・現在日時の取得・localStorage 入出力）の調停のみを担う。
 *
 * 設計方針:
 * - ストアは引数（DI）で受け取り、テスト時に {@link InMemoryCharacterStore} 等へ差し替え可能。
 *   省略時は共有シングルトン {@link defaultCharacterStore}（IndexedDB）を用いる。
 * - 現在日時の取得（暦日算出）も `now` プロバイダ（DI）で受け取り、テストで固定・変更できる。
 *   省略時は `() => new Date()`。暦日（{@link CalendarDay}）の算出はこの副作用層で行い、
 *   ドメイン（{@link pick}）は純粋に保つ。
 * - salt は「暦日ごと」に `localStorage` へ保存する。読み込み時に保存された暦日と当日暦日を
 *   比較し、日付が変わっていれば salt を 0 にリセットする（要件5.2 の裏返し）。
 * - `reroll()` は salt を +1 して保存し、同一暦日で再計算する（要件5.3）。
 * - Character が 0 件のときは「登録要求」状態（`needsRegistration`）にし、ガチャを実行しない（要件5.6）。
 *
 * 参照: design.md「Hooks / View-State」「フロー2: 今日の一枚ガチャ（決定的選出）」、
 *       要件5.1, 5.2, 5.3, 5.6
 */
import { useCallback, useEffect, useState } from 'react';
import type { CalendarDay, Character } from '../domain/types';
import { pick } from '../domain/DailyPickSelector';
import { buildDailyMessage } from '../domain/dailyMessage';
import type { CharacterStore } from '../persistence/CharacterStore';
import { defaultCharacterStore } from '../persistence/defaultStore';

/**
 * ガチャの読み込み状態（design.md「Hooks / View-State」の `LoadState` に準ずる）。
 * - `idle`:              初期化前（初回 `loadToday` 前）
 * - `loading`:           ストア読み込み・選出中
 * - `loaded`:            「今日の相棒」を選出済み
 * - `needsRegistration`: Character が 0 件で、先に登録が必要（要件5.6）
 * - `failed`:            ストア読み込みに失敗
 */
export type GachaState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'needsRegistration'
  | 'failed';

/**
 * `localStorage` に保存するガチャの salt 状態。暦日ごとに salt を保持する。
 * 保存された暦日と当日暦日が一致する場合のみ salt を引き継ぎ、日付が変われば 0 にリセットする（要件5.2）。
 */
interface StoredSalt {
  /** salt を記録した暦日（端末ローカル） */
  day: CalendarDay;
  /** 当該暦日の salt（初期 0、引き直しで +1） */
  salt: number;
}

/**
 * ガチャ salt を保存する `localStorage` のキー。
 */
const SALT_STORAGE_KEY = 'chara-collection:daily-gacha-salt';

/**
 * {@link useDailyGacha} の戻り値。
 */
export interface UseDailyGachaResult {
  /** 「今日の相棒」として選出された Character。未選出・0 件時は `null`。要件5.1, 5.4 */
  partner: Character | null;
  /** 「今日の相棒」に併記する短いメッセージ（最大50文字）。未選出時は空文字。要件5.5 */
  message: string;
  /** 現在の読み込み状態。0 件時は `'needsRegistration'`。要件5.6 */
  state: GachaState;
  /** Character が 0 件で登録が必要かどうか（`state === 'needsRegistration'` の簡便フラグ）。要件5.6 */
  needsRegistration: boolean;
  /** 「今日の相棒」を読み込む。同一暦日は再オープンでも同じ結果を返す。要件5.1, 5.2, 5.6 */
  loadToday: () => Promise<void>;
  /** 引き直し。salt を +1 して保存し、新たに選出し直す。要件5.3 */
  reroll: () => Promise<void>;
}

/**
 * 現在時刻から端末ローカルの暦日（{@link CalendarDay}）を算出する。
 * 副作用層（本 hook）で暦日を求め、ドメイン（{@link pick}）を純粋に保つ。
 *
 * @param date 現在日時
 * @returns 端末ローカルの暦日（`month` は 1〜12）
 */
function toCalendarDay(date: Date): CalendarDay {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/**
 * 2 つの暦日が同一日かどうかを判定する。
 */
function isSameDay(a: CalendarDay, b: CalendarDay): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * `localStorage` から当日暦日に対応する salt を読み込む。
 * 保存が無い、パースに失敗した、または保存された暦日が当日と異なる場合は 0 を返す
 * （日付が変わったら salt をリセットする。要件5.2）。
 *
 * @param today 当日暦日
 * @returns 当日暦日に対応する salt（無ければ 0）
 */
function readSaltForDay(today: CalendarDay): number {
  try {
    const raw = localStorage.getItem(SALT_STORAGE_KEY);
    if (raw === null) {
      return 0;
    }
    const parsed = JSON.parse(raw) as Partial<StoredSalt>;
    if (
      parsed == null ||
      parsed.day == null ||
      typeof parsed.salt !== 'number' ||
      !Number.isInteger(parsed.salt)
    ) {
      return 0;
    }
    // 保存された暦日が当日と異なる（＝日付が変わった）なら salt をリセットする（要件5.2）。
    if (!isSameDay(parsed.day, today)) {
      return 0;
    }
    return parsed.salt;
  } catch {
    // localStorage 利用不可・破損時は安全側に倒して 0 とする。
    return 0;
  }
}

/**
 * 当日暦日に紐づく salt を `localStorage` へ保存する（要件5.2, 5.3）。
 * localStorage が利用不可でも致命的ではないため、失敗は握りつぶす。
 *
 * @param today 当日暦日
 * @param salt 保存する salt
 */
function writeSaltForDay(today: CalendarDay, salt: number): void {
  try {
    const payload: StoredSalt = { day: today, salt };
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 保存失敗は無視する（選出自体は当該セッションの salt で継続できる）。
  }
}

/**
 * 今日の一枚ガチャの読み込み・引き直しを提供する hook。
 *
 * @param store 永続化ストア（DI）。省略時は共有シングルトン {@link defaultCharacterStore}。
 * @param now 現在日時プロバイダ（DI）。テストで暦日を固定・変更するために差し替える。省略時は現在時刻。
 * @returns 「今日の相棒」・メッセージ・状態・読み込み/引き直し関数。
 */
export function useDailyGacha(
  store: CharacterStore = defaultCharacterStore,
  now: () => Date = () => new Date(),
): UseDailyGachaResult {
  const [partner, setPartner] = useState<Character | null>(null);
  const [message, setMessage] = useState<string>('');
  const [state, setState] = useState<GachaState>('idle');

  /**
   * 指定の salt で「今日の相棒」を選出し、状態へ反映する内部関数。
   *
   * ストアから全 Character を取得し、id 集合と当日暦日・salt から {@link pick} で
   * 決定的に 1 件を選ぶ。0 件時は `needsRegistration` 状態にする（要件5.6）。
   * 選出した id を Character へ解決し（写真・名前表示用）、{@link buildDailyMessage} で
   * メッセージを生成する。
   *
   * @param today 当日暦日
   * @param salt 用いる salt
   */
  const selectWithSalt = useCallback(
    async (today: CalendarDay, salt: number): Promise<void> => {
      setState('loading');
      let characters: Character[];
      try {
        characters = await store.fetchAll();
      } catch {
        setState('failed');
        return;
      }

      // 0 件時はガチャを実行せず、登録要求状態にする（要件5.6）。
      if (characters.length === 0) {
        setPartner(null);
        setMessage('');
        setState('needsRegistration');
        return;
      }

      const ids = characters.map((c) => c.id);
      const selectedId = pick(ids, today, salt);
      // 0 件でない限り pick は非 null を返すが、型の健全性のため null もハンドリングする。
      const selected =
        selectedId == null
          ? null
          : characters.find((c) => c.id === selectedId) ?? null;

      if (selected == null) {
        setPartner(null);
        setMessage('');
        setState('needsRegistration');
        return;
      }

      setPartner(selected);
      setMessage(buildDailyMessage(selected.name));
      setState('loaded');
    },
    [store],
  );

  /**
   * 「今日の相棒」を読み込む。当日暦日に紐づく salt を `localStorage` から読み（無ければ 0、
   * 日付変化でリセット）、その salt で選出する。同一暦日・同一 salt では {@link pick} が
   * 決定的なため、アプリ再オープンでも同じ結果を返す（要件5.1, 5.2）。
   */
  const loadToday = useCallback(async (): Promise<void> => {
    const today = toCalendarDay(now());
    const salt = readSaltForDay(today);
    // 読み込み時に当日暦日の salt を（リセット済みの値で）保存し直し、以降の再オープンでも
    // 同じ salt を確実に用いる（日付変化時のリセットを永続化する）。
    writeSaltForDay(today, salt);
    await selectWithSalt(today, salt);
  }, [now, selectWithSalt]);

  /**
   * 引き直し。当日暦日の現在 salt を +1 して `localStorage` へ保存し、新しい salt で
   * 選出し直す（要件5.3）。
   */
  const reroll = useCallback(async (): Promise<void> => {
    const today = toCalendarDay(now());
    const nextSalt = readSaltForDay(today) + 1;
    writeSaltForDay(today, nextSalt);
    await selectWithSalt(today, nextSalt);
  }, [now, selectWithSalt]);

  // マウント時に一度読み込む（画面を開いた時点で「今日の相棒」を表示する。要件5.1, 5.2）。
  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  return {
    partner,
    message,
    state,
    needsRegistration: state === 'needsRegistration',
    loadToday,
    reroll,
  };
}
