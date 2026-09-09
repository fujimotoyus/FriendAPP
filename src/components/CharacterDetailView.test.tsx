/**
 * CharacterDetailView / CharacterCard のユニットテスト（出会った日の表示分岐・一覧非表示）
 *
 * task 32.3。詳細画面が `metOn` 設定時のみ「YYYY年M月D日」を表示し、未設定時は当該行を
 * 表示しないこと（要件14.5, 14.6）、および一覧カードには `metOn` 由来の日付文字列が出ない
 * こと（要件14.7）を例示・エッジケースで検証する。「出会った日」は詳細のみに表示し、
 * Daily_Gacha / Ranking_Battle には出さない（要件14.8）。
 *
 * ガチャ/対戦画面は自前のフック初期化（store/localStorage/now の副作用）を伴うため、
 * ここでは「これらの画面が Character の `metOn` を描画に用いていない」ことを、共通の
 * CharacterCard（一覧の 1 件）に日付文字列が現れないことの確認で代表させる。実装上、
 * DailyGachaView / RankingBattleView はいずれも `metOn` を参照しておらず（該当ソース参照）、
 * 14.8 はソースレベルでも担保される。
 *
 * 参照: design.md「Testing Strategy / ユニットテスト」、要件14.5, 14.6, 14.7, 14.8
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Character, PhotoData } from '../domain/types';
import { CharacterDetailView } from './CharacterDetailView';
import { CharacterCard } from './CharacterCard';

/** テスト用のダミー写真データ（PhotoData）。 */
function makePhoto(): PhotoData {
  return { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };
}

/** テスト用の Character を生成する。 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'テスト太郎',
    nickname: 'たろ',
    memo: 'メモ本文',
    favoriteLevel: 4,
    photo: makePhoto(),
    createdAt: 1000,
    metOn: undefined,
    imageColor: 'none',
    ...overrides,
  };
}

describe('CharacterDetailView — 出会った日の表示分岐（要件14.5, 14.6）', () => {
  it('metOn が妥当な YYYY-MM-DD のとき「YYYY年M月D日」を表示する（ゼロ埋めなし）', () => {
    const character = makeCharacter({ metOn: '2024-03-05' });
    render(
      <CharacterDetailView
        character={character}
        onBack={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    // 見出し行と整形済みの日付。
    expect(screen.getByText('出会った日')).toBeInTheDocument();
    expect(screen.getByText('2024年3月5日')).toBeInTheDocument();
  });

  it('metOn が undefined のときは「出会った日」行を表示しない（要件14.6）', () => {
    const character = makeCharacter({ metOn: undefined });
    render(
      <CharacterDetailView
        character={character}
        onBack={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.queryByText('出会った日')).not.toBeInTheDocument();
    // 日付らしき文字列も現れない。
    expect(screen.queryByText(/年\d+月\d+日/)).not.toBeInTheDocument();
  });

  it('metOn が不正値（形式外）のときは「出会った日」行を表示しない（防御的・要件14.6）', () => {
    const character = makeCharacter({ metOn: 'not-a-date' });
    render(
      <CharacterDetailView
        character={character}
        onBack={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.queryByText('出会った日')).not.toBeInTheDocument();
  });
});

describe('CharacterCard — 一覧カードに metOn を表示しない（要件14.7）', () => {
  it('metOn を持つ Character でもカードに日付文字列・「出会った日」を表示しない', () => {
    const character = makeCharacter({ metOn: '2024-03-05' });
    render(<CharacterCard character={character} onClick={() => {}} />);

    // 一覧カードには出会った日を出さない（詳細のみ）。
    expect(screen.queryByText('出会った日')).not.toBeInTheDocument();
    expect(screen.queryByText('2024年3月5日')).not.toBeInTheDocument();
    expect(screen.queryByText(/年\d+月\d+日/)).not.toBeInTheDocument();
    // 主表示（ニックネーム優先）は出ている。
    expect(screen.getByText('たろ')).toBeInTheDocument();
  });
});
