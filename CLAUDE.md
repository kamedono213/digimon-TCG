# デジモンTCGプロトタイプ — Claude Code 引き継ぎ資料

## このプロジェクトについて
ブラウザで遊べるデジモンテーマの対戦型TCG(1ファイルの `index.html`〈2026-07-25に
`digimon-tcg-prototype.html`からリネーム〉にHTML/CSS/JSがすべて含まれる)。
進化・マナチャージ・デッキダメージ制のルール。
このファイルを開いた直後に、まず本ファイルを最後まで読んでから作業を始めてください。

## セットアップ
1. `index.html` を作業ディレクトリに置く(このファイル1つで完結、ビルド不要)
2. ブラウザで直接開けば動作確認できる(`open index.html` など)
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

## 2026-07-20の第3バッチ(カードレイアウト微調整+ストーリー所持ゼロ化+攻撃SE同期)
同日中にさらに6項目の追加依頼を実装・検証済み。
- **カード要素の絶対配置化を徹底**:`.cd-cost`/`.cd-type-icons`/`.cd-name`は、全面イラスト化の
  背景(z-index:0)より前面に浮かせるための「position:relativeでflexフロー内シフト」という
  従来のハック的手法をやめ、素直に`position:absolute`にした(2026-07-20)。**この旧手法の
  副作用で`.cd-type-icons`が実質的に浮いておらず見えなくなっていたのが今回発覚**(コストは
  たまたまflexの最初の子要素だったため見た目上は問題なく見えていたが、後続要素である
  タイプアイコンは正しく浮かず埋もれていた)。コストは左上角(据え置き)、タイプアイコンは
  コストの真下、名前はカード下1/3付近(`bottom:26%`)へ移動しフォントサイズ1.5倍、
  パワー数値(`.cd-stats > span:first-child`)はバッジごと2倍に拡大。**この手のCSS変更をする際は
  必ず同じセレクタの「後から出てくる重複ルール」(通常表示ブロックの少し下、および
  `@media(max-width:600px)`/`@media(max-width:370px)`内)を全部grepしてから直すこと**
  (このセッションで複数回、後方の古いルールに上書きされる事故を踏んだ教訓)
- **ダークエリア/追放領域の中身確認画面(`showZoneCards`)もフィールドカードと同じ
  `.card-digimon`全面イラストレイアウトに統一**(以前は`.evo-node`という別の簡易バッジ
  表示だった)。【インパルス】で裏向き追放されたカードは、マナ/デッキの伏せカードと
  完全に同じ「裏面画像だけ」の表示(`.facedown-zone-card`、コスト・名前等は一切出さない)に
  変更(以前は「???」ラベル付きで中途半端だった)。**伏せカードは中身の色が不明なはずなので、
  枠色を色付きカードと同じ判別可能な色にしてはいけない**(`border-color:#6b6148`固定、
  マナの裏面と同じ中立色)
- **手札/フィールドカードの枠色バグを修正**:①赤(専用クラスが無くデフォルト値がそのまま
  使われる色)の枠が実はgoldのままで赤になっていなかった→`#e0705a`に修正。②白の枠が
  ほぼ白(`#fff8e8`)で目立たなかった→ユーザー指示で黄色`#f5d033`に変更。③`.card-hand.blue-card`
  にだけ`border-color`指定が丸ごと欠落しており青い手札カードが金枠のままだった→追加。
  `.card-digimon`側は青は元から正しかったので変更不要だった
- **バトル画面の立ち絵を大幅拡大**:88px→300px。位置(投了の下/一手戻すの上)は変更せず、
  高さだけ伸ばすことで結果的に自分側の立ち絵の下端が手札ゾーンの下端とほぼ一致する
  (実測でズレ20px程度)。`.controls`内の通常フローに置いたままなので、画面全体が
  その分だけ縦に伸びる(スクロールが必要になる場合がある、意図的なトレードオフ)
- **ストーリーモードを本当に所持数ゼロからスタートするよう修正**:新規プロフィールへの
  自動スターターデッキ付与(`loadMeta`内、`savedDecks`が空の時)が、デッキだけでなく
  `collection`にもカードを加算していたため、フリーバトルで使うにはenoughだが
  ストーリーの「ゼロから始まる」体験を壊していた。**`collection`への加算だけを削除し、
  `savedDecks`への「スタータープロト」デッキ自動付与は残した**(フリーバトルの
  デッキ編集は`pool:'all'`で所持数を見ないため、この変更でもフリーバトル側の体験は
  変わらない)。それだけでは不十分で、**ストーリーのデッキ選択画面(`showDeckListView`、
  `deckEditorState.pool==='collection'`)は`savedDecks`に残っている「スタータープロト」を
  一覧から除外するようにした**(除外しないと、所持数ゼロでも自動付与済みの既存デッキを
  即座に選んでストーリーを始められてしまい、ゼロスタートの意味が無くなるため)
- **攻撃突進演出の着地タイミングに既存の攻撃SEを同期**:以前は`playHitShake`が戦闘解決の
  瞬間(=突進の演出が始まったばかりの時点)に即座にSEを鳴らしていたため、突進が対象に
  到達する前にSEだけ先に鳴って聞こえる違和感があった。`playAttackChargeAnimation`が
  突進フェーズの着地タイミング(呼び出しから230ms後)で`playSfx('attack')`を鳴らすよう変更し、
  `playHitShake(side,uid,skipSfx)`に第3引数を追加、突進演出が実際に再生された時だけ
  `resolveCombatAgainstDefender`経由でskipSfx=trueを渡して二重再生を防止。突進演出が
  無い経路(【乱撃】の`resolveRangekiCombat`等)は`skipSfx`を渡さないため今まで通り即時再生

## 第3弾(pack3、2026-07-25追加)
ユーザー提供の`pack3.zip`(44枚のシート画像、1枚に1〜2カード)から86種類の新カードを追加。
第3弾は**専用の排出プール(`PACK_POOL_BT03`/`BT03_CARD_IDS`)を持ち、他パックには一切出ない**
(以前は「bt03は専用カードが無いため全パック合算にフォールバック」だったが、この追加で
本来のパック別排出に切り替わった。`poolForPack`/`limitedPoolForPack`の両方に`bt03`分岐を追加)。
- データは`CARDS_PACK3`(既存と`Object.assign`で統合)/`ART_PACK3`(同様)として
  `LIMITED_PACK_POOL.push(...BT02_CARD_IDS);`の直後に挿入されている
  (`card_images/pack3_extract/`配下のPowerShell+Nodeスクリプト群で自動生成・挿入、
  中間画像・スクリプトはそのまま残してある。再実行はしない想定)
- **再録名衝突はid末尾に`3`を付与(pack2の`2`と同じ慣習)**:グレイモン/メタルグレイモン/
  ウォーグレイモン/ガルルモン/ズドモン/イッカクモン/ガブモン/ワーガルルモン/メタルガルルモン等。
  **ただしpack2側と衝突した3件(アポカリモン/ケラモン/クリサリモン)は要注意**:pack3の初回
  データ投入時はこれに気づかず素の`apocalymon`/`keramon`/`chrysalimon`で書いてしまい、
  `Object.assign(CARDS, CARDS_PACK3)`がpack2版を上書きしてしまうバグがあった(ART_PACK3の
  キーも同様に衝突しARTまで上書きしていた)。発覚後`apocalymon3`/`keramon3`/`chrysalimon3`へ
  改名して解消済み。**新しいパックを追加する時は、既存の全パック(pack1/pack2/pack3)に対して
  id衝突チェックを必ず行うこと**(このセッションで書いた`card_images/pack3_extract/
  final_collision_check.js`が再利用できる)
- **新設した汎用メカニクス**(既存の「カード固有プロパティを直接見ずヘルパー経由にする」
  流儀を踏襲):
  - `hasVirusSource(carrierSide, flag)`/`isVirusInfected(side)`:既存の毒/腐敗/出血/熱傷/
    リーク/呪い(poisonVirus/decayVirus/bleedVirus/burnVirus/leakVirus/curseVirus)に加え、
    新設の`virulentVirus`(【猛毒】、毒の強化版でターン開始時デッキダメージ2)を含めた
    统一判定。**【パンデミック】**(`card.pandemic:true`)は「ダークエリアにいても感染源で
    あり続ける」を実現し、既存の5箇所のウィルス判定(beginTurn毒/猛毒/熱傷、endTurn腐敗、
    onAttack出血、render時リーク表示)を全てこのヘルパー経由に置き換えることで対応した。
    呪い(curseVirus)は`destroyDigimon`の「ダークエリアへ送る」フォールバック分岐にのみ
    フックしてあり(送り先を追放に変える)、マナ送り等の他の移動経路は対象外(簡易実装)
  - `hasOverSoul(side,digimon)`/`hasOverDark(side,digimon)`:【オーバーソウル(N)】
    (自分のマナが合計N枚以上)/【オーバーダーク(N)】(自分の裏マナがN枚以上)の汎用判定。
    `card.overSoul={amount:N}`/`card.overDark={amount:N}`を設定するだけで使える
    (既存の`hasOverflow`=手札枚数版と同じ形)
  - **【G侵食】は新しい進化制限ではなく、既存の`raceEvolve`パイプラインを拡張して実現**:
    `raceEvolve`に`costMin`(進化元のコスト下限、既存の`costReduction`と逆方向の概念)と
    `requireInfected:true`(自分が`isVirusInfected`である必要)を追加しただけで、
    `raceEvolveMatches`/`tryEvolveFromHandCard`等の既存UIをそのまま流用できた
    (専用のG侵食ピッカーは新設していない)。対象カードは全てコスト0固定+
    `evolveOnly:true`+既存の`bugRampage`(【バグ(狂暴化)】=【バグ(暴走)】と全く同一の
    「必ず攻撃・自分のデジモンも対象」メカニクス、新規実装不要だった)。②の「破壊した時」
    効果は`destroyDigimon`に新設した`EFFECTS[attacker.id].onKill(attackerSide, attacker,
    defeatedSide, defeatedDigimon)`汎用フックで実現(戦闘による破壊=`opts.byAttack`の時のみ)
  - `EFFECTS[id].onDealDD(side, digimon, amount)`:【DD時】(デッキダメージを与えた時)の
    汎用フック。**直接攻撃(`attackEnemyDirect`のプレイヤー版+AI版2箇所)からのみ発火する
    簡易実装**で、デジモン戦闘中のtoDark系デッキダメージ等の経路は対象外
- **legendUnique**:pack1/pack2の「レジェンドカードはデッキに1枚しか入れられない」制約は
  既存の色(`color:'rainbow'`)判定で自動適用されるため、pack3のレジェンドにも
  `legendUnique:true`を付けているが実質フラグは冗長(rainbow色だけで足りる、記録として残置)
- **意図的な簡略化(未配線・今後の拡張候補)**:X進化・可変コスト系のレジェンド
  (カオスデュークモン/アバドモンコア/アルファモン/デクスモン/ムゲンドラモン【3式:改】)、
  【バグ(処理落ち)】(効果発動タイミングを遅延させる汎用エンジンが無い)、
  【バグ(データエラー)】【バグ(不完全コピー)】【バグ(異常進化)】、デクスモンのX進化システム、
  ミネルヴァモン以外のオメガモンズワルト系(全ウィルス無効化・進化時追放等)、
  ホーリーエンジェモン(pack3版)の「次の自分ターンまで破壊されない」は
  `state[side].indestructibleUntilNextTurn`フラグを立てるのみで実際の破壊阻止判定は
  未配線、ヤタガラモンの【バグ(通信制限)】(ドローフェイズ以外のドロー禁止)、
  逆襲(スペル)の発動条件フラグ(`lostDigimonLastOppTurn`)は自動セット未配線のため実質不発、
  等。各カードの`ability`文字列冒頭に`(pack3、簡易実装:...)`または`(pack3/未実装)`と
  明記してある。実装するにはユーザーに方針を確認してから着手すること
  (pack2の【スキャン】【デフラグ(デジモン)】等と同じ「架空UI・新エンジンが要る」パターン)
- Playwrightでの動作確認は`card_images/pack3_extract/smoke_test*.js`で実施済み
  (全86枚の`cardInnerHtml`/`evoNodeHtml`生成・コレクション画面表示・デバッグモードでの
  対局開始まではエラー0件を確認。個別カードの効果を1枚ずつ対局で確認する所までは
  時間の都合で未実施、ユーザーのプレイ中バグ報告を待つ方針)

## 継承(インヘリット)/ハッキングの実装(2026-07-25)
pack2で「新しいカードスタックの仕組みが必要」として意図的に見送られていた8枚
(継承スペル/オーバーライド/セイバーハックモン/バオハックモン/ジエスモン/ハックモン/
ヌメモン/アイズモン)+pack2のファンロンモン【ルインモード】を実装。
- **共通エンジン`digimon.inheritStack`**(新設、hasEquipped直後に定義):重なっている
  カードの完全なライブオブジェクトを積む配列(デジクロスのequipmentが軽量スタブなのに
  対し、こちらはevoHistory/equipment自身まで含めた完全な状態を保持。ライドラモンの
  rideStackと同じ発想)。`pushInheritedCard(digimon, cardObj, {reTrigger})`で追加。
  `hasThrough`/`hasBlocker`/`hasRengeki`/`hasRangeki`/`hasShingeki`は`hasInheritedFlag`
  経由でinheritStack内のキーワードもOR判定する。`triggerOnSummon`/`triggerOnEvolve`/
  `triggerOnAttack`(既存equipmentループの隣)/`triggerOnDestroy`/`triggerOnBlock`は
  それぞれinheritStack内の`EFFECTS[e.id]`も追加で呼ぶ。`destroyDigimon`はrideStack展開
  ロジックの隣で、inheritStackの各エントリを`entry.owner || ownerSide`のダークエリアへ
  個別に展開する(ハッキングで下敷きにした相手のデジモンは相手のダークエリアへ戻る)。
  `showDigimonDetail`に「継承」サムネイル行+能力文の追記表示、`netStripCardArray`/
  `netRehydrateCardArray`にもequipmentと同様に対応済み(オンライン対戦sync対応)。
  **生パワーはinheritStackから加算しない**(セイバーハックモン②は別の恒久加算)
- **セイバーハックモン/バオハックモン/ジエスモン①**:`CARDS`定義に`inheritOnEvolve:true`
  フラグを付けるだけで`applyEvolution`内の共通処理が自動発動(進化元の完全スナップショットを
  inheritStackへ積む)。`applyEvolution`は通常進化・種族進化・ジョグレス・アーマー進化・
  AI側の全経路が通る唯一の上書き関数なので、この1箇所だけでどの経路の進化でも働く。
  セイバーハックモン②(パワー/DD恒久加算)は`inheritStatBonus:true`で専用に分岐。
  バオハックモン(「召喚時・進化時の能力もその際に発動する」)は`inheritReTrigger:true`で
  進化元カードのonSummon/onEvolveをその場で直接呼ぶ
- **ジエスモン②【インヘリット】**:`showDigimonDetail`に専用ボタン(inheritStackが
  1枚以上ある時のみ表示)→継承カードを1枚ダークエリアへ送る→自分の場のデジモン1体を選ぶ→
  `EVOLUTION_OPTIONS[対象.family]`(通常の進化ツリーと同じデータ、**`.family`キーである点に
  注意、`.id`ではない**)でデッキ内候補を検索→コスト無料でその場進化。**簡易化:使用回数
  制限なし**(実カードのターン制限等が不明なため)。ジエスモン自体の進化ツリーも新設:
  `EVOLUTION_OPTIONS_PACK2`にハックモン→バオハックモン→セイバーハックモン→ジエスモンを
  追加(既存のraceEvolve経路とは併存)
- **ハックモン【召喚時】**:`EFFECTS.hackmon.onSummon`で手札から1枚選ぶ任意ピッカー
  (`openMultiSelectPicker`のmaxCount:1・minCount:0を流用、0枚選択でスキップ)。
  選んだらpushInheritedCard+`d.blocker=true`+`d.power+=1000`を直接インスタンスに付与
- **ヌメモン/アイズモン/ファンロンモン【ルインモード】の【ハッキング】**:
  `card.hacking:true`フラグ。`playFromHand`が相手の場が空でなければ「①通常/②ハッキング」
  の2択ダイアログ(`openHackingChoiceDialog`)を出す(ファンロンモン【ルインモード】は
  evolveOnlyのため②のみ)。②選択後`openHackingTargetPicker`→`hackingCommitSummon`→
  共通関数`hackEvolveOntoOpponent(side, opponentTargetUid, card)`が本体:
  **ユーザー確認済みの所有権仕様**:成立後のデジモンは相手の場に残り相手が使用できるが、
  所有権は自分のまま(`owner:side`を設定して`state[opponentSide].field`にpush。
  `destroyDigimon`の既存`d.owner||side`解決ロジックがそのまま効くため追加実装不要だった)。
  下敷きにした相手のデジモンは相手の所有権のまま(`material.owner=opp`)inheritStackへ。
  表示は`.hacked-flip`CSSクラス(`transform:rotate(180deg)`)で上下反転し、ハッキングされた
  カードと分かるようにしている(`d.owner && d.owner!==renderedSide`で判定、player/ai
  両方の場のレンダリングループに追加)
- **AI使用(ユーザー指示で全カード対応)**:①ハッキング3枚は`aiSummonStep`冒頭で
  相手の場が空でなければ最優先チェック(自分の場の5体制限を消費しないため通常召喚より前に
  判定、相手の一番強いデジモンを対象にする簡易ヒューリスティック)。②ジエスモン②は
  `aiEvolveStep`から`aiTryJesmonInherit()`(最初に見つかった組み合わせで1ターン1回)。
  ③継承スペル/オーバーライドは`aiTurn`から`aiTryInheritSpells()`
  (**既存のAIは他の全スペルタイプを常にスキップしており〈`aiSummonStep`が
  `c.type==='spell'`を無条件skip〉、この2枚専用の個別ヒューリスティックとして追加した。
  AIの汎用スペル使用ロジックを新設したわけではない点に注意**)。④セイバーハックモン/
  バオハックモン①は`applyEvolution`内の処理なので既存の`aiEvolveStep`だけで自動的に効く
- Playwright(chromium、`npm install playwright --no-save`+`playwright install chromium`で
  用意)による白箱テストで、進化チェーン・ジエスモン②・ハックモンのスタック・継承/
  オーバーライドスペルのピッカーUI・ハッキングの召喚〜破壊時のダークエリア振り分けまで
  一通り確認済み、コンソールエラー無し(`state`/`CARDS`/`EFFECTS`等をpage.evaluateで直接
  操作し、ピッカーのクリックは`el.click()`をevaluate内で直接呼ぶ方式。
  Playwrightの`page.click()`は本ゲームのオーバーレイ要素を何故か「not visible」と
  誤判定して30秒タイムアウトすることがあったため、素のDOM `.click()`呼び出しに
  切り替えて回避した)

## 進化ツリー一括拡張(2026-07-26)
ユーザー指定の約50系統について、raceEvolve(手札からの種族進化)では既に機能していても
クリックで辿れる進化ツリー(`EVOLUTION_OPTIONS`)には未登録だったリンクを追加。
- **既存キーへの追加は`.push()`で行う**(`EVOLUTION_OPTIONS.agumon.push('tyranomon',
  'darktyranomon','greymon3')`等):`Object.assign`は既存キーの配列を丸ごと上書きしてしまう
  ため、既存キー(agumon/gabumon/guilmon/picodevimon/diaboromon/dorumon/ikkakumon/
  patamon/tentomon/palmon/piyomon)は新設オブジェクトに書かず、必ずpush文で追加すること。
  新規に追加する場合はこの一括拡張の直後(`aiTryJesmonInherit`関数の後)に追記していく
- **`EVOLUTION_OPTIONS`は`.family`キー、`.id`ではない**(2026-07-25バッチのジエスモン②
  実装時に一度間違えた教訓。`agumon_v1`のid≠familyのような例が普通にあるため注意)
- 新設した`evolveCondition`タイプ:`{type:'pursuit'}`(【追跡】達成ターンのみ、フェンリルガモン
  以降専用)/`{type:'and', requirements:[...]}`(任意条件の汎用AND)/`{type:'darkVsExile',
  op:'gt'|'lt'}`(ダークエリア枚数と追放領域枚数の比較、アルファモン/デクスモン)/
  `{type:'facedownOrColor', color, count}`(裏マナ+その色の表マナの合計、ケルベロモン)。
  いずれも`conditionMet`/`conditionLabel`/`conditionShortLabel`の3箇所に追加済み
- **レインボー(レジェンド)色の対象には色マナのevolveConditionを付けない**(マナに虹色は
  存在しないため。armagemon/gigaseadramon/imperialdramon_paladin・virus/バーストモード
  3種/fenrirgamon_takemikazuchiの色マナ部分などは意図的に無条件・または既存の
  `summonManaCondition`流用のまま)
- **`tryEvolve`/`aiEvolveStep`のツリー進化経路を`target.summonManaCondition`も判定するよう
  拡張**(既存はhandEvolveMatches/summonManaConditionMet止まりだった。インペリアルドラモン
  パラディン/ウィルスモード、ベリアルヴァンデモン〈新規に`summonManaCondition:'allFaceDown'`
  を付与〉で使用)。`openEvolveMenu`の「unlocked」表示判定にも同様の追加チェックを入れて
  実際にクリックした時の結果と表示が食い違わないようにした
- **X進化(デクスドル系統)**:`card.xEvolveExile:true`(デクスドルガモン/デクスドルグレモン/
  デクスドルゴラモンに設定済み)。`tryEvolve`が進化前と同名のカードをダークエリアから
  自動で1枚選んで追放してから進化させる(`doTryEvolveWithXExile`、`darkAreaEvolution`の
  発想をツリー進化に応用)。AI側は`aiEvolveStep`の候補フィルタ+実行時分岐で対応
- **バーストモード**(discard1+ターン終了時デッキ復帰、レイヴモン/シャイングレイモン/
  ミラージュガオガモンの【バーストモード】):`card.burstEvolve:true`(既存データ、
  今回配線)。`doTryEvolveWithBurst`が手札1枚を選ばせて捨てさせ(`openMultiSelectPicker`の
  maxCount1パターン)、`d.preBurstForm`(アーマー進化の`preArmorForm`と同型)+
  `d.burstActive=true`を付与。`endTurn()`に両陣営分の巻き戻し処理を追加(`Object.assign`で
  元の姿へ戻し、バースト体のコピーをデッキへシャッフルして戻す)。バーストモード対象自体には
  色マナのevolveConditionを付けていない(手札1枚破棄そのものが追加コストのため)
- **チェーン47専用:ツリーからのジョグレス**(メタルグレイモン(オーバーダーク個体)、
  `greymon3→metalgreymon3`):`card.treeJogressAllowed:true`を持つ`jogressSpecies`対象だけ、
  `openEvolveMenu`が`tryTreeJogressSpecies`という専用関数へ分岐する(通常のjogressSpeciesは
  今まで通り手札からの`openJogressMaterialSelect`経由のみ、ツリーの値としては登録しない
  という既存の慣習を踏襲。この専用ケースだけユーザーが明示的にツリー経路を要求したための
  例外)。**手札からの通常ジョグレスはデジクロス装備済みの素材も許可されるが、この
  ツリー経由の経路だけはデジクロス装備済みのデジモンを素材から除外する**(カード固有の
  仕様)。AI側はこの経路を使わない(`aiEvolveStep`のフィルタで`jogressSpecies`条件を持つ
  対象を明示的に除外、既存の手札ジョグレスのみ利用)。種族マッチングは「ビースト/ドラゴン」
  のようなスラッシュ区切り複合種族も認識するよう緩めに実装(既存の`jogressCandidateMatches`/
  `conditionMet`は単純完全一致のみで複合種族を見落とす既知の制限があるが、そちらは
  他の多数のカードが依存する共有ロジックのため今回は触らず、この専用関数内だけで対応)
- **テイルモンを新規カードとして追加**(このゲームに存在しなかった。白/エンジェル/rookie/
  cost1/power1000/dd1、パタモンに準拠、画像は未整備のためアイコン仮表示`art:null`)。
  既存の汎用ジョグレス(シルフィモン、species一致のみで判定)・汎用アーマー進化
  (ネフェルティモン、species制限なし)が種族/種別だけを見る設計のため、**カードを
  追加するだけでこの2経路が自動的に有効になった**(ツリー登録は不要)。`PACK_POOL_BT02`に
  手動追加(`BT02_CARD_IDS`はCARDS_PACK2のキーから自動収集される仕組みのため、基本CARDSに
  直接追加したテイルモンはそのままだとどのパックからも排出されない)
- **アルターエンジェモンはカード自体が存在せずスキップ**(新規カード作成は別途相談)
- Playwrightの白箱テスト(`page.evaluate`で`state`/`CARDS`を直接操作→`tryEvolve`/
  `tryTreeJogressSpecies`等を直接呼ぶ→結果を検証)で、通常進化・裏マナ条件・X進化・
  バーストモード・パラディン/ウィルスモードのsummonManaCondition・チェーン47の
  デジクロス除外・テイルモンの汎用ジョグレス/アーマー適合を個別に確認済み、
  コンソールエラー無し

## トーナメントのデッキ編集バグ修正・種族アイコン縦並び・カード効果一括実装(2026-07-26)

### トーナメントのデッキ編集で所持カードが出ない不具合を修正
2026-07-24のストーリー/メインコレクション分離作業で`deckEditorState.pool`の`'collection'`
文字列がストーリーモード専用とレガシーなトーナメント用途の両方で曖昧に共有されてしまい、
ストーリー/ショップ購入で手に入れたカードがトーナメントのデッキ編集画面に出てこなくなる
回帰バグが発生していた。`'owned'`という新しいpool種別を追加して解消:
- `poolCardIds()`に`else if(deckEditorState.pool==='owned') ids = Object.keys(collection)
  .filter(id=>collection[id]>0);`を追加
- `ownedCountFor(id)`に`if(deckEditorState.pool==='owned') return collection[id]||0;`を追加
- `startTournamentFlow()`と、コイン画面からのスターターデッキ購入導線の2箇所を
  `openDeckEditor('collection', ...)` → `openDeckEditor('owned', ...)`に変更

### 複数種族アイコンの重なりを縦並びに修正
パイルドラモン(ドラゴン/ネイチャー)・ディノビーモン(ネイチャー/ドラゴン)等、`species`が
スラッシュ区切りで複数種族のカードは、`.cd-type-icons`アイコンが横並びでイラストに
被っていた。`.cd-type-icons`のCSSに`flex-direction:column;`を1行追加するだけで解消
(位置・サイズのロジックは変更不要)。

### 未実装/簡易実装カード効果の一括実装(2026-07-19〜26蓄積分、92件→47件)
CLAUDE.mdの過去の記述には「未実装」と書かれつつ実は既に実装済みだったカードが多数
混在していたため、Playwrightでページをロードし`CARDS`オブジェクトの**最終的な実行時
ability文字列**(静的grepではなく`page.evaluate`後の状態)を検査して正確な残件数を
洗い出した(静的grepでは362件ヒットしたが、大半は上書き済みの古いコメント/代入だった)。
実際に手つかずだったのは92件、うち約45件を今回のバッチで実装し、47件を意図的に
Group B(新エンジンが要る、後日着手)として残した。

新設した汎用ヘルパー群(既存の「AIは自動選択・プレイヤーは実選択UI」方針を踏襲):
- `pickOwnHandCardInteractive`/`pickOwnManaCardInteractive`/`chooseManaFaceInteractive`/
  `chooseCountInteractive`/`repeatGiftManaPlacement`:ランダム選択だった約15枚
  (ホークモン/シルフィモン/イガモン/コガモン/シューシュモン/シャペルモン/サンディラモン/
  ナイトキロモン/ムラサメモン/ドリモン/レビアモン/バルバモン等)をプレイヤー実選択に変更
- `subscriptionCost`データを4枚(コマンドラモン/ハイコマンドラモン/メガドラモン/
  ギガドラモン)に追加し既存の`processSubscriptions`エンジンへ配線
- `triggerHandDiscardEffects(side, discardedCard)`:手札上限による強制捨て札の瞬間に
  発動する効果の汎用フック(`enforceHandLimit`/`showHandLimitDiscard`両経路)
- ドルモン系統(dorumon/dorugamon/dorugremon/dorugoramon)・バルバモンの「デッキを何枚か
  捨てる」必須効果を`showConfirmDialog`で任意化
- **アポカリモン(pack3版)**:【バグ(不完全コピー)】`beginTurn`内でファンロンモン処理の
  直後に、自分のダークエリアからランダムに1枚追放し`pushInheritedCard(apoc, card,
  {reTrigger:true, side})`で効果を継承(継承/ハッキングエンジンの`reTrigger`オプションを
  再利用、召喚時/進化時効果も自動的にもう一度発動する)
- **エンシェントグレイモン**:①【オーバーヒート】召喚時/進化時に発動選択(`d.tempBuff +=
  d.power`+`d.expiresEndOfTurn=true`で既存のオーバーヒート/オーバークロック用
  自壊パターンを流用)②破壊時、自分のマナ枚数以下のコストのデジモンをダークエリアから
  1体復活(専用ピッカー新設、AIは最高コスト個体を自動選択)
- **アイズモン(pack3版)**:`card.requireVirusInOwnDark=true`という新しい召喚ゲート
  フラグを追加し`playFromHandNormal`/`aiSummonStep`の2箇所でチェック。「場にいる限り
  お互いのダークエリアのウィルスを全て持つ」は`hasVirusSource`に直接1行追加するだけで実現
  (`p.field.some(d=>d.id==='eyesmon3') && (state.player.dark.some(d=>d[flag]) ||
  state.ai.dark.some(d=>d[flag]))`)
- **アルファモン**:自分のマナ+お互いの追放領域から、自分のダークエリア枚数までデッキに
  戻す。`openMultiSelectPicker`をゾーン横断(`zone:'mana'|'exile_own'|'exile_opp'`タグ付き
  item配列)で流用
- **アーマゲモン**:①追加召喚コスト(自分のケラモン系統カードを全ゾーンからデッキに戻す)は
  簡易実装で召喚時に自動処理(`ARMAGEMON_KERAMON_LINE_IDS`=kuramon/keramon/keramon3/
  chrysalimon/chrysalimon3/infermon/diaboromon/diaboromon3の固定リストで名前ではなくid
  一致判定、名前に「ケラモン」を含まない進化先が多いため)②【バグ(オートデリート)】は
  `endTurn`に新規フックを追加、場にいる限り毎ターン終了時にお互いの手札/マナ/フィールドから
  各1体ランダムにダークエリアへ(自分自身が対象になり得るため、いずれ自壊してループが
  止まることもある。意図的に許容)
- **カオスデュークモン**:【バグ(異常進化)】は`conditionMet(side, cond)`関数の冒頭に
  `if(state.player.field.some(d=>d.id==='chaosdukemon') || state.ai.field.some(...))
  return true;`を追加するだけで実現(この関数は進化条件判定にしか使われていないため、
  一律trueを返しても安全に全体へ波及する)。コスト面(進化時ダークエリア追放でコスト10)は
  引き続き固定0の簡易実装のまま
- **ヒュドラモン**:①毒/出血フラグは既存の`poisonVirus`/`bleedVirus`をそのまま使うだけで
  機能済みだった。②「毒・出血で与えたダメージはダークエリアへ送られる」は、`beginTurn`の
  毒ダメージブロックと`triggerOnAttack`の出血ダメージブロックの2箇所に
  `state[oppOf(side)].field.some(d=>d.id==='hydramon')`分岐を追加し、真なら
  `dealDeckDamage`の代わりに熱傷ウィルスと同じ`millToDark(side)`を呼ぶよう変更
- **オメガモン ズワルト**:①全ウィルス無効は`anyShakkoumonPresent`をラップする既存パターン
  (アルケーエンジェモンと同じ)にIIFEで相乗り②【進化時】相手手札2枚追放③【スルー】は
  データ上`through:true`が既に設定済みだった④【DD時】は`chooseSingleTarget`(AI/プレイヤー
  自動判定込み)で相手デジモン1体追放
- **オメガモンズワルト【DEFEAT】**:召喚時/進化時/攻撃時/DD時の各トリガーで
  `d.poisonVirus`/`d.virulentVirus`/`d.bleedVirus`/`d.decayVirus`を自分自身に直接
  付与するだけで実装完了(=このカード自身がそのウィルスの感染源になり、既存の
  `hasVirusSource`がそのまま機能する)。【バックアップ】(破壊時)だけは`chooseOwnTarget`で
  自分の別のデジモン1体を選んで`curseVirus`を与える(このカード自身は既に破壊済みのため
  他の個体に引き継がせる設計)

**Group B(新エンジンが要る、意図的に未着手のまま)として残った47件**:【スキャン】の
割り込み型無効化(ガードロモン/ハグルモン/ハイアンドロモン、アンドロモンは簡易実装のまま
維持)/【デフラグ(デジモン)】自動再召喚(ナノモン)/キメラモンの可変ジョグレス選択UI/
【追跡】の破壊以外の離脱への一般化(ルガルモン/ルガモン/ソルガルモン/フェンリルガモン
【タケミカヅチ】)/「このカードをダークエリアに送ることで発動」系の割り込み無効化
(ワルシードラモン/メガシードラモン/メガシードラモンX抗体/メタルシードラモン/
リュウグウモン)/ウィルス(ドール化)(ピエモン)/カードスタックによるパワー計算
(ズィードミレニアモン)/アバドモンコアの「バグ」横断タグ・デクスモンの全体進化条件変更
(いずれも既存の限定的な簡易実装のまま)。実装するには着手前にユーザーへ方針確認すること
(このリストは今回のセッションで内容を再確認済み、CLAUDE.mdの記述が古くなっていないかは
今後も実コードのability文字列で都度確認すること)

## Group B(新エンジンが必要だった47件)の実装(2026-07-26第2弾)

前バッチで意図的に見送っていたGroup B47件のうち、大半を新エンジン構築込みで実装した
(ユーザーに実装方針を個別確認しながら進行)。47件→29件まで削減。

### 割り込み型カウンター(スキャン/自壊型)エンジンを新設
既存のトリガーは全て「発生後」に呼ばれる作りで、「相手の召喚/スペル使用そのものを打ち消す」
割り込みの枠組みが無かった。`checkCounterNegate(playingSide, card, isSpell, onDecided)`を
新設し、`playFromHandNormal`/`playSpellFromHand`/`aiSummonStep`の3箇所(=手札からカードを
場に出そうとする瞬間)の先頭で呼ぶことで実現。無効化されたカードは「手札から一切取り除かれて
いない」状態にすることで「無効にし手札に戻す」を自然に表現し、`returnTo:'deck'`指定の
カードだけこの関数が手札からデッキへ移動させる。
- `card.scanNegate = {match, maxCost, appliesTo, returnTo, oncePerTurn?, firstCardOnly?}`:
  デッキトップを覗いて判定するガードロモン/ハグルモン/ハイアンドロモン/ギガシードラモン型
  (`match:'always'`でデッキトップ判定なし=常時有効にも対応)
- `card.selfSacrificeNegate = {appliesTo, maxCost, returnTo}`:このデジモン(またはデジクロス
  装備先、`digimonSelfSacrificeSpec`で判定)をダークエリアに送ることで発動するワルシードラモン/
  メガシードラモン/メガシードラモンX抗体型
- `CARDS.ryuguumon.grantsSelfSacrificeNegateToAll`:リュウグウモンが場にいる間、お互いの
  場のデジモン全てが自壊型カウンターを得るフォールバック
- メタルシードラモンは「相手カード発動時+2マナ、払えなければ無効化」を`metalseadramonCostTax`
  (`andromonCostTax`と同じ場所に配線)で実現。「払えなければ無効化」は既存のコスト加算の
  仕組みに乗せるだけで自然に成立する(コスト不足なら通常通り支払いが失敗するだけ)
- プレイヤーが防御側の時は選択ダイアログ(`offerCounterChoice`)、AIが防御側の時は可能なら
  常に発動する(既存の「AIは常に有利な選択を自動で取る」方針を踏襲)

### 【追跡】(Pursuit)を破壊以外の離脱にも一般化
従来「破壊(一部は攻撃による破壊限定)」でしか発動しなかったが、実際は「フィールドを離れた時
(手段を問わない)」を指す。個々の`field.splice`呼び出し箇所(約23箇所)を監査する代わりに、
スカモン大王の`checkSukamongreatSelfExile`と同じ「`render()`の頭で毎回ポーリングする」方式
(`registerPursuitWatch`/`checkPursuitDepartures`/`PURSUIT_EFFECTS`)を新設。
`triggerOnSummon`(召喚・進化どちらでも発火)でuidを登録し、次の`render()`で「登録されていた
のに場から消えている」ことを検出したら発動する。ルガルモン/ルガモン/ソルガルモンの
`onDestroy`実装を撤去してこちらへ完全移行。

### 【ウィルス(ドール化)】新設(ピエモン/キメラモン)
カードテキストに具体的な効果が残っておらず、**ユーザーに直接確認**:「ターンのはじめに
デジモン1体を選び、それはそのターン中裏返しにして存在しないものとなります」。
既存の【ダイビング】(`divingActive`)と全く同じ「いないものとして扱う」枠組み
(`isSpellImmune`/`isUntargetableByAttack`)を流用し、新規に`dollifiedThisTurn`フラグを追加。
`canDigimonAttack`にも「ドール化中は攻撃不可」を追加(バグ(暴走)より優先)。
`VIRUS_FLAGS`に`dollVirus`を追加、`beginTurn`で感染源の持ち主が対象を選ぶ
(`chooseSingleTarget`でAI/プレイヤー自動判定込み)。`endTurn`でリセット。

### キメラモン:【可変ジョグレス】(任意種族2体以上)を新設
既存のジョグレス選択UI(`openJogressMaterialSelect`)は固定family/species枠専用だったため、
`cond.type==='jogressAny'`(`{min:N}`)を新設して`jogressRequiredCount`/
`jogressCandidateMatches`/`jogressSelectionValid`/`conditionLabel`の4箇所に対応追加
(任意のデジモンを何体でも素材にでき、`min`以上あれば成立)。**`playFromHandNormal`の
evolveOnly→ジョグレス振り分け判定(`cond.type==='jogress'||'jogressSpecies'`)にも
`'jogressAny'`を追加し忘れると素材選択UI自体が開かない(実際に踏んだ抜け漏れ)**。
X(=素材の種族の種類数、複合種族「A/B」は2種として数える)・パワー(4000X)・DD(X)は
`performJogress`内の`target.id==='chimeramon'`専用分岐で計算し`chimeramonSpecies`配列に
保存、`EFFECTS.chimeramon.onEvolve`が種族ごとの追加効果(ドラゴン:ストライク/ネイチャー:
デッキ上2枚までマナへ/エンジェル:ダークエリアから1枚回収/デビル:デジモン1体破壊/
???:**自分自身**がドール化(原文「キメラモンをドール化する」を文字通り解釈)/レジェンド:
DD+3恒久)を後付けする。AI側は`aiPickJogressMaterials`で`jogressAny`を検知したら
null(=スキップ)を返すだけの安全策(組み合わせ最適化ヒューリスティックは今回実装しない)。

### その他の中規模実装
- **ナノモン【デフラグ(デジモン)】**:自分の場のデジモン(ナノモン自身も含む)を全て
  デッキへ戻しシャッフル、同じ数だけデッキの上から自動で召喚し直す。連鎖召喚(再召喚された
  カードがまた`triggerOnSummon`を発火する)は同名2枚までの制限で有限に収まるため許容
- **ズィードミレニアモン**:「カードを重ねる新ギミック」は不要だった。実際は
  ムーンミレニアモン→ミレニアモン→ズィードミレニアモンという**通常のツリー進化**で、
  既存の`evoHistory`(進化元記録)をそのまま流用できる。`EVOLUTION_OPTIONS_PACK2`に
  `millenniamon: ['zeedmillenniamon']`を追加するだけで`effectivePower`/`effectiveDD`が
  evoHistoryを見てパワー777777/DD7を返すよう分岐すれば完了(手札から単体召喚した場合は
  evoHistoryが空なので base power0/dd0のまま=仕様通り)
- **アバドモンコア**:①コスト減少(自分のダークエリアの【バグ】カード1枚につき1)は
  `isBugCard(id)`(ability文字列に「【バグ(」を含むかで判定する簡易ヘルパー、専用タグの
  後付けを回避)で実現。②【バグ(データエラー)】の効果変質(召喚時↔死亡時反転、ドロー↔
  手札破棄反転、バフ↔デバフ反転)はゲーム全体の召喚/ドロー/バフ処理を横断的に反転させる
  必要がありリスクが高いため今回も見送り
- **デクスモン**:【バグ(デクスリューション)】(全デジモン進化条件のX進化化)は
  `conditionMet`の冒頭バイパス(カオスデュークモンと同型)+`evolveCost`内で
  デクスモンが場にいれば持ち主の追放領域枚数を返すよう上書き、の2箇所で実現。
  【召喚時】追放領域からデジモン1体を場に出す効果も実装(コストは上記のグローバル
  ルールに統合済みのため単純に無料で出すだけでよい)
- **逆襲(スペル)**:発動条件フラグ`state[side].lostDigimonLastOppTurn`の自動セットが
  未配線だった(実質常に不発)のを配線。`triggerOnDestroy`で相手由来の破壊時にセットし、
  `beginTurn(side)`の冒頭で`state[oppOf(side)]`側のフラグをリセットする「2ターン窓」方式
  (自分が攻撃を受けたターンの**次の自分の1ターンだけ**発動できる、が正しく実装される)

### 既知のバグを発見・修正(このバッチ中に発覚)
- **メタルシードラモンのability文字列上書き順序ミス**:`CARDS.metalseadramon.ability
  = CARDS.metalseadramon.ability.replace('(pack2/未実装)', ...)`という書き方をしたが、
  それより前の行(既存の別のstale上書き)が既に別の文言(「相手への追加マナ課税は未実装」)に
  差し替え済みだったため置換対象の部分文字列が見つからず無視され続けていた。**`.replace()`で
  ability文字列を書き換える時は、その時点で実際に何が入っているかを確認してから
  パターンを書くこと(直書きの方が安全な場合も多い)**

## Group Bの続き:残存簡易実装カードの底上げ(2026-07-26第3弾)

Group B完了後、ユーザーから「つづきを」「再開」の指示を受け、残り29件のうち底上げ可能な
ものをさらに実装。29件→26件。
- **パラサイモン3のドロー時トリガー未配線を修正**:pack2版パラサイモンには既に
  `resolveParasimonDraw`(ドローされた時に公開・自分の場を全滅・相手デッキへ表向き編入)が
  実装済みだったが、`draw()`内の呼び出し条件が`card.id==='parasimon'`のみでpack3版
  (`parasimon3`)を見ていなかった単純な配線漏れ。`resolveParasimonDraw`を`CARDS.parasimon`
  決め打ちから`CARDS[card.id]`参照に一般化し、呼び出し条件に`|| card.id==='parasimon3'`を
  追加するだけで解決(【パンデミック】の全ウィルス相互感染は引き続き見送り)
- **ケラモン系統(ケラモン3/クリサリモン3/インフェルモン/ディアボロモン3)の
  【バグ(増殖)】に「毎ターンのドローフェイズで通常ドローの代わりにサーチできる」選択肢を
  追加**(ユーザー確認済み:既存の召喚時1回サーチに加えて両方実装)。`performTurnDraw`内に
  `performBugZoushokuDraw(side, sourceDigimon, allowDark)`を新設、場にこれらのカードが
  いれば通常ドローの代わりに発動。プレイヤーは①通常ドロー②サーチの2択ダイアログ、
  AIは候補があれば常にサーチ(このゲーム全体の「AIは有利な選択を自動で取る」方針を踏襲)。
  サーチ候補は既存の`ARMAGEMON_KERAMON_LINE_IDS`配列を再利用。インフェルモン/
  ディアボロモン3のみダークエリアからのサーチも許可(カードテキスト通り)
- **ティラノモン【シャウト】の対象を自動選択(相手の最高パワー1体固定)から
  `chooseSingleTarget`による実選択に変更**(プレイヤーは選べる、AIは自動判定)

## 未実装/簡易実装カードの総仕上げ(2026-07-26第4弾、26件→9件)

ユーザーから「残り全部追加して」の指示を受け、Group B完了後も残っていた26件をほぼ全て実装。
92件(セッション開始時)→47件→29件→26件→**9件**まで削減。

### 実装した主なもの
- **finalbattle/wargreymonx3①焼却**:finalbattleは`chooseOwnTarget`を両陣営分呼ぶだけで
  実プレイヤー選択に変更。wargreymonx3①は既存の`millToDark`キーワード+`hasEquipped`で解決
  (②身代わりは`destroyDigimon`呼び出し元~20箇所の非同期化が高リスクなため自動発動のまま維持)
- **metalgarurumonx3②**:`triggerHandDiscardEffects`の呼び出し箇所を`offerTradeoff`(hand型)/
  `opponentDiscardOne`/`openDiscardPicker`にも追加し、手札上限以外の主要な「捨てる」経路をカバー
- **diaboromonx3**:装備時(`equipDigicross`)+単体召喚時の両方で毒/腐敗/出血から1つ選ぶ
  ピッカーを新設。**CARDS.diaboromonx3はpack3データのため、この代入をCARDS_PACK3マージ
  (`Object.assign(CARDS, CARDS_PACK3)`)より前に書くとTypeErrorになる教訓を得た**
  (equipDigicross付近に関数定義、実際の`EFFECTS.diaboromonx3=`代入はマージ後の位置に分離)
- **onismon②③**:②は`raceEvolveMatches`/`jogressCandidateMatches`に`base.id==='onismon'`
  wildcardバイパスを追加(costMin/requireInfected等の資格条件は素通りさせない)。③は
  `!CARDS[c.id].evolveCondition`でデッキ内を絞り込むサーチピッカーを新設
- **ogudomon②**:封印カードがデジモンなら「公開するだけ」から「コスト無視で場に出す」に変更
- **jesmon②**:1ターンに1回の使用制限フラグを追加(showDigimonDetailのボタン表示条件+
  beginTurnリセット)
- **パラサイモン(pack2/pack3)【パンデミック】**:ディージャンモン①と全く同じ「双方向感染」
  ルールを、フィールド在籍ではなくダークエリア在籍で発動するよう`isVirusInfected`に追加。
  **この過程で、ディージャンモン①自身も実は`isVirusInfected`(G侵食の判定にしか使われない)
  にしか反映されておらず、実際の毒/猛毒/熱傷/出血ダメージトリガー(4箇所)は常に「相手の
  感染源のみ」を見る非双方向のままだった、という既存の潜在バグを発見・修正**
  (新設`virusAppliesTo(side, flag)`ヘルパーに統一)。状態異常の「重複」(スタック)は
  ダメージ計算全体の再設計が必要なため見送り
- **skullseadramon**:相手の裏マナが0枚ならスペル発動不可、というゲートで簡易実装
- **mugendramon2**:**このカードは`evolveOnly:true`なのにEVOLUTION_OPTIONS/raceEvolveの
  どちらにも登録が無く、実は一切到達不能だった**(発見・修正)。【ダークエリア進化】の
  フィールド版(`fieldExileEvolution`、`openFieldExileEvolutionPicker`/
  `exileFieldForEvolutionAndSummon`)を新設し、`evolveOnly`フラグ自体を削除して手札から
  直接特殊召喚できるようにした
- **fenrirgamon_takemikazuchi**:①手札減少トリガーは【追跡】と同じ「render()毎回
  ポーリング」方式(`checkHandSizeDecreases`)で実現。**さらに、コスト(12-X)・パワー
  (1000X)のX可変計算が`evolveCost`/`raceEvolveCost`/`effectivePower`のどこにも配線されて
  おらず、常に固定値cost12/power1000のままだったことも発見・修正**
- **koushiro_tentomon3**:デッキ上2枚を見て並び替えられるピッカーを新設(pop()する配列の
  末尾が「一番上」である点に注意)
- **igamon**:マナに置くカードをデッキの一番上固定ではなく、実際にデッキ全体から選べる
  ピッカーに変更
- **infermon/diaboromon3**:インフェルモンは召喚時専用だった「ケラモンをフィールドに出す」
  処理を攻撃時にも発動するよう共通関数化。ディアボロモン②(ケラモン1体を捨ててデジモン
  1体をデッキに戻す、ターン中1回)を新規実装(発動タイミングは攻撃時と推定、根拠となる
  実カードテキストが無いため要検証)
- **タケル&パタモン②【DD時】【治癒(1)】**:ユーザー確認により「治癒(N)=自分のダークエリアから
  N枚デッキに戻す(シャッフル)」と判明(HPではない)。**この調査中、同じ治癒キーワードを持つ
  patamon/ebidramon/parrotmon/piccolomon/leomon/holyangemonは全て既存の
  `returnOwnDarkToDeckUpTo`で正しく実装済みと判明**(誤って「未実装」を疑って調査したが
  実装は健在だった)。タケル&パタモンだけがこのヘルパーへの配線を欠いていたので追加した
- **アバドモン【バグ(処理落ち)】**:ユーザー確認により「他のカードの召喚時/進化時効果を
  ターン終了時まで遅延させる汎用エンジン」と判明。`triggerOnSummon`/`triggerOnEvolve`の
  `EFFECTS[id].onSummon/onEvolve`呼び出し部分だけを`abadmonDelayQueue`にキューイングし、
  `endTurn()`内の`processAbadmonDelayQueue()`で一括発動する仕組みを新設(アバドモン自身の
  召喚・pursuit登録・ネガーモンのフリーズ判定等、効果本体以外のロジックは対象外)

### 最終的に残った9件(いずれも意図的なトレードオフ、着手には要再確認)
andromon(視覚的な公開UI無し)/parasimon・parasimon3(状態異常の重複=ダメージ計算全体の
再設計が必要)/wargreymonx3②(destroyDigimon非同期化のリスク)/skullseadramon(支払い内訳
追跡の簡易化)/blackmetalgarurumon(進化専用効果を常時適用)/chaosdukemon・armagemon
(追加コストの固定値簡易化)/abadmoncore②(全カードの召喚/ドロー/バフ処理を反転させる
グローバルルール変更、リスク高)。CLAUDE.mdの記述が古くなっていないかは今後も実行時の
ability文字列で都度確認すること。

## 未実装/簡易実装カードの総仕上げ・第5弾(2026-07-26、9件→4件)

「続けて」の指示を受け、残り9件のうち3件をさらに実装。9件→**4件**。

- **ブラックメタルガルルモン【進化効果】**:`triggerHandDiscardEffects`に「進化で出ている
  (`evolvedIn`)ブラックメタルガルルモンが場にいれば、その捨て札をダークエリアの代わりに
  追放する」後処理を追加。①召喚時の強制捨て札も同じフックを経由させることで、進化版だけが
  自動的に追放にリダイレクトされ、手札からの通常召喚版はダークエリアのままになる
- **パラサイモン【パンデミック】②状態異常の重複**:`virusSourceCount(side, flag)`(場+
  pandemicダークエリア+アイズモンの合算)と`virusStackMultiplier(flag)`(パラサイモンが
  ダークエリアにいる時だけ両陣営の感染源合計数を倍率として返す、通常時は常に1倍)を新設。
  毒/猛毒/熱傷/出血の4箇所のダメージ量にこの倍率を掛けるだけで「複数の感染源があれば
  ダメージが重複する」を実現(ダメージ計算式自体の再設計は不要だった)
- **カオスデュークモン(進化時ダークエリア追放コスト)**:`card.darkExileEvolveCost=
  {amount:10}`を新設。ベリアルヴァンデモンの蘇生ピッカーと同じ「合計コストがぴったり
  一致すると決定ボタンが有効化される」UIを追放版として流用(`openDarkExileCostPicker`)。
  `tryEvolveFromHandCard`を`commitRaceEvolveFromHandCard`に分離し、追加コストの選択が
  終わってから通常の種族進化フローに合流する構造にした。AI側は`findDarkSubsetSummingTo`
  (小規模なダークエリア前提のDPによる部分和探索)で組み合わせを自動発見する
- **アーマゲモン①の再検証**:実際には「ケラモン系統カードを**全て**デッキに戻す」という
  無条件・非選択式の効果であり、既存の自動処理実装がそのまま原文に忠実だったと判明
  (「簡易実装」の注記だけが古かった、実装自体に変更は無し)

### 残り4件(いずれもアーキテクチャ上の理由で保留、着手には要再確認)
andromon(視覚的な公開UI無し、効果自体は完全動作)/wargreymonx3②(destroyDigimon呼び出し元
~20箇所の非同期化が必要)/skullseadramon(支払い内訳追跡が未実装)/abadmoncore②
(召喚/ドロー/バフ処理を全カード横断で反転させるグローバルルール変更、リスク高)。

## 未実装/簡易実装カードの総仕上げ・第6弾(2026-07-26、4件→3件)

「つづけて」の指示を受け、残り4件のうち2件をさらに実装。4件→**3件**。

- **ウォーグレイモンX抗体②【身代わり】**:「してもよい」の任意選択を、都度の確認
  ダイアログではなく**事前トグル方式**で実現(destroyDigimonの呼び出し元~20箇所を
  非同期化するリスクを避けつつ、プレイヤーに実際の選択権を持たせる妥協案)。
  `showDigimonDetail`に「【身代わり】を有効/無効にする」ボタンを追加、
  `d.wargreymonx3SubOff`フラグ(既定false=有効)で`destroyDigimon`側の身代わり判定に反映
- **スカルシードラモン**:支払いに実際に使われるマナ集合(手動選択が予約枚数と一致していれば
  その選択、そうでなければ自動払いの未タップ先頭N枚)を`wouldPaymentIncludeFacedown(side,
  amount)`で先読みし、その中に裏マナが含まれるかを正確に判定するよう精緻化(以前は
  「裏マナを1枚も持っていなければ発動不可」という粗いゲートだった)

### 残り3件(いずれもアーキテクチャ上の理由で保留)
andromon(視覚的な公開UI無し、コスト計算関数が表示専用でも頻繁に呼ばれるため迂闊に演出を
挟むと過剰発火するリスクがあり見送り)/wargreymonx3②(上記の通りトグル方式で対応済みだが、
真の「都度確認」ではない点は簡易実装のまま)/abadmoncore②(全カードの召喚/ドロー/バフ
処理を反転させるグローバルルール変更、ゲーム全体のシステムを横断するため最もリスクが高い)。

## 未実装/簡易実装カードの総仕上げ・第7弾(2026-07-26、3件→3件、うち1件を大幅深化)

「つづけて」の指示を受け、アバドモンコア②【バグ(データエラー)】を部分実装。件数としては
3件のままだが、内容としては③(パワーアップ↔パワーダウン反転)以外の①②が新たに動作するようになった。

- **①召喚時効果→死亡時発動への変換**:`triggerOnSummon`のEFFECTS呼び出し部分に、アバドモン
  【バグ(処理落ち)】と同じ位置に分岐追加。`digimon.__abadmoncoreDeferredOnSummon=true`を
  立てて即時発動をスキップし、`triggerOnDestroy`側でこのフラグを見て、死亡した瞬間に
  召喚時効果を発動する(アバドモンの「ターン終了時に遅延」と発想は同じ、発動タイミングが
  「死亡時」に変わるだけ)
- **②ドロー効果→手札を捨てる効果への変換**:`draw(side, cb)`関数自身に、ヤタガラモン②の
  `!state.inDrawPhase`判定のすぐ下へ追加。**通常のドローフェイズ中のドロー
  (`state.inDrawPhase===true`)は一切変換されず、カード効果由来のドロー呼び出しだけが
  手札1枚をランダムに捨てる効果に変換される**(この区別を誤ると通常ドローまで破壊される
  致命的なバグになるため、`state.inDrawPhase`の判定を最優先で確認してから実装した)
- **③パワーアップ↔パワーダウン反転は見送り**:このゲームには「バフを一箇所で適用する」
  集中管理関数が存在せず、`d.tempBuff += X`という直書きがコードベース全体の50箇所以上に
  散らばっている。安全に反転させる仕組みが無いため、今回も実装を見送った

### 最終的に残った3件(いずれもアーキテクチャ上の理由で保留)
andromon(視覚的な公開UI無し、効果自体は完全動作)/wargreymonx3②(真の「都度確認」では
なくトグル方式で対応済み)/abadmoncore③(パワーバフの集中管理箇所が無い)。

## アバドモンコア③実装・パワーバフ集中管理関数の新設(2026-07-26)

前バッチで「バフを一箇所で適用する集中管理関数が無く、d.tempBuff+=Xの直書きが
50箇所以上に散らばっている」という理由で見送っていたが、ユーザーから「テキスト通りの
効果で着手」と明示指示を受け、実際にgrepし直したところ**該当箇所は17箇所のみ**だったと判明
(以前の「50箇所以上」という見積もりは、ターン終了時リセット・初期化(`tempBuff:0`)・
既存デバフ(`-N`)まで含めた`tempBuff`全出現数を数えていたための過大評価だった)。
- **`grantPowerBuff(digimon, amount)`を新規実装**(`applyAttackBuff`の直前に配置):
  `anyAbadmoncorePresent()`(場のどちらかにアバドモンコアがいるか)がtrueかつ`amount>0`
  なら`digimon.tempBuff -= amount`、そうでなければ通常通り`+= amount`。カード効果側の
  「パワーを上げる」呼び出し17箇所を全てこの関数経由に置き換えて対応完了(ITEMS2種/
  EFFECTS onSummon1件/scorpiomon.onAttack/SPELL_EFFECTS2種/エンシェントグレイモン系
  オーバーヒートのoneShotAbility4件/ankylomon進化効果/インパルス系5件)。**既存のデバフ
  表現(`-N`、ベモン等)やターン終了時リセット・初期化処理はそのまま変更していない**
  (`grantPowerBuff`はあくまで「パワーを上げる」呼び出しの置き換え専用)
- Playwrightで、アバドモンコア不在時は通常通りバフが乗ること/自陣・敵陣どちらにいても
  反転すること/実カード(スコルピオモン・フレイモン系オーバーヒート)経由でも正しく
  反転すること/既存デバフが誤って再反転しないことを個別に確認、コンソールエラー0件。
  全27本の既存回帰テストも再実行しゼロエラーを確認済み
- これで**アバドモンコアは①②③全て実装完了**。残る保留2件はandromon(視覚的な公開UIのみ
  未実装、効果自体は完全動作)とwargreymonx3②(トグル方式、真の都度確認ではない)のみ

## コスメティック大量追加・第4弾(pack4)新規実装・バグ修正6件(2026-07-26)

ユーザーから「アバドモンコア完了後、画像類を大量追加してpack4を実装、その後いくつかの
バグ修正」という一括依頼を受け、全て完了した。

### コスメティック追加
- **コイン49種追加**(image/coins/coin_map.csvに新規49行→process_coins.ps1再実行→
  COSMETIC_COINSに追記、計140種)。ソース画像はほぼ実在デジモン名のファイル名を信頼、
  ファイル名だけでは判別できない一部(boutmon/canoweissmon等18種)はReadツールで画像を
  直接確認してから命名した。**ストーリーの敵立ち絵報酬はCOSMETIC_COINSから自動抽選される
  既存の仕組みのため、コイン追加だけで敵立ち絵プールも自動的に増える**(ユーザーの
  「コインの画像を立ち絵とコインの両方に追加して」という指示は、この既存連携を指していた
  と解釈し、別途立ち絵専用の処理は不要と判断)
- **アイコン20種追加**(image/icon/icon_map.csvに追記、うち11種はimage/dot内のドット絵
  素材を`..\dot\`相対パスで流用。ユーザー指示「dotの画像もアイコンとして使って」に対応)。
  ambiguousな汎用ファイル名(dada.jfif/dddd等)は識別不能なため除外(既存の「透かし入り
  画像は除外する」慣習を踏襲)
- **スリーブ11種・プレイマット18種追加**:.jfifファイルはReadツールで直接レンダリングされず
  raw JFIFバイナリがテキスト表示されてしまう(拡張子で判定される模様)ため、**.jpgに
  リネームコピーしてから読む**という回避策で対応(以後も.jfif画像を視認する必要がある時は
  この手を使うこと)。ウォーターマーク入り("not for print"等)の1枚は除外
- **第4弾/第5弾のパック絵柄**:image/buster/buster4.png・buster5.pngを使いPACK_SETSに
  bt04/bt05を追加。bt05はカード未実装のためpoolForPack/limitedPoolForPackは既存の
  「専用プールが無い弾は全パック合算」フォールバックに任せている(bt03が専用プール追加前に
  辿っていたのと同じ暫定挙動)

### 第4弾(pack4、86枚のシートから100種)
`C:\Users\user\Desktop\pack4.zip`(展開済み、54枚のシート画像×2カード=108枠、うち
sheets31-34はsheets26-29の重複スキャンと判明・実質100種)から新規実装。**過去のpack2/3と
異なり、本当に新しいゲームエンジンが複数必要な弾だった**:
- **デジコード(新カードタイプ)**:`state.digicode`という「お互いの場に合計1枚だけ」の
  共有ゾーン(どちらの所有物でもない専用スロット、`{...card, owner:side}`)。2枚目が
  発動されると1枚目は`discardDigicode()`で破棄され、全デジモンの`installedPrograms`も
  連鎖破棄される(各エントリの`revert()`を呼ぶだけで巻き戻せる設計)。
  **【インストール】**:`card.installOptions=[{label,cost,apply(d),revert(d),onAttack?}]`を
  払って場の任意のデジモン(自分・相手どちらでも)に永続効果を付与。`openInstallPicker`/
  `installProgramOnto`が本体、`effectivePower`/`effectiveDD`に`installedAttackerBonus`/
  `installedPowerBonus`/`installedDdBonus`の集計を追加、`isSpellImmune`に
  `installedSpellImmune`を追加。全DigiCode20種のうち代表4種(イニシャル/フライング/
  ブルー/ホーリー.sys)だけ個別インストール効果を実装、残りは簡易実装(効果は空配列)と
  明記
- **スターコア(N)/ビックバン**:`digimon.starCores`配列(マナをその場に積む、rideStack/
  inheritStackと同じ「破壊時に中身を展開する」パターンをdestroyDigimonに追加)。
  【スターノヴァ】はコア1枚を捨てて繰り返し発動できる小効果(showDigimonDetailの
  ボタン、AIは`aiTryStarNova()`で攻撃フェイズ前に使い切る)。【ビックバン】(レジェンド
  2種のみ)は貯めた全コアを一括消費する大効果
- **ブルーム(N)**:マナ総量がカード固有のNを満たせば、そのマナ自身を場に出せる
  (`tryBloomAction`、既存のロゼモン等の「マナから踏み倒し召喚」処理を一般化)。
  **簡易実装:【マナ進化時】(既存デジモンへの上書き進化)は見送り、常に新規召喚のみ**
- **マナビート(N)**:マナゾーンにあるカード自身+他N枚をタップして効果発動
  (`tryManaBeatAction`、対象4種のみ、プレイヤー操作は自動選択でUI簡略化)
- **共鳴(デジコード)**:`hasDigicodeOnField()`一つで判定、既存の`effectivePower`/
  `effectiveDD`/`hasThrough`/`hasRengeki`にid直書きの条件分岐を追加する形で実装(6種)
- **カウンター(N)/ハイカウンター/マッドカウンター**:`resolveCombatAgainstDefender`の
  冒頭に`EFFECTS[id].onCounter`フックを新設(被攻撃時、生死を問わず発動)
- **バディ**:種族(species)スロットの新しい値(色ではない)。`TYPE_ICON_MAP`/`TYPE_ICONS`に
  'buddy':'👥'を追加するだけで既存のタイプアイコン表示に自動対応
- **バグ(X)系統**:404(サーチ不可)/null(パワー変化なし)/スタック(複数攻撃不可)/
  同期エラー(進化時効果不発)/座標エラー(攻撃対象ランダム、プレイヤー操作のみ対応)/
  再起動(ターン終了時に手札全戻し+同枚数ドロー)をそれぞれ個別の軽量フラグ+フック点として実装
- **id衝突**:サーベルレオモン(既存の`saberleomon`はセイバーハックモンという別カードの
   idだったため`saberleomon4`に変更)以外は無し(事前grep確認により判明)
- Playwrightで全100カードのonSummon/onEvolve/onAttack/onManaSummon/onManaBeat/onStarNova/
  onBigBang/onCounter/installOptions/SPELL_EFFECTSを機械的に叩く一括スモークテストと、
  実際に10ターン分AIに対局させる統合テストの両方でゼロエラーを確認

### バグ修正6件
- **ギガシードラモンで無効化されたカードもコストは支払われるよう修正**:
  `checkCounterNegate`のfinishNegate内、`returnTo:'deck'`でのデッキ送り確定後に
  `counterCard.id==='gigaseadramon'`の場合だけ`payCostInteractive`でコストを追加徴収する
  (他の【スキャン】系カードは「無効化されたら何も失わず手札に残る」仕様のまま維持)
- **スタータープロトの収録カードをcollectionにも加算するよう変更**(2026-07-20に
  「ストーリーはゼロから始まる」ため意図的に外していたのをユーザー指示で再度加算するよう
  戻した。ストーリーの所持数ゼロ体験は今後失われる点は把握の上での変更)
- **favicon追加**:`<link rel="icon">`が存在しなかったため`image/coins/coin1.png`を指定
- **カード詳細画面に進化ツリーの進化条件を表示**:①`showDigimonDetail`に「進化先候補」の
  一覧(次の進化先名+条件)を新設②進化ツリー図(`buildEvoTreeColumn`)の条件バッジが
  `evolveCondition`しか見ておらず、raceEvolveのみで進化するカードは常に空白だったのを
  `treeCondShortLabel`で補完(このバグの方が実は主要な不具合だった)
- **タイプアイコンの横に排出パックのアイコンを追加**:`CARD_PACK_LOOKUP`(id→'bt01'〜'bt04'の
  逆引き表、各`CARDS_PACKn`のObject.keysから構築)+`packIconHtml(id)`をcardInnerHtml/
  evoNodeHtmlの`typeIconsHtml`呼び出し直後に追加。CSSは`.cd-type-icons`と同じ`left:-9px`の
  列の右隣(`left:14px`程度)に小さく重ねるだけ
- **ダークエリアから蘇生・回収したデジモンが攻撃できないバグ**:既存の修正
  (destroyDigimon側で`attackedThisTurn`をリセット済み、2026-07-24)はあったが、
  **手札から通常召喚する経路(`playFromHandNormalContinue`等、summon系スプレッド
  ~10箇所)には同じリセットが無く、何らかの経路でattackedThisTurn:trueが混入した
  手札カードを再召喚すると同じバグが再現し得た**。該当する全ての「フィールドに新規配置する」
  スプレッド箇所に`attackedThisTurn:false`を横展開して防御的に修正(存在するどの経路が
  実際の原因だったかは特定できていないが、これで全経路が塞がれた)

## pack4効果実装の完了・ブルームの全面刷新・デッキ編集の検索/パック順ソート(2026-07-26)

### ガブモン黒の進化ツリーバグ修正
`garurumon3`(ガブモン黒の進化先)の`color`が`'blue'`のままだったデータ入力ミスを修正
(`'black'`へ)。下流の`weregarurumon3`(`raceEvolve:{color:'black',...}`)と整合させる形で
発覚・修正。ガブモン黒→ガルルモン黒→ウェアガルルモン黒→ブラックメタルガルルモンの
チェーン全体が黒で統一される

### 【ブルーム】をユーザー確認済みの本来の仕様に全面刷新
以前の実装(「🌸ブルーム」ボタン→ピッカーで選ぶ→コスト無料でマナから召喚)は、
ユーザーへの確認の結果、**当初の理解が誤っていたことが判明**(コストを払わない/UIが
ボタン起点/マナ進化が存在しない、の3点とも異なる仕様だった)。正しい仕様に基づき
再構築:
- **UI**:ブルーム条件(マナ総量がカード固有のN以上)を満たすマナカードは、盤面の
  マナ行で光る(`.mana-card.bloom-eligible`、ピンクのパルス発光)。タップすると
  「①タップ(支払い予約)/②【ブルーム】場に出す」の2択ダイアログが出る(タップは
  従来通りの支払い予約、ブルームを選ぶと③へ)。**このカードを直接フィールドへ
  ドラッグすると自動でコストを支払って場に出る**(`startPointerDrag('bloom',...)`、
  既存の手札カードドラッグ〈`'summon'`型〉と同じ仕組みを新設)
- **コストは無料ではない**:カード自身の通常コストを、**自分以外の**未タップマナで
  支払う(`performBloomAction`が支払い前に対象カードをマナゾーンから取り除いてから
  `payCostInteractive`を呼ぶことで、自分自身が支払いに使われないようにしている)
- **【マナ進化時】(マナ進化)を新規実装**:ブルーム可能なマナカードを、そのカードの
  `raceEvolve`条件を満たす自分の場のデジモンへドラッグして重ねると、新規召喚の代わりに
  「そのデジモンへ進化」する(手札からの種族進化`commitRaceEvolveFromHandCard`と
  全く同じロジック、`raceEvolveMatches`を流用)。この時だけ`EFFECTS[id].onManaEvolve`が
  発動する(新規召喚時は`onManaSummon`のまま)。**raceEvolveを持たないカード
  (サーベルレオモン/トラロックモン)はマナ進化の対象になり得ない**(構造的に対象外、
  意図的な仕様)
- 対象6枚(グランザイルモン/セファーガモン/キウイモン/デラモン/ケレスモン/
  エルドラディモン)全てに`onManaEvolve`(②と同一処理を共有)を追加済み
- 旧`tryBloomAction`/`#bloomBtn`ボタンは完全に削除。AIは`aiTryBloomAction()`
  (進化元が見つかればマナ進化を優先、無ければ新規召喚)

### pack4カード効果の完全実装(実行時ability文字列で92件→2件まで削減)
静的grepでは「未実装/見送り」の文字列が61件ヒットしたが、**Playwrightでページを
ロードし`CARDS[id].ability`の実行時最終値を確認したところ、大半(51件)は既にEFFECTS/
SPELL_EFFECTS側で実装済みで、ability文字列の更新だけが漏れていた**(過去バッチで
繰り返し踏んだのと同じ「静的テキストは信用できない」パターン)。真に未実装だったのは
以下の10件のみで、全て今回実装完了:
- `infinity_sys`/`miracle_sys`/`flow_sys`:デジコードの`installOptions`が丸ごと
  欠落していたため新規追加。**`installOptions`の`cost`はデフォルト数値だが、
  インフィニティ.sys「Infinity.bin(デッキ残数)」用に`cost`を関数(`(side)=>N`)にも
  対応させた**(`optInstallCost(opt,side)`ヘルパー新設、`openInstallPicker`/
  `openInstallTargetPicker`の3箇所を経由するよう変更。パワー∞は999999で近似)。
  ミラクル.sysのguard.exeは`destroyDigimon`冒頭に新規フック
  (`target.installedGuardExe`、可能なら自動でマナ+手札1枚ずつ捨てて破壊回避)
- `firewall_sys`②/`unknown_sys`①【バックアップ】:`discardDigicode()`に分岐追加、
  この2枚だけデジコード入れ替わり時にダークエリアの代わりに持ち主の手札へ戻る
- `clockmon4`:自分自身に`installedPrograms`がある間、`effectivePower`/`effectiveDD`に
  id直書きの条件分岐で+3000/+1
- `tsukaimon4`:召喚時、現在のデジコードからコスト3以下のオプションを1つ自分自身へ
  無料インストール(簡易実装:対象は自分固定、複数候補は先頭を自動選択)
- `ponchomon4`:アーマー進化本体は既存の汎用エンジンで動作済みだったと判明(色マナ1/
  裏マナ2の追加コストは`card.armorEvolve.color`から既に汎用対応済み)。「マナから
  召喚・進化が起こる度マナチャージ」だけ`performBloomAction`のdoAction冒頭に追加
- `tlalocmon4`:①ブルームでの新規召喚は既存の汎用エンジンでそのまま動作(evolveOnly
  でもブルーム経路はevolveOnly判定を通らないため機能する)。②マナ進化時はジョグレス
  素材2体選択という別UIが必要でBloomの「ドラッグ単体進化」の枠組みでは表現できないため
  見送り(ability文字列に理由を明記)
- `manacharge_sys`①(コスト-1)は「デジコードは進化元にならないカードタイプのため」
  という過去セッションの判断のまま据え置き(未変更)
- 上記10件以外の51件は、ability文字列の`(pack4/未実装)`を`(pack4)`へ一括置換するだけで
  実態と一致した(`Edit`の`replace_all`で全置換、個別確認はEFFECTS/SPELL_EFFECTS存在
  チェック+Playwright機能テストの両方で実施済み)
- **今後「pack4のこのカードは未実装」と判断する前に、必ずPlaywrightで
  `CARDS[id].ability`の実行時値を確認すること(静的grepは信用しない)**。この確認用
  スクリプトは使い捨てず、`audit_pack4_remaining.js`のような形で毎回作り直せばよい

### デッキ編集:パック順ソート+フリーワード検索を追加
`#deckSortSelect`に`パック順`の選択肢を追加(`CARD_PACK_LOOKUP`を使い`poolCardIds()`/
`renderDeckEditor()`の「このデッキ」ソート両方に対応)。`#deckSearchInput`
(カード名部分一致)を新設、**フィルタは`renderDeckEditor()`のプール表示ループにのみ
適用し、`poolCardIds()`自体は絞り込まない**(`poolCardIds()`は「全てのカードを入れる」
ボタンや「おまかせ作成」からも呼ばれる論理的な全件プールのため、検索中に誤ってそちらまで
絞り込まれるのを避けるための意図的な分離)

## 作業の進め方について
- ユーザーはターミナル操作に不慣れなので、コマンドを実行する際は簡潔に何をしているか
  説明しながら進めること
- 機能追加・修正のたびに、区切りよく「今何をしたか」を分かりやすく報告すること
- ゲームバランスや新カードの追加方針など、こちらで判断がつかない・裏付けが無い変更は
  独断で進めず、先にユーザーに確認すること
