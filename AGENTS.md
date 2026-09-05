# デジモンTCGプロトタイプ — Codex 引き継ぎ資料

## このプロジェクトについて
ブラウザで遊べるデジモンテーマの対戦型TCG(1ファイルの `digimon-tcg-prototype.html` に
HTML/CSS/JSがすべて含まれる)。進化・マナチャージ・デッキダメージ制のルール。
このファイルを開いた直後に、まず本ファイルを最後まで読んでから作業を始めてください。

## セットアップ
1. `digimon-tcg-prototype.html` を作業ディレクトリに置く(このファイル1つで完結、ビルド不要)
2. ブラウザで直接開けば動作確認できる(`open digimon-tcg-prototype.html` など)
3. 著作権のあるBGM(アニメ主題歌)は同梱していない。`music/` フォルダにユーザーが
   任意でmp3ファイルを配置する運用(`BGM_TRACKS`/`EVOLUTION_TRACK`定数にファイル名を直書き)

## アーキテクチャの重要パターン(壊さないよう注意)
- **#evoTreeRow の className パターン**: 進化ツリー/ゾーン内容表示/デジモン詳細/対象選択/
  パートナー選び直し/ヘルプ/カード報酬選択/手札上限の捨て札選択など多数の用途で使い回している。
  各関数は自分の用途に応じて必ず `treeRow.className = '...'` を明示的に設定すること
- **#overlay と #packOpenOverlay は別物**: パック開封演出は独立した `#packOpenOverlay` を使用
- **`closeOverlay()`はゲーム終了後(`state.gameOver===true`)は何もしない(2026-07-19バグ修正)**:
  `endGame()`も同じ`#overlay`を使って勝敗画面を出すため、ガード無しだと「非同期ピッカーの
  解決を待たずに次の処理が進み、その裏でendGame()が勝敗画面を出したあと、元のピッカーが
  後から呼ぶcloseOverlay()が問答無用でそれを隠してしまう」という深刻なバグがあった
  (実際に踏んだ経路:グレイソード(【ダメージトリガー】)は`useDamageTriggerCard`内で
  `fx(side)`を呼んだ直後に完了を待たず次のデッキダメージ処理へ進んでしまう作りのため、
  その処理中にデッキ切れでendGame()が発動すると、グレイソード自身の対象選択ピッカー
  〈chooseSingleTarget〉が後から呼ぶcloseOverlay()が勝敗画面を隠し、盤面に戻ったまま
  操作不能になっていた)。`endGame()`自身の「メニューに戻る」「結果へ進む」ボタンだけは
  `closeOverlayForced()`(ガード無し版)を使うことで正常に閉じられる。新しく`closeOverlay()`を
  呼ぶ箇所を追加する時、通常は何も気にしなくてよい(ガードは自動で効く)が、
  「ゲーム終了後にも必ず閉じたい」特別な処理を書く場合だけ`closeOverlayForced()`を使うこと
- **#overlayを使い回すピッカーの中で`attachEyeBtn`(👁ボタン→`showDigimonDetail`)を使う場合は
  第3引数`onCloseDetail`を必ず渡すこと(2026-07-19バグ修正)**: `showDigimonDetail`も同じ
  `#overlay`を上書きするため、渡さないと詳細画面を閉じた時に元のピッカーの中身が消え、
  裏で見えているだけのメインメニューに戻ったように見えるバグになる(ドラフトの2ピック画面・
  シールドの3択カード報酬画面で実際に発生していた)。`onCloseDetail`には元のピッカーを
  同じ引数で再描画する関数を渡す(例:`attachEyeBtn(node, c, ()=> showDraftTwoPickChoice(round, sets, pack))`)。
  `#packOpenOverlay`内の`addPackCardEyeBtn`は別オーバーレイなのでこの問題の対象外。
  **パートナー選択画面(`showPartnerChoice`)でも同じ抜け漏れが見つかり修正済み
  (2026-07-19)**:詳細を見て閉じるとパートナー選択に戻れず操作不能に見えるバグだった。
  この手のオーバーレイ流用ピッカーを新設・修正する時は`attachEyeBtn`呼び出し箇所を
  必ずgrepして第3引数の有無を確認すること
- **render()は全ての状態変更後に最後に呼ぶこと**(triggerOnSummon/triggerOnEvolve含む)。
  順序を誤ると効果の反映が画面に遅れて出るバグになる
- **召喚時/進化時トリガーの裁定**: 【召喚時】は手札からの召喚と進化の両方で発動。
  【進化時】は進化でのみ発動
- **1ターン目は進化不可**(turnIndex<=1で判定、プレイヤー・AI両方)
- **endTurn()はコールバック構造**: 手札上限チェック(enforceHandLimit)を挟むため、
  即座にターン交代しない
- **window.storageは非同期**: coins/collection/savedDecksを変更したら必ずsaveJSON()を呼ぶ
- **BGM**: bgmEl(#bgmPlayer)のsrcをJSで切り替える方式
- **デッキ編集の限定プール**: `deckEditorState.pool` に `'sealed'`/`'draft'` を追加済み。
  それぞれ `shieldPoolIds`/`draftPoolIds` グローバル配列を参照。`poolCardIds()`/
  `renderDeckEditor()`の所持数計算/`saveDeckBtn`の最低枚数チェック/`deckEditBackBtn`の
  戻り先判定の4箇所で分岐している。新しい限定プールを追加する場合はこの4箇所を全部直すこと
- **`openPackReveal(pack, pulled, onClose, closeLabel)`**: 第3引数`onClose`(省略時は
  shopScreen上に獲得カード一覧を表示)、第4引数`closeLabel`(ボタン文言、省略時'閉じる')
- **スルー判定は`hasThrough(side, digimon)`を必ず使うこと**:カード固有の`through`
  プロパティを直接読まず、このヘルパー経由にすること。インペリアルドラモン(ドラゴンモード)
  のように「条件(裏マナ無し)を満たす間だけスルーを得る」カードがあるため。同様にスペルの
  対象にできるかは`isSpellImmune(side, digimon)`で判定する(`chooseSingleTarget`/
  `chooseOwnTarget`が内部でフィルタ済み)
- **演出待ちの「見た目だけ隠す」パターン**:ドロー(`pendingDrawRevealUids`)・マナチャージ
  (`pendingManaChargeRevealUids`)は、実データ(手札/マナ配列)へは即座に反映しつつ、
  render()時に該当uidを描画から除外し、飛翔演出のsetTimeoutコールバックで解除+再render()
  することで「演出が終わってから増えたように見せる」。ゲームロジック(コスト計算等)は
  実データを見るため影響を受けない
- **手札カードを場のデジモンに重ねる操作は`handFieldTargetMatches`/`tryHandFieldAction`に
  統一されている**:種族進化(`raceEvolve`)・デジクロス装備(`digicross`)・アーマー進化
  (`armorEvolve`)の3種類はすべてこの2関数を経由する(ドラッグ&ドロップの`handleDrop`、
  タップで武装するハイライト表示、進化ツリー描画ループの3箇所で共通利用)。新しい
  「手札カード→場のデジモンに重ねて使う」系の効果を追加する場合はこの2関数に分岐を足すこと
- **ブロッカー判定は`hasBlocker(side, digimon)`を必ず使うこと**:`hasThrough`と同様、
  カード固有の`blocker`プロパティを直接読まないこと(デジクロス装備等で動的に付与されるため)

## 現在の実装状況(2026-07-19時点のまとめ・詳しくは動作を見て確認)

### パック・ガチャ・デッキ構築
- パック購入:複数パック横スクロール表示→1枚ずつめくり演出/一気にオープン。1パックの
  封入数は`PACK_CARDS_PER_PACK=6`枚(通常購入・シールド・ドラフト全て共通)
- レアリティ:C/UC/R/SR/UR/LR。排出率`RARITY_WEIGHTS = { C:45, UC:28, R:16, SR:7, UR:6, LR:2 }`
  (UR・LRは当初の約2倍に引き上げ済み)。パック演出はSR・URがキラキラ、LRはカットイン
- デジコイン無限化は`INFINITE_COINS = true`で切替可能
- シールド戦(500コイン):`showLimitedPackChoice(packNum, totalPacks, onChosen)`で毎回
  PACK_SETSのパック絵柄を1つ選ばせてから6枚開封、を7回繰り返す→デッキ編集→3本勝負
- ドラフト戦(400コイン、「2ピック」方式):`DRAFT_ROUNDS=20`回、各回パック絵柄選択→
  `generateTwoPickSets(round)`が2枚組×2セットを生成→`.pick-set`(2枚まとめて1つの
  選択肢)をクリックで一括獲得→`pickDraftSet`。両セットは同じレアリティ構成になるよう
  `pickRarityTier()`を2回引いてtier1/tier2を決め、両セットともそれぞれのtierから
  独立にカードを選ぶ(`cardIdForRarityTier(tier)`)。1回目と最終回(20回目)はtier1/tier2の
  どちらもUR/LRでなければtier1を強制的にUR/LRへ差し替える。ピック画面のタイトルは
  「2ピック ○/20」表記(メニューの「④ドラフト戦」ボタン名は変更なし)
- **シールド/ドラフトは選んだパック絵柄の弾のみ排出(2026-07-19修正)**:`limitedPoolForPack(pack)`
  (`poolForPack`と同じ形だが進化専用カードも含む`LIMITED_PACK_POOL`相当の範囲)を新設し、
  `openNextShieldPack`/`cardIdForRarityTier`/`generateTwoPickSets`/`openDraftTwoPick`が
  選択パックを引数で受け取って使うよう修正。**この修正の過程で発覚した重大バグ**:
  `const LIMITED_PACK_POOL = BT01_CARD_IDS;`が配列をコピーせず参照を共有していたため、
  後段の`LIMITED_PACK_POOL.push(...BT02_CARD_IDS)`が`BT01_CARD_IDS`自体まで汚染し、
  「第1弾のみ」のはずのプールに第2弾164種が紛れ込んでいた(`BT01_CARD_IDS`は
  `[...BT01_CARD_IDS]`でコピーするよう修正済み)。ドラフトの旧実装は選択パックの
  `pack`引数自体を握りつぶしており(`showLimitedPackChoice`のonChosenコールバックが
  pack変数を使っていなかった)、パック絵柄選択が完全に見た目だけの演出になっていた
- **パック別の排出プール分離を実装済み(2026-07-19)**:`PACK_SETS`の`id`(bt01/bt02/bt03)に応じて
  `poolForPack(pack)`が排出プールを切り替える。bt01→`PACK_POOL`(第1弾のみ)、
  bt02→`PACK_POOL_BT02`(第2弾=デジモンアドベンチャー アルファのみ)、bt03→現状専用カードが
  無いため両方の合算にフォールバック。`buyPack`/`buyPacksBulk`の2箇所で`pickWeightedCardId(PACK_POOL)`
  だった箇所を`pickWeightedCardId(poolForPack(pack))`に変更済み。新しいパックを追加する場合は
  この関数に分岐を1つ足すだけでよい
- デッキ編集ルール:同名2枚まで・レジェンド2種類まで(通常デッキは30枚ちょうど、シールド/
  ドラフトは最低枚数のみ、超過は保存時のみ赤字警告でブロック)。**コスト2以下・未進化
  (ルーキー/ベイビー)のデジモンを3枚以上入れないと保存できない(2026-07-19追加、通常の
  30枚デッキのみ対象、シールド/ドラフト/デバッグは対象外)**:`saveDeckBtn`のonclick内、
  サイズチェックの直後に`deckEditorState.cards`を`CARDS[id].stage==='rookie'||'baby' &&
  cost<=2`でフィルタしてカウント、3枚未満なら`showNotice`でブロック。パートナー選出
  (`findPartnerCandidateIndex`、下記)がこのルールに依存しているため、削除する場合は
  そちらの動作も見直すこと
- コレクション画面はサイバーチックな「ファイル」風UI(タブ付きファイルフォルダ型):左に
  色別インデックスタブ(赤/青/緑/白/黒/虹、所持数/総数バッジ付き)、右にネオン枠のファイル
  パネル。並び順は`buildCollectionOrder()`が`family`/`evolveFromFamily`から進化ツリーを
  DFS順に構築(不明カードはコスト順で末尾)、`collectionOrderCache`にメモ化
- カード画像(ART):実装済み130カード中127種に実カード画像を割当済み(残り3件は
  パック外装画像で対象外)。`image/legend/`にレジェンド専用カットインイラストを8種類、
  `LEGEND_CUTIN_ART`にbase64登録(未使用の約20種は将来のカード追加用に温存)
- 実カード画像から新カードを追加する際の定番手順:PowerShellの`System.Drawing`で該当部分を
  左右/複数枚トリミング→500px幅にリサイズ→JPEG(quality82)化→base64化して`ART`定数に追加
  (中間ファイルは作業後に削除)
- **コイン/テイマーアイコン(コスメティック)の画像処理パイプライン**:`image/coins/coin_map.csv`
  (`元ファイル名|出力ファイル名`のパイプ区切り)+`image/coins/process_coins.ps1`
  (`System.Drawing`で透過ピクセルの外接矩形を120px縮小サンプルから検出→6%マージン→
  正方形パディング→320×320 PNGに整形)、アイコンは`image/icon/icon_map.csv`+
  `process_icons.ps1`で同じ仕組み。新しいコイン/アイコン画像を追加する時はCSVに1行足して
  スクリプトを再実行するだけでよい(切り抜きロジックは触らない)。**`Get-Content`は必ず
  `-Encoding UTF8`を付けること**(日本語ファイル名のCSV行が文字化けして読み込み失敗する、
  2026-07-19に`process_coins.ps1`側の付け忘れを発見・修正済み)。複数キャラが1枚に写った
  コンタクトシート/コラージュ画像(外接矩形が全体を囲んでしまい綺麗に切り抜けない)は
  このパイプラインに掛けず除外すること。`COSMETIC_COINS`/`COSMETIC_ICONS`配列(id/name/
  画像パス/価格)に手動で1エントリ追加すれば実装完了、id重複が無いか事前にgrep推奨
- **ショップのコイン/アイコン購入UIは数が多くなったため`.pack-grid-row`(折り返しgrid+
  検索ボックス+件数表示、`.shop-search-input`/`renderShopCosmeticRow`)を使用**(2026-07-19、
  91コイン/13アイコンに増えた時点で`.pack-scroll-row`の横スクロール単列表示が破綻したため
  導入)。パック/スターター/スリーブ/プレイマット等、点数が少ないカテゴリは従来通り
  `.pack-scroll-row`のまま。今後さらにコイン/アイコンを追加する場合は`COSMETIC_COINS`/
  `COSMETIC_ICONS`にエントリを足すだけで自動的にこのgrid+検索に反映される(UI側の変更は不要)
- **ショップで購入済みのアイテムは`.shop-owned`クラス(グレーアウト)で表示(2026-07-19)**:
  以前は`renderShopCosmeticRow`が所持済みも未所持と同じ`.tamer-equipped`(ゴールドの発光枠)を
  使い回していて「テイマー画面での装備中表示」と紛らわしかったため分離した。
  `.tamer-equipped`(ゴールド枠)はテイマー装備画面の「現在装備中」表示専用に戻し、
  ショップ側の「購入済みで今は買えない」表示は`.shop-owned`(opacity+grayscale)を新設して
  使う。ストーリーショップの購入済みオファー表示(`storyShopBoughtIds`)にも同じクラスを
  流用している(下記ストーリーモード節参照)
- **スリーブの画像処理パイプラインを新設(2026-07-19)**:コイン/アイコンと同じ
  CSVマッピング方式で`image/sleeve/sleeve_map.csv`(`元ファイル名|出力ファイル名`、
  元ファイルは`image/player/Sleeve/`を参照)+`image/sleeve/process_sleeves.ps1`。
  コインの「透明ピクセルの外接矩形を検出して切り抜く」方式とは違い、スリーブの元画像は
  白背景の商品写真やロゴ入りの完成品画像が多く、変にトリミングするとロゴやテキストを
  切り落とす危険があるため、**「contain方式でカード比率(350×488、既存sleeve1の287:400比を
  踏襲)に収め、余白は白でパディングする」方式**(`Process-One`)を採用。
  **WebP画像はSystem.Drawing(GDI+)で直接読めない(`FromFile`が`Out of memory`例外を出す)
  ため、`PresentationCore`(WPF)の`BitmapDecoder`経由で一度PNGに変換してから処理する**
  (`Convert-WebpToPng`、この環境ではOS側にWebPコーデックが入っているため成功する。
  AVIF画像はこの経路でも読めなかったため、AVIF形式のソースは登録せず除外した)。
  **`Get-Content -Encoding UTF8`だけでは不十分で、`.ps1`スクリプト自体にUTF-8 BOMが
  無いとWindows PowerShell 5.1が日本語コメントを含むスクリプトを正しく構文解析できず
  `Unexpected token`エラーになる(2026-07-19発見)**:このスクリプトを含め、日本語コメントを
  含む新しい`.ps1`を書く時は保存時に必ずBOM付きUTF-8にすること(`Write`ツールでの新規作成後、
  `node`で先頭に`EF BB BF`を追加するか、`Set-Content -Encoding utf8`で書き直すとよい)。
  横向きに撮影されたソース画像(例:`4.jpg`)は`RotateFlipType.Rotate270FlipNone`で
  事前に回転させてから(`4_rotated.jpg`として保存)CSVに登録した。新しいスリーブを追加する
  場合はCSVに1行足してスクリプトを再実行し、`COSMETIC_SLEEVES`に1エントリ追加するだけでよい
- **プレイマットは「実画像は後日差し替え予定」という暫定状態が続いていたが、2026-07-19に
  1枚だけ実画像を追加**(`image/playmat_numemon.jpg`、`background-size:cover`で使われるため
  厳密なアスペクト比合わせは不要、単純に1800px幅へアップスケールしただけ)。透かし入りの
  もう1枚のプレイマット候補画像(`image/player/playmat/il_fullxfull.7872380142_4rc5.jpg`、
  マーケットプレイスの商品写真で全面に半透明の繰り返し透かしが入っていた)は、コイン画像の
  透かし除外と同じ判断基準で意図的に未登録のまま残してある。既存の10色バリエーション
  (`playmat.png`にCSSフィルターを掛けるだけの暫定実装)は変更していない

### 第2弾(デジモンアドベンチャー アルファ、pack2)
2026-07-19に`card_images/pack2/`(90枚のシート画像、2枚に1カードずつ)から164種類の新カードを
追加(重複スキャン16枚は除外済み)。データ(ステータス・進化条件・アート)投入後、同日中に
**164枚全ての効果実装が完了**(q001〜q090、8バッチに分けて実装・都度Playwrightで機能テスト、
バッチごとにバックアップ取得)。
- データは`CARDS_PACK2`(既存`CARDS`と`Object.assign`で統合)/`ART_PACK2`(同様に`ART`と統合)/
  `EVOLUTION_OPTIONS_PACK2`(通常ツリー進化が必要な5系統のみ:
  moonmillenniamon→millenniamon/diaboromon→armageddemon/dorumon→dexdorugamon→
  dexdorugremon→dexdorugoramon)として`PACK_CARDS_PER_PACK`定義の直後にまとめて挿入されている
  (`card_images/splice_pack2.ps1`で自動挿入。ほとんどのpack2カードは通常ツリーではなく
  `raceEvolve`(【進化】種族or色/コストN形式)で進化するため、ツリー登録は上記5系統のみで足りる)
- 第1弾と同名だが別カード(グラウモン/メガログラウモン/ブイモン/エクスブイモン/
  フレイドラモン/パイルドラモン/ベルゼブモン/ガイアフォース/デジメンタルフラッシュ)は
  既存カードを壊さないよう`id`に`2`を付けて区別(例:`growlmon2`、`gaiaforce2`、`vmon2`、
  `exvmon2`、`flamedramon2`、`paildramon2`、`beelzemon2`、`vamdemon2`、`wolfmon2`。表示名は
  同じままなので実質「再録カード」として扱われる)
- カード種族が複数(例:ビースト/デビル)の場合は`species`にスラッシュ区切り文字列を設定
  (配列ではない。`raceClass`等の単純一致判定では引っかからずスタイル無しになるが動作はする)
- パイプライン用スクリプトは`card_images/split2.ps1`(シート→左右分割)/`resize2.ps1`(340px
  リサイズ、フルカードスキャンそのまま)/`crop_art2.ps1`(キャラクターアート部分だけを
  割合指定でトリミング、x:8-92%・y:13-58%の固定窓。カードごとに多少ズレることがある)/
  `inject_art2.ps1`(base64化)/`splice_pack2.ps1`(HTMLへの挿入)。中間画像フォルダ
  (split2/resized2/art2)は挿入後に削除済み
- **効果実装コードの置き場**:`<script>`内の`/* ==================== pack2 効果実装 ==================== */`
  以降、`/* ---- q001-q015 バッチ ---- */`のようにコメントでバッチ区切りされている。巨大な
  `CARDS_PACK2`データ定義そのものは触らず、`CARDS.xxx.yyy = ...`/`EFFECTS.xxx = {...}`の
  後付け代入だけで効果を配線する方式(データ定義と効果ロジックを分離し差分レビューしやすくする狙い)
- **pack2で新設した汎用システム**(既存の`hasThrough`/`hasBlocker`等と同じ「カード固有
  プロパティを直接見ずヘルパー経由にする」流儀を踏襲):
  - `state[side].sealed`:【契約(N)】でデッキ/手札から封印されたカードの永続ゾーン
    (ダークエリアと違い破壊されても解放されない)。`sealFromDeck(side,N)`で封入、
    `state[side].sealed.length`を各カードが直接参照(スカルサタモンの蘇生コスト等)
  - `state.fieldSnapshot`:【ロールバック】用に`beginTurn`の最初で毎ターン両陣営フィールドを
    ディープコピーして保持。`rollbackDigimon(side,uid)`がuid一致のデータを丸ごと復元する
    (進化・パワー変動・装備等その ターン中の変化を全て打ち消す。前のターンに存在しなかった
    デジモンには効果無し)
  - `processSubscriptions(side)`:【サブスクリプション(コスト)】の汎用エンジン。
    `digimon.subscriptionCost={type:'mana'|'hand'|'deck'|'digimon', amount:N}`を設定するだけで
    `beginTurn`から自動処理される
  - `hasOverflow(side,digimon)`:【オーバーフロー(N)】の汎用判定。
    `card.overflowCondition={amount:N}`と自分の手札枚数を比較するだけ
  - `offerImpulse(side,onExiled)`:【インパルス】の汎用実装(デッキから1枚裏向き追放して
    ボーナス)。プレイヤー側は`showConfirmDialog`でYes/No確認する本来通りの任意選択、
    AI側は選択UIが無いため常に実行する簡易版(2026-07-19、以前はプレイヤー側も
    自動実行だったのをユーザー指摘で任意化した)
  - `triggerOnBlock(side,digimon)`:【ブロック時】効果の汎用フック。`hasBlocker`を持つ防御側が
    `resolveCombatAgainstDefender`で対象になった瞬間(ダメージ計算前)に`EFFECTS[id].onBlock`を呼ぶ
  - `d.bonusAttackCharges`:「1回追加攻撃できる」系の汎用カウンタ。`canDigimonAttack`/
    `markAttacked`/AIの`nextAttack`ループ3箇所で消費される(ミラージュガオガモンの
    オーバーフロー2回攻撃・ドルゴラモンの追加攻撃で共用)
  - `d.rideStack`:【ライド】(ライドラモン)で下に重ねたデジモンの配列。非空ならスルーを得て、
    破壊時は`destroyDigimon`内でまとめてダークエリアへ送る
  - `d.__isEvolving`:進化トリガーでの`onSummon`実行中だけtrueになる既存フラグを活用し、
    「通常召喚時」と「進化時(X進化・アーマー進化含む)」で効果が変わるカード
    (シュリモン・サンドリマン・デクスドル系等)を`digimon.evolvedIn`より先に判定できるようにした
  - `andromonCostTax(side)`/`applyFacedownMoreCostReduce`と同じ場所で召喚コストに加算。
    アンドロモン(スキャン(スペル)、デッキトップを常時参照する簡易判定)専用
- 実装が届かなかった項目(=一部システムそのものが今回未着手、または個別カードの一部効果のみ
  簡易化・省略)は下記「まだ手つかず/残っているタスク」の一覧を参照

### トップメニュー構成(2026-07-19再編)
①ストーリー ②フリーバトル ③リミテッド ④ショップ ⑤コレクション ⑥テイマー
⑦デバッグモード の7ボタン構成。②フリーバトルは`battleMenuScreen`(トーナメント/
フリーバトルの2択、シールド戦・ドラフト戦は③リミテッドへ移設済み)。デッキ編集は独立の
トップボタンとしては存在しなくなり、フリーバトル(`pool:'all'`、全カード使用可能)と
ストーリーのマップ画面内(`pool:'collection'`、所持カードのみ)からそれぞれ別プールで
到達する形に整理された。`deckEditorState.returnTo`(関数参照、既定null=showMainMenu)で
デッキ編集画面の「戻る」ボタンの遷移先をメインメニュー以外(ストーリーマップ等)に
差し替え可能にしてある

### デジコイン経済(2026-07-19、INFINITE_COINS廃止)
`INFINITE_COINS`定数は削除済み。全ての購入処理(パック/単体カード/スターターデッキ/
コスメ/シールド戦/ドラフト戦参加費)は常に残高をチェックする。新規セーブの初期残高は
`loadJSON('digicoin_balance', 0)`で0(旧1000から変更)。**既存セーブの残高は
ユーザー確認の上、`loadMeta()`内で1度だけ0にリセット済み**(`coin_reset_20260719`という
永続フラグキーで「まだリセットしていなければ0にしてフラグを立てる」を実装、以後は
通常のプレイ結果として蓄積される一方通行のマイグレーションなので再実行はされない)

### ストーリーモード(ローグライク、2026-07-19新規実装・v1)
Slay the Spire形式の1人用ローグライクモード。マップを進み戦闘・ショップ・イベント・
宝箱を経て最終ボスを倒す。デッキ構築(所持カード)とデジコインは通常プレイと完全共有。
- **データモデル**:`storyRun`(ラン中のみ存在するグローバル変数、`saveJSON`しないため
  負ける/放棄する/ブラウザを閉じると消える。`{map, availableNodeIds, clearedNodeIds,
  deckName, deckIds, relics, items}`)。`storyMeta`(永続、`story_meta`キー、
  `{starterPacksGranted}`で初回6パック配布済みかを管理)。獲得済みの`coins`/`collection`は
  各アクションのたびに即`saveJSON`されるので、ラン失敗・放棄しても失われない
- **マップ生成**:`generateStoryMap()`が`STORY_ACT_PLAN`(Act1/2/3、各Actは通常フロア3〜4層+
  最終フロアが単一の中ボス/最終ボスノード)からフロア配列を生成。`storyRun.availableNodeIds`が
  「今選べるノード」、`advanceStoryNode(node)`がクリア後にそれを`node.connections`へ
  更新する(空配列=最終ボス撃破=`endStoryRun(true)`)
  - **樹形図の枝分かれ(2026-07-19、全結合から変更)**:以前は隣接フロア間が全結合
    (前フロアのどのノードからでも次フロアの全ノードへ進めた、実質「今のフロアの1つを
    選ぶだけ」だった)。通常フロアは3枠→**5枠**に拡張し、各ノードは自分の水平位置に
    対応する次フロアの近傍(中心±1)から**2〜3個だけ**を`connections`として持つよう
    生成方式を変更(`generateStoryMap`内、`pickRandomN`で近傍からランダム抽選)。
    次フロアの各ノードに最低1本の流入経路が来るよう、孤立ノードが出たら後から1本
    ランダムに足す未到達防止パスも実装済み(次フロアが1枠の中ボス/最終ボスの場合は
    全ノードがそこへ合流する)。結果、`renderStoryMap()`は現在フロアに5個のノードを
    表示するが、実際にクリックできる(`.available`)のは前のノードで選んだ経路の
    2〜3個だけになり、残りは`.locked`(暗く非活性)で見えるだけの「樹形図」らしい
    見た目になる。フロア0(ラン開始直後)だけは例外的に全ノードが最初から選べる
    (`beginNewStoryRun`が`storyRun.map[0]`の全IDを`availableNodeIds`にセットするため)
- **ノード種別**:`battle_normal`/`battle_elite`/`boss_mid`/`boss_final`/`shop`/
  `treasure`/`event`/`event_hard`。`enterStoryNode(node)`が種別ごとの解決関数へ
  ディスパッチする(`startStoryBattle`/`enterStoryShop`/`resolveStoryTreasure`/
  `resolveStoryEvent`)
- **マップの視界制限(2026-07-19追加)**:`renderStoryMap()`は`storyRun.availableNodeIds`が
  属するフロアのインデックスまでしか描画しない(`storyRun.map.slice(0, currentFloorIdx+1)`)。
  まだ到達していない上方のフロアはDOMにすら生成されない(以前は全フロアを常時表示していた)。
  クリア済みの下方フロアはそのまま足跡として表示され続ける
- **戦闘ノード**:AI難易度は`STORY_BATTLE_DIFFICULTY`でノード種別ごとに固定
  (通常=weak/強敵=normal/中ボス・最終ボス=strong、既存の3段階AIをそのまま流用し
  4段階目は新設していない)。AIデッキは`generateStoryAiDeck(nodeType)`が
  `STORY_NODE_RARITY_WEIGHTS`(ノード種別ごとのレアリティ重み、既存`pickWeightedCardId`と
  同じ抽選方式を流用)で生成、`startMatch({storyMode:true, storyNodeType, difficulty,
  playerDeckIds:storyRun.deckIds, aiDeckIds, onGameEnd})`で対局開始。勝利時は
  `storyCoinReward(nodeType)`(仕様書の範囲を10刻みでランダム)でコイン獲得後、
  `showRewardPicker`で3択報酬(カード/レリック/アイテム)。敗北時は`endStoryRun(false)`
  (獲得済みコイン・カードは残る、レリック・アイテム・マップ進行は失われる)
- **`state.storyMode`/`state.storyNodeType`**:`startMatch(opts)`内で`opts.storyMode`から
  セットされる対局専用フラグ。レリック効果(`hasRelic`)・戦闘中アイテムボタンの表示条件は
  必ずこれを経由し、通常対局(トーナメント/フリーバトル/シールド戦/ドラフト戦/デバッグ)には
  一切影響しない
- **レリック**(`RELICS`、最大3個、4個目取得で1個選んで破棄):`hasRelic(id)`が
  `state.storyMode && storyRun.relics.includes(id)`を返す汎用判定。フック箇所は
  `choosePartner`(初期手札+1・開始時裏マナ+1・表マナ+1)/`beginTurn`末尾(デジタル図書館の
  追加ドロー確認ダイアログ)/`evolveCost`+`tryEvolveFromHandCard`+`tryArmorEvolveFromHandCard`
  (進化コスト-1、`side!=='ai'`の時だけ適用してAI側に絶対に漏れないようにしてある)/
  `effectivePower`末尾(自分のデジモン全体+1000・攻撃時+1000・防御時+1000・デッキ5枚以下で
  +3000、`digimon.evoHistory.length>0`=進化済みデジモンに+2000)/`storyCoinReward`
  (コイン報酬+30%)/`sellPriceRatio()`(売却額50%→60%)。**6種→12種に拡張済み(2026-07-19)**、
  各エントリに`icon`(絵文字)を追加し、以前は全レリック共通で💠固定だった表示を種類ごとに
  差別化した(ショップ/報酬ピッカー/所持バッジ/宝箱カットインいずれも`def.icon||'💠'`で参照)
- **消費アイテム**(`ITEMS`、`storyRun.items`にid→所持数):`#battleScreen`の
  `#storyItemBtn`(`state.storyMode`の時だけ`render()`で表示切替)→
  `openStoryItemPicker()`→使用で`ITEMS[id].use('player')`実行し所持数-1。効果は
  既存の`draw`/`chooseOwnTarget`/`chooseSingleTarget`/`millToDark`/`pickOwnDarkToHand`等を
  再利用したコストなし単発版。**12種→20種に拡張済み(2026-07-19)**、レリックと同様
  各エントリに`icon`を追加(以前は🎒固定)。新カテゴリ:3枚ドロー/表マナ+2/ダメージ回復/
  凍結付与/デッキ圧縮妨害(相手デッキトップ3枚をダークエリアへ)/パワー+6000/
  ダークエリア回収/マナ全解除
- **報酬ピッカー**:`showRewardPicker(options, onPick)`が`#overlay`+`#evoTreeRow`を
  流用した3択UI(カードは`evoNodeHtml`、レリック/アイテムは`.story-reward-card`)。
  `generateRewardOptions()`(カード60%/レリック20%/アイテム20%)→`claimReward(opt)`。
  `addRelicToRun(id)`が4個目取得時の`offerRelicDiscard()`(1個選んで破棄)を内包
- **ショップノード**:`storyShopScreen`(パック/単体カード/レリック/アイテム/売却の
  5タブ、`storyShopTab`で切替・`renderStoryShop()`で再描画)。価格は`STORY_CARD_PRICES`/
  `STORY_RELIC_PRICES`/`STORY_ITEM_PRICES`(レアリティ→価格、仕様12/16/19節)。
  売却は`sellPriceRatio()`(通常50%、レリック「リサイクルコンバータ」所持で60%)。
  **単体カード/レリック/アイテムの3タブ全てランダム抽選のオファー制(2026-07-19)**:
  カードは`generateStoryShopCardOffers()`がレアリティごとに1枚(計6枚程度)、
  レリックは`generateStoryShopRelicOffers()`・アイテムは`generateStoryShopItemOffers()`が
  それぞれ`pickRandomN(...,3)`で約3個ずつ抽選し`storyShopCardOffers`/`storyShopRelicOffers`/
  `storyShopItemOffers`(グローバル配列)へ格納、`enterStoryShop(node)`に入る度に
  再抽選される(タブ切替だけでは変わらない)。以前は全カテゴリの全件が常時購入可能だった。
  **売却はショップ1回の訪問につき1度まで(2026-07-19)**:`storyShopSoldThisVisit`フラグ
  (`enterStoryShop`でリセット)、カード/レリック/アイテムいずれか1回売却すると
  `renderStoryShopSellTab`が以後「既に売却しました」メッセージのみ表示しボタン自体を
  出さない(個別に売却不可判定を入れるのではなく、売却済みならタブの中身自体を
  出し分ける方式)。**購入済みはグレーアウト表示(2026-07-19)**:`storyShopBoughtIds`
  (`'card:id'`/`'item:id'`形式のSet、`enterStoryShop`でリセット)に購入時追加し、
  該当オファーへ`.shop-owned`クラス(opacity+grayscale、メイン画面のコイン/アイコン
  ショップの「所持済み」表示と共通のCSS)を付ける。カード/アイテムは複数回購入できる仕様の
  ままなので、グレーアウトしても引き続きクリックは可能(見た目の「買った」マークのみ)。
  レリックは元々所持済みなら`onclick`自体を付けない(=クリック不可)仕様で変更なし
- **宝箱ノード**:`resolveStoryTreasure`が即時1つ確定付与(UR以上カード40%/レリック30%/
  アイテム30%、選択UIなし)。**獲得演出のカットインを追加(2026-07-19)**:
  `playTreasureCutIn(rewardLike, label, cb)`がUR以上パック演出(`ur-pull-*`)のCSS
  アニメーションをそのまま流用し、「🎁+獲得ラベル」を重ねて表示、演出完了(`cb`)後に
  実際の付与処理(`collection`加算/`addRelicToRun`/`storyRun.items`加算)と
  `advanceStoryNode`を実行する(=カットイン再生中はまだ付与されない)。カードは
  `cutInVisualHtml`が`.art`から通常のカード絵を表示、レリック/アイテムは`.icon`を
  絵文字表示するフォールバックが自動で効く
- **イベントノード**:`STORY_EVENTS`配列(データ駆動、`hard:true`で高難度イベント専用
  プールに分離)。`resolveStoryEvent`→`showStoryEventDialog`(`#overlayChoices`の
  ボタン列で2択、`choice.resolve()`実行後`advanceStoryNode`)。v1は7種(通常5+高難度2)
- **既知のv1の割り切り**(拡張時に見直す前提):ラン中の状態(`storyRun`)はブラウザ
  セッション内のみ有効でlocalStorageへは永続化していない(タブを閉じるとラン進行だけ
  失われる、コイン・コレクションは影響なし)。マップの経路交差回避なし(全結合)。
  「フリーバトル」ボタンは旧`battleMenuScreen`(トーナメント/フリーバトルの2択)へ
  誘導する形にしてあり、トーナメントモードの新メニューでの扱いは仕様書に明記が無かった
  ための実装時判断(ユーザー未確認)。レリック6種・アイテム12種はいずれもv1代表例で、
  `RELICS`/`ITEMS`ともデータ駆動(オブジェクトにエントリを足すだけ)なので追加は容易

### デバッグモード
トップメニュー「⑦デバッグモード」→`startDebugMode`。デッキ編集は`pool:'debug'`で全カード
対象・枚数制限なし(`poolCardIds`/`deckAddCheck`/`saveDeckBtn`/`deckEditBackBtn`の4箇所+
表示ラベルで分岐)。`startMatch({debugMode:true})`で`state.debugMode=true`になり、
プレイヤー側のみ①デッキ→手札ドラッグで無制限ドロー(`handleDrop`の`mana-deck`タイプに
`#playerHand`ドロップ分岐)②デッキ/手札→マナ行ドラッグで無制限チャージ
(`chargeFromDeck`/`chargeFromHandCard`の1回制限をバイパス、`render()`内の`deckDraggable`
判定もdebugMode時は常にtrue)が可能になる。相手(AI)は常に通常通り

### 対局の基本ルール
- 投了・フィールド上限5体・手札上限7枚・初手ターン進化不可(turnIndex<=1、プレイヤー・AI双方)
- **パートナー(初期デジモン)はコスト2以下の未進化に限定(2026-07-19追加)**:
  `findPartnerCandidateIndex(deck)`が`(stage==='rookie'||'baby') && cost<=2`を優先探索、
  見つからなければ従来通りコスト無視のフォールバック検索(デバッグデッキ等、上記の
  デッキ構築ルール導入前の枚数無制限デッキでもクラッシュしないための保険)。
  `setupPartners`/`rerollPartnerCandidates`(プレイヤー)と`setupPartners`内のAI側候補選定
  両方がこのヘルパーを共有する
- 進化条件:1進化=自色マナ1+/2進化=自色マナ2+/3進化=自色マナ3+、一部OR条件・特殊条件あり
- CPUのマナチャージ/召喚/進化AI:マナチャージは手札の中で一番価値が低い(コスト最低、
  同コストならパワー最低)カードを優先/召喚は出せる中でコスト最高のカードを優先/進化は
  条件を満たす最初の選択肢に進化。ここは`state.aiDifficulty`(弱/普通/強)による差は無く
  3段階とも共通の挙動(差があるのは攻撃フェーズのみ)
- CPUの攻撃AI(`aiAttackPhase`、`state.aiDifficulty`が'weak'/'normal'/'strong'、既定は'normal')。
  **共通原則(3段階共通、2026-07-19追加)**:単独攻撃で明らかに倒せない相手には攻撃を
  仕掛けない(`atkPower < defPower`なら`nextAttack`をスキップして次の攻撃者へ)。
  以前は「弱」だけこの判定が無く、勝てない相手にも無謀に攻撃して自滅していたバグを修正。
  各段階の違い:
  - 弱:勝てる相手の中から深く考えず先頭(`candidates[0]`)を攻撃対象にする。クワガーモンX抗体の
    同時攻撃は使えるなら使うが、2体への振り分けはランダム(`aiDualAttackSplit`)
  - 普通:勝てる相手の中で一番弱い(パワーが低い)ものを狙う。スルーがあれば直接攻撃を優先
    (`canDirect`)。同時攻撃は使えるなら使い、より強い方を優先して倒しきる配分にする
  - 強:勝てる相手の中で一番脅威(パワーが高い)なものを狙う。単独では倒せない相手がいても、
    複数体の合計パワーで倒せるならグループ攻撃で仕留める(`aiAttackPhase`冒頭の
    `totalGroupPower>=targetPower`判定、既存機能)。クワガーモンX抗体の同時攻撃は
    「2体とも倒せる時」だけ使う(`canKillBoth`。片方しか倒せない同時攻撃は倒せない方からの
    反撃で自滅しかねないため、その場合は通常の単独攻撃にフォールバックする)
  - `aiDualAttackSplit(difficulty, totalPower, [defPower0, defPower1])`:クワガーモンX抗体
    装備時の同時攻撃(2体)でパワーをどう振り分けるかを難易度別に返す共通ヘルパー。
    プレイヤー側の同時攻撃(`startDualAttackDistribution`、手動でボタン▲▼操作)とは
    別の、AI専用の自動振り分けロジック
- 進化元アイコン表示(デジモン詳細画面、evoHistory配列)
- スマホ向けレイアウト最適化(`@media (max-width:600px)`、600px以上のPC表示は無変更)

### マナシステム
- **マナゾーンのカード画像はイラストのみに統一(2026-07-19)**:第1弾の`card.art`は実カード
  スキャンをそのままトリミングした画像(コスト/名前/テキストまで写り込む、縦0.71比率)で、
  カード面の`.cd-art`(横長で薄くクロップする表示枠)では気にならないが、マナカード枠
  (60x84、ほぼ同じ0.71比率)だと余白なく全部表示されてしまい「カード画像」に見えてしまう
  バグがあった(第2弾`CARDS_PACK2`の`card.art`は元からキャラクターイラスト部分だけ事前
  トリミング済み〈横長1.33比率〉なので問題無し)。`manaCardEl`内`needsManaArtZoom(cardId)`
  (`!CARDS_PACK2[cardId]`、かつ既に例外的にイラストのみクロップ済みの4種
  `agumon_v1`/`geogreymon`/`raisegreymon`/`shinegreymon`は除く)がtrueの時だけ画像に
  `.mana-art-fullscan`クラスを付け、CSSの`transform:scale(2.22) / transform-origin:50% 18%`
  でキャラクター部分だけを拡大表示する(固定ズーム窓、カードごとに多少ズレることは許容)。
  **2026-07-19に一度scale(2.85)/32%で実装したが、ウォーグレイモン・ワーガルルモン等
  「頭部がカード上部(名前欄のすぐ下)寄りに描かれているカード」で顔が見切れる不具合を
  ユーザー指摘で発見**、ズーム窓をカード上方(y:18%起点)へシフトして修正済み。今後さらに
  顔が見切れる報告があれば、この値(scale/origin)をさらに上方向・弱めに調整すること
  (強くズームしすぎるとテキストは隠れるが顔も一緒に切れる、というトレードオフがある)。
  新しく「実カードスキャンそのまま」形式のアートを追加パックで導入する場合はこの判定を
  拡張すること(現状は第2弾かどうかだけで判定しており、第3弾以降の形式次第で見直しが必要)
- マナチャージはドラッグ操作(手札カード/デッキをマナ行へドラッグ、デッキは直接タップでも可)。
  デッキ/手札→マナゾーンへカードが飛ぶ演出(`playManaChargeAnimation`)、演出が終わるまで
  マナ枚数表示は増えない(`pendingManaChargeRevealUids`、実データは即時反映)
- マナの裏表操作は直接タップ方式:`startManaFlipSession({canTarget(side,m), max, label,
  onDone})`でセッションを開始すると、盤面のマナ行(`renderManaRow`→`manaCardEl(m,side)`)が
  `canTarget`を満たすマナだけ`.flip-selectable`(発光+パルス)にしてタップ可能にする。
  タップで`tapManaForFlip(side,m)`が即座に`m.faceup`を反転(`pendingManaFlipAnimUids`の
  くるっと演出)、max回タップし終わるか`#manaFlipBar`の「終了」ボタンで`onDone`。
  `state.awaitingChoice`をセッション中trueにして他操作の割り込みを防止。この方式を使う5箇所:
  `manaFaceTogglePicker`(自分/相手いずれか指定・1枚、ピヨモン等)/
  `manaFaceToggleEitherSidePicker`(自分・相手どちらでも・1枚、ブイモン等)/
  `openManaFreeFlipPicker`(自分のみ・無制限、インペリアルドラモン ファイターモード)/
  `pickUpTo2OpponentManaFlipDown`(相手の表マナのみ・最大2枚、デジメンタルディスオーダー)/
  `digimentalOrderFlow`の裏マナ確認ステップ(自分の裏マナのみ・最大2枚)
- 裏マナは所有者を含め中身不明(`mana-hidden`表示、実際にめくるまで色も分からない)
- コスト支払い(`payCostInteractive`)は「既定は完全自動・自分でマナをタップした時だけ手動」
  方式:盤面の自分の未タップマナは常時タップ可能で、タップすると`manualPaySelection`Setに
  追加/削除され`#manualPayBar`に件数表示+キャンセルが出る(`toggleManualPaySelection(uid)`)。
  `manualPaySelection`が空なら従来通りダイアログ無しの即時自動払い、予約枚数がコストと
  ちょうど一致する時だけそれを使う(不一致ならnotice表示のみで予約は保持、枚数を調整して
  やり直せる)。ターン開始時に`manualPaySelection.clear()`。召喚・進化・ジョグレス・
  アーマー進化・デジクロス・スペル使用など`payCostInteractive`を使う全箇所に自動反映
  (呼び出し側の変更は不要)。AI側は常にpayCost(自動・手動UIなし)

### 戦闘システム
- 反撃判定は`effectivePower`ベースに統一(ブイモン等の常時パワー上昇が正しく反映される)
- **パワーの増減は例外なく全てターン終了時にリセットされる**(`endTurn`で両陣営の
  `tempDamage`/`tempBuff`/`tempDdBuff`を0にリセット)。恒久的なパワー変化に見えるのは
  進化時の一度きりの加算(例:もんざえモン`d.power+=2000`、グラウモン`d.power+=1000`。
  これらは進化テキストが「進化時パワー+N」と明記している恒久ステータス変更であり、
  ターン終了時リセットの対象ではない)のみ。それ以外のダメージ・バフは全て`tempDamage`/
  `tempBuff`/`tempDdBuff`経由にすること。`dealDamageToDigimon`はグレイモン青のバグ発覚を
  機に`d.power -= amount`(恒久減少)から`d.tempDamage += amount`に修正済み(過去にこの
  関数がベースの全ダメージ・スペル効果で使われていたため影響範囲が大きかった)
- デジモンが場を離れる瞬間(`destroyDigimon`内)に`tempDamage`/`tempBuff`/`tempDdBuff`を
  必ず0にリセットしてからダークエリアへ送る(蘇生・手札加算等で再利用されても以前の
  増減を引きずらないようにするため)。手札・デッキへの直接バウンス系(`bounceAllDigimon`/
  `bounceSingleTarget`/`chooseEitherSidePicker`経由の各種戻す効果)は元々`CARDS[id]`から
  作り直しているため一時修飾は残らず、この観点では元から安全
- 単発攻撃はパワー減少を持続させない:攻撃を倒しきれなかった場合に相手のパワーをターン
  終了時まで減少させる仕様は「どちらの攻撃デジモンから順に攻撃したか」で結果が変わる
  順序依存バグだったため廃止済み(`resolveCombatAgainstDefender`は`defender.tempDamage`へ
  加算しない)。攻撃側自身のtempDamage蓄積は、クワガーモンX抗体の同時攻撃振り分け等
  同一アクション内で同じ攻撃側が複数の防御側と連続で戦う場合に必要なため維持
- スルー判定は必ず`hasThrough(side, digimon)`経由、ブロッカー判定は必ず
  `hasBlocker(side, digimon)`経由(カード固有プロパティを直接読まないこと。デジクロス
  装備等で動的に付与されるため)。スペル対象にできるかは`isSpellImmune(side, digimon)`
  (`chooseSingleTarget`/`chooseOwnTarget`が内部でフィルタ済み)
- 攻撃対象から除外する仕組み:`isUntargetableByAttack(side,digimon)`
  (`getValidTargets`/`getGroupValidTargets`から呼ばれる。エアロブイドラモンの白マナ6枚以上
  条件で使用)。`getGroupValidTargets`にはブイドラモン(複数攻撃者からの同時攻撃を受けない
  =attackers.length>1の時は対象から除外)の分岐もあり
- 共鳴(青):オタマモン/ゲコモン/トノサマゲコモンを実装(`hasThrough`内で判定、
  トノサマゲコモンは条件を満たすと自分の青デジモン全てにスルーを付与)。共鳴(緑/白/黒/虹)は
  該当カードが無いため未着手(`hasResonance(side,digimon,color)`は色非依存で汎用実装済み)
- 【進化効果】(進化で出した場合のみ有効な常在能力)は`digimon.evolvedIn`フラグで管理
  (`onEvolve`で立てる)。該当:ワルもんざえモン/アトラーカブテリモン/ユニモン/ゴッドドラモン
- 氷アイコン:常時攻撃不可カード(シェルモン・ゴツモン・ナイトモン・トイアグモン、
  `cantAttack`)とユキダルモン/コキュートスブレスの一時凍結の両方に表示。進化・
  ジョグレスでもフラグは正しく引き継がれる
- スルー持ちには風アイコン(💨、`.cd-wind-badge`)

### 進化システム
- 通常進化ツリー・ジョグレス進化(オメガモン/パイルドラモン等、`tryJogressEvolve`/
  `openJogressMaterialSelect`等で素材選択→カットイン→合体。AI側も`aiJogressStep`等で対応)
- 手札からの種族/色ベース進化(`raceEvolve`プロパティ、`raceEvolveMatches`は
  `species`が配列でも「いずれかに一致すればOK」として判定できる、`armorEvolveMatches`と
  同じ配列対応パターン)。該当手札カードには`handEvolveConditionLabel(c)`が生成する
  「進化元:○○」バッジを`cardInnerHtml`が`.cd-hand-evo-cond`として常時表示(対象がその場に
  居なくても条件は常に見える)
- アーマー進化+退化システム(フレイドラモン/マグナモン/ラピッドモン アーマー体/ゴッドドラモン):
  通常のraceEvolveとは別に`armorEvolve`プロパティを持ち、進化コストに加えて「その色のマナ
  1枚」または「裏マナ2枚」を追加コストとして破棄する(`tryArmorEvolveFromHandCard`/
  `offerArmorEvolveDiscard`、破棄した枚数はそのまま進化コストの支払いにも充当される)。
  アーマー進化したデジモンが破壊される時は`destroyDigimon()`内で分岐し、ダークエリアへ
  送る代わりに`preArmorForm`スナップショットへ退化してフィールドに残り、アーマー進化
  カード自身はデッキへ戻る(シャッフル、`deEvolveArmorDigimon`)
- ゴッドドラモン:進化元は「光(白)のドラゴンまたはエンジェル、コスト軽減無し」
  (`raceEvolve:{color:'white', species:['ドラゴン','エンジェル'], costReduction:0}`)。
  「光以外は攻撃できない」は【進化効果】(`evolvedIn`必須)、`goddramonLocksAttack`/
  `canDigimonAttack`で動的判定(場に居る間、自分・相手問わず適用)
- デジクロス装備システム(グレイモンX抗体/ヴァンデモンX抗体/ガルルモンX抗体/
  クワガーモンX抗体/レオモンX抗体):手札のデジクロスカードを自分の場のデジモンに
  ドラッグ/タップで重ねると装備(`equipDigicross`、`digimon.equipment`配列)。
  単体でも通常のデジモンとして召喚可能で、**単体召喚時も装備時と全く同じ能力を持つ**
  (`hasEquipped(digimon,cardId)`が`digimon.id===cardId`の場合もtrueを返すため、
  これを参照する`hasThrough`/`hasBlocker`/`effectivePower`/クワガーモンX抗体の2体同時
  攻撃判定などに自動反映される。ヘラクルカブテリモンX抗体の「装備先の代わりに破壊される」
  効果だけは装備対象が無いと意味を成さないため単体時は対象外)。クワガーモンX抗体の
  「2体同時攻撃」は攻撃対象を2体選択→`startDualAttackDistribution`で合計パワーを1000刻みで
  自由に振り分け→`resolveCombatAgainstDefender`で個別に戦闘解決(【攻撃時】等は1回のみ発動)
- デジクロスUI:装備バッジ(⚔)はカード下部右下(equipBadgeEl)。DDスタットも`ddModClass`で
  基準値比較し上昇時は赤字表示、`effectiveDD(side,m,isAttacking)`をフィールド描画時に注入。
  各デジモンカードは`.card-digimon-wrap`でラップし装備中のデジクロスを`.digicross-peek`と
  して下から覗く形で表示(タップで拡大)。`showDigimonDetail`にも装備カードへの遷移リンク
- レジェンド召喚カットイン:`playLegendSummonCutIn(card, cb)`が`playLegendPullCutIn`
  (パック演出のLRカットイン)と同じ虹色レイ+フラッシュ+スパークルを再利用しつつ、
  `LEGEND_CUTIN_ART`の専用イラスト+名前ラベルで表示。`isLegendId(...)`成立時に
  `playLegendBgm()`+このカットインを呼ぶ箇所は手札召喚/通常進化/ジョグレス×2/種族進化/
  アーマー進化×プレイヤー・AI双方の9箇所全てに分岐済み
- pack1plusレジェンド10種(オメガモンAlter-B/インペリアルドラモン【ファイターモード:黒】/
  ホーリードラモン/ホウオウモン/ベリアルヴァンデモン/ベルゼブモン/ヘラクルカブテリモンX抗体/
  グランクワガーモン/インペリアルドラモン【ウィルスモード】/【パラディンモード】、全て
  color:'rainbow'=LR・レジェンド1枚ルール自動適用)。**基本効果は全て実装済み**(2026-07-19に
  動作確認済み。以前このファイルには「未実装・テキストのみ」と書かれていたものが多かったが、
  実際には過去のセッションで既に実装されており記載が古いだけだった):ホーリードラモンの
  白マナ3枚以上の進化条件/ホウオウモンの全体沈黙(自身は例外)/ベリアルヴァンデモンの
  動的コスト減少+蘇生/グランクワガーモンのマナ枚数比較召喚条件/オメガモンAlter-Bと
  インペリアルドラモン【ファイターモード:黒】の【ダークエリア進化】・【バグ(暴走)】
  (いずれも下記「カード効果・演出基盤」に詳細)/インペリアルドラモン【ファイターモード:黒】の
  【連撃】【乱撃】【しんげき】(`fighterBlackManaCompare`、下記「戦闘システム」の
  れんげき節参照)/ヘラクルカブテリモンX抗体の再装備(`openHerculesRedeployPicker`。
  「破壊後に再装備」ではなく、単体で場に出ている間に詳細を開くと「デジクロス装備し直す
  (コスト○)」ボタンが出て、押すと通常召喚と同じコストを払って場の他のデジモンに
  デジクロス装備できる、という仕様)
- インペリアルドラモン(ドラゴンモード):召喚時に自分のマナを全て表向きにする。裏マナが
  無い間はスルー+スペル対象外(`hasThrough`/`isSpellImmune`)
- インペリアルドラモン(ファイターモード、非レジェンド版):攻撃時に自分のマナが全て表示され
  好きなだけタップして表裏変更可能(`openManaFreeFlipPicker`)。直接攻撃時に5色全て揃って
  いればデッキダメージはドローされずダークエリアへ(`hasAllManaColors`)。直接攻撃時は
  ピッカーの決定を待ってから`dealDeckDamage`を呼ぶ

### カード効果・演出基盤
- スペルカード(`SPELL_EFFECTS`に約26種の効果、`playSpellFromHand`が本体。手札からタップで
  即使用/場へドラッグでも使用可、確認ダイアログなし)。スペルは効果解決が完全に終わってから
  ダークエリアへ送られる(デジメンタルオーダー等、自分のダークエリアを参照する効果が使用中の
  自分自身を回収対象にしないため)。非同期の選択を伴う効果は`fx(side, onDone)`の第2引数で
  完了を通知する(関数の引数の数`fx.length>=2`で自動判定、既存の同期的な効果は変更不要)
- 対象を選ぶスペルはドラッグ&ドロップでも対象指定可能(`pendingSpellTargetUid`経由で
  `chooseSingleTarget`/`chooseOwnTarget`がピッカーを開かず即時適用、無効な対象への
  ドロップは通常のピッカーにフォールバック)
- デッキに戻す効果は指示がない限りシャッフル統一(ジャッジメントデイ/デジメンタルオーダー/
  天空の門/光の軍勢/デジメンタルフラッシュの手札戻し等)
- 【バックアップ】:`destroyDigimon()`の`triggerOnDestroy`フック(`opts.byAttack`/
  `opts.attackerSide`/`opts.attackerUid`で相手の攻撃による破壊か判定)。もんざえモン/
  ゲソモン/エビドラモン/ベジーモン/ワルもんざえモン/バケモン/マミーモンを実装。破壊時は
  ダークエリアに「データ復元」演出(`playDarkRepairEffect`)。持ち主未指定のカードは
  `chooseEitherSidePicker`という汎用の自分/相手切り替えピッカーで対応。ワルもんざえモンは
  通常「相手による破壊」でのみ発動するが、進化で出した場合(`evolvedIn`)は制限が外れる
- 【ギフト】:パンプモンの召喚時効果(相手デッキトップを公開し黒でなければ相手のダークエリアへ)
- ダメージ振り分けUI:`openDamageDistributionPicker`で対象を全て表示し▲▼で1000ずつ割り振り、
  残り0で決定ボタンが有効化(ファイナルエリジオンで使用)
- 【ダメージトリガー】:デッキダメージは1枚ずつ順番にドローする方式(`drawDeckDamageSequential`)。
  `damageTrigger:true`のカードがめくれたら雷カットイン(`playDamageTriggerCutIn`)後に
  コスト無料でその場使用できる選択肢を表示(`offerDamageTrigger`/`useDamageTriggerCard`、
  演出〜選択の間`state.awaitingChoice`でAIの裏側処理をブロック)。現状グレイソードのみ該当
- 未実装効果の一括実装(約39体分):「未実装、テキストのみ」だったカード効果のうち既存の
  トリガー基盤(`EFFECTS`の`onSummon`/`onEvolve`/`onAttack`、`hasThrough`/`isSpellImmune`/
  `effectivePower`/`effectiveDD`/`destroyDigimon`/`getGroupValidTargets`への条件追加)で
  実現できるものをまとめて実装。新設した汎用ヘルパー:`optionalManaToHand(side,max)`/
  `mandatoryReturnHandCardToDeck(side)`/`returnOwnDarkToDeckUpTo(side,max)`/
  `pickOwnDarkToHand(side)`/`destroyOpponentManaUpTo(side,max,faceupOnly)`/
  `bothSidesFacedownManaToDark()`/`bothSidesManaToDark()`/`bothSidesFacedownManaToHand()`/
  `bothSidesMillToDark()`(既存`millToDark(side)`を両者分呼ぶだけ)/
  `reviveTopDarkDigimon(side)`/`destroyDigimonByCostThreshold(maxCost)`(両陣営のコスト以下
  デジモンを全破壊し破壊数を返す)。新設フラグ:`digimon.battleOnlyDestroy`
  (「バトル以外では破壊されない」、`destroyDigimon`内で`opts.byAttack`以外の呼び出しを弾く。
  メタルエテモン/ヘラクルカブテリモン[通常メガ版、デジクロスX抗体版とは別id])。
  実装した主なカード:airdramon/tuskmon/woodmon/togemon/parrotmon/mojyamon/piccolomon/
  kentaurusmon/metaletemon/gargomon(【乱撃】含め実装済み。`hasRangeki`/`resolveRangekiCombat`
  が反撃を受けずに相手全体へ攻撃し全体ダメージと同じ`playFieldFlameEffect`を流用する)/
  rapidmon/saintgargomon/ikkakumon/zudomon/growlmon/whamon/lilymon/kabuterimon/stingmon/
  atlurkabuterimon/herculeskabuterimon/snimon/okuwamon/scorpiomon/pinocchimon/impmon/
  devimon/devidramon/ladydevimon/angewomon(スルー条件のみ)/garudamon/veedramon/
  aeroveedramon/leomon/angemon/holyangemon/seraphimon/megalogrowlmon/
  megidramon(進化条件のマナ判定`evolveCondition:{type:'color',color:'black',count:1}`
  含め実装済み)/dukemon(召喚条件`summonManaCondition:{type:'colorPresent',color:'white'}`
  含め実装済み)/unimon/kodokugumon・dokugumon(毒ウィルスのターン開始時デッキダメージ・
  自滅条件とも実装済み)/desumeramon(【バグ(暴走)】含め実装済み、下記参照)/
  birdramon(`triggerBirdramonDrawCheck()`がマナの表裏を反転する全経路(9箇所)から
  呼ばれ、反転完了のたびに1枚ドロー)/raremon(道連れ。`onDestroy`で自身を破壊した
  攻撃者を道連れで破壊する)/anomalocarimon・drimogemon(【ダイビング】、下記参照)/
  mekanorimon/mammon/jyureimon/evilmon(封印は元々実装済み)/rosemon/hououmonは
  2026-07-19に追加実装済み(下記参照)。**上記のうち「未実装・意図的に見送った」と
  以前このファイルに書かれていたものの大半は、実際には過去のセッションで既に実装
  されており記載が古いだけだった(2026-07-19に実コードを1件ずつ確認の上この記述に
  修正)。今後「未実装」と判断する前に、必ずコード側(EFFECTS/CARDSの該当id)を
  grepで確認してから記載すること**
- 【ダークエリア進化】:`card.darkAreaEvolution:{nameContains:'文字列'}`を持つカードは、
  手札から通常召喚する代わりに、自分のダークエリアから名前に指定文字列を含むカードを
  1枚追放することでも召喚できる(コストは通常通り支払う)。`playFromHand`内で
  `card.darkAreaEvolution`があれば候補を`p.dark`から`d.name.includes(need)`で絞り込み、
  候補1枚なら`openDarkAreaEvolutionConfirm`、複数なら`openDarkAreaEvolutionPicker`で
  選ばせてから追放→召喚。該当:オメガモンAlter-B(`nameContains:'オメガモン'`)/
  インペリアルドラモン【ファイターモード:黒】(`nameContains:'インペリアルドラモン'`。
  パラディン/ウィルス/ドラゴン/通常ファイター/黒自身のいずれの「インペリアルドラモン」も
  対象になる、名前ベースの緩い判定のため)。AI側も対応済み(2026-07-19追加。
  `aiSummonStep`の召喚候補フィルタで`ai.dark`に条件を満たすカードがあるかを
  チェックし、選ばれたら最初に見つかった候補を1枚追放してから召喚する。
  どれを追放するか選ぶ判断力は無く、単純に配列の先頭要素を使うだけ)
- 【バグ(暴走)】:`digimon.bugRampage:true`を持つカードは、氷・攻撃不可効果等の
  「攻撃できない」状態を全て無視して必ず攻撃できる(`canDigimonAttack`が`bugRampage`を
  最優先でチェック)。かつ、自分のターン中まだ1度も攻撃していないなら`endTurn()`で
  ターン終了自体がブロックされ警告が出る(2026-07-19追加、プレイヤー側のみ。AIは
  必ず攻撃してからendTurnを呼ぶ想定のため未対応)。該当:オメガモンAlter-B/
  インペリアルドラモン【ファイターモード:黒】/デスメラモン。「既に今ターン攻撃済みか」は
  `m.canAttack`(凍結解除等でも使い回されるため区別が付かない)ではなく専用の
  `m.attackedThisTurn`フラグで判定する(`beginTurn`でリセット、攻撃解決の全6箇所で
  `markAttacked(d)`ヘルパーを通して`canAttack`/`tapped`と一緒に立てる)。この分離を
  していなかった旧実装では、バグ(暴走)持ちが`m.canAttack`チェックを無条件でバイパス
  してしまい1ターンに2回以上攻撃できてしまうバグがあったため2026-07-19に修正済み
- 【ダイビング】:`digimon.divingActive=true`の間、出した次の自分のターン開始まで
  スペル対象外(`isSpellImmune`)・攻撃対象外(`isUntargetableByAttack`)になり
  「まるでいないかのように」扱われる。ただし相手の場がダイビング状態のデジモンだけに
  なった場合は、`getGroupValidTargets`が除外後の場を0体とみなし直接攻撃を許可する
  (通常の「場が空」判定と同じ扱いになる)。`beginTurn`で次の自分のターン開始時に
  自動解除。該当:アノマロカリモン/ドリモゲモン(共に`onSummon`で`divingActive=true`を
  付与するだけのシンプルな実装)
- 新カード追加:ムゲンドラモン・デジメンタルチャージ(pack1(68)右/pack1(32)左の実カード
  画像から実装)。①ムゲンドラモン:レジェンド・コスト∞(マナコストはデッキの残り枚数、
  `card.xCostDeck:true`)・パワー16000・DD5。「デッキが残り10枚以下の時のみ召喚できる」
  召喚条件は`card.deckCountCondition:{max:N}`(`summonManaCondition`と同様のパターン)。
  `playFromHand`/`aiSummonStep`(`summonCostFor(c)`ヘルパー)両方で対応。手札でのコスト
  表示は`cardInnerHtml`の`opts.displayCost`(スペルのxCostと同じ仕組みをデジモンにも拡張)。
  ②デジメンタルチャージ:赤・コスト3のスペル。マナ1枚反転(自分・相手どちらでも対象可)→
  自分のマナから1枚を手札に加えてもよい(`optionalManaToHand`)
- 既知の未修正ズレ:「ガイアフォース」の実カード効果は「パワー4000以下のデジモンを破壊」
  だが、現在の実装は「4000ダメージ」(ユーザー確認の上、ダメージ方式のまま維持することで確定)
- 2026-07-19の大規模一括修正(約22件)で以下を実装・修正:
  - ホーリードラモン(白マナ3枚以上の進化条件)/グランクワガーモン(自分マナ>相手マナの
    召喚条件、`card.summonManaCondition:{type:'moreManaThanOpponent'}`を新設、
    `summonManaConditionMet(side,cond)`で`playFromHand`/`aiSummonStep`/
    `raceEvolveMatches`の3経路を統一)/ホウオウモン(自身は能力ロックの例外、
    `isHououmonLocked`に実装済みだったがテキストが古かったので修正)/ムゲンドラモン
    (∞表示は実装済みだったのを確認)は、実は前セッションで既に実装済みだったコードを
    ドキュメントが追いついていなかっただけと判明
  - ベリアルヴァンデモンを新規実装:`card.xCostFacedownMana:true`でコストが
    お互いの裏マナ合計枚数分ダウン(`totalFacedownMana()`、`raceEvolveCost`/
    `playFromHand`/`aiSummonStep`の3箇所に反映)。召喚時は`belialvamdemonRevivePicker`
    でダークエリアのデジモンを選択(コスト合計が自分の裏マナ枚数とぴったり一致すると
    決定ボタン有効化・数字が赤くなる)→`playDarkGhostRiseEffect`(👻✝️が浮かぶ演出)+
    `playCardZoneMoveAnimationMulti`で蘇生。AI側の蘇生ロジックは未対応
  - メカノリモンを新規実装:`mekanorimonEffect(side,count)`で相手の手札を全て公開する
    `openMultiSelectPicker`(進化時はcount=2)。ジュレイモンを新規実装:
    `card.xCostMana:true`でコスト=自分のマナ枚数(`evolveCost`/`raceEvolveCost`/
    `playFromHand`/`aiSummonStep`に反映、進化ツリー経由で1マナで出せてしまうバグも
    同時に解消)。フィールドに出ていない間(手札・デッキ構築画面・コレクション等)は
    `cardInnerHtml`の`xManaStatic`分岐でコスト「X」パワー「1000X」の数式表記、
    実際に場に出ている時だけ`opts.liveStats:true`で実数値を表示する
  - マンモンを新規実装:`mammonDiscardOwnMana`(攻撃時に自分のマナ1枚を選んでダークエリアへ)、
    `sendWeakDigimonToOwnMana(4000)`(進化時、お互いのパワー4000以下のデジモンを
    持ち主のマナゾーンへ。ネイチャートラップの`sendDigimonToOwnMana`と同じ移動処理を
    両陣営・複数体に拡張)
  - **重要なバグ修正**:コカトリモンの「進化時に召喚時効果をもう一度使う」実装
    (`chooseSingleTarget`のonclickコールバック内から再度`chooseSingleTarget`を呼ぶ
    再帰パターン)は、外側のonclickが`applyFn`実行後に呼ぶ`closeOverlay()`が、
    ちょうど内側で開かれたばかりの2枚目のピッカーを即座に隠してしまい、
    `state.awaitingChoice`もfalseに戻らないまま実質フリーズしうる構造的バグだった。
    このパターン(pickerのonclickコールバック内から同じpicker関数を再帰呼び出しする)は
    **今後も避けること**。コカトリモンは`onSummon`/`onEvolve`を独立した2つの発動に
    分離して解消(進化時3000ダメージがもう1回入る形に単純化)
  - `applyEvolution`が`through`/`blocker`/`cantAttack`/`millToDark`しかリセットして
    おらず、`rangeki`/`rengeki`/`shingeki`等のカード固有フラグが進化後まで残ってしまう
    (前の姿が持っていた能力を引き継いでしまう)リスクがあったため、`target.X||false`で
    明示リセットする対象を拡張(ロゼモン/エアロブイドラモン/イビルモンでの誤発動報告を
    受けての対策、ただし実際の漏洩経路は特定できず未然防止のハードニング)
  - `summonFromOwnManaByTotalCost`/`rosemonFreeSummonFromMana`(ロゼモン/ディノビーモンが
    マナから踏み倒し召喚する共通処理)がスペルカードを除外しておらず、マナゾーンに
    チャージされたスペルを「召喚」できてしまうバグを修正(`CARDS[m.cardId].type!=='spell'`
    を追加)
  - イビルモンの進化時効果を「封印しているカードを追放」から「(封印の有無に関係なく)
    相手の手札から新たに1枚を中身を見ずに追放」に変更(`exileBlindFromOpponentHandPicker`)。
    それに伴い`sealExileOnEvolve`フラグと`applyEvolution`内の専用分岐は削除(他に
    使うカードが無いため)
  - 封印(🔒)バッジをスルー・ブロッカーと同じ`abilityBadgesEl`(カード右縁の縦積み)に
    統合、`ailmentBadgesEl`(カード左縁)からは削除(氷アイコンのみ残る)
  - インプモン等が使う`millToDark(side)`にデッキ→ダークエリアへ裏向きカードが飛ぶ
    演出(`playCardZoneMoveAnimation`)を追加(devimon/ladydevimon/`dealDeckDamage`の
    toDark経路にも自動的に恩恵)
  - 光の軍勢(`lookTopNAddMatching`)を「静かに自動解決」から「めくれた5枚を全部表示し、
    条件に合わないものは`.evo-node.locked`でグレーアウト、確認ボタンで条件に合うものだけ
    手札へ」というUIに変更(`fx(side,onDone)`の非同期パターンに対応)
  - デバッグモードのデッキ編集画面に「txtから読み込む」(`showTxtDeckList(true)`、
    `loadDeckFromTxtContent`に`preservePool`引数を追加して`pool:'debug'`を維持)と
    「全てのカードを入れる」(1〜4枚を選択→`poolCardIds()`の全カードをその枚数ずつ
    投入)ボタンを追加
- 【〇〇する度】系・繰り返し発動アビリティの汎用エンジン(`canPayActivatedAbilityCost`/
  `payActivatedAbilityCost`/`activateRepeatableAbility`)を導入済み。デジモンに
  `activatedAbility:{label, cost:{type:'discardHand', count}, run(side, sourceUid)}`
  を持たせると、`showDigimonDetail`に発動ボタンが出て、自分のターン中コストを払える限り
  1ターンの回数制限なく能動的に発動できる(他カード効果による手札破棄等では発動しない、
  あくまでこのボタンを押した時だけ発動する専用の仕組み)。現時点では対応する`activatedAbility`
  付きカードは未追加で、エンジンのみ先行実装(第4弾のカード追加時に使う予定)。コストの
  種類は`discardHand`のみ実装済み、新しいコスト種別が必要になった場合は
  `canPayActivatedAbilityCost`/`payActivatedAbilityCost`の両方に分岐を足すこと
- 各種演出:ドロー時にデッキ→手札へ裏向きカードが飛ぶ(`pendingDrawRevealUids`で演出完了まで
  手札枚数表示を遅延)、単体ダメージは火の玉が着弾、全体ダメージはフィールド全体が炎に包まれる、
  デッキダメージ時はデッキが振動、攻撃を受けたデジモンが振動。追放エリアは黒い渦の演出
  (`playExileEffect`)。ダークエリアから1枚選ぶ効果には自分/相手切り替えボタン
  (`pickFromDarkToExile`、`.side-toggle-btn`)

### 効果音・BGM
Web Audio APIによる合成音(音声ファイル不要)。`sfxTone`(オシレーター、freqEndで音程を
滑らかに変化)/`sfxNoise`(減衰ホワイトノイズ、衝突・爆発・擦過音向け、filterTypeで質感調整)の
2つの合成プリミティブを`SFX_PRESETS`で組み合わせ、`playSfx('名前')`で呼び出す(BGMセクション
直前に配置)。全SEの音量は`SFX_MASTER_GAIN`定数(現在1.7)を`sfxTone`/`sfxNoise`内で
`Math.min(1, gain*SFX_MASTER_GAIN)`として一括適用、個々のプリセットのgain値はそのまま。
登録プリセット:confirm/cancel/notice/attack/damage(炎の着火音イメージ、スペル/効果ダメージ用)/
aoeDamage(同・全体版)/destroy/exile/draw(ハイパスノイズの「シュッ」という擦過音)/
manaCharge(魔法っぽい上昇アルペジオ)/manaFlip/summon/spell/evolve/jogress/legend/
thunder(ダメージトリガー用)/packFlip/packRare/turnEnd/coinFlip(「チャリーン」という金属音、
硬貨が着地する終盤にもう一度鳴る)/win/lose。
フック済み箇所:`showNotice`/`playHitShake`(攻撃着弾、通常攻撃の音はdamage/aoeDamageとは
別で据え置き)/`playFireballImpact`/`playFieldFlameEffect`/`playDestroyEffect`/
`playExileEffect`/`playDrawAnimation`/`playManaChargeAnimation`/`playSummonImpact`/
`playEvoCutIn`/`playJogressCutIn`/`playDamageTriggerCutIn`/`playUrPullCutIn`/
`playLegendPullCutIn`/`playLegendSummonCutIn`/`playDeckShake`/`playSpellFromHand`
(支払い後・fx実行前)/`chooseSingleTarget`・`chooseOwnTarget`・`openMultiSelectPicker`の
決定クリック/パック開封の通常カードめくり(個別・一気にオープン両方)/`tapManaForFlip`・
`toggleManualPaySelection`/`endTurn`/`endGame`(勝敗)/`rollDiceForFirst`(投げる時に
coinFlip、結果確定時にconfirm)/`.menu-btn`・`.back-btn`(委任イベントリスナーで一括、
個別ボタンの配線は不要)。log()経由の`showToast`(対局ログの度に鳴る方)には意図的に
付けていない(鳴りすぎるため)。毒(poisonVirus)のターン開始時デッキダメージには
専用のSEトリガーが付いていない(damageの既定音を流用、専用音は未追加)。本物の音声
ファイルに差し替えたい場合は`SFX_PRESETS`内の該当関数の中身だけ差し替えれば呼び出し側
(`playSfx`の呼び出し箇所)は変更不要。BGM音量は`initBgm`内`bgmEl.volume`(現在0.1、
段階的に0.5→0.22→0.1と下げてきた経緯あり)。コイントスの`.coin-face`は表(あなたが先攻)を
金色、裏(相手が先攻)を銀色のradial-gradientで区別。デジコイン表示(`.menu-coin`)は
背景に斜めのハイライトが周期的に流れるシマー演出

### UI・デザイン
- タイトル・各メニュー画面(`.menu-screen`)はサイバーチックなネオン配色:CSS変数
  (`--gold`/`--gold-bright`等)を`.menu-screen`スコープで上書きするだけで配下の
  `.menu-btn`/`.back-btn`/`.deck-list-card`/`.pack-item`等が一括でネオン化する。
  対局画面(`#battleScreen`)はこのクラスを持たないため元の配色のまま
  (対局画面の`.zone`はもともと寒色系ボーダーで、結果的に違和感は無い)
  スマホ向けレイアウト最適化は`@media (max-width:600px)`
- **種族アイコン表示(2026-07-19追加、同日サイズ・位置を再調整、同日絵文字に変更)**:
  カード上の種族テキスト(`.cd-species`によるドラゴン等の文字表記)は廃止し、名前
  (`.cd-name`)の左下あたりに丸アイコンで表示する(`typeIconsHtml(species)`→
  `cardInnerHtml`/`evoNodeHtml`の両方から呼ばれる)。当初はコストバッジ直下の小さい
  アイコンだったが、視認性のため名前の左下位置・約1.5倍のサイズ
  (`.cd-type-icons{top:32px;left:-9px}`/`.cd-type-icon-img{22px}`、`.card-digimon`
  スコープはそれぞれ25px/17px)に変更済み。**`TYPE_ICONS`は当初`image/type_icon.png`
  (8種を4×2で並べたスプライト)から切り出したbase64画像だったが、「見分けにくい」という
  ユーザー指摘を受けて絵文字文字列に置き換え済み**(🐉🐾🌿👼😈❓🌈🍼、
  `typeIconsHtml`側は`<img>`ではなく`<span>`でテキスト表示するよう変更、
  `image/crop_type_icons.ps1`/`resize_type_icons.ps1`は現在未使用)。
  `TYPE_ICON_MAP`でドラゴン/ビースト/ネイチャー/エンジェル/デビル/???/レジェンド/ベイビーの
  8種を対応付け、`species`が`'ビースト/デビル'`のようなスラッシュ区切りなら複数アイコンを
  横並びで表示する(`'ビーストエンジェル'`のようなスラッシュ無し表記は`SPECIES_ALIASES`で
  正規化してから処理)。`.cd-species`のCSSクラス自体は伏せカードの「???」プレースホルダー
  表示(`showZoneCards`等)でまだ使われているため削除していない

## まだ手つかず/残っているタスク
- パック1第一弾zip(約150枚)のうち、実装済み130カードに含まれていない残りの個体を
  新カードとして追加するかどうかは未確認・未着手。**注意**:以前このファイルには例として
  「スコピオモン・デュークモン・セラフィモン・オメガモン系統」を挙げていたが、これらは
  2026-07-19確認時点で全て`CARDS`に実装済みだった(記載が古かった)。現時点で本当に
  未実装のカードが何かは再度洗い出しが必要(画像特定作業自体は完了済み、下記「現在の
  実装状況」参照)
- パック別の排出プール分離(PACK_POOLS)は2026-07-19に実装済み(`poolForPack`、上記
  「第2弾」節参照)
- **第2弾(pack2)164カードの効果実装は2026-07-19に完了**。ただし以下は新しい相互作用の
  枠組みが必要で意図的に見送った(各カードの`ability`文字列に`未実装`/`未対応`マーカー付き。
  実装するにはユーザーに方針を確認してから着手すること):
  - **カードを重ねる系統(継承・インヘリット・ハッキング)**:継承(継承スペル/オーバーライド
    スペル/セイバーハックモン/ジェスモン/ハックモン/バオハックモン)、ハッキング=相手の場に
    進化で重ねる(ヌメモン/ファンロンモン【ルインモード】/アイズモン)。既存の`equipment`
    (デジクロス専用)や進化システムのどちらにも当てはまらない新しい「カードスタック」の
    仕組みが必要
  - **割り込み型の効果**:【スキャン】(ガードロモン/ハグルモン/ハイアンドロモン、相手の
    召喚/スペル使用に割り込んで無効化)。既存のトリガーは全て「発生後」に呼ばれる作りで、
    割り込み(インタラプト)の枠組みが無い
  - **新しいウィルス/状態異常種別**:ウィルス(ドール化)(ピエモン/キメラモンの???分岐)、
    ウィルス(腐敗、既存の同名フラグとは別物)(マスティモン/エゾモン)、
    ウィルス(熱傷)(ヴォルケニックドラモン)、【パンデミック】(パラサイモン、ダークエリアに
    いる間だけ全ウィルスが伝染+状態異常が重複するルール)、【再生】(ヴァンデモン(pack2版))
  - **カード重ね/計算系の未着手データ**:ズィードミレニアモン(下に重ねたカードの数で
    パワー777777等が決まる特殊計算)、キメラモン(ジョグレス素材2種族以上・可変人数選択の
    ジョグレスUIが無いため、`evolveCondition`を成立不可の値にして安全に無効化してある。
    実装するには`jogressRequiredCount`/`jogressCandidateMatches`/`jogressSelectionValid`
    等6箇所への新ジョグレスタイプ追加が必要)
  - **デフラグ(デジモン)**:ナノモン。破壊された全デジモンを自動で再召喚し直す連鎖が
    既存の召喚パイプラインと衝突するため見送り
  - **その他個別カードの部分省略**:ケルベロモンの3体同時攻撃・破壊リダイレクト、
    オグドモンの②(封印カードを裏にして発動)、ペガスモンの「デジモンに攻撃できない」
    対象制限、ライドラモンの②(1ターン2枚までの追加ライド)、レナモン系4体の【幻術】
    (攻撃後に手札へ戻れる。攻撃解決フックが複数経路に散らばっており未着手)、
    ソルガルモンの【追跡】(破壊時のみ対応、バウンス等での離脱には未対応)、
    ルガルモン系の【追跡】(同上)
  - 上記以外は簡易化を明記した上で自動判定・自動選択に倒して実装済み(「してもよい」は
    必ず実行、対象選択はプレイヤーのUIが無い箇所は自動選択、等。各カードの`ability`文字列
    冒頭に`(pack2、簡易実装:...)`と明記してある)

## 2026-07-20の大規模修正(18件、バグ修正+新機能)
ユーザーからの一括依頼(18項目)を全て実装・検証済み。主な変更点:
- **セキュリティホール(スペル)の仕様変更**:「発動したターンを強制終了させる」効果に変更
  (`SPELL_EFFECTS.securityhole`が`setTimeout`で`endTurn()`を強制呼び出し)。これに伴い
  `canDigimonAttack`の判定順序を修正:`state[side].attackDisabled`のチェックを
  `bugRampage`/ホウオウモンロックのバイパスより**先**に置くこと(順序を誤ると
  バグ(暴走)持ちがセキュリティホール発動中でも攻撃できてしまい、`endTurn`の
  「今ターンまだ攻撃していないなら終了不可」制約と衝突してゲームが進行不能になる)
- **凍結系の二段階pending/activeパターンを一般化**:ユキダルモン等の`frozenPending→frozenActive`
  と同じ「効果を受けた次の自分のターン開始まで1ターンだけ発動」の仕組みを、マスターティラノモンの
  【シャウト】にも`shoutPending`/`shoutActive`として適用(旧実装は`shoutLocked`を
  `beginTurn`で単純に毎回falseリセットしていたため、相手タールを挟むタイミング次第で
  何ターンも解除されないバグだった)。今後同様の「次の自分のターンまでだけ効く」効果を
  追加する場合はこのpending→activeの二段階パターンを踏襲すること
- **`state.gameOver`のリセット漏れ回帰バグ**:`closeOverlay()`を`gameOver`中は無効化する
  仕組み(以前のセッションで勝敗画面保護のため導入)が、勝敗確認後に`gameOver`を
  falseへ戻す処理を欠いていたため、ストーリー報酬・トーナメント報酬ピッカーが
  「ボタンを押しても消えない」状態で進行不能になっていた。`endGame`から呼ぶ両方の
  ボタンonclickで`state.gameOver = false`を追加して解消。**`closeOverlay`をgameOverで
  ガードする仕組みを触る時は、必ず「いつgameOverをfalseに戻すか」もセットで確認すること**
- **コスト変動の赤字表示**:`handDisplayCost(side, card)`(`playFromHand`と同じ計算式を
  手札表示用に複製)を新設、基本コストと異なれば`.cd-cost-modified`(赤)を付与。
  アンドロモン等の動的コスト増減カードで有効
- **試合終了画面の拡張**:`endGame`を`showEndGameOverlay`に分離、「盤面を確認する」
  「相手のデッキを確認する」ボタンを追加(`showZoneCards`に4引数目`onClose`を追加して対応)
- **ストーリーのレリック/アイテムを10種ずつ追加**(計22レリック/30アイテム、既存カード効果の
  抽出がベース)。ショップは**1度の訪問につきレリック/アイテムそれぞれ1個までしか買えない**
  よう`storyShopRelicBoughtThisVisit`/`storyShopItemBoughtThisVisit`フラグを追加
  (`enterStoryShop`でリセット、買うとその後の同種ボタンは全てグレーアウト)
- **サーチ系アイテムを選択式に変更**:`searchDeckForCard(side, filterFn)`を新設し、
  デッキから条件に合う候補を一覧表示→選んで手札へ(以前は自動選択のみだった)
- **【封印】の統一実装(シュリモン等)**:`sealerDigimon.sealedCard`(単数)を
  `sealerDigimon.sealedCards`(**配列**)に変更。シュリモンが誤って`state[side].sealed`
  (デーモン系の【契約(N)】が使うデッキ封印用グローバルゾーン、別物)を使っていたのを、
  イビルモンと同じ`sealFromOpponentHandPicker(side, digimon, onDone)`(第3引数`onDone`を
  新設、複数枚封印する時に連鎖呼び出しできるようにした)ベースに書き換え。
  `releaseSealedCard`も配列全件を持ち主の手札へ返すよう対応。**「デジモン本体に付いて
  破壊時に手札へ戻る封印」と「`state[side].sealed`のデッキ封印グローバルゾーン(契約(N)系、
  破壊されても解放されない)」は完全に別の仕組みなので混同しないこと**
- **インパルスの追放カードを完全に伏せる**:`offerImpulse`が追放したカードに
  `impulseFacedown:true`を付与、`showZoneCards`の追放エリア確認画面で伏せカード表示に
  分岐。デッキ→追放領域へ飛ぶ演出+雷SE(`playCardZoneMoveAnimation`に`{sfx:'thunder'}`)を追加
- **場のデジモンカードを全面イラスト化**:`.card-digimon .cd-art{position:absolute;inset:0}`で
  カード全体にアートを敷き詰め、枠線を太く(1.5px→3px)、マナ色バッジ(`.cd-color-badge`)を
  右下に追加、コスト/パワー/DDの文字サイズと縁取りを強化。**実装時、同じセレクタに対する
  古い競合ルール(`height:44px`等)が後方に残っていて上書きされる事故が発生した。
  CSS変更が「見た目は正しそうなのに実際は反映されていない」時は`getComputedStyle`で
  実際の計算値を確認すること(スクリーンショットの見た目だけで判断しない)**
- **ストーリーマップに道の線+移動アイコン演出+ランダム敵アイコン**:
  `drawStoryMapPaths()`が`node.connections`ベースで隣接フロア間にSVG線を描画
  (実際にクリアした道は金色`.story-path-walked`で強調、スタート地点`#storyStartAnchor`
  からも線を引く)。`placeStoryPlayerMarker(el, animate)`が自分の装備アイコン
  (`currentTamerIcon()`)をノード位置に配置、`walkStoryPlayerIconTo(btn, cb)`で
  ノードクリック時にCSSトランジションで歩くように移動してから`cb`(=`enterStoryNode`)を
  呼ぶ(**`renderStoryMap`は毎回`area.innerHTML=''`で全消去するため、マーカーの
  移動アニメは「同じレンダリング内でクリック→アニメ→ナビゲーション」の間だけ有効。
  再描画をまたいでは繋がらないので、初回配置は`animate:false`+`transition:none`一時無効化
  で瞬間配置すること**)。戦闘系ノード(`battle_normal`等)は`generateStoryMap()`実行時に
  `node.enemyIconId`を**`COSMETIC_COINS`**からランダムに1度だけ確定(再描画のたびに変わらない
  よう、ノードオブジェクト自身に保持。2026-07-20に`COSMETIC_ICONS`(テイマーアイコン)から
  `COSMETIC_COINS`(デジモン顔アート)へ差し替え済み、下記「立ち絵・敵コイン報酬」節参照)
- エクスブイモンのマナ表裏変更(【召喚時】マナ1枚表裏反転)は確認の結果、既に前セッションで
  実装済みだった(記載が古かっただけ)

## 2026-07-20の追加バッチ(立ち絵システム/カードレイアウト刷新/攻撃演出)
上記18件バッチの直後に、同日中にユーザーから新たに一括依頼された7項目を実装・検証済み。
- **立ち絵(テイマーポートレート)コスメティックシステムを新設**:`COSMETIC_PORTRAITS`
  (太一が無料デフォルト、ヤマト/ソラ/ジョウ/光子郎/ミミ/タケル/ヒカリが購入可能、
  `image/player/tatie/`内の背景除去済みPNG・全て240×480に統一済みでトリミング不要だった)。
  既存の`COSMETIC_ICONS`等と全く同じ`ownedXxx`/`equippedXxx`+`tamerListFor`/
  `tamerOwnedListFor`/`tamerEquippedFor`/`buyCosmetic`/`equipCosmetic`の分岐パターンに
  `'portrait'`タブを追加しただけで配線完了(データ駆動設計のおかげで低リスクに拡張できた)。
  ショップ・テイマー画面とも「テイマー」タブ/セクションを**スリーブの前**に配置
  (`showTamer()`の既定タブも`'portrait'`に変更)
- **ストーリーで倒した敵の立ち絵報酬**:`onStoryBattleEnd`から`grantEnemyPortraitReward(node)`
  を呼び、そのノードの`enemyIconId`(=`COSMETIC_COINS`のid)が指す`front`画像をそのまま
  `unlockedEnemyPortraits`(`{id:'enemy_'+coinId, name, img, price:0}`の配列、
  `saveJSON('unlocked_enemy_portraits',...)`で永続化)に追加。新規イラストは用意せず
  既存コイン絵を流用する方針(ユーザー指示)。テイマー装備画面(`renderTamerItems`)は
  `tamerTab==='portrait'`の時だけ`COSMETIC_PORTRAITS`と`unlockedEnemyPortraits`を
  マージして表示する(ショップの購入リストには混ぜない、`tamerListFor`はショップ用に
  `COSMETIC_PORTRAITS`のみ返す設計を維持)
- **バトル画面に自分/相手の立ち絵を表示**:`.controls`(投了/一手戻す/ターン終了ボタンの
  横並び列)の**先頭**に`#aiPortraitSlot`、**末尾**に`#playerPortraitSlot`を追加し、
  CSSの`flex-basis:100%`+`order`(`.battle-portrait-slot`は`order:-1`、
  `#playerPortraitSlot`だけ`order:1`で上書き)で強制的に別行に押し出すことで
  「相手は一手戻すの上」「自分は投了の下」を実現。`startMatch()`内で相手の立ち絵を
  対局ごとにランダムに1人選ぶ(`aiBattlePortraitImg`、自分の装備中と同じキャラは
  候補から除外、`aiDeckBackImg`のランダム選出と同じ考え方)
- **手札カードをフィールドカードと同じ全面イラストレイアウトに統一**:`.card-hand .cd-art`
  を`.card-digimon .cd-art`と同じセレクタにまとめ`position:absolute;inset:0`の全面イラスト化を
  適用。コスト(左上)・パワー(左下)・デッキダメージ(右下)を全て「カード外縁からはみ出す丸バッジ」
  スタイルに統一(`.cd-stats`自体は`display:contents`にして箱を消し、中の`span:first-child`
  (パワー)と`.cd-dd`をそれぞれ独立してposition:absoluteで配置するCSSのみの変更、
  `cardInnerHtml`のHTML構造自体は変更不要だった)。カード枠を3px→6px、マナカードの枠も
  1.5px→3pxにさらに倍化。**色アイコン(`.cd-color-badge`、前回バッチで追加したばかりだった)は
  廃止**し、枠の色だけで判別させる方針に変更(`cardInnerHtml`からdiv自体を削除)。
  **この時、`@media(max-width:600px)`と`@media(max-width:370px)`内に残っていた
  `.cd-art{height:...px}`という旧レイアウトの上書きルールが、全面イラスト化の
  `position:absolute;inset:0`と衝突する「stale conflicting rule」になっていたため削除**
  (前回バッチのCLAUDE.mdの教訓通り、`getComputedStyle`で実際に確認しないと気づけない
  類のバグだった。デスクトップ幅では問題なく見えていたのでモバイル幅のCSSまで
  忘れずに洗うこと)
- **詳細画面のマナアイコンを2.5倍・目/進化アイコンを1.5倍に拡大**:`.detail-color-icon`
  (20px→50px)、`.cd-eye-btn`(25px→38px)、`.cd-evo-btn`(22px→33px、`.card-digimon`版は
  21px→32px)。単純なサイズ変更のみ、配置ロジックは変更なし
- **攻撃演出:カードが対象へ突進するアニメーションを追加**:`playAttackChargeAnimation(
  attackerUid, targetSelector)`が新設の中核関数。**「引いて加速しつつ突進→ゆっくり戻る」の
  実体はクローン要素**(`el.cloneNode(true)`を`position:fixed`でbody直下に配置し、
  CSS transitionを3段階(引く.1s→突進.13s→戻る.28s、計560ms)でtransformさせるだけ)で、
  `playDestroyEffect`と全く同じ「本体はrender()で即座に作り直される可能性があるため、
  独立したクローンだけを動かす」パターンを踏襲している。本体側は`pendingAttackChargeUids`
  (Set)に載っている間`render()`が`.attack-charging-hidden`(opacity:0)を付けて隠す
  (ドロー演出の`pendingDrawRevealUids`と同じ「見た目だけ隠す」パターン)。
  **戦闘解決(`resolveCombatAgainstDefender`等)のタイミングそのものは一切変更していない
  (発火して忘れる方式)**:ダメージ計算・破壊は今まで通り完全に同期的・即座に処理される。
  呼び出し箇所は3箇所のみ:①`resolveGroupCombat`(プレイヤー・AI双方の通常/グループ攻撃の
  唯一の合流点、ここ1箇所でデジモン対デジモンの全攻撃をカバー)②`showAttackArrowAndWait`
  (AI用、対象が`.card-digimon`でない=直接攻撃の時だけ発火するようガードしてあり、
  対象がデジモンの時は①と二重発火しないようにしてある)③`attackEnemyDirect`
  (プレイヤーの直接攻撃)。**新しく攻撃解決経路を追加する場合、この3箇所のいずれかを
  経由するなら演出は自動で付くが、`resolveCombatAgainstDefender`を直接呼ぶ独立した経路
  (クワガーモンX抗体の同時攻撃振り分け`startDualAttackDistribution`等)を新設する場合は
  演出が付かないので、必要なら個別に`playAttackChargeAnimation`を呼ぶこと**
- ドラッグ&矢印による攻撃対象選択(「今までの選択から矢印表示」)は実は**前セッションで
  既に完成済みの機能だった**(`startPointerDrag('attack',...)`→`beginVisualDrag`→
  `#dragArrow`/`#dragLine`の曲線矢印描画→離した位置で`handleDrop`が`attackEnemyDigimon`/
  `attackEnemyDirect`を呼ぶ、AI側も`showAttackArrowAndWait`という同種の矢印表示を持つ)。
  このバッチで新たに実装したのは「突進エフェクト」の部分のみで、矢印表示自体は変更していない

## 作業の進め方について
- ユーザーはターミナル操作に不慣れなので、コマンドを実行する際は簡潔に何をしているか
  説明しながら進めること
- 機能追加・修正のたびに、区切りよく「今何をしたか」を分かりやすく報告すること
- ゲームバランスや新カードの追加方針など、こちらで判断がつかない・裏付けが無い変更は
  独断で進めず、先にユーザーに確認すること
