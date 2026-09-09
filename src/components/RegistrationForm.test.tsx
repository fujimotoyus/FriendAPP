/**
 * RegistrationForm / useRegistration のユニットテスト（出会った日・イメージカラーの UI と保存分岐）
 *
 * task 32.3。イテレーション6 で追加した「出会った日」= `<input type="date">` と「イメージカラー」の
 * 6 択スウォッチ選択が RegistrationForm に存在すること、編集時に既存 `metOn` / `imageColor` が初期表示
 * され `metOn` をクリアできること、新規で `imageColor` 未選択なら `'none'` として保存されることを、
 * 例示・エッジケースで検証する（要件14.1, 14.9, 14.10, 15.1, 15.2, 15.3）。
 *
 * - UI の存在・初期表示・クリア操作は RegistrationForm をレンダリングして検証する。
 * - 保存された Character の属性（`metOn`/`imageColor`）は、RegistrationForm が内部で用いる
 *   {@link useRegistration} を InMemoryCharacterStore を DI して直接 renderHook で駆動し、`save()` 後の
 *   `store.fetchAll()` で確認する（RegistrationForm は store prop を受け取らないため、保存結果の観測は
 *   hook 経由で行う。UI とロジックは同一 hook を共有するため観点は担保される）。
 *
 * ドメインの網羅的性質（normalizeMetOn / deriveImageColorStyle）は Property 21/22 で別途担保する。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」、要件14.1, 14.9, 14.10, 15.1, 15.2, 15.3
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';
import { useRegistration } from '../hooks/useRegistration';
import { RegistrationForm } from './RegistrationForm';

/** テスト用のダミー写真データ（PhotoData）。 */
function makePhoto(): PhotoData {
  return { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };
}

/** 編集モードの初期表示検証に用いる Character を生成する。 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'テスト太郎',
    nickname: 'たろ',
    memo: '',
    favoriteLevel: 3,
    photo: makePhoto(),
    createdAt: 1000,
    metOn: undefined,
    imageColor: 'none',
    ...overrides,
  };
}

describe('RegistrationForm — 出会った日 / イメージカラーの UI（要件14.1, 15.1）', () => {
  it('出会った日の日付入力欄（type="date"）が存在する（要件14.1）', () => {
    render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);

    const dateInput = screen.getByLabelText(/出会った日/);
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('type', 'date');
  });

  it('イメージカラーの 6 択スウォッチ（なし＋5色）が group 内に存在する（要件15.1）', () => {
    render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);

    const group = screen.getByRole('group', { name: /イメージカラー/ });
    expect(group).toBeInTheDocument();

    const swatches = screen.getAllByRole('button', { name: /^イメージカラー: / });
    expect(swatches).toHaveLength(6);

    // 期待する 6 択（なし＋プリセット5色）の aria-label がそろっていること。
    const labels = [
      'イメージカラー: なし',
      'イメージカラー: ローズ',
      'イメージカラー: ミント',
      'イメージカラー: ラベンダー',
      'イメージカラー: バター',
      'イメージカラー: スカイ',
    ];
    for (const label of labels) {
      expect(
        screen.getByRole('button', { name: label }),
      ).toBeInTheDocument();
    }
  });

  it('新規時は「なし」が選択状態（aria-pressed=true）、他は非選択（既定 none・要件15.2）', () => {
    render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);

    const none = screen.getByRole('button', { name: 'イメージカラー: なし' });
    expect(none).toHaveAttribute('aria-pressed', 'true');

    const rose = screen.getByRole('button', { name: 'イメージカラー: ローズ' });
    expect(rose).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('RegistrationForm — 編集モードの初期表示（要件14.9, 15.3）', () => {
  it('編集時に metOn が日付入力へ、imageColor が該当スウォッチの選択状態へ初期表示される', () => {
    const editing = makeCharacter({ metOn: '2024-03-05', imageColor: 'mint' });
    render(
      <RegistrationForm
        editing={editing}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    const dateInput = screen.getByLabelText(/出会った日/) as HTMLInputElement;
    expect(dateInput.value).toBe('2024-03-05');

    // ミントが選択状態、なし/他は非選択。
    expect(
      screen.getByRole('button', { name: 'イメージカラー: ミント' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'イメージカラー: なし' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('編集時に metOn をクリア（空）にできる（入力値が空になる・要件14.10）', () => {
    const editing = makeCharacter({ metOn: '2024-03-05', imageColor: 'rose' });
    render(
      <RegistrationForm
        editing={editing}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    const dateInput = screen.getByLabelText(/出会った日/) as HTMLInputElement;
    expect(dateInput.value).toBe('2024-03-05');

    // 日付入力を空にする（RegistrationForm 側で undefined を格納し、value は '' へ）。
    fireEvent.change(dateInput, { target: { value: '' } });
    expect(dateInput.value).toBe('');
  });
});

describe('useRegistration — 保存された属性の観測（RegistrationForm が用いる hook・要件14.10, 15.2）', () => {
  it('新規で imageColor 未選択（既定 none）のまま保存すると imageColor === "none"（要件15.2）', async () => {
    const store = new InMemoryCharacterStore([]);
    const { result } = renderHook(() => useRegistration(undefined, store));

    // 写真は必須のため draft に写真をセットしてから保存する。
    act(() => {
      result.current.setField('name', 'ゆうき');
      result.current.setField('photo', makePhoto());
    });

    let saveResult: string | undefined;
    await act(async () => {
      saveResult = await result.current.save();
    });
    expect(saveResult).toBe('saved');

    const stored = await store.fetchAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].imageColor).toBe('none');
    expect(stored[0].metOn).toBeUndefined();
  });

  it('編集で metOn をクリア（空文字→undefined）して保存すると metOn が undefined になる（要件14.10）', async () => {
    const editing = makeCharacter({ metOn: '2024-03-05', imageColor: 'sky' });
    const store = new InMemoryCharacterStore([editing]);
    const { result } = renderHook(() => useRegistration(editing, store));

    // 編集の初期 draft には metOn が入っていること。
    expect(result.current.draft.metOn).toBe('2024-03-05');

    // クリア（RegistrationForm の handleMetOnChange('') と同じく undefined を格納）。
    act(() => {
      result.current.setField('metOn', undefined);
    });

    let saveResult: string | undefined;
    await act(async () => {
      saveResult = await result.current.save();
    });
    expect(saveResult).toBe('saved');

    const stored = await store.fetchAll();
    const updated = stored.find((c) => c.id === editing.id);
    expect(updated).toBeDefined();
    expect(updated?.metOn).toBeUndefined();
    // 件数は不変（上書き更新）。
    expect(stored).toHaveLength(1);
  });

  it('imageColor を選び直して保存すると選択値が保存される（要件15.3）', async () => {
    const editing = makeCharacter({ imageColor: 'none' });
    const store = new InMemoryCharacterStore([editing]);
    const { result } = renderHook(() => useRegistration(editing, store));

    act(() => {
      result.current.setField('imageColor', 'lavender');
    });

    await act(async () => {
      await result.current.save();
    });

    const stored = await store.fetchAll();
    expect(stored.find((c) => c.id === editing.id)?.imageColor).toBe(
      'lavender',
    );
  });
});
