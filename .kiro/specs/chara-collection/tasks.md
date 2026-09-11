# Implementation Plan

実装計画: chara-collection（キャラ図鑑 / PWA）

## Overview

概要

本計画は、設計書（design.md）と要件定義書（requirements.md）に基づき、カップル向けの PWA「chara-collection（キャラ図鑑）」を **React + TypeScript + Vite** で実装するための、コード生成 LLM 向けの段階的タスク列である。要件の反復（イテレーション）計画に沿って、各イテレーションが動作する増分を提供するように構成する。前のタスクの成果物の上に次のタスクを積み上げ、宙に浮いた（統合されない）コードを残さない。

- **イテレーション1（MVP）**: 写真付き登録・一覧・オフライン保存（IndexedDB）・PWA 基本動作・かわいいポップな UI（要件1, 2, 3, 7）
- **イテレーション2**: 今日の一枚ガチャ（要件5）
- **イテレーション3**: ランキング対戦（要件4）
- **イテレーション4**: 仕上げ（編集・削除・エラー/空状態ハンドリング）（要件6, 8）
- **イテレーション5**: 見た目と使い勝手の底上げ（大人かわいいテーマ・ニックネーム優先表示・並び替え・お気に入り度の視覚強調・共通ナビゲーションバー）（要件9, 10, 11, 12, 13）
- **イテレーション6**: 登録項目の拡張（任意の「出会った日」＝ Met_On を詳細でのみ表示、パステルプリセットから選ぶ「イメージカラー」＝ Image_Color をカードと詳細の写真枠の縁取りへ反映。旧データは既定値で補完し後方互換を維持）（要件14, 15）
- **イテレーション7**: 一覧の並び替えに「出会った日の新しい順」を追加（Sort_Order に 'metOn' を追加。Met_On 降順・未設定は後方・タイブレークは createdAt 降順→id 昇順。既存データ・機能に破壊的変更なし）（要件11.1, 11.7）
- **イテレーション8**: 今日の相棒に一言（Daily_Gacha のメッセージを相棒キャラ本人のセリフ風の一言＝Daily_Line に置き換え。暦日＋相棒 id＋salt から決定的に選ぶその日固定の選出。50文字保証・名前空でも成立・外部送信なし。既存 `buildDailyMessage` を決定的セリフ選択 `buildDailyLine` へ作り替え）（要件5 の改定と要件16）
- **イテレーション9**: 対戦を魅せる（試合ごとのリザルト表示・勝者ハイライト/ペア入場アニメ・優勝の紙吹雪風演出・勝ち上がりを可視化するトーナメント表。自動再生/効果音/総評なし。`TournamentEngine` を勝ち上がり履歴 `bracket` の公開のため拡張（既存セマンティクス・Property 11〜13 は不変）。`useRankingBattle` を「勝負！」→「次へ」の2段階進行へ拡張）（要件17, 18、要件4 と整合）
- **イテレーション10**: 対戦をもっと楽しく（状況別実況・準優勝/ベスト4 表示・対戦のお題 Battle_Theme。`TournamentEngine` の勝敗判定は不変）（要件19, 20, 21、要件4/17/18 と整合）
- **イテレーション11**: トーナメント表を図に（`TournamentBracketView` を接続線つき縦向きブラケット図へ表示強化。データ/ドメイン/エンジン変更なし）（要件18.7 の表示強化）
- **イテレーション12**: お題に沿った実況（各試合の Battle_Commentary に、その回のお題 Battle_Theme の観点ワード＝Theme_Aspect を織り込む。状況別実況を維持しつつお題に沿った文面にする。`battleTheme` に `getBattleThemeAspect` を追加し既存8お題すべてに観点ワードを定義（未知ラベルは非空フォールバック）、`BattleCommentator.narrate` を末尾任意引数 `aspect?` で後方互換拡張、`useRankingBattle` が観点ワードを実況へ渡す。`TournamentEngine` の勝敗判定・`pickBattleTheme` シグネチャは不変、既存 Property 11〜14, 24, 25, 26, 27 を保持）（要件19.6、要件19/21 の拡張）

実装言語は **TypeScript**、UI は **React**、ビルドは **Vite** で確定している（design.md「技術方針」）。ドメインロジックはフレームワーク非依存の純粋 TypeScript モジュールとして切り出す。永続化は IndexedDB（`idb` ラッパ、写真は Blob）。PWA 化は `vite-plugin-pwa`（Web App Manifest + Service Worker）。UI はパステルカラー基調・角丸多用のデザインを CSS カスタムプロパティで実現する。

プロパティテストは **fast-check**（Vitest 上、最低100反復 `numRuns: 100`）で記述し、各テストに `// Feature: chara-collection, Property {number}: {property_text}` タグを付与する。各 Correctness Property は単一のプロパティテストで実装する。ユニットテストは Vitest + React Testing Library で記述する。

### 開発環境に関する注記

本アプリは Web 技術（React / TypeScript / Vite / IndexedDB / PWA）のみで構成されるため、ビルド・実行・テストはすべて **Windows 環境で完結**する。macOS や Xcode は不要である。各チェックポイントでは Windows 上で `vite build`（ビルド）と `vitest run`（テスト単発実行）がグリーンであることを確認する。開発サーバーはウォッチプロセスのため手動起動を前提とし、タスクの検証には単発実行コマンドを用いる。

## Tasks

- [x] 1. Vite + React + TS プロジェクト scaffold と PWA / フォルダ基盤のセットアップ
  - Vite の React + TypeScript テンプレートでプロジェクトを作成し、`react`・`react-dom`・`typescript`・`vite`・`@vitejs/plugin-react`・`idb`・`vite-plugin-pwa`、および開発依存として `vitest`・`@testing-library/react`・`@testing-library/jest-dom`・`jsdom`・`fast-check` を導入する
  - `src` 配下に `components/`・`hooks/`・`domain/`・`persistence/`・`pwa/`・`test/`・`styles/` のフォルダ構成を作成する（design.md「レイヤー構成」）
  - `vite.config.ts` に `@vitejs/plugin-react` と `VitePWA({ registerType: 'autoUpdate', devOptions: { enabled: true } })` を設定し、Vitest（`test: { environment: 'jsdom', globals: true, setupFiles }`）を構成する。`npm run build` = `vite build`、`npm run test` = `vitest run` を `package.json` に定義する
  - `index.html`・`src/main.tsx`・最小の `App.tsx`（空の `CollectionView` プレースホルダを描画）を用意し、Service Worker 登録（`virtual:pwa-register`）を `main.tsx` から呼び出して統合する
  - _Requirements: 7.1, 7.2, 7.3, 3.4, 3.5_

- [x] 2. デザインシステム（CSS トークン）とグローバルスタイルの実装
  - `src/styles/tokens.css` に `:root` のカラートークン（`--color-primary` パステルピンク等）・角丸トークン（`--radius-small/medium/large`）・rem ベースのタイポグラフィ変数を定義する（design.md「Design Theme and Design System」、要件7.4, 7.5, 7.8）
  - `src/styles/global.css` にモバイルポートレート基準・横スクロールなしのレスポンシブ基盤（`max-width`／フレックス、`box-sizing: border-box`）と、インタラクティブ要素の最小 44×44 CSS px ユーティリティを定義する（要件7.6, 7.7）
  - `main.tsx` から両 CSS を import して全画面に適用する
  - _Requirements: 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 3. ドメインの型定義（Character と補助値型）
  - `src/domain/types.ts` に `Character`（`id: string`・`name`・`nickname`・`memo`・`favoriteLevel: number`・`photo: Blob`・`createdAt: number`）を定義する（design.md「Data Models」）
  - 補助値型 `CharacterDraft`・`CalendarDay`・`BattlePair`・`BattleOutcome`（`winner: string`・`loser: string`・`commentary: string`）・`Result<T, E>`・`StoreError`・`PhotoError`・`FieldError` を定義する
  - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 3.3, 2.1_

- [x] 4. Persistence 層: CharacterStore インターフェースと実装
  - [x] 4.1 `CharacterStore` インターフェースと `IndexedDbCharacterStore`（idb）を実装する
    - `src/persistence/CharacterStore.ts` に `fetchAll`・`insert`・`update`・`delete`・`count` を持つインターフェースを定義する
    - `src/persistence/IndexedDbCharacterStore.ts` で `openDB('chara-collection', 1, { upgrade })` によりストア `characters`（`keyPath: 'id'`）と `by-createdAt` インデックスを作成し、`fetchAll` は `createdAt` 降順で返す。`insert` は事前に `count() < 1000` を確認し、到達時は `capacityReached` を throw する。`QuotaExceededError`／書き込み失敗は `StoreError`（`quotaExceeded` / `writeFailed` / `loadFailed`）へ変換する
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.6, 6.3, 6.7_

  - [x] 4.2 `InMemoryCharacterStore` と失敗スタブ Store を実装する
    - `src/persistence/InMemoryCharacterStore.ts` に Map ベースの実装（`fetchAll` は `createdAt` 降順）を実装し、テストで差し替え可能にする
    - `src/persistence/FailingCharacterStore.ts` に、`insert`/`update` が指定の `StoreError` を throw する失敗スタブを実装する（保存失敗テスト用）
    - _Requirements: 3.2, 8.4, 8.5_

  - [ ]* 4.3 保存・復元ラウンドトリップのプロパティテスト
    - **Property 5: 保存・復元のラウンドトリップ**（`InMemoryCharacterStore` へ保存後に取得すると写真 Blob 含む全属性が等価）
    - **Validates: Requirements 1.8, 3.3, 3.6**
    - `// Feature: chara-collection, Property 5` タグ・`numRuns: 100`

  - [ ]* 4.4 一覧の降順整列のプロパティテスト
    - **Property 9: 一覧は登録日時の降順**（`fetchAll` は入力集合の並べ替えかつ `createdAt` 降順）
    - **Validates: Requirements 2.1**
    - `// Feature: chara-collection, Property 9` タグ・`numRuns: 100`

  - [ ]* 4.5 削除の単一除去のプロパティテスト
    - **Property 8: 削除は対象1件のみを除去**（削除で当該要素のみ除去・件数1減・他要素不変）
    - **Validates: Requirements 6.7**
    - `// Feature: chara-collection, Property 8` タグ・`numRuns: 100`

  - [ ]* 4.6 IndexedDbCharacterStore の上限・エラー変換のユニットテスト
    - 1,000 件到達時に `capacityReached` を throw すること、`QuotaExceededError` を `quotaExceeded` へ変換することを検証する（fake-indexeddb 等でエラーを注入）
    - _Requirements: 2.2, 3.2, 8.4_

- [x] 5. ドメイン: CharacterValidator と PhotoProcessor
  - [x] 5.1 `CharacterValidator` を実装する
    - `src/domain/CharacterValidator.ts` に `validate(draft): FieldError[]` を実装する。名前 0〜50・ニックネーム 0〜50・メモ 0〜500 の文字数、`favoriteLevel` の整数 1〜5、写真必須（`photo == null` で `photo` エラー）を検証する
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 6.2, 8.1_

  - [ ]* 5.2 フィールド文字数バリデーションのプロパティテスト
    - **Property 1: フィールド文字数バリデーション**（名前/ニックネーム 0〜50・メモ 0〜500 の通過と超過エラー、名前0文字許可）
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.9, 6.2**
    - `// Feature: chara-collection, Property 1` タグ・`numRuns: 100`

  - [ ]* 5.3 お気に入り度範囲バリデーションのプロパティテスト
    - **Property 2: お気に入り度の範囲バリデーション**（整数かつ 1〜5 のみ通過、範囲外・非整数はエラー）
    - **Validates: Requirements 1.7, 8.1, 6.2**
    - `// Feature: chara-collection, Property 2` タグ・`numRuns: 100`

  - [ ]* 5.4 写真必須のプロパティテスト
    - **Property 3: 写真は必須**（`photo` が null の draft は写真必須エラーを返し、入力内容は不変）
    - **Validates: Requirements 1.3**
    - `// Feature: chara-collection, Property 3` タグ・`numRuns: 100`

  - [x] 5.5 `PhotoProcessor` を実装する
    - `src/domain/PhotoProcessor.ts` に `validateAndProcess(file): Promise<Result<Blob, PhotoError>>` を実装する。対応 MIME（JPEG/PNG/WebP）判定・サイズ上限チェックを行い、非対応は `unsupportedFormat`、過大は `tooLarge` を返し、正常時は Blob を返す
    - _Requirements: 1.10, 8.2_

  - [ ]* 5.6 非対応・過大画像拒否のプロパティテスト
    - **Property 4: 非対応・過大画像の拒否**（非対応 MIME または上限超過は対応する `PhotoError` の失敗を返す）
    - **Validates: Requirements 1.10, 8.2**
    - `// Feature: chara-collection, Property 4` タグ・`numRuns: 100`

- [x] 6. 再利用可能 UI コンポーネント（MVP 分）
  - [x] 6.1 `PhotoFrame` と `PhotoInput` を実装する
    - `src/components/PhotoFrame.tsx`: Blob から `URL.createObjectURL` で Object URL を生成し角丸枠（`--radius-large`）で表示、アンマウント/差し替え時に `URL.revokeObjectURL` で解放、`<img onError>` でプレースホルダーへフォールバックする（要件2.4）
    - `src/components/PhotoInput.tsx`: `<input type="file" accept="image/*" capture="environment">` をラップし、選択・キャンセル（空 FileList）・ブロックを扱い、選択ファイルをコールバックで返す（要件1.2, 1.11）
    - _Requirements: 1.2, 1.11, 2.4_

  - [x] 6.2 `PastelButton`・`FavoriteLevelPicker`・`EmptyStateView`・`CharacterCard` を実装する
    - `PastelButton`: パステルアクセント・`--radius-medium`・最小 44×44 CSS px（要件7.5, 7.7）
    - `FavoriteLevelPicker`: 1〜5 のかわいい選択（ハート等、各 44×44 CSS px 以上、要件1.7, 7.7）
    - `EmptyStateView`: 空状態メッセージと導線（要件2.7, 5.6, 8.6）
    - `CharacterCard`: `PhotoFrame`・名前・（あれば）ニックネームを表示（要件2.3, 2.5, 2.6）
    - _Requirements: 1.7, 2.3, 2.5, 2.6, 2.7, 7.5, 7.7_

  - [ ]* 6.3 PhotoInput 属性・PhotoFrame フォールバックのユニットテスト
    - `PhotoInput` が `accept="image/*"` と `capture` 属性を持つこと、`PhotoFrame` が `onError` でプレースホルダー表示に切り替わることを検証する
    - _Requirements: 1.2, 2.4_

- [x] 7. Hooks: useCollection と useRegistration
  - [x] 7.1 `useCollection` を実装する
    - `src/hooks/useCollection.ts` に `characters`（`createdAt` 降順）・`loadState`・`reload()`・`remove(id)` を実装し、`CharacterStore.fetchAll` を呼び出す。読み込み失敗は `failed` 状態にして再試行手段を提供する（要件2.9）
    - _Requirements: 2.1, 2.9, 6.7_

  - [x] 7.2 `useRegistration` を実装する
    - `src/hooks/useRegistration.ts` に `draft`・`fieldErrors`・`setField`・`pickPhoto(files)`・`save()` を実装する。`pickPhoto` は `PhotoProcessor` を呼び、キャンセル/ブロック/不正時は `draft` を破棄せずエラー種別を保持する。`save()` は `CharacterValidator.validate` → `count() < 1000` 確認 → `insert` を行い、`'saved' | 'invalid' | 'storeError'` を返す。保存失敗時は入力を保持する（editing 引数で新規/編集を切替）
    - _Requirements: 1.3, 1.8, 1.10, 1.11, 1.12, 2.2, 3.1, 3.2, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 7.3 保存失敗時の原子性・入力保持のプロパティテスト
    - **Property 7: 保存失敗時の原子性と入力保持**（永続化失敗時は Character がストアに残らず件数不変、draft は保持）
    - **Validates: Requirements 1.12, 3.2, 8.4, 8.5**
    - 失敗スタブ Store + `save` ロジックを対象。`// Feature: chara-collection, Property 7` タグ・`numRuns: 100`

  - [ ]* 7.4 useRegistration の写真取得・保存分岐のユニットテスト
    - ファイル選択キャンセル/ブロック時に入力保持・再取得を促すこと、非対応/過大画像時に形式・サイズ案内を出すことを検証する（要件1.11, 8.2, 8.3）
    - _Requirements: 1.11, 8.2, 8.3_

- [x] 8. MVP 画面: RegistrationForm と CollectionView / CharacterDetailView の配線
  - [x] 8.1 `RegistrationForm`（新規登録）を実装し配線する
    - `src/components/RegistrationForm.tsx`: 名前・ニックネーム・メモ・`FavoriteLevelPicker`・`PhotoInput` を配置し、`useRegistration` に接続する。写真未指定確定・不正画像・保存失敗・選択キャンセル/ブロック時は入力を保持したままメッセージを表示する（要件1.3, 1.10, 1.11, 1.12, 8.1〜8.5）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

  - [x] 8.2 `CollectionView` と `CharacterDetailView` を実装し App に配線する
    - `CollectionView`: `useCollection` から `characters` を受け取り `CharacterCard` グリッド/リストで新しい順に表示。0 件時は `EmptyStateView`、読み込み失敗時は再試行導線を表示する（要件2.1, 2.3〜2.7, 2.9, 8.6）
    - `CharacterDetailView`: 選択 Character の写真・名前・ニックネーム・メモ・お気に入り度を表示する（要件2.8）
    - `App.tsx` に「一覧 ↔ 登録 ↔ 詳細」の画面遷移を配線し、登録完了後に一覧へ戻り再読み込みする
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 8.6_

  - [ ]* 8.3 表示ビュー必須情報のプロパティテスト
    - **Property 10: 表示ビューの必須情報の網羅**（カード/詳細の表示モデルが名前・(あれば)ニックネーム・写真を含み、詳細はさらにメモとお気に入り度を含む）
    - **Validates: Requirements 2.3, 2.5, 2.6, 2.8**
    - 表示モデル導出関数を対象。`// Feature: chara-collection, Property 10` タグ・`numRuns: 100`

  - [ ]* 8.4 一覧の空状態・写真読込失敗・読込失敗のユニットテスト
    - 0 件時の空状態表示（要件2.7, 8.6）、1 件の写真読込失敗時に当該のみプレースホルダーで他は継続（要件2.4）、ストア読込失敗時の再試行導線と非破壊（要件2.9）を検証する
    - _Requirements: 2.4, 2.7, 2.9, 8.6_

- [x] 9. Iteration 1 チェックポイント（MVP）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `vite build` と `vitest run` がグリーンであることを確認する。

- [x] 10. ドメイン: DailyPickSelector（決定的選出）
  - [x] 10.1 `DailyPickSelector` を実装する
    - `src/domain/DailyPickSelector.ts` に `pick(ids, day, salt): string | null` を実装する。id を辞書順で安定ソートし、`CalendarDay` + salt + ソート済み id 列を連結した文字列を FNV-1a 系の決定的ハッシュで 32bit 値 `h` にし、`index = h mod count` の id を返す。空配列は null。`Math.random()` は使用しない
    - `src/domain/dailyMessage.ts` に「今日の相棒」用の短いメッセージ生成関数（最大50文字を保証）を実装する
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x]* 10.2 今日の一枚の決定性・要素性のプロパティテスト
    - **Property 15: 今日の一枚は暦日内で決定的かつコレクションの要素**（同一 day+salt で常に同一 id・コレクションの要素、salt 変更後もコレクションの要素）
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - `// Feature: chara-collection, Property 15` タグ・`numRuns: 100`

  - [x]* 10.3 メッセージ50文字以下のプロパティテスト
    - **Property 16: 今日のメッセージは50文字以下**（併記メッセージの文字数は50以下）
    - **Validates: Requirements 5.5**
    - `// Feature: chara-collection, Property 16` タグ・`numRuns: 100`

- [x] 11. ガチャの Hook と画面
  - [x] 11.1 `useDailyGacha` を実装する
    - `src/hooks/useDailyGacha.ts` に `partner`・`message`・`loadToday()`・`reroll()` を実装する。`fetchAll` で id を集め、当日暦日（端末ローカル）に紐づく salt を `localStorage` から読む（無ければ 0、日付変化でリセット）。`DailyPickSelector.pick` で選出し、同一暦日は再オープンでも同じ結果を返す。`reroll` は salt を +1 して保存・再計算する。0 件時は登録要求状態にする（要件5.6）
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 11.2 `DailyGachaView` を実装し App に配線する
    - `src/components/DailyGachaView.tsx`: `useDailyGacha` に接続し「今日の相棒」を写真・名前・短いメッセージとともに表示、引き直しボタンを提供、0 件時は `EmptyStateView` で登録を促す（要件5.4, 5.5, 5.6）。App のナビゲーションにガチャ画面を追加する
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [x]* 11.3 useDailyGacha の暦日固定・0件ガードのユニットテスト
    - 同一暦日内の再 `loadToday` で同じ結果を返すこと、日付変化で salt がリセットされること、0 件時に登録要求を表示することを検証する
    - _Requirements: 5.2, 5.6_

- [x] 12. Iteration 2 チェックポイント（今日の一枚ガチャ）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `vite build` と `vitest run` がグリーンであることを確認する。

- [x] 13. ドメイン: TournamentEngine（自動判定）と BattleCommentator（実況）
  - [x] 13.1 `TournamentEngine` を実装する（勝者は rng で自動判定）
    - `src/domain/TournamentEngine.ts` に `createTournament(contestants, rng, shuffle?)` ファクトリを実装する。`rng: () => number` は [0,1) の一様乱数を外部注入し、本番は `Math.random`、テストは固定/シード rng を渡す。`currentPair`・`champion`・`lastResult`（`{ winner, loser }`）・`advance()` を実装する。開始時に注入シャッフル（テスト時は恒等/固定順）で一度並べ替え、各ラウンドでキューから 2 件ずつ `BattlePair` を構成する。`advance()` は現ペアの 2 件から rng でちょうど 1 件を勝者に自動決定し（例: `rng() < 0.5` で left）、勝者を次ラウンドのキューへ進め、敗者を除外する。奇数の余り 1 件は不戦勝で次ラウンドへ繰上げ、勝ち残り 1 件で champion を確定する（有限回で終了。終了性は rng に非依存）。利用者による `selectWinner` は廃止する
    - _Requirements: 4.1, 4.2, 4.4, 4.6, 4.7_

  - [x] 13.2 `BattleCommentator` を実装する
    - `src/domain/BattleCommentator.ts` に `narrate(pair: { winner: string; loser: string }, rng: () => number): string` を実装する。複数の実況テンプレート（例: 「{winner} が {loser} を圧倒！」「接戦の末、{winner} が {loser} を下した！」等）を持ち、rng でテンプレートを 1 つ選び勝者/敗者名を差し込む。純粋関数で副作用を持たず rng を外部注入するため、同一の対戦結果でも rng の値により文面が変動しうる
    - _Requirements: 4.3, 4.5_

  - [ ]* 13.3 唯一の勝者で自動終了のプロパティテスト
    - **Property 11: トーナメントは唯一の勝者で自動終了する**（2件以上・任意の rng シード列で、進行中は相異なる2件の pair、最終的に要素ちょうど1件が champion として確定して終了し、利用者の勝敗選択を要しない）
    - **Validates: Requirements 4.1, 4.2, 4.7**
    - 対象: `TournamentEngine`（rng 注入）。`// Feature: chara-collection, Property 11` タグ・`numRuns: 100`

  - [ ]* 13.4 自動判定の敗者除外・単調減少のプロパティテスト
    - **Property 12: 自動判定は敗者を除外し勝者を進める**（rng による自動判定で選ばれた勝者は次の対戦へ進み、敗者は以降のいずれの対戦にも現れず、勝ち残り総数は単調減少）
    - **Validates: Requirements 4.2, 4.4**
    - 対象: `TournamentEngine`（rng 注入）。`// Feature: chara-collection, Property 12` タグ・`numRuns: 100`

  - [ ]* 13.5 奇数ラウンドの不戦勝のプロパティテスト
    - **Property 13: 奇数ラウンドの不戦勝**（奇数件のラウンドでちょうど1件が不戦勝で次へ、全 Character が過不足なく次ラウンドへ引き継がれる）
    - **Validates: Requirements 4.6**
    - 対象: `TournamentEngine`（rng 注入）。`// Feature: chara-collection, Property 13` タグ・`numRuns: 100`

  - [ ]* 13.6 対戦実況の妥当性・変動性のプロパティテスト
    - **Property 14: 対戦実況は妥当で実行ごとに変動しうる**（`narrate` は非空で勝者を表す情報を含む実況文字列を返し、実況テンプレートは複数存在し rng の値を変えると同一の対戦結果に対して複数の異なる実況文面が生成されうる）
    - **Validates: Requirements 4.3, 4.5**
    - 対象: `BattleCommentator`（rng 注入）。`// Feature: chara-collection, Property 14` タグ・`numRuns: 100`

- [x] 14. 対戦の Hook と画面
  - [x] 14.1 `useRankingBattle` を実装する（自動判定・自動進行）
    - `src/hooks/useRankingBattle.ts` に `currentPair`・`currentCommentary`（`BattleOutcome`）・`champion`・`canStart`・`start()`・`advance()`・`reset()` を実装する。`fetchAll` で全 Character を取得し 2 件未満は `canStart=false`（開始せずメッセージ、要件4.8）。`start` で `createTournament`（rng に `Math.random` を注入）を生成し最初のペアを提示。`advance()` は呼ぶたびに現ペアの勝者を rng で自動判定し `BattleCommentator.narrate` で実況を生成して `currentCommentary` に反映し、勝者を次ラウンドへ進める。利用者の勝敗選択（`choose(side)`）は廃止する。進行状態は in-memory のみで永続化せず、ページ再読み込み/再起動時は初期化される（要件4.9）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9_

  - [x] 14.2 `RankingBattleView` を実装し App に配線する
    - `src/components/RankingBattleView.tsx`: 現在の `BattlePair` 2 件を並べて表示する。勝敗は利用者が選ばず、アプリが自動判定する。ランダムに変わる実況（`currentCommentary`）と勝敗結果を表示して自動進行する（利用者の操作は「開始」「次へ／自動再生」のみで勝敗選択はしない）。最終勝者を「最も好きなキャラ」として表示。2 件未満は開始せずメッセージ表示（要件4.8）。App のナビゲーションに対戦画面を追加する
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [ ]* 14.3 useRankingBattle の2件未満ガード・初期化・実況のユニットテスト
    - 2 件未満で開始せずメッセージを表示すること（要件4.8）、`reset()`／再マウントで進行状態が初期化されること（要件4.9）、実況が複数テンプレートから rng でランダム生成され rng を固定/シードすると決定的に検証できること（勝者/敗者名の差し込み・非空、要件4.3, 4.5）を検証する
    - _Requirements: 4.3, 4.5, 4.8, 4.9_

- [x] 15. Iteration 3 チェックポイント（ランキング対戦）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `vite build` と `vitest run` がグリーンであることを確認する。

- [x] 16. 編集・削除機能
  - [x] 16.1 RegistrationForm の編集モードを実装する
    - `useRegistration(editing)` に既存 Character の属性を初期表示（要件6.1）し、写真を差し替え可能にする（要件6.4）。`save()` で要件1と同じ検証を行い、`CharacterStore.update` で上書き（件数不変）、完了を通知する（要件6.2, 6.3）
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 16.2 CharacterDetailView に削除フローを配線する
    - 編集・削除の導線を提供し、削除時は確認を求める。キャンセルで元表示に戻し（要件6.6）、確認で `useCollection.remove(id)`（`CharacterStore.delete`）を呼び削除完了を通知する（要件6.5, 6.7）
    - _Requirements: 6.5, 6.6, 6.7_

  - [ ]* 16.3 更新ラウンドトリップ・件数不変のプロパティテスト
    - **Property 6: 更新のラウンドトリップと件数不変**（更新後の取得が新属性を反映し写真差し替えを含み上書き、件数不変）
    - **Validates: Requirements 6.1, 6.3, 6.4**
    - `// Feature: chara-collection, Property 6` タグ・`numRuns: 100`

  - [ ]* 16.4 削除確認フローのユニットテスト
    - 削除確認の要求・キャンセルで非削除・確定で削除通知を検証する（要件6.5, 6.6, 6.7）
    - _Requirements: 6.5, 6.6, 6.7_

- [x] 17. エラー / 空状態ハンドリングの全画面配線
  - [x] 17.1 hooks 層のエラーマッピングを整備し各画面に反映する
    - design.md「Error Handling」表に従い、`StoreError`（`quotaExceeded`/`writeFailed`/`loadFailed`/`capacityReached`）・`PhotoError`・`FieldError` をユーザー向けメッセージへマッピングする共通ヘルパを `src/hooks/errorMessages.ts` に実装し、`RegistrationForm`・`CollectionView`・`DailyGachaView`・`RankingBattleView` に配線する。容量超過は不要データ削除の促し、その他保存失敗は再試行の促し、いずれも入力・保存済みデータを破棄しない
    - _Requirements: 1.3, 1.10, 1.11, 1.12, 2.2, 2.4, 2.7, 2.9, 3.2, 3.7, 4.6, 5.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 17.2 空状態・エラー分岐の横断ユニットテスト
    - 上限1,000件到達通知（要件2.2）、復元失敗時の非破壊（要件3.7）、favoriteLevel 不正時のメッセージ（要件8.1）、容量不足と再試行の各メッセージ（要件8.4, 8.5）を検証する
    - _Requirements: 2.2, 3.7, 8.1, 8.4, 8.5_

- [x] 18. PWA 仕上げ: Manifest とオフライン確認
  - [x] 18.1 Web App Manifest とアイコン・Service Worker precache を確定する
    - `vite.config.ts` の `VitePWA` に Manifest（`name`/`short_name`「キャラ図鑑」相当、`display: 'standalone'`、`orientation: 'portrait'`、`start_url: '.'`、`scope: '.'`、`theme_color`/`background_color` をパステルトークンに一致）と 192/512（`maskable` 含む）アイコンを設定する。Workbox によるアプリシェル（JS/CSS/HTML/アイコン）precache を有効化し `autoUpdate` を設定する
    - iOS Safari 向けにホーム画面追加手順の案内 UI を追加し、`navigator.storage.persist()` を best-effort で呼ぶ（要件3.7 の非破壊方針を維持）
    - _Requirements: 3.4, 3.5, 3.8, 7.2, 7.3_

- [x] 19. Iteration 4 / 最終チェックポイント（仕上げ）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `vite build` と `vitest run` がグリーンであることを確認する。

- [x] 20. デザインシステムを「大人かわいい（Adult_Cute_Theme）」に刷新（要件9）
  - `src/styles/tokens.css` のカラートークンを彩度を抑えた大人かわいい配色へ更新（`--color-primary` くすませたローズ、`--color-secondary` スモーキーミント、`--color-accent` スモーキーラベンダー、`--color-background` オフホワイト/クリーム、`--color-surface`、`--color-text-primary`/`--color-text-secondary`）。既存トークン名は維持し値のみ調整する（要件9.1 / 7.4）
  - 影トークン（`--shadow-soft` / `--shadow-raised`）、余白トークン（`--space-xs`/`sm`/`md`/`lg`）、トランジショントークン（`--transition-fast=200ms` / `--transition-base=300ms` / `--transition-slow=500ms`、いずれも 200〜500ms）を追加する。`@media (prefers-reduced-motion: reduce)` でトランジションを 0/短縮にする（要件9.2, 9.4, 9.5）
  - 主要コンポーネント（`PastelButton`・カード・写真枠・入力欄・各画面）が色/角丸/影/余白/トランジションをトークン経由で参照するよう `global.css` と各コンポーネントのクラスを整える。同一種別要素で角丸/影/余白が一致することを担保する。rem タイポグラフィ・44×44 CSS px・320〜430 px 横スクロールなしを維持する（要件9.3, 9.6, 9.7 / 7.6, 7.7, 7.8）
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 21. 一覧の並び替え（要件11）
  - [x] 21.1 ドメイン純粋関数 `sortCharacters` を実装する
    - `src/domain/types.ts` に `type SortOrder = 'newest' | 'favorite' | 'name'` を追加する
    - `src/domain/sortCharacters.ts` に `sortCharacters(characters: readonly Character[], order: SortOrder): Character[]` を実装する。元配列を変更せず新配列を返す。タイブレーク: `newest` = `createdAt` 降順 → `id` 昇順 / `favorite` = `favoriteLevel` 降順 → `createdAt` 降順 → `id` 昇順 / `name` = 名前の Unicode コードポイント順昇順（空名は後方）→ `id` 昇順。決定的順序とする
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 21.2 並び替えの決定性・要素保存のプロパティテスト
    - **Property 17: 並び替えは決定的で要素を保存する**（入力集合の並べ替え＝要素の過不足なし、元配列不変、各 SortOrder で決定的順序・タイブレーク）
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6**
    - `// Feature: chara-collection, Property 17` タグ・`numRuns: 100`。対象 `sortCharacters`

  - [x] 21.3 `useCollection` に並び順状態を追加し `CollectionView` に選択 UI を配線する
    - `useCollection` に `sortOrder`（初期 `'newest'`）・`setSortOrder` を追加し、`characters` は `fetchAll` 結果に `sortCharacters` を適用して返す（表示順のみ、ストア/データ不変。要件11.5, 11.6）
    - `CollectionView` に大人かわいいテーマ準拠の並び順選択 UI（3 種、各 44×44 CSS px、横スクロールなし）を追加する（要件11.1）
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [x] 22. 一覧でのニックネーム優先表示（要件10）
  - [x] 22.1 表示モデル導出 `deriveCardDisplay` を実装し `CharacterCard` に適用する
    - `src/domain` に `deriveCardDisplay(character): { primary: string; secondary?: string }` を実装する。ニックネーム非空（空白のみ除く）→ `primary` = ニックネーム、（名前非空なら）`secondary` = 名前 / ニックネーム空かつ名前非空 → `primary` = 名前 / 両方空 → `primary` = 「名前未設定」
    - `CharacterCard` を `deriveCardDisplay` ベースに更新し、主表示を先頭かつ副表示より大きい文字サイズ、副表示を補助表示にする（要件10.4）。詳細画面（`CharacterDetailView`）の表示順は変更しない
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 22.2 一覧カード主表示/副表示のプロパティテスト
    - **Property 18: 一覧カードの主表示/副表示の決定**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - `// Feature: chara-collection, Property 18` タグ・`numRuns: 100`。対象 `deriveCardDisplay`

- [x] 23. お気に入り度の視覚的強調（要件12）
  - [x] 23.1 表示モデル導出 `deriveFavoriteLevelDisplay` と `FavoriteLevelDisplay` を実装する
    - `src/domain` に `deriveFavoriteLevelDisplay(favoriteLevel: number): { filled: number; total: 5; textEquivalent: string }` を実装する。1〜5 整数 → `filled = level`、範囲外/未設定/非整数 → `filled = 0`、`total` 常に 5、`textEquivalent = `5段階中${filled}``
    - `src/components/FavoriteLevelDisplay.tsx`（表示専用）を実装する。塗り記号 `filled` 個＋未塗りで合計 5 個、色/記号のみに依存しないよう `aria-label` 等で「5段階中N」を提供する。`CharacterCard` と `CharacterDetailView` に配置する（要件12.1, 12.2, 12.3, 12.4）
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 23.2 お気に入り度表示のプロパティテスト
    - **Property 19: お気に入り度表示は個数一致とテキスト等価物を持つ**
    - **Validates: Requirements 12.1, 12.3, 12.4**
    - `// Feature: chara-collection, Property 19` タグ・`numRuns: 100`。対象 `deriveFavoriteLevelDisplay`

- [x] 24. 共通ナビゲーションバー（要件13）
  - [x] 24.1 `NavigationBar` を実装し App に配線する
    - `src/components/NavigationBar.tsx`（下部固定タブ 4 項目「図鑑/今日の相棒/トーナメント/新規登録」、アクティブタブ表示、各 44×44 CSS px、320〜430 px 横スクロールなし、大人かわいいテーマ整合）を実装する
    - `App.tsx` を更新する: `NavigationBar` を `view` が `'list'`/`'gacha'`/`'battle'` のときのみ表示し、`'detail'`/`'add'` では非表示にする（要件13.6, 13.7）。各タブは `goToList`/`goToGacha`/`goToBattle`/`goToAdd`（`goToAdd` は編集状態を引き継がない新規）に対応させる。アクティブタブは現在の `view` から導出する
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [ ]* 24.2 NavigationBar 表示制御・遷移のユニットテスト
    - 各タブ選択で `view` が期待どおり遷移すること（`goToList`/`goToGacha`/`goToBattle`/`goToAdd`）、主要画面（list/gacha/battle）で表示・詳細/フォームで非表示、アクティブタブ一致、`goToAdd` が新規（編集状態を持たない）であることを検証する（要件13.2〜13.7）
    - _Requirements: 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 25. Iteration 5 チェックポイント（見た目と使い勝手の底上げ）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `vite build`（＝ `tsc -b && vite build`）と `vitest run` がグリーンであることを確認する。

- [x] 26. ドメイン型・テーマトークンの拡張（イメージカラー / 出会った日）
  - `src/domain/types.ts` に `type ImageColor = 'none' | 'rose' | 'mint' | 'lavender' | 'butter' | 'sky'` を追加する（design.md「Data Models」）
  - `Character` に `metOn?: string`（ISO 8601 の `YYYY-MM-DD`、任意・未設定は `undefined`）と `imageColor: ImageColor`（既定 `'none'`）を追加する。`CharacterDraft` に `metOn?: string` と `imageColor: ImageColor` を追加する。`FieldError` の `field` 取り得る値に `'metOn'` と `'imageColor'` を追加する（既存フィールドは破壊せず追記）
  - `src/styles/tokens.css` に `--image-color-rose` / `--image-color-mint` / `--image-color-lavender` / `--image-color-butter` / `--image-color-sky` を大人かわいいテーマ（Adult_Cute_Theme）の配色に整合するパステル色として追加する（要件15.1, 15.9 / 9.1）
  - _Requirements: 14.1, 14.11, 15.1, 15.5_

- [x] 27. ドメイン純粋関数: 出会った日の正規化・整形とイメージカラー縁取り導出
  - [x] 27.1 `normalizeMetOn` と `formatMetOn` を実装する
    - `src/domain/metOn.ts` に `normalizeMetOn(value: string | undefined, today: CalendarDay): string | undefined` を実装する。入力が `YYYY-MM-DD` 形式かつ 1900-01-01 以上 `today` 以下の実在する暦日である場合のみ、その正規化済み `YYYY-MM-DD` 文字列を返す。空文字・`undefined`・形式不正・実在しない日付・1900 以前・未来日はいずれも `undefined` を返す（要件14.2, 14.3, 14.4, 14.10, 14.11）
    - 同ファイルに `formatMetOn(metOn: string): string` を実装する。妥当な `YYYY-MM-DD` を「YYYY年M月D日」へ整形し、月/日はゼロ埋めしない（例: `'2024-03-05'` → `'2024年3月5日'`、要件14.5）
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.10, 14.11_

  - [x] 27.2 `deriveImageColorStyle` を実装する
    - `src/domain/imageColor.ts` に `deriveImageColorStyle(imageColor: ImageColor): { hasBorder: boolean; borderVarName?: string }` を実装する。`'none'` または許容値以外は `{ hasBorder: false }`（`borderVarName` を持たない）、プリセット5色は `{ hasBorder: true, borderVarName: `--image-color-${color}` }` を返す（要件15.4, 15.6, 15.7, 15.8）
    - _Requirements: 15.4, 15.6, 15.7, 15.8_

  - [x]* 27.3 出会った日の正規化の妥当性のプロパティテスト
    - **Property 21: 出会った日の正規化の妥当性**（`YYYY-MM-DD` かつ 1900-01-01〜`today` の実在日のみそのまま返し、空/不正形式/実在しない日/範囲外/未来日は `undefined`）
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.10, 14.11**
    - `// Feature: chara-collection, Property 21` タグ・`numRuns: 100`。対象 `normalizeMetOn`

  - [x]* 27.4 イメージカラーの正規化と縁取り導出のプロパティテスト
    - **Property 22: イメージカラーの正規化と縁取り導出**（`'none'`/許容値以外は `hasBorder === false`、プリセット5色はちょうど対応する `--image-color-{color}` を伴い `hasBorder === true`）
    - **Validates: Requirements 15.4, 15.6, 15.7, 15.8**
    - `// Feature: chara-collection, Property 22` タグ・`numRuns: 100`。対象 `deriveImageColorStyle`

- [x] 28. CharacterValidator を新フィールドへ拡張する
  - `src/domain/CharacterValidator.ts` の `validate(draft)` に、`metOn` は `normalizeMetOn` を用いて正規化不能な値を未設定へ落とす方針で扱い（必要に応じて `FieldError`（`field: 'metOn'`）を返す）、`imageColor` はプリセット許容値のみ受理し許容値以外・未設定は `'none'` へ正規化する検証を追加する。既存の名前/ニックネーム/メモ/お気に入り度/写真の検証は不変とする（design.md「CharacterValidator」）
  - _Requirements: 14.4, 15.4_

- [x] 29. Persistence の後方互換正規化（読み出し時）
  - `src/persistence/IndexedDbCharacterStore.ts` の `fetchAll` の読み出し時に、既存 `PhotoData` 正規化と同じ場所で `metOn` 欠落/不正 → `undefined`、`imageColor` 欠落/不正 → `'none'` を補完する。DB バージョンは 1 のまま据え置き、スキーマ変更は行わない（要件14.11, 15.5）
  - `src/persistence/InMemoryCharacterStore.ts` も同様に、読み出し結果が `metOn`（`undefined` 可）・`imageColor`（既定 `'none'`）を含むよう整合させる
  - _Requirements: 14.11, 15.5_

  - [x]* 29.1 新フィールドを含む保存・復元ラウンドトリップのプロパティテスト
    - **Property 20: 出会った日・イメージカラーを含む保存・復元ラウンドトリップ**（任意の妥当な `metOn`（`YYYY-MM-DD` または `undefined`）と任意の `ImageColor` を持つ Character を保存後に取得すると写真バイト内容を含む全属性・`metOn`・`imageColor` が等価に復元され、`metOn` 欠落は `undefined`・`imageColor` 欠落/不正は `'none'` に正規化される）
    - **Validates: Requirements 14.2, 14.3, 14.11, 15.2, 15.3, 15.5**
    - `// Feature: chara-collection, Property 20` タグ・`numRuns: 100`。対象 `InMemoryCharacterStore` ＋読み出し正規化

- [x] 30. useRegistration を新フィールドへ拡張する
  - `src/hooks/useRegistration.ts` の `draft` に `metOn`・`imageColor` を持たせ、`setField` で更新できるようにする。編集モードでは既存 Character の `metOn`（未設定なら空欄）・`imageColor` を初期化する。`save()` で `normalizeMetOn` を適用して `metOn` を確定し（クリア時は未設定へ更新、要件14.10）、`imageColor` はそのまま保存する。既存の写真取得・検証・保存分岐は不変とする（要件14.9, 14.10, 15.2, 15.3）
  - _Requirements: 14.9, 14.10, 15.2, 15.3_

- [x] 31. RegistrationForm に「出会った日」「イメージカラー」入力 UI を追加する
  - `src/components/RegistrationForm.tsx` に「出会った日」= `<input type="date">`（任意項目・未入力可、最小 44×44 CSS px、横スクロールなし、大人かわいいテーマ整合）を追加し、`useRegistration` の `metOn` に接続する。編集時は既存 `metOn` を初期表示し、クリア（空）にして確定すると未設定へ更新する（要件14.1, 14.9, 14.10）
  - 「イメージカラー」= 「なし」＋プリセット5色の**6択**スウォッチ選択 UI（各 44×44 CSS px 以上、横スクロールなし、既定選択 `'none'`）を追加し、`useRegistration` の `imageColor` に接続する。編集時は既存 `imageColor` を初期選択にする（要件15.1, 15.2, 15.3, 15.10）
  - _Requirements: 14.1, 14.9, 14.10, 15.1, 15.2, 15.3, 15.10_

- [x] 32. CharacterCard / CharacterDetailView / PhotoFrame に縁取りと詳細の Met_On 表示を反映する
  - [x] 32.1 CharacterCard・PhotoFrame に縁取りを適用する
    - `src/components/CharacterCard.tsx`（および必要に応じて `src/components/PhotoFrame.tsx`）で `deriveImageColorStyle(character.imageColor)` の結果に基づき、`hasBorder === true` のときのみ `borderVarName`（`--image-color-*`）を `border-color` にトークン経由で適用し、`'none'` のときは縁取りを適用しない。角丸（`--radius-large`）を維持し、横スクロールなし・44×44 CSS px を崩さない。`metOn` は一覧カードに表示しない（要件14.7, 15.6, 15.8, 15.9, 15.10）
    - _Requirements: 14.7, 15.6, 15.8, 15.9, 15.10_

  - [x] 32.2 CharacterDetailView に写真枠の縁取りと Met_On 表示を追加する
    - `src/components/CharacterDetailView.tsx` で写真枠に `deriveImageColorStyle` に基づく縁取りを反映する（`'none'` は縁取りなし、角丸維持、要件15.7, 15.8, 15.9）。`metOn` が設定済み（`normalizeMetOn` を通過した妥当な値）のときのみ `formatMetOn(metOn)` の結果「YYYY年M月D日」を表示し、未設定のときは当該行を表示しない（要件14.5, 14.6）
    - Daily_Gacha・Ranking_Battle の各画面に `metOn` を出さないことを担保する（要件14.8）
    - _Requirements: 14.5, 14.6, 14.8, 15.7, 15.8, 15.9_

  - [x]* 32.3 UI 追加・表示分岐のユニットテスト
    - `RegistrationForm` に日付入力欄と6択のイメージカラー選択が存在すること、編集時に `metOn`/`imageColor` が初期表示され `metOn` をクリアできること（要件14.9, 14.10, 15.3）、`CharacterDetailView` が `metOn` 設定時のみ「YYYY年M月D日」を表示し未設定時は非表示にすること（要件14.5, 14.6）、一覧/ガチャ/対戦に `metOn` を表示しないこと（要件14.7, 14.8）、`imageColor` 未選択で `'none'` として保存されること（要件15.2）を検証する
    - _Requirements: 14.1, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 15.1, 15.2_

- [x] 33. Iteration 6 チェックポイント（登録項目の拡張）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

- [x] 34. 一覧の並び替えに「出会った日の新しい順」を追加（要件11.1, 11.7）
  - `src/domain/types.ts` の `type SortOrder` に `'metOn'` を追加する（`'newest' | 'favorite' | 'name' | 'metOn'`）。コメントに「'metOn': 出会った日（Met_On）の新しい順。Met_On 降順、未設定は後方」を追記する
  - `src/domain/sortCharacters.ts` に `'metOn'` の case を追加する。Met_On が設定されている要素を Met_On（`YYYY-MM-DD` 文字列）の降順、Met_On 未設定（`undefined`）の要素は後方、Met_On 同値または両方未設定は `createdAt` 降順 → `id` 昇順のタイブレークで並べる。`YYYY-MM-DD` は辞書順＝日付順のため文字列のコードポイント比較で降順にできる（要件14.4 で不正値は未設定化済みのため、値は妥当な `YYYY-MM-DD` か `undefined`）。元配列は変更しない純粋関数を維持する
  - `src/components/CollectionView.tsx` の並び順選択 UI（`SORT_OPTIONS`）に「出会った日順」（value: `'metOn'`）を追加し、4 種の選択肢にする。各ボタンは最小 44×44 CSS px・横スクロールなし・大人かわいいテーマ整合を維持する（要件11.1）
  - `useCollection` は既存の汎用実装（`sortCharacters(source, sortOrder)`）で `'metOn'` を透過的に扱うため変更不要（表示順のみ変更・ストア/データ不変、要件11.5, 11.6）
  - _Requirements: 11.1, 11.5, 11.6, 11.7_

  - [x]* 34.1 並び替え（'metOn' を含む）のプロパティテストを更新する
    - **Property 17: 並び替えは決定的で要素を保存する** の対象に `'metOn'` を含める。Character 集合と各 `SortOrder`（`'newest'`/`'favorite'`/`'name'`/`'metOn'`）の組で、入力集合の並べ替え（要素の過不足なし）・元配列不変・決定的順序を検証し、`'metOn'` のタイブレーク（Met_On 降順→未設定後方→`createdAt` 降順→`id` 昇順）を確認する。生成器は Met_On 設定/未設定の混在、同一 Met_On、同一 createdAt を含める
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5, 11.6, 11.7**
    - `// Feature: chara-collection, Property 17` タグ・`numRuns: 100`。対象 `sortCharacters`

- [x] 35. Iteration 7 チェックポイント（出会った日順の追加）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。
- [x] 36. 並び順選択 UI の選択肢構成と初期並び順の変更（要件2.1, 11.1, 11.2）
  - CollectionView の SORT_OPTIONS から newest（新しい順）を除き、左から 名前(name)→お気に入り(favorite)→出会った日(metOn) の3種にする。各ボタンは最小 44x44 CSS px・横スクロールなし・大人かわいいテーマ整合を維持する（要件11.1）
  - useCollection の sortOrder 初期値を newest から name に変更する（初期表示は名前の昇順=要件11.4 と同一の順序。要件2.1, 11.2）
  - sortCharacters の newest case・SortOrder 型は変更しない（UI 選択肢と初期値のみ変更）
  - _Requirements: 2.1, 11.1, 11.2_

  - [x]* 36.1 並び順 UI 選択肢・初期並び順のユニットテスト
    - CollectionView の並び順選択に 名前/お気に入り/出会った日 の3ボタンが左からこの順で存在し新しい順が無いこと、初期状態で名前が選択状態(aria-pressed=true)であること、useCollection の初期 sortOrder が name であることを検証する（要件11.1, 11.2）
    - _Requirements: 2.1, 11.1, 11.2_

- [ ] 37. 今日の相棒の一言（Daily_Line）の決定的セリフ選択（要件16, 5.5）
  - [ ] 37.1 ドメイン `buildDailyLine` を実装し `buildDailyMessage` を置換/内部委譲する
    - `src/domain/dailyMessage.ts` に `buildDailyLine(input: { id: string; name: string }, day: CalendarDay, salt: number): string` を実装する。複数のセリフ風テンプレート集（相棒本人の一言として表現する文。名前差し込み用と名前なし用の双方を含む）を持ち、`DailyPickSelector` と同じ FNV-1a 系の決定的ハッシュ（`day` の year/month/day＋相棒 `id`＋`salt` を連結した文字列をハッシュ）でテンプレートを 1 つ選び、名前を差し込む。同一の `{ id, day, salt }` では常に同一の一言を返す（決定的、要件16.2）。名前が空（空文字・空白のみ）のときは名前を差し込まないテンプレートを用い、空でない一言を返す（要件16.6）。長さは常に最大50文字（Unicode コードポイント数、`MAX_MESSAGE_LENGTH`）以下を保証する（要件16.4, 5.5）。`Math.random()` は使用せず外部送信も行わない純粋関数とする（要件16.5, 3.8）
    - 既存 `buildDailyMessage(name)` は `buildDailyLine` へ作り替える（または `buildDailyLine` へ内部委譲する形で置換し、呼び出し側 `useDailyGacha` を新シグネチャへ差し替える）。既存の 50文字切り詰めユーティリティ（`codePointLength` / `truncateToCodePoints` / `MAX_MESSAGE_LENGTH`）は再利用する
    - _Requirements: 16.1, 16.2, 16.4, 16.6, 5.5_

  - [ ]* 37.2 今日の一言の決定的・非空・50文字以下のプロパティテスト
    - **Property 23: 今日の一言は決定的・要素妥当・50文字以下**（任意の相棒 `{ id, name }`（名前は空/空白/絵文字/長文を含む）・固定 `CalendarDay`・固定 salt に対し、`buildDailyLine` は (a) 何度呼んでも同一文字列＝決定的、(b) 長さ50コードポイント以下、(c) 空でない文字列を返す）
    - **Validates: Requirements 5.5, 16.1, 16.2, 16.4, 16.6**
    - `// Feature: chara-collection, Property 23` タグ・`numRuns: 100`。対象 `buildDailyLine`。既存 `dailyMessage.test.ts`（Property 16）は 50文字以下の検証を維持する（対象は `buildDailyLine`）

- [ ] 38. useDailyGacha を新関数シグネチャへ更新する（要件16, 5.2, 5.3）
  - `src/hooks/useDailyGacha.ts` の `selectWithSalt` 内で、`pick` により相棒を確定した後、その相棒の `id` と `name`・当日暦日（`today`）・現在の `salt` を `buildDailyLine({ id, name }, today, salt)` へ渡して `message` に反映する（従来の `buildDailyMessage(selected.name)` からの差し替え）。`loadToday`（同一暦日固定）・`reroll`（salt +1 再計算）の双方でこの一言が決定的に固定/更新される（要件16.2, 16.3, 5.2, 5.3）。既存の salt 管理・0件ガード・エラー処理は不変とする
  - _Requirements: 16.1, 16.2, 16.3, 5.2, 5.3_

- [ ] 39. UI: DailyGachaView のメッセージ表示を吹き出し風セリフに更新する（要件16.1, 要件9）
  - `src/components/DailyGachaView.tsx` の `message` 表示（`.daily-gacha__message`）を、相棒キャラ本人のセリフ風の一言として**吹き出し風**に表示するよう更新する（要件16.1）。見た目（背景・角丸・影・余白・吹き出しの尻尾等）は `src/styles/global.css`（または該当 CSS）で大人かわいいテーマのトークン（`--color-*` / `--radius-*` / `--shadow-*` / `--space-*`）経由で適用し、最小 44×44 CSS px・横スクロールなし・rem 追従を維持する（要件9.1, 9.2, 9.6, 9.7）。本コンポーネントはロジックを持たず、hook から受け取った `message` を描画するのみとする
  - _Requirements: 16.1, 9.1, 9.2, 9.6, 9.7_

- [ ] 40. Iteration 8 チェックポイント（今日の相棒に一言）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

- [ ] 41. ドメイン: TournamentEngine を勝ち上がり履歴（Tournament_Bracket）公開のため拡張する（要件18, 4.6, 4.7）
  - `src/domain/types.ts` に `interface BracketMatch { round: number; left: string; right: string | null; winner: string | null; bye: boolean }` と `type TournamentBracket = BracketMatch[]` を追加する。表示用に id を Character へ解決した `interface ResolvedBracketMatch { round: number; left: Character; right: Character | null; winner: Character | null; bye: boolean }` も追加する（既存の型は破壊せず追記。design.md「Data Models」）
  - `src/domain/TournamentEngine.ts` の `TournamentEngine` インターフェースに `readonly bracket: TournamentBracket` を追加する。`createTournament` の実装で、`advance()` が現ペアの勝者を確定した時点で `{ round, left, right, winner, bye: false }` を bracket へ追記し、奇数の余り 1 件を不戦勝で繰り上げる際に `{ round, left: 繰上げ id, right: null, winner: 繰上げ id, bye: true }` を追記する。ラウンド番号は各対戦が属するラウンドを表す。**既存の `currentPair` / `champion` / `lastResult` / `advance()` のセマンティクスおよび `createTournament` の仕様は不変**とし、bracket への追記のみを追加する（要件18.1, 18.2, 18.3, 4.6, 4.7）
  - _Requirements: 18.1, 18.2, 18.3, 4.6, 4.7_

  - [ ]* 41.1 トーナメント表の整合性のプロパティテスト
    - **Property 24: トーナメント表は勝ち上がりと整合する**（2 件以上・任意の rng シード列で champion 確定まで進めた後、bracket が (a) 各 match の勝者妥当（bye は winner===left・right===null）、(b) あるラウンドの勝者集合＝次ラウンドの対戦者集合、(c) 頂点＝champion、(d) `advance()`（`lastResult`）系列と無矛盾、を満たす）
    - **Validates: Requirements 4.6, 4.7, 18**
    - `// Feature: chara-collection, Property 24` タグ・`numRuns: 100`。対象 `TournamentEngine`（rng 注入・bracket）。既存 Property 11〜13 のテストは不変で保持する
    - _Requirements: 4.6, 4.7, 18.1, 18.2, 18.3_

- [ ] 42. Hook: useRankingBattle を2段階進行と bracket 公開へ拡張する（要件17, 18, 4.2, 4.3, 4.4, 4.7）
  - `src/hooks/useRankingBattle.ts` に対戦フェーズ状態 `phase: 'pair' | 'result' | 'champion'` を追加する。`resolveCurrentBattle()`（「勝負！」）は内部で `engine.advance()` を呼び、現ペアの勝者を rng で自動判定し `BattleCommentator.narrate` で実況を生成して `currentCommentary` に反映し `phase` を `'result'` にする（要件17.1, 17.2, 4.2, 4.3）。`next()`（「次へ」）は `engine.champion` 確定なら `phase` を `'champion'` に、そうでなければ次の `currentPair` を提示して `phase` を `'pair'` に戻す（要件17.3, 17.4, 4.4, 4.7）
  - `engine.bracket`（id 列）の各 id を `fetchAll` 済みの Character へ解決した `ResolvedBracketMatch[]` を `bracket` として公開する（要件18.1, 18.2, 18.3）。既存の `start`/`advance`/`reset`・`canStart`（2 件未満ガード、要件4.8）・進行状態の非永続（要件4.9）は不変とし、UI 進行の2段階化は `resolveCurrentBattle` が `advance` を内部で呼ぶ形で吸収する（互換維持）
  - _Requirements: 17.1, 17.3, 17.4, 17.5, 18.1, 18.2, 18.3, 4.2, 4.3, 4.4, 4.7_

- [ ] 43. UI: RankingBattleView を試合ごとリザルト表示＋優勝演出に更新する（要件17, 4.7, 9.4, 9.5）
  - `src/components/RankingBattleView.tsx` を `useRankingBattle` の `phase` に従って表示を切り替えるよう更新する。`'pair'` はペア 2 件と「勝負！」ボタン（`resolveCurrentBattle`）、`'result'` は勝者ハイライト＋実況（`currentCommentary`）と「次へ」ボタン（`next`）、`'champion'` は勝者 1 件を大きく強調した優勝発表（紙吹雪風演出）を表示する（要件17.1, 17.2, 17.3, 17.4, 17.9, 4.7）。対戦は自動再生せず利用者の操作でのみ進行し、効果音を用いない（要件17.5, 17.6）
  - ペア入場・勝者ハイライト・優勝演出のトランジション/アニメーションは大人かわいいテーマのトークン（`--transition-*` 200〜500ms 等）経由で適用し、操作要素は最小 44×44 CSS px・横スクロールなしを維持する（要件17.7, 17.10, 17.11, 9.4, 9.6, 9.7）
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.9, 4.7, 9.4_

- [ ] 44. UI: TournamentBracketView（新規）で勝ち上がりを可視化する（要件18, 7.6, 7.7, 9.6, 9.7）
  - `src/components/TournamentBracketView.tsx`（新規）を実装する。`useRankingBattle` の `bracket`（`ResolvedBracketMatch[]`）を受け取り、各ラウンドの対戦ペア・勝者・不戦勝（Bye）を勝ち上がり順に可視化する（要件18.1, 18.2, 18.3）。表示（読み取り専用）のみで対戦結果やストアを変更しない（要件18.4）。ビューポート幅 320〜430 CSS px でも横スクロールを発生させないレイアウト（縦積み/折り返し等）とし、操作要素は最小 44×44 CSS px を維持し、配色・角丸・影・余白は大人かわいいテーマのトークン経由で適用する（要件18.5, 17.10, 17.11, 7.6, 7.7, 9.6, 9.7）
  - `RankingBattleView` に `TournamentBracketView` を配置し、対戦の進行に応じて表示を更新する
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 7.6, 7.7, 9.6, 9.7_

- [ ] 45. CSS: 勝者ハイライト・ペア入場・紙吹雪の演出をトークン経由で追加する（要件17, 9.4, 9.5）
  - `src/styles/global.css` に、勝者ハイライト（発光/強調）・ペア入場（フェード/スライド）・優勝の紙吹雪風演出の `@keyframes` とトランジション/アニメーションを追加する。時間はトークン（`var(--transition-*)`、200〜500ms）で参照し、色/角丸/影/余白は `--color-*` / `--radius-*` / `--shadow-*` / `--space-*` 経由で適用する（要件17.7, 9.2, 9.4）
  - `@media (prefers-reduced-motion: reduce)` で対戦演出（勝者ハイライト・入場・紙吹雪）のアニメーション/トランジションを無効化または大幅短縮する（既存トークンの reduced-motion 対応に整合、要件17.8, 9.5）。効果音は追加しない（要件17.6）
  - _Requirements: 17.7, 17.8, 9.4, 9.5_

  - [ ]* 45.1 対戦の進行フェーズ・遷移・ブラケット表示のユニットテスト
    - `phase` が `pair`→`result`→`champion` の順に遷移すること、「勝負！」（`resolveCurrentBattle`）で結果発表フェーズ（勝者ハイライト・実況）が表示され、「次へ」（`next`）で勝ち残り2件以上なら次ペア・1件なら優勝発表へ進むこと、2 件未満ガード（要件4.8）が維持されること、`TournamentBracketView` が bracket（勝ち上がり）を表示することを例示テスト（React Testing Library）で確認する
    - _Requirements: 17.1, 17.3, 17.4, 17.5, 18.1, 18.2, 18.3, 4.8_

- [ ] 46. Iteration 9 チェックポイント（対戦を魅せる）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

- [ ] 47. ドメイン: BattleCommentator を状況別（Battle_Situation）に拡張する（要件19, 4.3, 4.5）
  - `src/domain/types.ts` に `type BattleSituation = 'favored' | 'upset' | 'even'` を追加する（既存の型は破壊せず追記。design.md「Data Models」）
  - `src/domain/BattleCommentator.ts` の `narrate` を `narrate(pair: { winner: string; loser: string }, rng: () => number, situation?: BattleSituation): string` へ拡張する。状況別（favored/upset/even）の実況テンプレート群を持ち、`situation` が渡されたら当該状況のテンプレート集から rng で 1 つ選ぶ。`situation` 省略時は従来相当の汎用テンプレートを用いる（**後方互換**：既存呼び出し `narrate(pair, rng)` が壊れないこと）。各状況にテンプレートは複数存在し、いずれの状況でも非空で勝者名を含む文字列を返す（既存 Property 14 を維持、要件19.2, 19.3）。純粋関数・rng 外部注入・副作用なしを維持する
  - _Requirements: 19.1, 19.2, 19.3, 4.3, 4.5_

- [ ] 48. ドメイン: deriveBattleSituation を実装する（要件19.1, 19.5）
  - `src/domain/BattleCommentator.ts`（または `src/domain` の適所）に `deriveBattleSituation(winnerFavoriteLevel: number, loserFavoriteLevel: number): BattleSituation` を実装する。`winner > loser` → `'favored'`、`winner < loser` → `'upset'`、等値または比較不能（非数値等）→ `'even'` を返す純粋関数。勝敗判定には影響しない（要件19.4）
  - _Requirements: 19.1, 19.5_

- [ ] 49. ドメイン: deriveRanking（準優勝・ベスト4 導出）を実装する（要件20）
  - `src/domain/TournamentEngine.ts`（または `src/domain` の適所）に `deriveRanking(bracket: TournamentBracket, championId: string): { runnerUp: string | null; semifinalists: string[] }` を実装する。準優勝 = `championId` が勝者として現れる最終ラウンドの対戦（決勝）の敗者（存在しなければ `null`）、ベスト4 = 最終ラウンドの1つ前のラウンド（準決勝）の各対戦の敗者集合（不戦勝の match は敗者なし、定義できない小規模トーナメントは空配列）。`runnerUp`・`semifinalists` の各要素は `championId` と異なり相互に重複しない（要件20.5）。`bracket` を変更しない純粋関数とする（要件20.4）。`TournamentEngine` の勝敗判定・既存セマンティクスは一切変更しない
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [ ] 50. ドメイン: pickBattleTheme（お題選択）を実装する（要件21）
  - `src/domain` に `pickBattleTheme(rng: () => number): string` を実装する。お題テンプレート配列（例「かわいい選手権」「たよれる度No.1決定戦」「今いちばん会いたい子は？」等の短い文言、複数）を持ち、rng で 1 つ選んで返す純粋関数。常に非空文字列（お題配列の要素）を返す。毎回ランダム（決定的固定はしない、要件21.2）。`Math.random()` は使用せず rng を外部注入し、外部送信も行わない（要件21.3, 3.8）
  - _Requirements: 21.1, 21.2, 21.3_

  - [ ]* 50.1 状況別実況の妥当性のプロパティテスト
    - **Property 25: 状況別実況は妥当で状況を反映しつつ勝率に影響しない**（任意の勝者/敗者名・rng・`situation`（favored/upset/even/省略）について、`deriveBattleSituation` が Favorite_Level 比較で状況を正しく分類し、`narrate` は非空で勝者名を含む文字列を返し、各状況にテンプレートが複数存在し rng で変動しうる。`situation` は実況選択のみに用い勝敗判定に影響しない）
    - **Validates: Requirements 19, 4.3, 4.5**
    - `// Feature: chara-collection, Property 25` タグ・`numRuns: 100`。対象 `deriveBattleSituation` / `BattleCommentator.narrate`（rng 注入）。既存 `BattleCommentator` の Property 14 テストは不変で保持する

  - [ ]* 50.2 準優勝・ベスト4 導出の bracket 整合のプロパティテスト
    - **Property 26: 準優勝・ベスト4 の導出は bracket と整合する**（2 件以上の id 集合・任意の rng シード列で champion 確定まで進めた bracket と championId について、`deriveRanking` の `runnerUp` は決勝＝最終ラウンドの敗者（存在すれば）に一致し、`semifinalists` は準決勝＝最終ラウンドの1つ前のラウンドの敗者集合に一致し、いずれも champion と相異なり重複しない。小規模で定義できない順位は `null`/空。`bracket` を変更しない）
    - **Validates: Requirements 20, 18.4, 4.7**
    - `// Feature: chara-collection, Property 26` タグ・`numRuns: 100`。対象 `deriveRanking`（rng 注入で進めた `TournamentEngine.bracket`）。生成器は 2/3 件など小規模・偶数/奇数・不戦勝を含める。既存 Property 24 のテストは不変で保持する

  - [ ]* 50.3 お題選択の非空・要素性・変動のプロパティテスト
    - **Property 27: 対戦のお題は非空でお題集合の要素であり rng で変動しうる**（任意の rng について `pickBattleTheme` は非空文字列（お題集合の要素）を返し、rng を変えると複数の異なるお題が生じうる）
    - **Validates: Requirements 21**
    - `// Feature: chara-collection, Property 27` タグ・`numRuns: 100`。対象 `pickBattleTheme`（rng 注入）

- [ ] 51. Hook: useRankingBattle にお題・状況別実況・準優勝/ベスト4 を追加する（要件19, 20, 21）
  - `src/hooks/useRankingBattle.ts` に `theme: string` を追加し、`start()` 時に `pickBattleTheme(rng)` でお題を選んで公開する（毎回変わりうる、既存の `start` セマンティクスは不変。要件21.1, 21.2）
  - `resolveCurrentBattle()`（および既存 `advance` の実況生成）で、`engine.lastResult` の勝者・敗者を Character へ解決し、`deriveBattleSituation(winner.favoriteLevel, loser.favoriteLevel)` で状況を導出して `BattleCommentator.narrate(names, rng, situation)` へ渡し `currentCommentary` に反映する（要件19.1, 19.2, 19.3）。勝敗判定は不変（要件19.4）
  - `engine.champion` 確定時に `deriveRanking(engine.bracket, championId)` を計算し、得られた id を `fetchAll` 済みの Character へ解決した `runnerUp: Character | null`・`semifinalists: Character[]` を公開する（定義不能な順位は `null`/空、要件20.1, 20.2, 20.3, 20.4）
  - 既存の戻り値・セマンティクス（`start`/`advance`/`resolveCurrentBattle`/`next`/`reset`/`canStart`/`champion`/`currentPair`/`currentCommentary`/`phase`/`bracket`）は保持し、追加のみとする
  - _Requirements: 19.1, 19.2, 19.3, 20.1, 20.2, 20.3, 20.4, 21.1, 21.2_

- [ ] 52. UI: RankingBattleView にお題表示・準優勝/ベスト4 表示を追加する（要件20, 21, 9）
  - `src/components/RankingBattleView.tsx` に `useRankingBattle` の `theme` を対戦画面上部等に表示する（お題バッジ、要件21.1）。表示はトークン経由（`--color-*` / `--radius-*` / `--shadow-*` / `--space-*`）で適用し、横スクロールなし・44×44 CSS px・rem 追従を維持する（要件21.4, 21.5, 9）
  - `phase === 'champion'` の優勝発表画面に、`runnerUp`（準優勝、`null` なら非表示）と `semifinalists`（ベスト4、空なら非表示）を追加表示する（要件20.1, 20.2, 20.3）。表示はトークン経由・横スクロールなし・44×44 CSS px を維持する（要件9）。状況別実況は hook から受け取った `currentCommentary` を描画するのみとする（本コンポーネントは状況導出ロジックを持たない、要件19.2）
  - _Requirements: 20.1, 20.2, 20.3, 21.1, 21.4, 21.5, 9.1, 9.2, 9.6, 9.7_

- [ ] 53. CSS: お題バッジ・準優勝/ベスト4 表示のスタイルをトークン経由で追加する（要件21, 20, 9）
  - `src/styles/global.css`（または該当 CSS）に、お題バッジ（Battle_Theme）と準優勝・ベスト4 表示のスタイルを、大人かわいいテーマのトークン（`--color-*` / `--radius-*` / `--shadow-*` / `--space-*`）経由で追加する。横スクロールなし・44×44 CSS px・rem 追従を維持し、既存トークンの `prefers-reduced-motion` 対応に整合させる（要件21.5, 20, 9.1, 9.2, 9.6, 9.7）
  - _Requirements: 21.5, 20.1, 9.1, 9.2, 9.6, 9.7_

  - [ ]* 53.1 お題表示・準優勝/ベスト4 表示のユニットテスト
    - 対戦画面にお題（Battle_Theme）が表示されること（要件21.1）、`start` を複数回呼ぶとお題が変わりうること（複数テンプレートの存在を例示で確認、要件21.2）、優勝発表画面（`phase === 'champion'`）に準優勝が表示され、参加者数に応じてベスト4 が表示されること、参加者が少なく定義できない順位が表示されないこと（要件20.1, 20.2, 20.3）を例示テスト（React Testing Library）で検証する。状況別実況が状況（favored/upset/even）に応じて出し分けられること（rng を固定/シードして決定的に確認、要件19.2）も併せて検証する
    - _Requirements: 19.2, 20.1, 20.2, 20.3, 21.1, 21.2_

- [ ] 54. Iteration 10 チェックポイント（対戦をもっと楽しく）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

- [ ] 55. UI: TournamentBracketView を接続線つき縦向きブラケット図へ作り替える（要件18, 7.6, 9.7, 9）
  - `src/components/TournamentBracketView.tsx` の描画（JSX/クラス構造）を、現状の「ラウンドごとに対戦を縦積みしたリスト」から **接続線つきの縦向きブラケット図** へ作り替える。ラウンド（`round` 昇順）を上から下へ縦積みし、各対戦を「対戦カード（2者＋勝者強調・不戦勝は Bye 表記）」として表し、**各対戦の勝者を次ラウンド（下）の対戦へ接続線でつなぐ**構造にする（要件18.1, 18.2, 18.3, 18.7）
  - 勝者ハイライト（`👑`・`--winner`）、不戦勝（Bye）表記、`winnerHighlightId`（最終優勝者）の軽い強調（`--champion`）を維持する。**読み取り専用**（操作要素を置かず対戦結果や Character_Store を変更しない）を守る（要件18.4）。`matches` が空のときは何も描画しない（`null` 返却）を維持する
  - props（`matches: ResolvedBracketMatch[]`・`winnerHighlightId?: string | null`）は不変とする。データモデル・`useRankingBattle`・`TournamentEngine` は変更しない（表示強化のみ、Property 24 は不変）
  - 接続線は CSS 罫線／擬似要素、または軽量な自前 SVG（追加ライブラリなし）で描く。実際のスタイル定義はタスク56で行う
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.7, 7.6, 9.7_

- [ ] 56. CSS: `.tournament-bracket*` を接続線つき縦向きブラケット図用に更新/追加する（要件18.5, 18.7, 9）
  - `src/styles/global.css` の `.tournament-bracket*` を、接続線つき縦向きブラケット図用に更新/追加する。ラウンドを縦積みにし、対戦カード（背景 `--color-surface`、角丸 `--radius-medium`/`--radius-large`、影 `--shadow-soft`、余白 `--space-*`）として表示する。**勝者から次ラウンドへの接続線**は罫線／擬似要素（`::before`・`::after`）で描き、線色はトークン（`--color-border` / `--color-accent` 相当）経由で解決する（要件18.7, 9.1, 9.2）
  - **横スクロールなし**を最優先とし、対戦カードは `width:100%`（または画面幅に収まる `max-width`）で配置し、長い名前は折り返す（`overflow-wrap` 等）。図が縦に長い場合は画面の縦スクロールで対応する。ビューポート幅 320〜430 CSS px でも図コンテナ・画面全体に横スクロールを出さない（要件18.5, 18.7, 7.6, 9.7）
  - トランジションを用いる場合は `var(--transition-*)`（200〜500ms）経由とし、`@media (prefers-reduced-motion: reduce)` で無効化/短縮する（既存トークンの reduced-motion 対応に整合、要件9.4, 9.5）。効果音は追加しない
  - _Requirements: 18.5, 18.7, 9.1, 9.2, 9.7_

  - [ ]* 56.1 ブラケット図の縦向き表示・接続線・勝者/Bye/優勝強調のユニットテスト
    - `TournamentBracketView` がラウンドを縦向きに縦積みで表示し、各対戦カードと勝者から次ラウンドへの接続線要素（可能ならクラス/要素の存在）が描画されること、勝者ハイライト（`--winner`/👑）・不戦勝（Bye）表記・`winnerHighlightId` 一致時の優勝強調（`--champion`）が出ること、`matches` が空のとき何も描画しないことを例示テスト（React Testing Library）で確認する。既存の bracket 表示テスト（`RankingBattleView.iteration10.test.tsx`・`RankingBattleView.test.tsx` 等）が引き続き通る範囲で追加する
    - _Requirements: 18.1, 18.2, 18.3, 18.5, 18.7_

- [ ] 57. Iteration 11 チェックポイント（トーナメント表を図に）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

- [ ] 58. ドメイン: `battleTheme` にお題の観点ワード（Theme_Aspect）対応を追加する（要件19.6, 21）
  - `src/domain/battleTheme.ts` に `getBattleThemeAspect(theme: string): string` を追加する。お題ラベル→観点ワードの対応を持ち、既存8お題すべてに観点ワードを定義する（例「かわいい選手権」→「かわいさ」、「たよれる度No.1決定戦」→「頼れる度」、「今いちばん会いたい子は？」→「会いたい度」、「キュンとくるのは誰だ！？」→「キュン度」、「癒やしオーラ王者決定戦」→「癒やし度」、「いっしょにいたい子グランプリ」→「いっしょにいたい度」、「ときめきトーナメント」→「ときめき度」、「推し度ナンバーワン決定戦」→「推し度」等）。対応が未定義の任意のラベルには汎用の非空フォールバック（例「魅力」）を返す。常に非空文字列を返す純粋関数とする。`pickBattleTheme` / `BATTLE_THEME_COUNT` は**戻り値・シグネチャを変えず不変**とする。`Math.random()` は使用せず外部送信も行わない（要件19.6, 3.8）
  - _Requirements: 19.6, 21_

- [ ] 59. ドメイン: `BattleCommentator.narrate` を観点ワード（aspect）織り込みに拡張する（要件19.6, 19.2, 19.3）
  - `src/domain/BattleCommentator.ts` の `narrate` を `narrate(pair: { winner: string; loser: string }, rng: () => number, situation?: BattleSituation, aspect?: string): string` へ**末尾に任意引数を足す**形で拡張する。各状況（favored/upset/even）につき観点ワード差し込み版の実況テンプレート群を追加し、`aspect` が渡されたら当該状況（省略時は汎用/従来相当の扱い）の観点ワード入りテンプレート集から rng で 1 つ選び、お題に沿った文面（例 favored: 「{aspect}で{winner}が{loser}を圧倒！」）を生成する。`aspect` 省略時は従来どおり（既存呼び出し `narrate(pair, rng)` / `narrate(pair, rng, situation)` を壊さない**後方互換**）。各状況・各テンプレートは複数存在し、いずれも非空で勝者名を含む文字列を返す（既存 Property 25 を維持、要件19.6, 19.2, 19.3）。純粋関数・rng 外部注入・副作用なしを維持する
  - _Requirements: 19.6, 19.2, 19.3_

  - [ ]* 59.1 お題の観点ワードを織り込んだ実況のプロパティテスト
    - **Property 28: お題の観点ワードを織り込んだ実況**（任意の勝者/敗者名・rng・`situation`（favored/upset/even/省略）・`aspect`（非空文字列）について、(a) `getBattleThemeAspect` は既存8お題および対応未定義の任意ラベルにも非空の観点ワードを返す、(b) `narrate(pair, rng, situation, aspect)` は非空で勝者名を含む文字列を返す、(c) `aspect` を指定すると観点を織り込んだ文面を生成しうる（aspect を含むテンプレートが存在し反映される）、(d) rng を変えると同一入力でも複数の異なる文面が生じうる、(e) `aspect` 省略は既存挙動（Property 25）を保ち勝敗判定に影響しない）
    - **Validates: Requirements 19.6, 21**
    - `// Feature: chara-collection, Property 28` タグ・`numRuns: 100`。対象 `getBattleThemeAspect` / `BattleCommentator.narrate`（aspect 拡張・rng 注入）。既存 Property 25（`BattleCommentator.situation.test.ts` 等）・Property 27（`battleTheme.test.ts`）のテストは不変で保持する

- [ ] 60. Hook: `useRankingBattle` の実況生成でお題観点ワードを `narrate` へ渡す（要件19.6）
  - `src/hooks/useRankingBattle.ts` の実況生成箇所（`runBattle`）で、その回のお題（既に保持している `theme`）から `getBattleThemeAspect(theme)` で観点ワード（Theme_Aspect）を導出し、`narrate(names, rng, situation, aspect)` へ渡してお題に沿った状況別実況を生成する。既存の戻り値・セマンティクス（`start`/`advance`/`resolveCurrentBattle`/`next`/`reset`/`theme`/`currentCommentary`/`phase`/`bracket` 等）は不変とし、`narrate` への引数追加のみを行う。勝敗判定は不変（要件19.4）
  - _Requirements: 19.6_

  - [ ]* 60.1 実況にお題の観点が反映されうることのユニットテスト（任意）
    - `getBattleThemeAspect(theme)` を `narrate` へ `aspect` として渡すと、生成される実況にお題に沿った観点の文面が現れうることを、ドメイン直接（`getBattleThemeAspect` / `narrate`）または `useRankingBattle` 経由で rng を固定/シードして例示テストで確認する（要件19.6）。既存の対戦実況・お題表示テストは不変で保持する
    - _Requirements: 19.6_

- [ ] 61. Iteration 12 チェックポイント（お題に沿った実況）
  - Ensure all tests pass, ask the user if questions arise. Windows 上で `npm run build`（＝ `tsc -b && vite build`）と `npm run test`（＝ `vitest run`）がグリーンであることを確認する。

## Notes

- `*` が付いたサブタスクは任意（テスト）であり、MVP を急ぐ場合はスキップ可能である。トップレベルタスクには `*` を付けない。
- 各タスクは特定の要件条項および設計プロパティを参照し、トレーサビリティを確保する。
- チェックポイントは各イテレーションの末尾に置き、`vite build` / `vitest run` による Windows 上での増分検証を保証する。
- プロパティテスト（Property 1〜28）は fast-check で普遍的性質を検証し、ユニットテストは具体例・エッジ・UI/エラー分岐を検証する（相補的）。
- ドメインロジックは純粋 TypeScript として React / IndexedDB / File API から独立させ、テスト容易性を確保する。
- 外部サーバー送信は行わない（ネットワーク層なし、要件3.8）。

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["4.1", "5.1", "5.5"] },
    { "id": 1, "tasks": ["4.2", "6.1", "6.2", "5.2", "5.3", "5.4", "5.6"] },
    { "id": 2, "tasks": ["7.1", "7.2", "4.3", "4.4", "4.5", "4.6", "6.3"] },
    { "id": 3, "tasks": ["8.1", "8.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["8.3", "8.4", "10.1"] },
    { "id": 5, "tasks": ["11.1", "10.2", "10.3"] },
    { "id": 6, "tasks": ["11.2", "11.3", "13.1", "13.2"] },
    { "id": 7, "tasks": ["14.1", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 8, "tasks": ["14.2", "14.3", "16.1"] },
    { "id": 9, "tasks": ["16.2", "16.3", "16.4"] },
    { "id": 10, "tasks": ["17.1"] },
    { "id": 11, "tasks": ["17.2", "18.1"] },
    { "id": 12, "tasks": ["20", "21.1", "22.1", "23.1"] },
    { "id": 13, "tasks": ["21.2", "21.3", "22.2", "23.2"] },
    { "id": 14, "tasks": ["24.1"] },
    { "id": 15, "tasks": ["24.2"] },
    { "id": 16, "tasks": ["26"] },
    { "id": 17, "tasks": ["27.1", "27.2"] },
    { "id": 18, "tasks": ["27.3", "27.4", "28", "29", "32.1"] },
    { "id": 19, "tasks": ["29.1", "30", "32.2"] },
    { "id": 20, "tasks": ["31"] },
    { "id": 21, "tasks": ["32.3", "34", "36"] },
    { "id": 22, "tasks": ["34.1", "36.1", "37.1"] },
    { "id": 23, "tasks": ["37.2", "38"] },
    { "id": 24, "tasks": ["39"] },
    { "id": 25, "tasks": ["41", "45"] },
    { "id": 26, "tasks": ["41.1", "42"] },
    { "id": 27, "tasks": ["43"] },
    { "id": 28, "tasks": ["44"] },
    { "id": 29, "tasks": ["45.1"] },
    { "id": 30, "tasks": ["47", "48", "49", "50"] },
    { "id": 31, "tasks": ["50.1", "50.2", "50.3", "51"] },
    { "id": 32, "tasks": ["52"] },
    { "id": 33, "tasks": ["53"] },
    { "id": 34, "tasks": ["53.1"] },
    { "id": 35, "tasks": ["55", "56"] },
    { "id": 36, "tasks": ["56.1"] },
    { "id": 37, "tasks": ["58"] },
    { "id": 38, "tasks": ["59"] },
    { "id": 39, "tasks": ["59.1", "60"] },
    { "id": 40, "tasks": ["60.1"] }
  ]
}
```
