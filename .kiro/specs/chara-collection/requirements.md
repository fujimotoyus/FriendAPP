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
- **イテレーション5**: 見た目と使い勝手の底上げ（「大人かわいい」UIテーマ、一覧でのニックネーム優先表示、一覧の並び替え、お気に入り度の視覚的強調、共通ナビゲーションバー）（要件9、要件10、要件11、要件12、要件13）。並び替え（要件11）は、イテレーション6でMet_On（出会った日）が加わった後に「出会った日の新しい順」を後追いで拡張する
- **イテレーション6**: 登録項目の拡張（任意の「出会った日」を登録し詳細でのみ表示、パステルプリセットから選ぶ「イメージカラー」を登録しカードと詳細の写真枠の縁取りへ反映。旧データは既定値で補完し後方互換を維持）（要件14、要件15）
- **イテレーション7**: 一覧の並び替えに「出会った日の新しい順」を追加（Sort_Orderに 'metOn' を追加。Met_On降順・未設定は後方・タイブレークはcreatedAt降順→id昇順。既存データ・機能に破壊的変更なし）（要件11.1、要件11.7）
- **イテレーション8**: 今日の相棒に一言（Daily_Gachaのメッセージを相棒キャラ本人のセリフ風の一言に置き換え、同一暦日・同一相棒・同一 salt 内で固定＝その日固定の決定的選出。要件5.2・5.5と整合）（要件5の改定と要件16）
- **イテレーション9**: 対戦を魅せる（試合ごとのリザルト表示・勝者ハイライト/ペア入場アニメ・優勝演出・勝ち上がりを可視化するトーナメント表。自動再生/効果音なし。TournamentEngine を勝ち上がり履歴の公開のため拡張）（要件17・要件18、要件4と整合）
- **イテレーション10**: 対戦をもっと楽しく（実況を状況別＝順当/番狂わせ/互角に拡充、優勝画面に準優勝・ベスト4を表示、対戦開始ごとにお題＝Battle_Theme をランダム表示。TournamentEngine の勝敗判定は不変）（要件19・要件20・要件21、要件4/17/18 と整合）

## Glossary

用語集

- **Chara_App**: 本アプリケーション全体を指すシステム名。React + TypeScript + Viteで実装されたWebアプリ（PWA）であり、iPhoneのホーム画面へインストールでき、オフラインで利用できる
- **Character**: 二人が登録するお気に入り対象の1件。写真および属性（名前、ニックネーム、メモ、お気に入り度）を持つ
- **Character_Store**: キャラクターデータを端末内に永続化する保存機構。写真・バイナリデータ（Character_Photo）を含むデータの保存にはIndexedDBによる端末内の永続化を用い、写真はBlobとして保存する
- **Collection_View**: 登録済みキャラクターを一覧表示する画面（図鑑）
- **Registration_Form**: キャラクターを新規登録・編集する入力画面。React画面/コンポーネントとして提供される
- **Character_Photo**: キャラクターに紐づく画像データ。端末の写真/カメラから、ブラウザのファイル選択（input[type=file]）で取り込んだ画像であり、1件あたり端末の写真1枚相当のサイズを上限の目安とする。対応する画像形式はブラウザが標準で扱える画像形式（JPEG、PNG、WebPなど）に準ずる
- **Favorite_Level**: キャラクターへのお気に入り度合いを表す属性（1〜5の整数）
- **Ranking_Battle**: 全登録キャラクターを対象にトーナメント（勝ち抜き）形式で自動対戦させ、最も好きな1件を決めるモード。各Battle_Pairの勝敗はChara_Appがランダム要素を含めて自動的に判定し、試行のたびに結果が変動する
- **Battle_Pair**: ランキング対戦で同時に提示される2件のキャラクターの組
- **Battle_Commentary**: Battle_Pairの対戦の様子および勝敗結果を、実行のたびにランダムに変わる、それっぽい実況として表現するテキスト
- **不戦勝（Bye）**: ランキング対戦のあるラウンドで対象Characterが奇数の場合に、対戦せず次のラウンドへ進む1件の扱い
- **Daily_Gacha**: 登録済みキャラクターから1件をランダムに選び「今日の相棒」として表示するモード。同一暦日（利用者の端末ローカルの日付）内は選択結果を固定する
- **PWA**: Webアプリをネイティブアプリのように端末へインストール・オフライン利用できる仕組み（Web App Manifest + Service Worker）
- **大人かわいいテーマ（Adult_Cute_Theme）**: 落ち着いたパステルを基調とし、上品なアクセント・洗練された余白/影/フォント/トランジションで構成する視覚テーマ。要件7で定めた制約（パステル基調、角丸、横スクロールなし、最小44×44 CSSピクセルのタッチ領域、rem追従）をすべて満たしたうえで美観を高める上位互換の位置づけとする
- **Sort_Order**: Collection_Viewにおける一覧の並び順。UIで選択できる並び順は「名前の昇順」「Favorite_Levelの高い順」「出会った日の新しい順（Met_Onの降順、未設定は後方）」の3種を指す。並び順の変更は表示順のみに作用し、Character_Storeに保存されたデータおよびCharacterの内容を変更しない
- **Navigation_Bar**: 画面下部に固定表示されるタブ型の共通ナビゲーション。「図鑑」「今日の相棒」「トーナメント」「新規登録」の4つの遷移項目を持ち、それぞれCollection_View・Daily_Gacha・Ranking_Battle・Registration_Form（新規登録）への到達手段を提供する。現在表示中の画面に対応するタブを選択状態として視覚的に区別する
- **Met_On（出会った日）**: Characterに紐づく任意（未設定可）の日付属性。当該Characterと「出会った日」を暦日（年月日）で表す。妥当な暦日のみを保持し、未入力または不正な日付文字列は未設定として扱う。CharacterDetailView（詳細画面）でのみ表示し、Collection_View・Daily_Gacha・Ranking_Battleには表示しない。この属性を持たない既存Characterは未設定として扱う（後方互換）
- **Image_Color（イメージカラー）**: Characterに紐づく属性で、大人かわいいテーマ（Adult_Cute_Theme）のテーマトークン由来のパステルのプリセット色から選ぶ縁取り色。選択肢はプリセット5色と「なし（Image_Color_None）」で構成し、既定値は「なし」とする。CharacterCard（一覧カード）の枠および詳細画面の写真枠の縁取りへ反映する。プリセットの許容値以外・未設定・この属性を持たない既存Characterはいずれも「なし」として扱う（後方互換）
- **Image_Color_None（イメージカラーなし）**: Image_Colorの既定値。縁取りを一切適用しない状態を表す
- **Daily_Line（今日の一言）**: Daily_Gachaで選出された「今日の相棒」Characterに紐づけて表示する、当該相棒キャラ本人のセリフ風の短いメッセージ（最大50文字、Unicodeコードポイント数）。暦日（利用者の端末ローカルのCalendarDay）と当該相棒のid、および現在のsaltから決定的に選ばれ、同一暦日・同一相棒・同一saltでは再オープンしても同一の一言になる（要件5.2の「同一暦日は固定」の思想に整合する）。端末内で生成し、いかなる外部サーバーへも送信しない（要件3.8）
- **Tournament_Bracket（トーナメント表）**: Ranking_Battleにおいて、全ラウンドの対戦ペアと各対戦の勝者・不戦勝（Bye）を勝ち上がり順に表す読み取り専用の構造。TournamentEngineが対戦の進行に応じて保持・公開し、RankingBattleViewが可視化する。表示（読み取り専用の可視化）のみに用い、対戦の判定結果やCharacter_Storeのデータを変更しない。いかなる外部サーバーへも送信しない（要件3.8）
- **Battle_Result_Phase（試合結果発表フェーズ）**: Ranking_Battleにおいて、各対戦で勝者を演出（勝者ハイライト・Battle_Commentary）付きで発表し、利用者の「次へ」操作で次のBattle_Pairへ進む表示フェーズ。対戦は自動再生せず、利用者の操作でのみ進行する
- **Battle_Theme（対戦のお題）**: Ranking_Battleを開始するたびにChara_Appがランダム要素を含めて1つ選ぶ短いテーマ文言（例「かわいい選手権」「たよれる度No.1決定戦」「今いちばん会いたい子は？」等）。対戦画面に表示し、Battle_Commentaryにも軽く反映しうる。端末内で選び、いかなる外部サーバーへも送信しない（要件3.8）。開始のたびに変わりうる（決定的固定ではない）
- **Battle_Situation（対戦の状況区分）**: 各Battle_Pairの勝敗が決まったときに、勝者と敗者のFavorite_Levelの比較から導く区分。勝者のFavorite_Levelが敗者より高ければ `favored`（順当）、低ければ `upset`（番狂わせ）、両者が同値または比較不能であれば `even`（互角）とする。Battle_Commentaryの出し分けにのみ用い、勝敗の判定（要件4.2の自動判定・勝率50/50）には一切影響しない

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

1. WHEN 利用者がCollection_Viewを開く, THE Chara_App SHALL Character_Storeに保存された全Characterを名前の昇順（要件11.4と同一の順序）で一覧表示する
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

**ユーザーストーリー:** カップルとして、キャラクター同士をトーナメントで自動的に勝ち抜かせ、そのバトルの様子を実況で楽しみたい。そうすることで、二人の一番のお気に入りを決めて盛り上がれる。

#### 受け入れ基準

1. WHEN 利用者がRanking_Battleを開始する, THE Chara_App SHALL Character_Storeに保存された全Character（2件以上）からトーナメントの組み合わせを生成し、最初のBattle_Pairの2件のCharacterを並べて表示する
2. WHEN 1件のBattle_Pairが提示される, THE Chara_App SHALL 当該Battle_Pairの2件のCharacterからランダム要素を含めてちょうど1件を勝者として自動的に判定し、利用者の勝敗選択を必要とせずに勝者を決定する
3. WHEN Battle_Pairの勝者が自動判定される, THE Chara_App SHALL 当該対戦の様子および勝敗結果を、実行のたびにランダムに変わるBattle_Commentaryとして表示する
4. WHEN Battle_PairのBattle_Commentaryが表示された後, THE Chara_App SHALL 勝者を次のラウンドへ進め、かつ現ラウンドで未対戦の勝ち残りが2件以上ある間は次のBattle_Pairを提示する
5. WHEN 同一のBattle_Pairの組み合わせに対してRanking_Battleが複数回実行される, THE Chara_App SHALL 実行ごとに勝者およびBattle_Commentaryが変動しうる結果を生成する
6. IF あるラウンドの対象Characterが奇数件である場合, THEN THE Chara_App SHALL 当該ラウンドの対戦に割り当てられなかった1件を不戦勝（Bye）として、対戦を行わずに次のラウンドへ進める
7. WHEN 勝ち残ったCharacterが1件のみとなる, THE Chara_App SHALL 当該Characterを最も好きなキャラクターとして表示する
8. IF Character_Storeに保存されたCharacterが2件未満の場合, THEN THE Chara_App SHALL Ranking_Battleを開始せず、対戦には2件以上の登録が必要である旨のメッセージを表示する
9. IF Ranking_Battleの進行中にアプリが再読み込みまたは再起動された場合, THEN THE Chara_App SHALL 進行中の対戦状態を破棄し、対戦を初期状態に戻す

### 要件5: 今日の一枚ガチャモード

**ユーザーストーリー:** カップルとして、コレクションから今日の1枚をランダムに引きたい。そうすることで、毎日「今日の相棒」を二人で楽しめる。

#### 受け入れ基準

1. WHEN 利用者がDaily_Gachaを実行する, THE Chara_App SHALL Character_Storeから1件のCharacterをランダムに選択する
2. THE Chara_App SHALL 同一暦日内はDaily_Gachaの選択結果を固定し、アプリを再度開いても同じCharacterを「今日の相棒」として表示する
3. WHEN 利用者が引き直し操作を行う, THE Chara_App SHALL 新たに1件のCharacterをランダムに選択して表示する
4. WHEN 1件のCharacterが選択される, THE Chara_App SHALL 当該Characterを2秒以内に「今日の相棒」としてCharacter_Photoおよび名前とともに表示する
5. WHEN 「今日の相棒」が表示される, THE Chara_App SHALL 選出された相棒Characterに紐づく、最大50文字（Unicodeコードポイント数）の短いセリフ風メッセージ（相棒キャラ本人の一言として表現する文＝Daily_Line）を併せて表示する（同一暦日・同一相棒・同一saltでは要件5.2と整合してDaily_Lineを固定する。詳細は要件16で定める）
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

### 要件9: 大人かわいい UI テーマ

**ユーザーストーリー:** カップルとして、もっと大人かわいい見た目で使いたい。そうすることで、毎日開くのが上品で楽しくなる。

#### 受け入れ基準

1. THE Chara_App SHALL 一覧・登録/編集フォーム・詳細・今日の一枚ガチャ・ランキング対戦の各画面で、大人かわいいテーマ（Adult_Cute_Theme）の配色をテーマトークン経由で解決して適用し、当該配色は要件7.4のパステル基調を満たす
2. THE Chara_App SHALL ボタン・カード・写真枠・入力欄について、同一種別の要素間では角丸・影・余白の値が一致する一貫したスタイルを、要件7.5の角丸適用を満たす形でテーマトークン経由で適用する
3. THE Chara_App SHALL テキストのフォントサイズを相対単位（rem）で定義し、ルート要素の文字サイズ設定の変更に比例して追従させることで、要件7.8を満たす
4. WHEN 画面遷移または操作へのフィードバックを表示するとき, THE Chara_App SHALL 200ミリ秒以上500ミリ秒以下の視覚的トランジションを適用する
5. IF 利用者の環境がモーション低減（prefers-reduced-motion: reduce）を要求している場合, THEN THE Chara_App SHALL トランジションを無効化または大幅に短縮して適用する
6. THE Chara_App SHALL ボタン・カード上の操作要素・お気に入り度選択・写真取り込み操作・並び順選択などのインタラクティブ要素について、最小44×44 CSSピクセルのタッチ領域を、要件7.7を満たす形で維持する
7. WHEN ビューポート幅が320〜430 CSSピクセルの縦向き画面で表示されたとき, THE Chara_App SHALL 横スクロールを発生させないレイアウトを、要件7.6を満たす形で維持する

### 要件10: 一覧でのニックネーム優先表示

**ユーザーストーリー:** カップルとして、一覧ではニックネームを目立たせたい。そうすることで、二人だけの呼び方で見つけやすくなる。

#### 受け入れ基準

1. IF あるCharacterのニックネームが空でない（空文字でなく、かつ空白文字のみでもない）場合, THEN THE Collection_View SHALL 当該Characterのニックネームを主表示として表示し、名前が空でない場合は当該名前を副表示として表示する
2. IF あるCharacterのニックネームが空（空文字、または空白文字のみ）であり、かつ名前が空でない場合, THEN THE Collection_View SHALL 当該Characterの名前を主表示として表示し、副表示を表示しない
3. IF あるCharacterのニックネームおよび名前がいずれも空（それぞれ空文字、または空白文字のみ）である場合, THEN THE Collection_View SHALL 「名前未設定」を主表示として表示し、副表示を表示しない
4. THE Collection_View SHALL 各Characterについて、主表示を当該Characterの表示テキストのうち先頭に配置し、かつ副表示より大きい文字サイズで表示し、副表示は主表示に続けて補助的に表示する

### 要件11: 一覧の並び替え

**ユーザーストーリー:** カップルとして、一覧の並び順を選びたい。そうすることで、お気に入り順や名前順でも眺められる。

#### 受け入れ基準

1. THE Collection_View SHALL Sort_Orderとして「名前の昇順」「Favorite_Levelの高い順」「出会った日の新しい順」の3つを、左から「名前の昇順」→「Favorite_Levelの高い順」→「出会った日の新しい順」の順序で選択する手段を提供する
2. WHEN 利用者がSort_Orderを選択していない初期状態でCollection_Viewを開く, THE Collection_View SHALL 全Characterを名前の昇順（要件11.4と同一の順序）で一覧表示する
3. WHEN 利用者が「Favorite_Levelの高い順」を選択する, THE Collection_View SHALL 全CharacterをFavorite_Levelの降順に並べ替え、Favorite_Levelが同値のCharacterどうしは登録日時（createdAt）の新しい順で並べ、それも同値の場合はCharacterのidの昇順で並べて一覧表示する
4. WHEN 利用者が「名前の昇順」を選択する, THE Collection_View SHALL 全Characterを名前のUnicodeコードポイント順（大文字小文字・ロケールに依存しない一貫した順序）で昇順に並べ替え、名前が空（空文字または空白のみ）のCharacterは名前を持つCharacterより後に配置し、比較が同値の場合はCharacterのidの昇順で並べて一覧表示する
5. WHEN 利用者がSort_Orderを変更する, THE Collection_View SHALL 一覧の表示順のみを変更し、Character_Storeに保存されたデータおよびCharacterの内容を変更しない
6. THE Collection_View SHALL 同一のCharacter集合と同一のSort_Orderに対して、常に同一の並び順（決定的な順序）で一覧表示する
7. WHEN 利用者が「出会った日の新しい順」を選択する, THE Collection_View SHALL 全Characterを、Met_Onが設定されているCharacterをMet_Onの降順に並べ、Met_Onが未設定のCharacterはMet_Onを持つCharacterより後に配置し、Met_Onが同値または両方が未設定の場合は登録日時（createdAt）の降順で並べ、それも同値の場合はCharacterのidの昇順で並べて一覧表示する

### 要件12: お気に入り度の視覚的強調

**ユーザーストーリー:** カップルとして、各キャラのお気に入り度をひと目で分かるようにしたい。そうすることで、どれだけ好きかが一覧でも伝わる。

#### 受け入れ基準

1. WHEN Collection_ViewがCharacterの一覧カードを表示するとき, THE Collection_View SHALL 各CharacterのFavorite_Levelを、塗り記号（ハート等）をFavorite_Levelと等しい個数だけ塗り、残りを合計5個までの未塗り記号で表示し、塗られた記号の個数がFavorite_Level（1〜5の整数）と一致するようにする
2. WHEN Chara_AppがCharacter詳細を表示するとき, THE Chara_App SHALL Favorite_Levelを、要件2.8を満たす形で受け入れ基準1と同一の視覚表現（塗り記号の個数がFavorite_Levelと一致し、合計5個の記号を表示）で表示する
3. THE Chara_App SHALL Favorite_Levelの各視覚表現に対し、色または記号の見た目のみに依存せず度合い（数量）を判別できるよう、「5段階中N（NはFavorite_Levelの整数値）」に相当するテキスト等価物（スクリーンリーダー向け）を提供する
4. IF Favorite_Levelが1〜5の整数範囲外、未設定、または数値として解釈できない値である場合, THEN THE Chara_App SHALL 塗り記号を0個として5個すべてを未塗り記号で表示し、テキスト等価物として「5段階中0」に相当する内容を提供する

### 要件13: 共通ナビゲーションバー

**ユーザーストーリー:** カップルとして、主要な画面へメニューバーからすぐ移動したい。そうすることで、図鑑・今日の相棒・トーナメント・新規登録を迷わず行き来できる。

#### 受け入れ基準

1. THE Chara_App SHALL 画面下部に固定表示されるNavigation_Barを提供し、「図鑑」「今日の相棒」「トーナメント」「新規登録」の4つの遷移項目を表示する
2. WHEN 利用者がNavigation_Barの「図鑑」を選択する, THE Chara_App SHALL Collection_Viewを表示する
3. WHEN 利用者がNavigation_Barの「今日の相棒」を選択する, THE Chara_App SHALL Daily_Gachaの画面を表示する
4. WHEN 利用者がNavigation_Barの「トーナメント」を選択する, THE Chara_App SHALL Ranking_Battleの画面を表示する
5. WHEN 利用者がNavigation_Barの「新規登録」を選択する, THE Chara_App SHALL 既存の編集状態を引き継がない新規登録用のRegistration_Formを表示する
6. WHILE Collection_View・Daily_Gacha・Ranking_Battleのいずれかの画面を表示している間, THE Chara_App SHALL Navigation_Barを表示し、現在表示中の画面に対応するタブを選択状態として視覚的に区別して示す
7. WHILE キャラクター詳細画面またはRegistration_Form（新規登録・編集）を表示している間, THE Chara_App SHALL Navigation_Barを表示しない
8. THE Navigation_Bar SHALL 各タブ項目を、要件7.7を満たす形で最小44×44 CSSピクセルのタッチ領域で提供する
9. WHEN ビューポート幅が320〜430 CSSピクセルの縦向き画面で表示されたとき, THE Navigation_Bar SHALL 横スクロールを発生させずに4つの遷移項目を、要件7.6を満たす形で表示する
10. THE Navigation_Bar SHALL 大人かわいいテーマ（Adult_Cute_Theme）の配色・角丸・テーマトークンに整合した外観を、要件9と整合する形で適用して表示する

### 要件14: 出会った日（Met_On）の登録と詳細表示

**ユーザーストーリー:** カップルとして、そのキャラと出会った日を残したい。そうすることで、二人の思い出の日付を詳細画面で振り返れる。

#### 受け入れ基準

1. THE Registration_Form SHALL Met_Onの入力欄を`<input type="date">`により任意項目（未入力可）として提供する
2. WHEN 利用者がMet_Onに妥当な暦日を入力してCharacterの登録または編集を確定する, THE Chara_App SHALL 当該暦日をMet_OnとしてCharacterに保持しCharacter_Storeへ保存する
3. WHEN 利用者がMet_Onを未入力のままCharacterの登録または編集を確定する, THE Chara_App SHALL 当該CharacterのMet_Onを未設定としてCharacter_Storeへ保存する
4. IF Met_Onとして入力された値が妥当な暦日として解釈できない場合, THEN THE Chara_App SHALL 当該値をMet_Onとして保存せず、Met_Onを未設定として扱う
5. WHERE あるCharacterのMet_Onが設定されている場合, THE CharacterDetailView SHALL 当該CharacterのMet_Onを詳細画面に表示する
6. IF あるCharacterのMet_Onが未設定である場合, THEN THE CharacterDetailView SHALL 当該CharacterのMet_Onを未設定である旨として示す、またはMet_Onの表示を行わない
7. THE Collection_View SHALL Met_Onを一覧に表示しない
8. THE Chara_App SHALL Daily_GachaおよびRanking_Battleの画面にMet_Onを表示しない
9. WHEN 利用者が既存のCharacterの編集操作を行う, THE Registration_Form SHALL 当該CharacterのMet_Onが設定されている場合は当該日付を初期値として表示し、未設定の場合は空欄で表示する
10. WHEN 利用者が編集時にMet_Onの入力欄をクリア（空）にして確定する, THE Chara_App SHALL 当該CharacterのMet_Onを未設定へ更新してCharacter_Storeへ保存する
11. WHERE Met_Onの属性を持たない既存のCharacterが読み出される場合, THE Chara_App SHALL 当該CharacterのMet_Onを未設定として扱う
12. THE Chara_App SHALL Met_Onをいかなる外部サーバーへも送信せず、Character_Storeによる端末内保存のみに保持する

### 要件15: イメージカラー（Image_Color）の登録と縁取り反映

**ユーザーストーリー:** カップルとして、キャラごとにイメージカラーを付けたい。そうすることで、一覧や詳細でそのキャラらしい色の縁取りが映えて見分けやすくなる。

#### 受け入れ基準

1. THE Registration_Form SHALL Image_Colorを、大人かわいいテーマ（Adult_Cute_Theme）のテーマトークン由来のパステルのプリセット5色と「なし（Image_Color_None）」の合計6つの選択肢から1つ選択する手段を提供する
2. WHEN 利用者がImage_Colorを選択せずにCharacterの登録を確定する, THE Chara_App SHALL 当該CharacterのImage_ColorをImage_Color_None（既定値）としてCharacter_Storeへ保存する
3. WHEN 利用者がプリセットの許容値のImage_Colorを選択してCharacterの登録または編集を確定する, THE Chara_App SHALL 当該Image_ColorをCharacterに保持しCharacter_Storeへ保存する
4. IF あるCharacterのImage_Colorがプリセットの許容値以外の値、または未設定である場合, THEN THE Chara_App SHALL 当該CharacterのImage_ColorをImage_Color_Noneとして扱う
5. WHERE Image_Colorの属性を持たない既存のCharacterが読み出される場合, THE Chara_App SHALL 当該CharacterのImage_ColorをImage_Color_Noneとして扱う
6. WHERE あるCharacterのImage_ColorがImage_Color_None以外のプリセット色である場合, THE CharacterCard SHALL 当該Characterの一覧カードの枠に当該Image_Colorの縁取りを、テーマトークン経由で適用して表示する
7. WHERE あるCharacterのImage_ColorがImage_Color_None以外のプリセット色である場合, THE CharacterDetailView SHALL 当該Characterの詳細画面の写真枠に当該Image_Colorの縁取りを、テーマトークン経由で適用して表示する
8. IF あるCharacterのImage_ColorがImage_Color_Noneである場合, THEN THE Chara_App SHALL 当該CharacterのCharacterCardおよびCharacterDetailViewの写真枠に縁取りを適用しない
9. THE Chara_App SHALL Image_Colorの縁取りを、要件7.5の角丸適用および要件9.2のテーマトークン経由の一貫スタイルを満たす形で適用する
10. THE Chara_App SHALL Image_Colorの縁取りを反映しても、要件7.6・要件9.7を満たす横スクロールを発生させないレイアウト、および要件7.7・要件9.6を満たす最小44×44 CSSピクセルのタッチ領域を維持する
11. THE Chara_App SHALL Image_Colorをいかなる外部サーバーへも送信せず、Character_Storeによる端末内保存のみに保持する

### 要件16: 今日の相棒の一言（Daily_Line）

**ユーザーストーリー:** カップルとして、今日の相棒がその日ごとに本人のセリフ風の一言を言ってくれるようにしたい。そうすることで、毎日開くたびに二人で「今日の相棒」との小さなやり取りを楽しめる。

#### 受け入れ基準

1. WHEN Daily_Gachaで「今日の相棒」が選出される, THE Chara_App SHALL 当該相棒Characterに対してDaily_Line（セリフ風の一言）を生成し、要件5.5に従って併せて表示する
2. WHEN 同一暦日・同一相棒・同一saltでDaily_Lineが生成される, THE Chara_App SHALL 端末ローカルのCalendarDayと当該相棒のidおよび現在のsaltから決定的に同一のDaily_Lineを選び、アプリを再度開いても同一のDaily_Lineを表示する（要件5.2と整合）
3. WHEN 利用者が引き直し操作を行いsaltが変わる, THE Chara_App SHALL 変更後のsaltと選出された相棒のidからDaily_Lineを再計算し、相棒またはsaltの変化に応じてDaily_Lineが変わりうる結果を生成する（要件5.3と整合）
4. THE Chara_App SHALL Daily_Lineの長さを常に最大50文字（Unicodeコードポイント数）以下とする（要件5.5と整合）
5. THE Chara_App SHALL Daily_Lineを端末内で生成し、いかなる外部サーバーへも送信しない（要件3.8と整合）
6. WHERE 選出された相棒Characterの名前が空（空文字または空白文字のみ）である場合, THE Chara_App SHALL 名前を差し込まないテンプレートを用いてDaily_Lineを生成し、空でないDaily_Lineを表示する

### 要件17: 試合ごとのリザルト表示と対戦の演出

**ユーザーストーリー:** カップルとして、対戦を一戦ずつ結果発表付きで見せてほしい。そうすることで、二人でひと試合ごとに盛り上がりながらトーナメントを進められる。

本要件は要件4を破壊せず、各対戦に結果発表フェーズ（Battle_Result_Phase）と演出を追加する非破壊拡張として整理する。要件4.2（rngによる自動判定）・要件4.6（不戦勝）・要件4.7（勝者1件で終了）は維持する。

#### 受け入れ基準

1. WHEN 現在のBattle_Pairが提示されている状態で利用者が「勝負」を実行する, THE Chara_App SHALL 当該対戦の勝者をランダム要素を含めてちょうど1件自動判定し（要件4.2と整合）、勝者を強調表示（勝者ハイライト）したBattle_Result_Phaseを表示する
2. WHILE Battle_Result_Phaseを表示している間, THE Chara_App SHALL 当該対戦のBattle_Commentaryを表示する（要件4.3と整合）
3. WHEN Battle_Result_Phaseで利用者が「次へ」を実行し、かつ現ラウンドで未対戦の勝ち残りが2件以上ある場合, THE Chara_App SHALL 次のBattle_Pairを提示する（要件4.4と整合）
4. WHEN Battle_Result_Phaseで利用者が「次へ」を実行し、かつ勝ち残りが1件である場合, THE Chara_App SHALL 当該Characterを最も好きなキャラクターとして優勝発表を表示する（要件4.7と整合）
5. THE Chara_App SHALL Ranking_Battleの進行を利用者の操作でのみ進め、対戦を自動再生しない
6. THE Chara_App SHALL Ranking_Battleの進行および演出において効果音を用いない
7. WHEN Battle_Pairの入場・勝者ハイライト・画面遷移を表示する, THE Chara_App SHALL 200ミリ秒以上500ミリ秒以下の視覚的トランジションまたはアニメーションを大人かわいいテーマ（Adult_Cute_Theme）のテーマトークン経由で適用する（要件9.4と整合）
8. IF 利用者の環境がモーション低減（prefers-reduced-motion: reduce）を要求している場合, THEN THE Chara_App SHALL 対戦の演出（勝者ハイライト・ペア入場・優勝演出）のトランジション/アニメーションを無効化または大幅に短縮して適用する（要件9.5と整合）
9. WHEN 優勝が確定して優勝発表を表示する, THE Chara_App SHALL 勝者1件を大きく強調した演出（紙吹雪風の演出を含む）で表示する（要件4.7と整合）
10. WHEN ビューポート幅が320〜430 CSSピクセルの縦向き画面でRanking_Battleの各画面を表示する, THE Chara_App SHALL 横スクロールを発生させないレイアウトを維持する（要件7.6、要件9.7と整合）
11. THE Chara_App SHALL Ranking_Battleの操作要素を最小44×44 CSSピクセルのタッチ領域で提供する（要件7.7、要件9.6と整合）

### 要件18: 勝ち上がりを可視化するトーナメント表（Tournament_Bracket）

**ユーザーストーリー:** カップルとして、誰が誰に勝って勝ち上がったのかを表で見たい。そうすることで、トーナメント全体の流れを二人で振り返って楽しめる。

#### 受け入れ基準

1. WHEN Ranking_Battleの対戦が進行する, THE Chara_App SHALL これまでに確定した各ラウンドの対戦ペアと各対戦の勝者・不戦勝（Bye）をTournament_Bracketとして可視化表示する
2. THE Tournament_Bracket SHALL 対戦の進行と整合し、各対戦の勝者を次ラウンドの対戦者として示し、不戦勝（Bye）は対戦せず次ラウンドへ繰り上がった1件として示す（要件4.6と整合）
3. WHEN 優勝が確定する, THE Chara_App SHALL Tournament_Bracketの最終到達点として勝者1件を示す（要件4.7と整合）
4. THE Chara_App SHALL Tournament_Bracketを表示（読み取り専用の可視化）のみに用い、対戦の判定結果およびCharacter_Storeのデータを変更しない
5. WHEN ビューポート幅が320〜430 CSSピクセルの縦向き画面でTournament_Bracketを表示する, THE Chara_App SHALL 横スクロールを発生させないレイアウト（大きい場合は縦積みまたは折り返し等）でTournament_Bracketを表示する（要件7.6、要件9.7と整合）
6. THE Chara_App SHALL Tournament_Bracketを含む一切のデータをいかなる外部サーバーへも送信しない（要件3.8と整合）

### 要件19: 状況別の対戦実況

**ユーザーストーリー:** カップルとして、対戦の実況が順当勝ちか番狂わせかで変わってほしい。そうすることで、一戦ごとのドラマを二人でより楽しめる。

本要件は要件4を破壊せず、Battle_Commentaryを状況（Battle_Situation）別に出し分ける非破壊拡張として整理する。要件4.2（rngによる自動判定・勝率は状況区分に依存しない）は維持する。

#### 受け入れ基準

1. WHEN あるBattle_Pairの勝敗が自動判定される, THE Chara_App SHALL 当該対戦の勝者と敗者のFavorite_LevelからBattle_Situation（favored・upset・even）を導出する
2. WHEN Battle_Situationが導出される, THE Chara_App SHALL 当該Battle_Situationに応じたBattle_Commentaryを、実行のたびにランダムに変わる非空のテキストとして表示する（要件4.3、要件4.5と整合）
3. THE Chara_App SHALL Battle_Commentaryに当該対戦の勝者を表す情報（勝者の名前またはニックネーム）を含める（要件4.3と整合）
4. THE Chara_App SHALL Battle_Situationの導出をBattle_Commentaryの出し分けのみに用い、Battle_Pairの勝敗の自動判定（要件4.2）の結果および各Characterの勝率を変更しない
5. WHERE 勝者と敗者のFavorite_Levelを比較できない、または両者が同値である場合, THE Chara_App SHALL Battle_Situationをeven（互角）として扱う

### 要件20: 準優勝・ベスト4の表示

**ユーザーストーリー:** カップルとして、優勝だけでなく準優勝やベスト4も知りたい。そうすることで、トーナメントの上位の顔ぶれを二人で振り返れる。

本要件は要件18を破壊せず、Tournament_Bracketから上位順位を導出して優勝発表に表示する非破壊拡張として整理する。要件18.4（読み取り専用・データ不変）は維持する。

#### 受け入れ基準

1. WHEN 優勝が確定して優勝発表を表示する, THE Chara_App SHALL 優勝者に加えて準優勝（決勝＝最終ラウンドの対戦の敗者）を、Tournament_Bracketから導出して表示する
2. WHERE 参加者数に応じてベスト4（準決勝＝最終ラウンドの1つ前のラウンドの各対戦の敗者）が定義できる場合, THE Chara_App SHALL 当該ベスト4をTournament_Bracketから導出して表示する
3. IF 参加者が少なくベスト4または準優勝が定義できない場合, THEN THE Chara_App SHALL 定義できる分（存在する順位）のみを表示し、定義できない順位は表示しない
4. THE Chara_App SHALL 準優勝・ベスト4の導出および表示を読み取り専用の可視化のみに用い、対戦の判定結果およびCharacter_Storeのデータを変更しない（要件18.4、要件4.7と整合）
5. THE Chara_App SHALL 準優勝・ベスト4の各順位に、優勝者および相互に重複しない相異なるCharacterを表示する

### 要件21: 対戦のお題（Battle_Theme）

**ユーザーストーリー:** カップルとして、対戦ごとに「かわいい選手権」みたいなお題が出てほしい。そうすることで、毎回ちがう切り口でトーナメントを二人で盛り上がれる。

#### 受け入れ基準

1. WHEN 利用者がRanking_Battleを開始する, THE Chara_App SHALL Battle_Themeをランダム要素を含めて1つ選び、対戦画面に表示する
2. WHEN 同一の利用者がRanking_Battleを複数回開始する, THE Chara_App SHALL 開始のたびにBattle_Themeが変わりうる結果を生成する（決定的な固定を行わない）
3. THE Chara_App SHALL Battle_Themeを端末内で選び、いかなる外部サーバーへも送信しない（要件3.8と整合）
4. WHEN ビューポート幅が320〜430 CSSピクセルの縦向き画面でBattle_Themeを表示する, THE Chara_App SHALL 横スクロールを発生させないレイアウトでBattle_Themeを表示する（要件7.6、要件9.7と整合）
5. THE Chara_App SHALL Battle_Themeの表示を大人かわいいテーマ（Adult_Cute_Theme）の配色・角丸・テーマトークンに整合した外観で適用する（要件9と整合）
