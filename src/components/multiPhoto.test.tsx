/**
 * 複数写真 UI のユニットテスト（イテレーション15 / タスク78.1）
 *
 * 既存テスト（PhotoGallery.test.tsx / RegistrationForm.test.tsx 等）で未カバーの観点のみを補う:
 * (a) RegistrationForm 内の `input[type="file"]` が `multiple` を持つ（要件23.1）
 * (b) 複数写真の取り込み順サムネ・個別削除・6枚目以降の上限メッセージ（要件23.3, 23.11）
 * (c) 写真0枚での保存保留と入力内容の保持（要件23.4, 23.13）
 * (d) CharacterDetailView が PhotoGallery で枚数分を表示（要件23.8）
 * (e) 一覧カード / ガチャ / 対戦が代表画像 photos[0] のみを表示（要件23.7）
 *
 * jsdom では画像のデコードは行われないため、DOM 構造（クラス・個数・メッセージ）と、
 * PhotoFrame が `URL.createObjectURL` に渡す Blob（type / size）で「どの写真が描画されたか」を判定する。
 * 既定ストアは InMemoryCharacterStore へ差し替え、保存結果（どの写真が残ったか）も観測する。
 *
 * 参照: design.md「イテレーション15（複数写真対応）」、要件23.1, 23.3, 23.4, 23.7, 23.8, 23.11, 23.13
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { InMemoryCharacterStore } from '../persistence/InMemoryCharacterStore';

/**
 * RegistrationForm / DailyGachaView は既定ストア（defaultCharacterStore）に依存する。
 * テストごとに差し替えられる共有 InMemoryCharacterStore を返すようにモックする。
 */
let mockStore: InMemoryCharacterStore = new InMemoryCharacterStore([]);
vi.mock('../persistence/defaultStore', () => ({
  get defaultCharacterStore() {
    return mockStore;
  },
}));

/**
 * DailyGachaView は useDailyGacha() を引数なしで呼ぶ。この hook は既定の `now`（毎回新しい関数）
 * を依存に持つため、実ストア接続のままでは再読み込みを繰り返してしまう。ここで検証したいのは
 * 「ビューが相棒の photos[0] のみを描画する」ことなので、hook は固定の相棒を返すスタブにする。
 */
let mockPartner: Character | null = null;
vi.mock('../hooks/useDailyGacha', () => ({
  useDailyGacha: () => ({
    partner: mockPartner,
    message: 'きょうもよろしくね',
    state: 'loaded',
    needsRegistration: false,
    loadToday: async () => {},
    reroll: async () => {},
  }),
}));

// モック宣言後にインポートする。
import { RegistrationForm } from './RegistrationForm';
import { CharacterDetailView } from './CharacterDetailView';
import { CharacterCard } from './CharacterCard';
import { DailyGachaView } from './DailyGachaView';
import { RankingBattleView } from './RankingBattleView';

/** 指定 MIME・バイト数の PhotoData を作る（バイト数は 1 以上）。 */
function makePhoto(type: string, size = 1): PhotoData {
  return { data: new Uint8Array(size).buffer, type };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'テスト太郎',
    nickname: '',
    memo: '',
    favoriteLevel: 3,
    photos: [makePhoto('image/png')],
    createdAt: 1000,
    metOn: undefined,
    imageColor: 'none',
    ...overrides,
  };
}

/**
 * 常に 0 を返す rng。モジュールスコープの安定した参照にする
 * （useRankingBattle が rng を依存に持つため、毎回新しい関数だと再初期化を繰り返す）。
 */
function alwaysZeroRng(): number {
  return 0;
}

/** サイズ `size` バイトの PNG File を作る（サイズで取り込み順を識別する）。 */
function makeFile(size: number, name = `p${size}.png`): File {
  return new File([new Uint8Array(size)], name, { type: 'image/png' });
}

/** PhotoFrame が createObjectURL に渡した Blob を記録するスパイを張る。 */
function spyCreateObjectURL(): { blobs: Blob[]; restore: () => void } {
  const blobs: Blob[] = [];
  const spy = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
    blobs.push(obj as Blob);
    return 'blob:test-object-url';
  });
  return { blobs, restore: () => spy.mockRestore() };
}

/** RegistrationForm 内の最初の file input に File 群を渡す。 */
function uploadFiles(files: File[]): void {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  fireEvent.change(inputs[0], { target: { files } });
}

function thumbnails(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll('.photo-thumbnails__item');
}

beforeEach(() => {
  mockStore = new InMemoryCharacterStore([]);
  localStorage.clear();
});

describe('RegistrationForm — 複数選択 input（要件23.1）', () => {
  it('フォーム内の file input はすべて multiple 属性を持つ', () => {
    render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => expect(input).toHaveAttribute('multiple'));
  });
});

describe('RegistrationForm — サムネの取り込み順・個別削除・上限（要件23.3, 23.11）', () => {
  it('複数写真を取り込むとサムネが取り込み順に並ぶ', async () => {
    const spy = spyCreateObjectURL();
    try {
      const { container } = render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);
      expect(thumbnails(container)).toHaveLength(0);

      uploadFiles([makeFile(1), makeFile(2), makeFile(3)]);
      await waitFor(() => expect(thumbnails(container)).toHaveLength(3));

      // 各サムネの PhotoFrame が取り込み順（サイズ 1,2,3）で描画されている。
      await waitFor(() => expect(spy.blobs.map((b) => b.size)).toEqual([1, 2, 3]));
    } finally {
      spy.restore();
    }
  });

  it('「写真を削除」で該当の1枚のみ消え、保存すると残りの写真だけが保存される', async () => {
    const onSaved = vi.fn();
    const { container } = render(<RegistrationForm onSaved={onSaved} onCancel={() => {}} />);

    uploadFiles([makeFile(1), makeFile(2), makeFile(3)]);
    await waitFor(() => expect(thumbnails(container)).toHaveLength(3));

    // 2枚目（サイズ2）のみ削除する。
    fireEvent.click(screen.getAllByRole('button', { name: '写真を削除' })[1]);
    expect(thumbnails(container)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const stored = await mockStore.fetchAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].photos.map((p) => p.data.byteLength)).toEqual([1, 3]);
  });

  it('6枚目以降を追加しようとすると上限メッセージが出て、写真は5枚のまま', async () => {
    const { container } = render(<RegistrationForm onSaved={() => {}} onCancel={() => {}} />);

    uploadFiles([makeFile(1), makeFile(2), makeFile(3), makeFile(4), makeFile(5)]);
    await waitFor(() => expect(thumbnails(container)).toHaveLength(5));
    expect(screen.queryByText(/写真は最大5枚までです/)).toBeNull();

    uploadFiles([makeFile(6)]);
    expect(await screen.findByText(/写真は最大5枚までです/)).toBeInTheDocument();
    expect(thumbnails(container)).toHaveLength(5);
  });
});

describe('RegistrationForm — 写真0枚での保存保留（要件23.4, 23.13）', () => {
  it('写真0枚で登録しようとすると保存されず「1枚以上必須」が alert 表示され、入力済みの名前は保持される', async () => {
    const onSaved = vi.fn();
    render(<RegistrationForm onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/名前（任意/), { target: { value: 'ゆうき' } });
    fireEvent.click(screen.getByRole('button', { name: '登録する' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('写真は1枚以上必須です');
    expect(onSaved).not.toHaveBeenCalled();
    expect(await mockStore.fetchAll()).toHaveLength(0);
    expect((screen.getByLabelText(/名前（任意/) as HTMLInputElement).value).toBe('ゆうき');
  });

  it('写真を全部削除してから登録しようとしても同様に保留される', async () => {
    const onSaved = vi.fn();
    const { container } = render(<RegistrationForm onSaved={onSaved} onCancel={() => {}} />);

    uploadFiles([makeFile(1)]);
    await waitFor(() => expect(thumbnails(container)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '写真を削除' }));
    expect(thumbnails(container)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '登録する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('写真は1枚以上必須です');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('CharacterDetailView — 複数写真ギャラリー（要件23.8）', () => {
  it('複数写真の Character で .photo-gallery と .photo-gallery__item が枚数分表示される', () => {
    const character = makeCharacter({
      photos: [makePhoto('image/png'), makePhoto('image/jpeg'), makePhoto('image/webp')],
    });
    const { container } = render(
      <CharacterDetailView
        character={character}
        onBack={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.querySelectorAll('.photo-gallery')).toHaveLength(1);
    expect(container.querySelectorAll('.photo-gallery__item')).toHaveLength(3);
  });
});

describe('一覧 / ガチャ / 対戦 — 代表画像 photos[0] のみ表示（要件23.7）', () => {
  let spy: ReturnType<typeof spyCreateObjectURL>;

  beforeEach(() => {
    spy = spyCreateObjectURL();
  });

  afterEach(() => {
    spy.restore();
  });

  const multi = (): PhotoData[] => [
    makePhoto('image/png'),
    makePhoto('image/jpeg'),
    makePhoto('image/webp'),
  ];

  it('CharacterCard は .photo-frame を1つだけ描画し、先頭の写真を用いる', () => {
    const { container } = render(<CharacterCard character={makeCharacter({ photos: multi() })} />);
    expect(container.querySelectorAll('.photo-frame')).toHaveLength(1);
    expect(spy.blobs.map((b) => b.type)).toEqual(['image/png']);
  });

  it('DailyGachaView は今日の相棒の写真として先頭の1枚のみ描画する', async () => {
    mockPartner = makeCharacter({ photos: multi() });
    const { container } = render(<DailyGachaView onBack={() => {}} onRegister={() => {}} />);

    expect(container.querySelectorAll('.daily-gacha__photo')).toHaveLength(1);
    expect(container.querySelectorAll('.photo-frame')).toHaveLength(1);
    await waitFor(() => expect(spy.blobs.map((b) => b.type)).toEqual(['image/png']));
  });

  it('RankingBattleView は対戦ペアそれぞれの先頭の1枚のみ描画する', async () => {
    const store = new InMemoryCharacterStore([
      makeCharacter({ id: 'a', name: 'アルファ', photos: [makePhoto('image/png'), makePhoto('image/jpeg')] }),
      makeCharacter({ id: 'b', name: 'ベータ', photos: [makePhoto('image/webp'), makePhoto('image/jpeg')] }),
    ]);
    const { container } = render(
      <RankingBattleView onBack={() => {}} onRegister={() => {}} store={store} rng={alwaysZeroRng} />,
    );

    await screen.findByRole('button', { name: /勝負/ });
    expect(container.querySelectorAll('.ranking-battle__photo')).toHaveLength(2);

    // 2枚目以降（image/jpeg）は描画されない。先頭の png / webp のみ。
    const types = new Set(spy.blobs.map((b) => b.type));
    expect(types.has('image/jpeg')).toBe(false);
    expect(types).toEqual(new Set(['image/png', 'image/webp']));
  });
});
