# Requirements Document

要件定義書

## Introduction

はじめに

本ドキュメントは、カップルが二人だけの「内輪ノリ」で楽しむための、iPhoneのホーム画面に追加して使えるPWA（Progressive Web App）「chara-collection（キャラ図鑑）」の要件を定義する。アプリはReact + TypeScript + Viteで実装し、開発はWindows環境で行う。

このアプリの中心は、二人のお気に入りキャラクター（アニメ、有名人、ポケモンなど、あらゆるキャラクター）を写真付きで登録し、一覧（図鑑）として眺めることである。さらに、登録したキャラクターを使って遊ぶ2つのモード（ランキング対戦、今日の一枚ガチャ）を備える。

データはすべて端末内にオフライン保存（IndexedDB。写真はBlobとして保存）され、サーバー同期は行わない。写真は端末の写真ライブラリまたはカメラから、ブラウザのファイル選択（input[type=file]）で取り込む。アプリはWeb App Manifestによりホーム画面へインストールでき、Service Workerにより初回読み込み後はオフラインでも動作する。UIはパステルカラーを基調とし、角丸を多用したかわいくポップなデザインをCSSで実現する。

本要件定義書はアプリ全体の範囲（図鑑 + 対戦 + ガチャ）を網羅するが、開発はアジャイル/反復型で進めることを想定し、優先度を段階的に設定する。

### 反復（イテレーション）計画の想定

- **イテレーション1（MVP）**: キャラクターの写真付き登録、一覧表示、オフライン保存（IndexedDB）、PWAとしての基本動作とかわいいポップなUI（要件1、要件2、要件3、要件7）
- **イテレーション2**: 今日の一枚ガチャ（要件5）
- **イテレーション3**: ランキング対戦（要件4）
- **イテレーション4**: 仕上げ（編集・削除、メモ・ニックネーム、UI調整）（要件6、要件8）

## Glossary

用語集

- **Chara_App**: 本アプリケーション全体を指すシステム名。React + TypeScript + Viteで実装されたWebアプリ（PWA）であり、iPhoneのホーム画面へインストールでき、オフラインで利用できる
- **Character**: 二人が登録するお気に入り対象の1件。写真および属性（名前、ニックネーム、メモ、お気に入り度）を持つ
- **Character_Store**: キャラクターデータを端末内に永続化する保存機構。写真・バイナリデータ（Character_Photo）を含むデータの保存にはIndexedDBによる端末内の永続化を用い、写真はBlobとして保存する
- **Collection_View**: 登録済みキャラクターを一覧表示する画面（図鑑）
- **Registration_Form**: キャラクターを新規登録・編集する入力画面。React画面/コンポーネントとして提供される
- **Character_Photo**: キャラクターに紐づく画像データ。端末の写真/カメラから、ブラウザのファイル選択（input[type=file]）で取り込んだ画像であり、1件あたり端末の写真1枚相当のサイズを上限の目安とする。対応する画像形式はブラウザが標準で扱える画像形式（JPEG、PNG、WebPなど）に準ずる
- **Favorite_Level**: キャラクターへのお気に入り度合いを表す属性（1〜5の整数）
- **Ranking_Battle**: 全登録キャラクターを対象にトーナメント（勝ち抜き）形式で対戦させ、最も好きな1件を決めるモード
- **Battle_Pair**: ランキング対戦で同時に提示される2件のキャラクターの組
- **不戦勝（Bye）**: ランキング対戦のあるラウンドで対象Characterが奇数の場合に、対戦せず次のラウンドへ進む1件の扱い
- **Daily_Gacha**: 登録済みキャラクターから1件をランダムに選び「今日の相棒」として表示するモード。同一暦日（利用者の端末ローカルの日付）内は選択結果を固定する
- **PWA**: Webアプリをネイティブアプリのように端末へインストール・オフライン利用できる仕組み（Web App Manifest + Service Worker）

## Requirements

要件

### 要件1: キャラクターの写真付き登録

**ユーザーストーリー:** カップルとして、お気に入りキャラクターを写真付きで登録したい。そうすることで、二人だけの図鑑にお気に入りを集められる。

#### 受け入れ基準

1. WHEN 利用者が新規登録操作を行う, THE Chara_App SHALL Registration_Formを表示する
2. THE Registration_Form SHALL ブラウザのファイル選択（input[type=file], accept="image/*"）による端末の写真またはカメラからのCharacter_Photo取り込み手段を提供する
3. IF 利用者がCharacter_Photoを指定せずに登録を確定しようとした場合, THEN THE Chara_App SHALL 登録を保留し、既に入力済みの各項目の内容を保持したまま、写真が必須である旨のメッセージを表示する
4. THE Registration_Form SHALL 名前の入力欄（0〜50文字）を提供する
5. THE Registration_Form SHALL ニックネームの入力欄（0〜50文字）を提供する
6. THE Registration_Form SHALL メモの入力欄（0〜500文字）を提供する
7. THE Registration_Form SHALL Favorite_Levelを1〜5の範囲で選択する入力欄を提供する
8. WHEN 利用者がCharacter_Photoを指定し登録を確定する, THE Chara_App SHALL 入力内容から1件のCharacterを作成しCharacter_Storeへ保存する
9. WHERE 名前が未入力の場合, THE Chara_App SHALL 名前欄を任意項目として扱い登録を許可する
10. IF 選択されたCharacter_Photoが対応していない画像形式、またはサイズ上限を超える場合, THEN THE Chara_App SHALL 当該画像の取り込みを拒否し、対応する画像形式とサイズの目安を示すメッセージを表示する
11. IF 利用者がファイル選択をキャンセルした、またはブラウザが画像へのアクセスをブロックした場合, THEN THE Chara_App SHALL 写真が取り込まれなかった旨を伝え、入力内容を保持したまま再取得を促す
12. IF Character_StoreへのCharacter保存がIndexedDBの容量超過または書き込みエラーにより失敗した場合, THEN THE Chara_App SHALL 保存を中止し、入力内容を保持したまま、保存に失敗した旨のメッセージを表示する

### 要件2: キャラクター一覧の表示（図鑑）

**ユーザーストーリー:** カップルとして、登録したキャラクターを一覧で眺めたい。そうすることで、二人のお気に入りコレクションを図鑑として楽しめる。

#### 受け入れ基準

1. WHEN 利用者がCollection_Viewを開く, THE Chara_App SHALL Character_Storeに保存された全Characterを登録日時の新しい順で一覧表示する
2. THE Chara_App SHALL 保持可能なCharacterの上限を1,000件とする
3. THE Collection_View SHALL 各CharacterのCharacter_Photoを表示する
4. IF あるCharacterのCharacter_Photoの読み込みに失敗した場合, THEN THE Chara_App SHALL 当該Characterに代替のプレースホルダー画像を表示し、他のCharacterの表示は継続する
5. THE Collection_View SHALL 各Characterの名前を表示する
6. WHERE ニックネームが登録されている場合, THE Collection_View SHALL 当該Characterのニックネームを表示する
7. IF Character_Storeに保存されたCharacterが0件の場合, THEN THE Chara_App SHALL 登録がまだ無い旨と新規登録手順を案内するメッセージを表示する
8. WHEN 利用者が一覧内の1件のCharacterを選択する, THE Chara_App SHALL 当該Characterの詳細（Character_Photo、名前、ニックネーム、メモ、Favorite_Level）を表示する
9. IF Character_Storeからの読み込みに失敗した場合, THEN THE Chara_App SHALL 読み込みに失敗した旨と再試行の手段を表示し、保存済みデータを保持する

### 要件3: キャラクターデータのオフライン保存

**ユーザーストーリー:** カップルとして、登録したデータが端末内だけに保存されてほしい。そうすることで、二人だけの内緒のコレクションとしてオフラインでも使える。

#### 受け入れ基準

1. WHEN 1件のCharacterが登録される, THE Character_Store SHALL 当該CharacterをIndexedDBによる端末内保存へ3秒以内に永続化する
2. IF Character_Storeへの永続化が容量超過または書き込みエラーにより失敗した場合, THEN THE Chara_App SHALL 失敗した旨を表示し、当該Characterを保存済みとして扱わない
3. WHEN 1件のCharacterが登録される, THE Character_Store SHALL 当該CharacterのCharacter_PhotoをBlobとして対応するCharacterに紐づけて端末内に保存する
4. THE Chara_App SHALL ネットワーク接続が無い状態でも登録・一覧表示の機能を提供する
5. WHEN 初回読み込みが完了した後にネットワーク接続が無い状態でアプリを起動したとき, THE Chara_App SHALL Service Workerによりオフラインでアプリの各機能を提供する
6. WHEN 利用者がアプリを再度開く, THE Chara_App SHALL 前回までにCharacter_Storeへ保存された全Characterを復元して表示する
7. IF アプリ再起動時の復元に失敗した場合, THEN THE Chara_App SHALL 復元に失敗した旨を表示し、保存済みデータを消失させない
8. THE Chara_App SHALL CharacterデータおよびCharacter_Photoをいかなる外部サーバーへも送信しない

### 要件4: ランキング対戦モード

**ユーザーストーリー:** カップルとして、キャラクター同士を「どっちが好き？」で勝ち抜かせたい。そうすることで、二人の一番のお気に入りを決めて盛り上がれる。

#### 受け入れ基準

1. WHEN 利用者がRanking_Battleを開始する, THE Chara_App SHALL Character_Storeの全Characterからトーナメントの組み合わせを生成し、最初のBattle_Pairを並べて表示する
2. WHILE Ranking_Battleが進行中である間, THE Chara_App SHALL 提示中のBattle_Pairの2件から一方を選ぶ選択操作を提供する
3. WHEN 利用者がBattle_Pairの一方を選択する, THE Chara_App SHALL 選択されたCharacterを勝者として次の対戦へ進め、勝ち残りが2件以上ある間は次のBattle_Pairを提示する
4. IF あるラウンドの対象Characterが奇数である場合, THEN THE Chara_App SHALL 1件を不戦勝として次のラウンドへ進める
5. WHEN 勝ち残ったCharacterが1件のみとなる, THE Chara_App SHALL 当該Characterを最も好きなキャラクターとして表示する
6. IF Character_Storeに保存されたCharacterが2件未満の場合, THEN THE Chara_App SHALL Ranking_Battleを開始せず、対戦には2件以上の登録が必要である旨のメッセージを表示する
7. IF Ranking_Battleの進行中にアプリが再読み込みまたは再起動された場合, THEN THE Chara_App SHALL 進行中の対戦状態を破棄し、対戦を初期状態に戻す

### 要件5: 今日の一枚ガチャモード

**ユーザーストーリー:** カップルとして、コレクションから今日の1枚をランダムに引きたい。そうすることで、毎日「今日の相棒」を二人で楽しめる。

#### 受け入れ基準

1. WHEN 利用者がDaily_Gachaを実行する, THE Chara_App SHALL Character_Storeから1件のCharacterをランダムに選択する
2. THE Chara_App SHALL 同一暦日内はDaily_Gachaの選択結果を固定し、アプリを再度開いても同じCharacterを「今日の相棒」として表示する
3. WHEN 利用者が引き直し操作を行う, THE Chara_App SHALL 新たに1件のCharacterをランダムに選択して表示する
4. WHEN 1件のCharacterが選択される, THE Chara_App SHALL 当該Characterを2秒以内に「今日の相棒」としてCharacter_Photoおよび名前とともに表示する
5. WHEN 「今日の相棒」が表示される, THE Chara_App SHALL 最大50文字の短いメッセージを併せて表示する
6. IF Character_Storeに保存されたCharacterが0件の場合, THEN THE Chara_App SHALL Daily_Gachaを実行せず、先にキャラクター登録が必要である旨のメッセージを表示する

### 要件6: キャラクターの編集と削除

**ユーザーストーリー:** カップルとして、登録済みのキャラクターを後から編集・削除したい。そうすることで、コレクションを最新の状態に保てる。

#### 受け入れ基準

1. WHEN 利用者が既存のCharacterの編集操作を行う, THE Chara_App SHALL 当該Characterの現在の属性を入力済みの状態でRegistration_Formを表示する
2. WHEN 利用者が編集内容を確定する, THE Chara_App SHALL 入力値を要件1と同じ検証（各項目の文字数、Favorite_Levelの範囲）で確認する
3. WHEN 編集内容の検証に成功する, THE Chara_App SHALL Character_Store内の当該Characterを更新後の属性で上書き保存し、保存完了を利用者に通知する
4. WHERE 編集時に利用者が新しいCharacter_Photoを指定した場合, THE Chara_App SHALL 当該CharacterのCharacter_Photoを新しい画像へ差し替える
5. WHEN 利用者が既存のCharacterの削除操作を行う, THE Chara_App SHALL 削除の確認を求める
6. WHEN 利用者が削除の確認をキャンセルする, THE Chara_App SHALL 当該Characterを削除せず元の表示に戻す
7. WHEN 利用者が削除を確認する, THE Chara_App SHALL 当該CharacterをCharacter_Storeから削除し、削除完了を利用者に通知する

### 要件7: PWAとしての動作とかわいいポップなUI

**ユーザーストーリー:** カップルとして、iPhoneでかわいくおしゃれなアプリを使いたい。そうすることで、二人で見るのが毎日楽しくなる。

#### 受け入れ基準

1. THE Chara_App SHALL React + TypeScript + Vite で実装されたWebアプリ（PWA）として動作する
2. THE Chara_App SHALL Web App Manifest を提供し、iPhoneのホーム画面に追加してアプリのように起動できるようにする
3. WHEN 初回読み込みが完了した後にネットワーク接続が無い状態でアプリを起動したとき, THE Chara_App SHALL Service Worker によりオフラインで登録・一覧・対戦・ガチャの各機能を提供する
4. THE Chara_App SHALL パステルカラーを基調とした配色で全画面を表示する
5. THE Chara_App SHALL ボタン・カード・写真枠などの主要なUI要素に角丸（丸みのある形状）を適用する
6. WHEN スマートフォンの縦向き画面で表示されたとき, THE Chara_App SHALL 横スクロールを発生させないレスポンシブなレイアウトで全コンテンツを表示する
7. THE Chara_App SHALL 操作要素を最小44×44 CSSピクセルのタッチ領域で提供する
8. THE Chara_App SHALL 相対単位（rem等）を用いてブラウザ/OSの文字サイズ設定に追従し、テキストの可読性を確保する

### 要件8: 空状態と入力エラーのハンドリング

**ユーザーストーリー:** カップルとして、登録が無いときや入力に不備があるときに分かりやすく案内してほしい。そうすることで、迷わずに使える。

#### 受け入れ基準

1. IF Favorite_Levelに1〜5の整数以外の値（範囲外の数値、空、または数値以外）が指定された場合, THEN THE Chara_App SHALL 当該値を保存せず、1〜5の整数で選択する旨のメッセージを表示する
2. IF ブラウザのファイル選択から取り込んだCharacter_Photoが対応していない画像形式、またはサイズ上限を超える場合, THEN THE Chara_App SHALL 登録を保留し、対応する画像形式およびサイズの目安を示したうえで画像の取得のやり直しを促すメッセージを表示する
3. IF Character_Photoの取り込みが形式・サイズ以外の理由で失敗した、または利用者がファイル選択をキャンセルした場合, THEN THE Chara_App SHALL 登録を保留し、入力済みの他の項目を保持したまま画像の取得のやり直しを促すメッセージを表示する
4. IF Character_StoreへのIndexedDB保存がストレージ容量超過により失敗した場合, THEN THE Chara_App SHALL 入力内容を破棄せずに保持し、容量不足で保存できなかった旨と不要データの削除を促すメッセージを表示する
5. IF Character_Storeへの保存が容量上限以外の理由で失敗した場合, THEN THE Chara_App SHALL 入力内容を破棄せずに保持し、保存できなかった旨と再試行を促すメッセージを表示する
6. WHEN カップルがキャラクター一覧を表示した時にCharacter_Storeに登録が1件も存在しない場合, THE Chara_App SHALL 登録が無い旨と新規登録手順を案内するメッセージを表示する
