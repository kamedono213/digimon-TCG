/* ====================================================================
   firebase-online.js (2026-09-05新規追加)
   ------------------------------------------------------------------
   蟲神器プロジェクト(C:\Users\user\Desktop\musizingi\app)で実装済みの
   Firebase Realtime Database基盤(ルームコード対戦・ID引き継ぎ・トレード)を
   デジモンTCG用に移植したもの。

   このファイルは既存のゲームロジック(CARDS/state/召喚・進化・攻撃・スペル等の
   ハンドラ)には一切触れない。既存の「オンライン対戦」機能(index.html内の
   net*関数)が使っていた WebRTC 手動シグナリング(netCreateConnection/
   netSetupDataChannel等)の代わりに、この一連の関数がルームコード+Firebaseで
   同じ役割(netSend/netHandleMessageへメッセージを橋渡しする)を果たす。
   netStripCardArray/netRehydrateCardArray/netSendTurnState/netReceiveTurnState/
   netScheduleLiveBroadcast/netReceiveLiveState/netStartDeckSelect/
   netTryStartOnlineMatch/netFinishOnlineMatch は既存のまま一切変更しない
   (「手番終了時に盤面を丸ごと送る」という既存方式を維持する軽量移植のため)。

   蟲神器と同じ3系統のID:
   ①表示用デバイスID(fbDeviceId, localStorage)
   ②Firebase匿名認証uid(fbEnsureSignedIn、セキュリティルール上の本人確認)
   ③ユーザー自己申告のセーブID(fbSaveId、クラウドセーブの主キー。ランダムuidを
     主キーにすると全端末データ削除で復旧不能になるため、蟲神器と同じ設計)
   ==================================================================== */

/* ---------- Firebase初期化 ---------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCF4oTAO5U6b7hUlf5ojYxdvTYV9ura4AA",
  authDomain: "digimon-tcg-game.firebaseapp.com",
  databaseURL: "https://digimon-tcg-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "digimon-tcg-game",
  storageBucket: "digimon-tcg-game.firebasestorage.app",
  messagingSenderId: "332410968734",
  appId: "1:332410968734:web:a1ad86756ebdbec373798f"
};
let fbApp = null, fbAuth = null, fbDb = null;
function fbInit(){
  if(fbApp) return;
  if(typeof firebase==='undefined'){ console.error('Firebase SDKが読み込まれていません'); return; }
  fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  fbAuth = firebase.auth();
  fbDb = firebase.database();
}

/* ---------- 匿名認証(蟲神器のauthorize.ts ensureSignedIn相当) ----------
   リロード直後の競合で毎回別uidになる事故を避けるため authStateReady を待ち、
   多重呼び出しはsingle-flight化する(React StrictMode相当の二重実行対策は
   ここでは単純に同一Promiseを使い回すことで対応) */
let fbSignInPromise = null;
function fbEnsureSignedIn(){
  fbInit();
  if(fbAuth.currentUser) return Promise.resolve(fbAuth.currentUser);
  if(fbSignInPromise) return fbSignInPromise;
  fbSignInPromise = new Promise((resolve, reject)=>{
    const unsub = fbAuth.onAuthStateChanged(user=>{
      if(user){ unsub(); resolve(user); }
    }, reject);
    fbAuth.signInAnonymously().catch(err=>{
      /* onAuthStateChangedが既存ユーザーで先に発火していれば無視してよい失敗もあるため
         ここではログのみ、実際の成否はonAuthStateChanged側で判定する */
      console.warn('signInAnonymously failed (may already be signed in)', err);
    });
  }).finally(()=>{ fbSignInPromise = null; });
  return fbSignInPromise;
}

/* ---------- 表示用デバイスID(蟲神器のdeviceId.ts相当) ---------- */
function fbGetDeviceId(){
  let id = localStorage.getItem('dtcg_device_id_v1');
  if(!id){
    id = 'device_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('dtcg_device_id_v1', id);
  }
  return id;
}
function fbGetDisplayName(){
  return localStorage.getItem('dtcg_display_name_v1') || 'テイマー';
}
function fbSetDisplayName(name){
  localStorage.setItem('dtcg_display_name_v1', (name||'テイマー').slice(0, 20));
}

/* ==================== ルームコード(蟲神器のroomCode.ts移植) ==================== */
/* 紛らわしい文字(0/O, 1/I/L)を除いた32種のアルファベットを使用 */
const FB_ROOM_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function fbGenerateRoomCode(length){
  length = length || 6;
  let out = '';
  for(let i=0;i<length;i++) out += FB_ROOM_CODE_CHARS[Math.floor(Math.random()*FB_ROOM_CODE_CHARS.length)];
  return out;
}
function fbNormalizeRoomCode(code){
  return String(code||'').toUpperCase().replace(/\s+/g,'');
}

/* ==================== ローカル対戦ルーム(蟲神器のroomService.ts+battleSync.ts
   +session.tsを、既存デジモンTCGの「手番終了時に盤面を丸ごと送る」方式向けに
   軽量移植したもの) ====================

   RTDB配置: rooms/{code} = {
     hostUid, guestUid, status:'WAITING'|'PLAYING'|'FINISHED'|'CLOSED', createdAt,
     players: { host:{uid,name,connected,lastSeen}, guest:{uid,name,connected,lastSeen} },
     state: { host:{payload,sentAt}, guest:{payload,sentAt} }
   }
   host/guestはそれぞれ自分側のstate.<seat>にしか書き込めない(firebase.rules.json)。
   既存のnetSend(msg)はこの<mySeat>側へmsgをJSON文字列化して書き込むだけに置き換え、
   相手側のstate.<otherSeat>をonValue購読してnetHandleMessage(msg)へ渡す。
   これにより既存のnetHandleMessage/netReceiveTurnState等は一切変更不要になる。

   RTDBは空配列を保存できない(消えてnullになる)ため、蟲神器と同じく
   payloadはJSON.stringifyした文字列として保存する(node内は{payload,sentAt}のみ)。 */
let fbRoomCode = null;
let fbRoomSeat = null; // 'host' | 'guest'
let fbRoomMyUid = null;
let fbRoomRef = null;
let fbRoomStateUnsub = null;
let fbRoomMetaUnsub = null;
let fbRoomOnPeerConnectedChange = null; // UI通知用コールバック(接続/切断/参加を伝える)
let fbRoomOnMessageReceived = null; // 相手からの1メッセージを受け取るコールバック(= netHandleMessage)

const FB_ROOM_SESSION_KEY = 'dtcg_online_session_v1';
const FB_ROOM_RESUME_WINDOW_MS = 10*60*1000; // 蟲神器と同じ10分以内なら再接続対象

function fbSaveRoomSession(){
  if(!fbRoomCode || !fbRoomSeat) return;
  localStorage.setItem(FB_ROOM_SESSION_KEY, JSON.stringify({
    roomCode: fbRoomCode, seat: fbRoomSeat, uid: fbRoomMyUid, updatedAt: Date.now()
  }));
}
function fbClearRoomSession(){
  localStorage.removeItem(FB_ROOM_SESSION_KEY);
}
function fbLoadResumableRoomSession(){
  let raw;
  try{ raw = JSON.parse(localStorage.getItem(FB_ROOM_SESSION_KEY)||'null'); }catch(e){ return null; }
  if(!raw || !raw.roomCode || !raw.seat) return null;
  if(Date.now() - (raw.updatedAt||0) > FB_ROOM_RESUME_WINDOW_MS) return null;
  return raw;
}

/* ホスト:ルーム作成(コード衝突なら再生成、最大8回) */
async function fbCreateRoom(){
  await fbEnsureSignedIn();
  fbRoomMyUid = fbAuth.currentUser.uid;
  for(let attempt=0; attempt<8; attempt++){
    const code = fbGenerateRoomCode(6);
    const ref = fbDb.ref('rooms/'+code);
    const snap = await ref.get();
    if(snap.exists()) continue;
    const now = Date.now();
    try{
      await ref.set({
        hostUid: fbRoomMyUid,
        guestUid: null,
        status: 'WAITING',
        createdAt: now,
        players: { host: { uid: fbRoomMyUid, name: fbGetDisplayName(), connected: true, lastSeen: now } }
      });
    }catch(e){
      continue; // 衝突(同時作成)時はルールで弾かれるので次のコードへ
    }
    fbRoomCode = code; fbRoomSeat = 'host'; fbRoomRef = ref;
    ref.child('players/host/connected').onDisconnect().set(false);
    fbSaveRoomSession();
    return code;
  }
  throw new Error('ルームコードの生成に失敗しました(再試行してください)');
}

/* ゲスト:ルーム参加(存在確認→満室確認→開始済み確認→guestUidをCAS的に書込み) */
async function fbJoinRoom(codeInput){
  await fbEnsureSignedIn();
  fbRoomMyUid = fbAuth.currentUser.uid;
  const code = fbNormalizeRoomCode(codeInput);
  const ref = fbDb.ref('rooms/'+code);
  const snap = await ref.get();
  if(!snap.exists()) throw new Error('そのルームコードは見つかりませんでした');
  const room = snap.val();
  if(room.status!=='WAITING' && room.guestUid!==fbRoomMyUid) throw new Error('このルームはすでに対戦中か終了しています');
  if(room.guestUid && room.guestUid!==fbRoomMyUid) throw new Error('このルームは満室です');
  const now = Date.now();
  try{
    await ref.child('guestUid').set(fbRoomMyUid);
    await ref.child('players/guest').set({ uid: fbRoomMyUid, name: fbGetDisplayName(), connected: true, lastSeen: now });
  }catch(e){
    throw new Error('参加に失敗しました(タイミングが重なった可能性があります。もう一度お試しください)');
  }
  fbRoomCode = code; fbRoomSeat = 'guest'; fbRoomRef = ref;
  ref.child('players/guest/connected').onDisconnect().set(false);
  fbSaveRoomSession();
  return code;
}

/* 相手からのメッセージ購読を開始する(自分の書き込みは自分のnodeにしか行かないため、
   相手のnodeだけを見ればよい=自分の送信を自分で処理してしまう心配が無い設計) */
function fbSubscribeRoomMessages(onMessage){
  fbRoomOnMessageReceived = onMessage;
  const otherSeat = fbRoomSeat==='host' ? 'guest' : 'host';
  const ref = fbRoomRef.child('state/'+otherSeat);
  let lastSentAt = 0;
  const handler = ref.on('value', snap=>{
    const v = snap.val();
    if(!v || !v.payload) return;
    if(v.sentAt && v.sentAt<=lastSentAt) return; // 古い/重複更新の取りこぼし対策
    lastSentAt = v.sentAt||Date.now();
    let msg;
    try{ msg = JSON.parse(v.payload); }catch(e){ return; }
    if(fbRoomOnMessageReceived) fbRoomOnMessageReceived(msg);
  });
  fbRoomStateUnsub = ()=> ref.off('value', handler);
}

/* 自分側のnodeへメッセージを送る(既存のnetSend(msg)から呼ばれる想定) */
function fbSendRoomMessage(msg){
  if(!fbRoomRef || !fbRoomSeat) return;
  fbRoomRef.child('state/'+fbRoomSeat).set({ payload: JSON.stringify(msg), sentAt: Date.now() });
}

/* 相手の接続状態(players/<seat>/connected)を監視し、参加/切断をUIへ通知する */
function fbSubscribeRoomPresence(onChange){
  fbRoomOnPeerConnectedChange = onChange;
  const otherSeat = fbRoomSeat==='host' ? 'guest' : 'host';
  const ref = fbRoomRef.child('players/'+otherSeat);
  const handler = ref.on('value', snap=>{
    if(fbRoomOnPeerConnectedChange) fbRoomOnPeerConnectedChange(snap.val());
  });
  fbRoomMetaUnsub = ()=> ref.off('value', handler);
}

/* 再接続:localStorageの直近セッションを使ってルームに戻り、相手の最新盤面
   (state/<otherSeat>)を一度読み直してから購読を張り直す(=盤面復元)。
   呼び出し側(index.html側の新設UI)がnetHandleMessageへ渡して盤面を復元する */
async function fbResumeRoomSession(){
  const session = fbLoadResumableRoomSession();
  if(!session) return null;
  await fbEnsureSignedIn();
  if(fbAuth.currentUser.uid!==session.uid) return null; // 別デバイス/別匿名uidでは復元しない
  const ref = fbDb.ref('rooms/'+session.roomCode);
  const snap = await ref.get();
  if(!snap.exists()) { fbClearRoomSession(); return null; }
  const room = snap.val();
  if(room.status==='CLOSED' || room.status==='FINISHED'){ fbClearRoomSession(); return null; }
  fbRoomCode = session.roomCode; fbRoomSeat = session.seat; fbRoomMyUid = session.uid; fbRoomRef = ref;
  ref.child('players/'+session.seat+'/connected').onDisconnect().set(false);
  ref.child('players/'+session.seat+'/connected').set(true);
  fbSaveRoomSession();
  const otherSeat = session.seat==='host' ? 'guest' : 'host';
  const otherState = room.state && room.state[otherSeat];
  let lastMessage = null;
  if(otherState && otherState.payload){
    try{ lastMessage = JSON.parse(otherState.payload); }catch(e){}
  }
  return { room, lastMessage };
}

/* ==================== IDによるデータ引き継ぎ(蟲神器のpersistence.ts+
   cloudSave.tsを移植。既存のSAVE_DATA_KEYS/saveJSON(index.html既存定義)を
   そのまま使い、クラウド保存の形式だけ追加する。既存のexportSaveData/
   importSaveData(ファイル書き出し)とは独立した別経路であり、互いに干渉しない) ====================

   RTDB配置: saves/{saveId}/current = { ...SAVE_DATA_KEYSの中身, saveVersion, updatedAt, deviceId, saveId }
             saves/{saveId}/backup/{1..3} = 直近3世代のバックアップ(10分間隔でのみローテ)
             saves/{saveId}/backupMeta = { lastRotatedAt }

   saveIdはユーザー自身が入力する記憶可能な文字列(ランダムuidを主キーにしない理由は
   蟲神器と同じ:全端末データ削除で復旧不能になるのを避けるため)。 */
function fbNormalizeSaveId(raw){
  const s = String(raw||'').trim();
  if(!s || s.length>32) return null;
  if(/[.#$/\[\]]/.test(s)) return null; // RTDBキーに使えない文字
  return s;
}

function fbReadLocalSaveSnapshot(){
  const data = {};
  SAVE_DATA_KEYS.forEach(key=>{
    const raw = localStorage.getItem(key);
    if(raw!==null){ try{ data[key] = JSON.parse(raw); }catch(e){} }
  });
  data.saveVersion = parseInt(localStorage.getItem('dtcg_save_version_v1')||'0', 10);
  data.updatedAt = parseInt(localStorage.getItem('dtcg_save_updated_at_v1')||'0', 10);
  data.deviceId = fbGetDeviceId();
  return data;
}
async function fbWriteLocalSaveSnapshot(data){
  for(const key of SAVE_DATA_KEYS){
    if(Object.prototype.hasOwnProperty.call(data, key)) await saveJSON(key, data[key]);
  }
  localStorage.setItem('dtcg_save_version_v1', String(data.saveVersion||0));
  localStorage.setItem('dtcg_save_updated_at_v1', String(data.updatedAt||Date.now()));
}

/* 蟲神器のresolveBootSave()移植:「ローカルが空=新規」と断定しない、
   古い方が新しい方を上書きしない、を保証する純粋関数。5パターン判定 */
function fbResolveBootSave(local, cloud){
  const localHas = !!local && SAVE_DATA_KEYS.some(k=> Object.prototype.hasOwnProperty.call(local,k));
  const cloudHas = !!cloud && SAVE_DATA_KEYS.some(k=> Object.prototype.hasOwnProperty.call(cloud,k));
  if(!localHas && !cloudHas) return { action:'fresh' };
  if(localHas && !cloudHas) return { action:'migrate-local-to-cloud', use: local };
  if(!localHas && cloudHas) return { action:'restore-from-cloud', use: cloud };
  const lv = local.saveVersion||0, cv = cloud.saveVersion||0;
  if(lv>cv) return { action:'local-newer', use: local };
  if(cv>lv) return { action:'cloud-newer', use: cloud };
  return (local.updatedAt||0) >= (cloud.updatedAt||0)
    ? { action:'local-newer', use: local }
    : { action:'cloud-newer', use: cloud };
}

async function fbFetchCloudSave(saveId){
  await fbEnsureSignedIn();
  const snap = await fbDb.ref('saves/'+saveId+'/current').get();
  return snap.exists() ? snap.val() : null;
}

/* バックアップは直近3世代、10分間隔でしかローテしない(連続セーブで世代を使い切らない、蟲神器と同じ方針) */
async function fbWriteCloudSave(saveId, data){
  await fbEnsureSignedIn();
  const ref = fbDb.ref('saves/'+saveId);
  const metaSnap = await ref.child('backupMeta').get();
  const meta = metaSnap.exists() ? metaSnap.val() : { lastRotatedAt:0, nextSlot:1 };
  const now = Date.now();
  const updates = {};
  if(now - (meta.lastRotatedAt||0) > 10*60*1000){
    const currentSnap = await ref.child('current').get();
    if(currentSnap.exists()){
      const slot = meta.nextSlot || 1;
      updates['backup/'+slot] = currentSnap.val();
      updates['backupMeta'] = { lastRotatedAt: now, nextSlot: (slot%3)+1 };
    }
  }
  updates['current'] = { ...data, saveId, updatedAt: now };
  await ref.update(updates);
  return updates['current'];
}

/* 新端末でのID入力→復元、または現端末のセーブを初めてIDに紐付ける、の入口。
   呼び出し側UI(index.html側の新設画面)がstep単位でこの関数群を呼ぶ想定 */
async function fbBootWithSaveId(saveId){
  const normalized = fbNormalizeSaveId(saveId);
  if(!normalized) throw new Error('IDは32文字以内、記号( . # $ / [ ] )を含まない文字列にしてください');
  const local = fbReadLocalSaveSnapshot();
  const cloud = await fbFetchCloudSave(normalized);
  const decision = fbResolveBootSave(local, cloud);
  if(decision.action==='cloud-newer' || decision.action==='restore-from-cloud'){
    await fbWriteLocalSaveSnapshot(decision.use);
  } else if(decision.action==='local-newer' || decision.action==='migrate-local-to-cloud'){
    await fbWriteCloudSave(normalized, decision.use);
  }
  localStorage.setItem('dtcg_save_id_v1', normalized);
  return decision;
}
function fbGetLinkedSaveId(){ return localStorage.getItem('dtcg_save_id_v1') || null; }
/* IDを切替える(マーカーだけ消す、蟲神器と同じくセーブ本体はローカルに残す=
   切替後もその時点の進行を新IDの初期値として使える) */
function fbUnlinkSaveId(){ localStorage.removeItem('dtcg_save_id_v1'); }

/* 現在のIDに紐付いたクラウドへ今のローカル状態を保存する(進行のたびに呼ぶ用) */
async function fbSyncCurrentSaveToCloud(){
  const saveId = fbGetLinkedSaveId();
  if(!saveId) return;
  const local = fbReadLocalSaveSnapshot();
  local.saveVersion = (local.saveVersion||0) + 1;
  local.updatedAt = Date.now();
  localStorage.setItem('dtcg_save_version_v1', String(local.saveVersion));
  localStorage.setItem('dtcg_save_updated_at_v1', String(local.updatedAt));
  await fbWriteCloudSave(saveId, local);
}

/* ==================== トレード(蟲神器のtradeRoomService.ts+tradeSession.ts+
   engine/tradeLogic.tsを移植)====================
   対戦ルーム(rooms/)とは完全に別ツリー(tradeRooms/)。カードは既存の
   collection({cardId:枚数})をそのまま使う(蟲神器のtradeLogic.tsが要求する
   「所持数」の形が最初から一致しているため、判定ロジックはほぼそのまま移植できる)。

   userCollections/{uid} は「ローカルのcollectionのクラウドミラー」であり、
   ローカルlocalStorageが唯一の正(蟲神器と同じ方針)。トレードの検証・実行の
   ためだけに存在する。

   RTDB配置:
     tradeRooms/{code} = { hostUid, guestUid, status, createdAt,
       players:{ host:{uid,name,connected,lastSeen,offer:[a,b,c],accepted,finalConfirmed},
                 guest:{...} },
       executingBy, executedTradeId, cancelReason }
     userCollections/{uid}/{cardId} = 枚数(0以上、ルールで強制)
     activeTradePartner/{uid} = 相手uid(トレード成立処理中だけ設定される一時的な書込み許可) */

const FB_TRADE_SESSION_KEY = 'dtcg_trade_session_v1';

/* ---- 純粋関数(engine/tradeLogic.ts相当、Firebase等I/Oを一切持たない) ---- */
function fbOfferCardCounts(offer){
  const counts = {};
  (offer||[]).forEach(id=>{ if(id) counts[id] = (counts[id]||0)+1; });
  return counts;
}
function fbIsOfferValidShape(offer){
  return Array.isArray(offer) && offer.length===3 && offer.every(x=> x==='' || typeof x==='string');
}
function fbHasSufficientCards(collectionCounts, offer){
  const need = fbOfferCardCounts(offer);
  return Object.keys(need).every(id=> (collectionCounts[id]||0) >= need[id]);
}
/* host/guest双方のdelta計算(自分のオファーを渡し、相手のオファーを受け取る) */
function fbComputeTradeExecutionPlan(hostOffer, guestOffer){
  const hostGives = fbOfferCardCounts(hostOffer), guestGives = fbOfferCardCounts(guestOffer);
  return {
    hostDelta: fbMergeDelta(fbNegate(hostGives), guestGives),
    guestDelta: fbMergeDelta(fbNegate(guestGives), hostGives)
  };
}
function fbNegate(counts){ const o={}; for(const k in counts) o[k]=-counts[k]; return o; }
function fbMergeDelta(a,b){ const o={...a}; for(const k in b) o[k]=(o[k]||0)+b[k]; return o; }
/* 成立直前の最終検証:形状+実在カードID+所持数(CARDSは既存のカード定義、変更しない) */
function fbValidateTradeBeforeExecution(hostOffer, guestOffer, hostCollection, guestCollection){
  if(!fbIsOfferValidShape(hostOffer) || !fbIsOfferValidShape(guestOffer)) return { ok:false, reason:'形式が不正です' };
  const allIds = [...new Set([...hostOffer, ...guestOffer].filter(Boolean))];
  if(allIds.some(id=> !CARDS[id])) return { ok:false, reason:'存在しないカードが含まれています' };
  if(!fbHasSufficientCards(hostCollection, hostOffer)) return { ok:false, reason:'ホストの所持数が不足しています' };
  if(!fbHasSufficientCards(guestCollection, guestOffer)) return { ok:false, reason:'ゲストの所持数が不足しています' };
  return { ok:true };
}

/* ---- ローカルcollectionをクラウドへミラーする(トレード画面表示前に必ず呼ぶ) ---- */
async function fbSyncCollectionMirror(){
  await fbEnsureSignedIn();
  const uid = fbAuth.currentUser.uid;
  await fbDb.ref('userCollections/'+uid).set(collection || {});
}
async function fbFetchCollectionMirror(uid){
  const snap = await fbDb.ref('userCollections/'+uid).get();
  return snap.exists() ? snap.val() : {};
}

/* ---- ルーム作成/参加(対戦ルームと同じコード生成ロジックを流用) ---- */
let fbTradeCode = null, fbTradeSeat = null, fbTradeMyUid = null, fbTradeRef = null;
let fbTradeUnsub = null;

function fbSaveTradeSession(){
  if(!fbTradeCode || !fbTradeSeat) return;
  localStorage.setItem(FB_TRADE_SESSION_KEY, JSON.stringify({ roomCode: fbTradeCode, seat: fbTradeSeat, uid: fbTradeMyUid, updatedAt: Date.now() }));
}
function fbClearTradeSession(){ localStorage.removeItem(FB_TRADE_SESSION_KEY); }
function fbLoadResumableTradeSession(){
  let raw;
  try{ raw = JSON.parse(localStorage.getItem(FB_TRADE_SESSION_KEY)||'null'); }catch(e){ return null; }
  if(!raw || !raw.roomCode || !raw.seat) return null;
  if(Date.now()-(raw.updatedAt||0) > FB_ROOM_RESUME_WINDOW_MS) return null;
  return raw;
}

async function fbCreateTradeRoom(){
  await fbEnsureSignedIn();
  await fbSyncCollectionMirror();
  fbTradeMyUid = fbAuth.currentUser.uid;
  for(let attempt=0; attempt<8; attempt++){
    const code = fbGenerateRoomCode(6);
    const ref = fbDb.ref('tradeRooms/'+code);
    const snap = await ref.get();
    if(snap.exists()) continue;
    const now = Date.now();
    const emptyOffer = ['','',''];
    try{
      await ref.set({
        hostUid: fbTradeMyUid, guestUid: null, status:'WAITING', createdAt: now,
        players: { host: { uid: fbTradeMyUid, name: fbGetDisplayName(), connected:true, lastSeen:now, offer: emptyOffer, accepted:false, finalConfirmed:false } }
      });
    }catch(e){ continue; }
    fbTradeCode = code; fbTradeSeat = 'host'; fbTradeRef = ref;
    ref.child('players/host/connected').onDisconnect().set(false);
    fbSaveTradeSession();
    return code;
  }
  throw new Error('トレードルームの生成に失敗しました(再試行してください)');
}

async function fbJoinTradeRoom(codeInput){
  await fbEnsureSignedIn();
  await fbSyncCollectionMirror();
  fbTradeMyUid = fbAuth.currentUser.uid;
  const code = fbNormalizeRoomCode(codeInput);
  const ref = fbDb.ref('tradeRooms/'+code);
  const snap = await ref.get();
  if(!snap.exists()) throw new Error('そのトレードコードは見つかりませんでした');
  const room = snap.val();
  if(room.hostUid===fbTradeMyUid) throw new Error('自分が作成したルームには参加できません');
  if(room.guestUid && room.guestUid!==fbTradeMyUid) throw new Error('このルームは満室です');
  if(room.status==='FINISHED' || room.status==='CANCELLED') throw new Error('このトレードはすでに終了しています');
  const now = Date.now();
  const emptyOffer = ['','',''];
  try{
    await ref.child('guestUid').set(fbTradeMyUid);
    /* firebase.rules.jsonのtradeRooms/$roomId/players/guestは各フィールド単位でしか
       .writeを許可していない(players/guestノード自体への一括set許可は無い)ため、
       フラットなパスのupdate()で書く必要がある(2026-09-05修正:.set()で一括書込み
       しようとしてPERMISSION_DENIEDになっていたバグ) */
    await ref.update({
      'players/guest/uid': fbTradeMyUid,
      'players/guest/name': fbGetDisplayName(),
      'players/guest/connected': true,
      'players/guest/lastSeen': now,
      'players/guest/offer': emptyOffer,
      'players/guest/accepted': false,
      'players/guest/finalConfirmed': false,
      'status': 'OFFERING'
    });
  }catch(e){ throw new Error('参加に失敗しました(もう一度お試しください): '+e.message); }
  fbTradeCode = code; fbTradeSeat = 'guest'; fbTradeRef = ref;
  ref.child('players/guest/connected').onDisconnect().set(false);
  fbSaveTradeSession();
  return code;
}

function fbSubscribeTradeRoom(onChange){
  const handler = fbTradeRef.on('value', snap=> onChange(snap.val()));
  fbTradeUnsub = ()=> fbTradeRef.off('value', handler);
}

/* オファー内容を変更すると自分・相手両方のaccepted/finalConfirmedを強制解除する
   (=「相手がキャンセルしたら戻る」相当。片方が編集し直したら合意はリセットが安全) */
async function fbSetTradeOffer(offer){
  if(!fbIsOfferValidShape(offer)) throw new Error('オファーの形式が不正です');
  await fbTradeRef.update({
    ['players/'+fbTradeSeat+'/offer']: offer,
    ['players/'+fbTradeSeat+'/accepted']: false,
    ['players/'+(fbTradeSeat==='host'?'guest':'host')+'/accepted']: false,
    ['players/'+fbTradeSeat+'/finalConfirmed']: false,
    ['players/'+(fbTradeSeat==='host'?'guest':'host')+'/finalConfirmed']: false
  });
}
async function fbSetTradeAccepted(accepted){
  await fbTradeRef.child('players/'+fbTradeSeat+'/accepted').set(!!accepted);
}
/* 最終確認:自分だけ確定する。両者確定した時点でエスクロー(activeTradePartner)を
   張る=相手が一時的に自分のuserCollectionsへ書き込める状態にする */
async function fbSetTradeFinalConfirmed(room){
  const myUid = fbTradeSeat==='host' ? room.hostUid : room.guestUid;
  const otherUid = fbTradeSeat==='host' ? room.guestUid : room.hostUid;
  await fbTradeRef.child('players/'+fbTradeSeat+'/finalConfirmed').set(true);
  await fbDb.ref('activeTradePartner/'+myUid).set(otherUid);
}
/* 「戻る」:両者のaccepted/finalConfirmed解除+エスクロー解除 */
async function fbBackToOffering(room){
  const myUid = fbTradeSeat==='host' ? room.hostUid : room.guestUid;
  await fbTradeRef.update({
    status: 'OFFERING',
    'players/host/accepted': false, 'players/guest/accepted': false,
    'players/host/finalConfirmed': false, 'players/guest/finalConfirmed': false
  });
  await fbDb.ref('activeTradePartner/'+myUid).remove();
}
async function fbCancelTradeRoom(reason){
  if(!fbTradeRef) return;
  await fbTradeRef.update({ status:'CANCELLED', cancelReason: reason||'相手が離脱しました' }).catch(()=>{});
  if(fbTradeMyUid) await fbDb.ref('activeTradePartner/'+fbTradeMyUid).remove().catch(()=>{});
}

/* 成立処理:①executingByの排他ロック→②最新状態を読み直し→③userCollectionsで
   所持数の最終検証→④deltaを計算→⑤1回のマルチパスupdateで両者のuserCollectionsと
   executedTradeId/status:FINISHEDを同時書込み(RTDBのマルチパスupdateはアトミック)。
   成功/失敗いずれでもfinally節でexecutingByを必ずnullへ戻す */
async function fbExecuteTrade(){
  await fbEnsureSignedIn();
  const myUid = fbAuth.currentUser.uid;
  const lockRef = fbTradeRef.child('executingBy');
  const txResult = await lockRef.transaction(current=> current ? undefined : myUid);
  if(!txResult.committed || txResult.snapshot.val()!==myUid){
    throw new Error('相手が処理中です。少し待ってから確認してください');
  }
  try{
    const snap = await fbTradeRef.get();
    const room = snap.val();
    if(!room || room.executedTradeId) throw new Error('すでに成立済みです');
    if(!room.players.host.finalConfirmed || !room.players.guest.finalConfirmed) throw new Error('両者の最終確認が揃っていません');
    const [hostCollection, guestCollection] = await Promise.all([
      fbFetchCollectionMirror(room.hostUid), fbFetchCollectionMirror(room.guestUid)
    ]);
    const check = fbValidateTradeBeforeExecution(room.players.host.offer, room.players.guest.offer, hostCollection, guestCollection);
    if(!check.ok){
      await fbTradeRef.update({ status:'CANCELLED', cancelReason: check.reason });
      throw new Error('成立できませんでした: '+check.reason);
    }
    const plan = fbComputeTradeExecutionPlan(room.players.host.offer, room.players.guest.offer);
    const tradeId = 'trade_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    const updates = {};
    Object.keys(plan.hostDelta).forEach(id=>{ updates['userCollections/'+room.hostUid+'/'+id] = (hostCollection[id]||0) + plan.hostDelta[id]; });
    Object.keys(plan.guestDelta).forEach(id=>{ updates['userCollections/'+room.guestUid+'/'+id] = (guestCollection[id]||0) + plan.guestDelta[id]; });
    updates['tradeRooms/'+fbTradeCode+'/executedTradeId'] = tradeId;
    updates['tradeRooms/'+fbTradeCode+'/status'] = 'FINISHED';
    await fbDb.ref().update(updates);
    /* ローカルcollectionへの反映はここでは行わない。実行した側・していない側の
       どちらもfbApplyTradeResultIfNeeded()(部屋の状態変化を見て両者対称的に呼ばれる)
       で反映する設計にすることで、「実行した側だけ反映され、相手には反映されない」
       という抜けを防ぐ(2026-09-05修正) */
    return { tradeId, plan };
  } finally {
    await lockRef.set(null).catch(()=>{});
    if(fbTradeMyUid) await fbDb.ref('activeTradePartner/'+fbTradeMyUid).remove().catch(()=>{});
  }
}

function fbLeaveTradeRoom(){
  if(fbTradeUnsub) fbTradeUnsub();
  fbTradeUnsub = null;
  if(fbTradeRef && fbTradeSeat) fbTradeRef.child('players/'+fbTradeSeat+'/connected').set(false).catch(()=>{});
  fbTradeCode = null; fbTradeSeat = null; fbTradeRef = null;
  fbClearTradeSession();
}

/* ==================== 既存の「オンライン対戦」画面(netShowEntryChoice)に
   追加されたルームコード方式の入口。既存のnetShowHostScreen/netShowJoinScreen
   (WebRTC手動シグナリング)は一切変更せず、そのまま「予備の方法」として残る。
   ここから先は netSend/netHandleMessage/netStartDeckSelect/netTryStartOnlineMatch/
   netFinishOnlineMatch という既存の共通処理にそのまま合流する(netTransportMode='firebase'
   をセットしてnetSendの振り分けを切り替えるだけ) ==================== */
function fbNetCleanup(){
  /* netCleanupConnection()側でnetTransportMode==='firebase'ならfbLeaveRoom()も
     呼ぶよう合流させてあるので、ここではそれを呼ぶだけでよい */
  netCleanupConnection();
}

function fbNetShowHostScreen(){
  netIsHost = true;
  netTransportMode = 'firebase';
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = 'ルーム作成中';
  document.getElementById('overlayText').textContent = 'ルームコードを発行しています…';
  document.getElementById('overlayChoices').classList.add('hidden');
  const treeRow = document.getElementById('evoTreeRow');
  treeRow.className = 'help-block';
  treeRow.classList.remove('hidden');
  treeRow.innerHTML = '';
  const btn = document.getElementById('overlayBtn');
  btn.classList.remove('hidden');
  btn.textContent = 'キャンセル';
  btn.onclick = ()=>{ fbNetCleanup(); closeOverlay(); };

  fbCreateRoom().then(code=>{
    document.getElementById('overlayText').textContent = 'このコードを対戦相手に伝えてください。相手が入力すると自動的に始まります。';
    treeRow.innerHTML = `
      <div style="font-size:32px;letter-spacing:4px;text-align:center;font-weight:bold;">${code}</div>
      <button class="end-turn secondary" id="fbHostCopyBtn" style="margin:10px auto;display:block;">コードをコピー</button>
      <div id="fbHostStatus" style="margin-top:8px;font-size:11px;color:var(--ink-dim);text-align:center;">相手の参加を待っています…</div>
    `;
    document.getElementById('fbHostCopyBtn').onclick = ()=> netCopyText(code, document.getElementById('fbHostCopyBtn'));
    fbSubscribeRoomMessages(netHandleMessage);
    fbSubscribeRoomPresence(guestMeta=>{
      if(guestMeta && guestMeta.connected){
        const statusEl = document.getElementById('fbHostStatus');
        if(statusEl) statusEl.textContent = '相手が参加しました!';
        closeOverlay();
        showNotice('相手が参加しました!デッキを選んでください');
        netStartDeckSelect();
      } else if(guestMeta===false || (guestMeta && guestMeta.connected===false)){
        if(state && state.onlineMode && !state.gameOver) showNotice('相手が切断しました');
      }
    });
  }).catch(err=>{
    showNotice('ルーム作成に失敗しました: '+err.message);
    fbNetCleanup(); closeOverlay();
  });
}

function fbNetShowJoinScreen(){
  netIsHost = false;
  netTransportMode = 'firebase';
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = 'ルームコードで参加';
  document.getElementById('overlayText').textContent = 'ホストから伝えられた6桁のコードを入力してください。';
  document.getElementById('overlayChoices').classList.add('hidden');
  const treeRow = document.getElementById('evoTreeRow');
  treeRow.className = 'help-block';
  treeRow.classList.remove('hidden');
  treeRow.innerHTML = `
    <input id="fbJoinCodeInput" type="text" maxlength="6" style="width:100%;font-size:24px;letter-spacing:6px;text-align:center;text-transform:uppercase;" placeholder="ABCDEF">
    <button class="end-turn" id="fbJoinBtn" style="margin-top:10px;">参加する</button>
    <div id="fbJoinStatus" style="margin-top:8px;font-size:11px;color:var(--ink-dim);text-align:center;"></div>
  `;
  document.getElementById('fbJoinBtn').onclick = ()=>{
    const codeInput = document.getElementById('fbJoinCodeInput').value;
    document.getElementById('fbJoinBtn').disabled = true;
    document.getElementById('fbJoinStatus').textContent = '接続しています…';
    fbJoinRoom(codeInput).then(()=>{
      fbSubscribeRoomMessages(netHandleMessage);
      fbSubscribeRoomPresence(hostMeta=>{
        if(hostMeta===false || (hostMeta && hostMeta.connected===false)){
          if(state && state.onlineMode && !state.gameOver) showNotice('相手が切断しました');
        }
      });
      closeOverlay();
      showNotice('参加しました!デッキを選んでください');
      netStartDeckSelect();
    }).catch(err=>{
      document.getElementById('fbJoinBtn').disabled = false;
      document.getElementById('fbJoinStatus').textContent = err.message;
    });
  };
  const btn = document.getElementById('overlayBtn');
  btn.classList.remove('hidden');
  btn.textContent = 'キャンセル';
  btn.onclick = ()=>{ fbNetCleanup(); closeOverlay(); };
}

/* ---------- 再接続(蟲神器のsession.ts相当) ----------
   アプリ起動時に呼ぶ。10分以内に切断したルームがあれば、盤面を復元して
   対局を再開する。既存のnetReceiveTurnState/beginTurn等は一切変更しない */
function fbNetOfferReconnectIfAny(){
  const session = fbLoadResumableRoomSession();
  if(!session) return;
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = '対戦が中断されています';
  document.getElementById('overlayText').textContent = `ルーム ${session.roomCode} での対戦が進行中でした。再接続しますか?`;
  document.getElementById('evoTreeRow').classList.add('hidden');
  const choices = document.getElementById('overlayChoices');
  choices.classList.remove('hidden');
  choices.innerHTML = '';
  const resumeBtn = document.createElement('button');
  resumeBtn.className = 'end-turn';
  resumeBtn.textContent = '再接続する';
  resumeBtn.onclick = ()=>{
    closeOverlay();
    netTransportMode = 'firebase';
    netIsHost = (session.seat==='host');
    fbResumeRoomSession().then(result=>{
      if(!result){ showNotice('再接続できませんでした(ルームが見つかりません)'); return; }
      fbSubscribeRoomMessages(netHandleMessage);
      fbSubscribeRoomPresence(()=>{});
      if(result.lastMessage){
        /* 相手の最後のメッセージ(state/liveState/deckReady等)をそのまま既存の
           netHandleMessageへ渡す=盤面復元。既存ロジック側の分岐は変更不要 */
        netHandleMessage(result.lastMessage);
      } else {
        showNotice('再接続しましたが、相手の情報がまだありません。少々お待ちください');
      }
    }).catch(err=> showNotice('再接続に失敗しました: '+err.message));
  };
  choices.appendChild(resumeBtn);
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'end-turn secondary';
  dismissBtn.textContent = '破棄する';
  dismissBtn.onclick = ()=>{ fbClearRoomSession(); closeOverlay(); };
  choices.appendChild(dismissBtn);
  document.getElementById('overlayBtn').classList.add('hidden');
}

/* ==================== データ引き継ぎ画面(蟲神器のSaveSyncScreen.tsx相当、
   #overlayを使い回すシンプル版) ==================== */
function fbShowSaveSyncScreen(){
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = 'データ引き継ぎ';
  const linked = fbGetLinkedSaveId();
  document.getElementById('overlayText').textContent = linked
    ? `現在のID: ${linked}\n別端末でこのIDを入力すると、所持カード・デッキ・パック開封状況・進行状況を復元できます。`
    : 'IDを決めて設定すると、このIDで別端末からデータを復元できるようになります。既存のデータは勝手に上書き・削除されません。';
  document.getElementById('evoTreeRow').classList.add('hidden');
  const choices = document.getElementById('overlayChoices');
  choices.classList.remove('hidden');
  choices.innerHTML = `
    <input id="fbSaveIdInput" type="text" maxlength="32" style="width:100%;font-size:16px;padding:6px;" placeholder="例: taichi-2026" value="${linked||''}">
  `;
  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '10px';
  const applyBtn = document.createElement('button');
  applyBtn.className = 'end-turn';
  applyBtn.textContent = 'このIDで設定/復元する';
  applyBtn.onclick = async ()=>{
    const idVal = document.getElementById('fbSaveIdInput').value;
    applyBtn.disabled = true;
    try{
      const decision = await fbBootWithSaveId(idVal);
      const messages = {
        'fresh': 'このIDは新規です。今のデータのまま紐付けました',
        'migrate-local-to-cloud': 'この端末のデータをクラウドに保存し、IDに紐付けました',
        'restore-from-cloud': 'クラウドから復元しました',
        'local-newer': 'この端末の方が新しいデータでした。クラウド側を更新しました',
        'cloud-newer': 'クラウドの方が新しいデータでした。この端末を復元しました'
      };
      await loadMeta(); // 既存のグローバル変数(collection/savedDecks/coins等)を再読込
      closeOverlay();
      showNotice(messages[decision.action] || '完了しました');
      showMainMenu();
    }catch(e){
      showNotice('失敗しました: '+e.message);
      applyBtn.disabled = false;
    }
  };
  btnRow.appendChild(applyBtn);
  if(linked){
    const unlinkBtn = document.createElement('button');
    unlinkBtn.className = 'end-turn secondary';
    unlinkBtn.textContent = 'このIDとのリンクを解除';
    unlinkBtn.style.marginLeft = '8px';
    unlinkBtn.onclick = ()=>{ fbUnlinkSaveId(); closeOverlay(); showNotice('リンクを解除しました(この端末のデータは残っています)'); };
    btnRow.appendChild(unlinkBtn);
  }
  choices.appendChild(btnRow);
  const btn = document.getElementById('overlayBtn');
  btn.classList.remove('hidden');
  btn.textContent = '閉じる';
  btn.onclick = closeOverlay;
}

/* ==================== トレード画面(蟲神器のTradeTab.tsx相当) ==================== */
function fbShowTradeEntryScreen(){
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = 'トレード';
  document.getElementById('overlayText').textContent = 'ルームコードで、別端末のプレイヤーとカードを交換できます(1回のトレードで最大3枚まで)。';
  document.getElementById('evoTreeRow').classList.add('hidden');
  const choices = document.getElementById('overlayChoices');
  choices.classList.remove('hidden');
  choices.innerHTML = '';
  const createBtn = document.createElement('button');
  createBtn.className = 'end-turn';
  createBtn.textContent = 'ルームを作成する';
  createBtn.onclick = ()=>{
    fbCreateTradeRoom().then(code=> fbShowTradeRoomScreen(code)).catch(err=> showNotice('失敗しました: '+err.message));
  };
  choices.appendChild(createBtn);
  const joinBtn = document.createElement('button');
  joinBtn.className = 'end-turn secondary';
  joinBtn.textContent = 'コードで参加する';
  joinBtn.onclick = ()=>{
    const code = prompt('トレードコードを入力してください');
    if(!code) return;
    fbJoinTradeRoom(code).then(c=> fbShowTradeRoomScreen(c)).catch(err=> showNotice('失敗しました: '+err.message));
  };
  choices.appendChild(joinBtn);
  const btn = document.getElementById('overlayBtn');
  btn.classList.remove('hidden');
  btn.textContent = '閉じる';
  btn.onclick = closeOverlay;
}

let fbTradeMyOffer = ['','',''];
function fbShowTradeRoomScreen(code){
  fbTradeMyOffer = ['','',''];
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');
  document.getElementById('overlayTitle').textContent = 'トレードルーム '+code;
  document.getElementById('overlayChoices').classList.add('hidden');
  const treeRow = document.getElementById('evoTreeRow');
  treeRow.className = 'help-block';
  treeRow.classList.remove('hidden');
  const btn = document.getElementById('overlayBtn');
  btn.classList.remove('hidden');
  btn.textContent = '退出する';
  btn.onclick = ()=>{
    fbCancelTradeRoom('自分から退出しました');
    fbLeaveTradeRoom();
    closeOverlay();
  };

  fbSubscribeTradeRoom(room=>{
    if(!room) return;
    fbRenderTradeRoom(room, code);
  });
}

function fbCardLabel(id){
  const c = CARDS[id];
  return c ? c.name : id;
}

/* 成立(FINISHED)を検知した側が、実行した/しなかったに関わらず自分のローカル
   collectionへ反映する。二重反映を避けるため適用済みexecutedTradeIdを
   localStorageに記録する(蟲神器のuserCollectionsミラー方針と同じく、
   ローカルcollectionが唯一の正であることは変えない) */
function fbApplyTradeResultIfNeeded(room){
  if(room.status!=='FINISHED' || !room.executedTradeId) return;
  const appliedKey = 'dtcg_trade_applied_ids_v1';
  let applied = [];
  try{ applied = JSON.parse(localStorage.getItem(appliedKey)||'[]'); }catch(e){}
  if(applied.includes(room.executedTradeId)) return;
  const plan = fbComputeTradeExecutionPlan(room.players.host.offer, room.players.guest.offer);
  const myDelta = fbTradeSeat==='host' ? plan.hostDelta : plan.guestDelta;
  Object.keys(myDelta).forEach(id=>{
    collection[id] = Math.max(0, (collection[id]||0) + myDelta[id]);
  });
  saveJSON('collection', collection);
  applied.push(room.executedTradeId);
  localStorage.setItem(appliedKey, JSON.stringify(applied.slice(-50))); // 直近50件だけ保持すれば十分
}

function fbRenderTradeRoom(room, code){
  const treeRow = document.getElementById('evoTreeRow');
  const mySeat = fbTradeSeat;
  const myPlayer = room.players[mySeat];
  const otherSeat = mySeat==='host' ? 'guest' : 'host';
  const otherPlayer = room.players[otherSeat];
  document.getElementById('overlayText').textContent = `コード: ${code} / ステータス: ${room.status}`;

  if(room.status==='CANCELLED'){
    treeRow.innerHTML = `<div>トレードは中止されました${room.cancelReason ? '('+room.cancelReason+')' : ''}</div>`;
    return;
  }
  if(room.status==='FINISHED'){
    fbApplyTradeResultIfNeeded(room);
    treeRow.innerHTML = `<div>トレードが成立しました!</div>`;
    return;
  }
  if(room.status==='WAITING'){
    treeRow.innerHTML = `<div>相手の参加を待っています…(コード: ${code})</div>`;
    return;
  }
  if(!otherPlayer){
    treeRow.innerHTML = `<div>相手を待っています…</div>`;
    return;
  }

  const myOffer = myPlayer ? myPlayer.offer : ['','',''];
  const otherOffer = otherPlayer.offer || ['','',''];
  const collectionEntries = Object.keys(collection||{}).filter(id=> collection[id]>0 && CARDS[id]);

  const pickerHtml = collectionEntries.map(id=>
    `<button class="menu-btn secondary" style="margin:2px;font-size:11px;" data-fbcard="${id}">${fbCardLabel(id)} ×${collection[id]}</button>`
  ).join('');

  treeRow.innerHTML = `
    <div><strong>あなたのオファー</strong> ${myPlayer && myPlayer.finalConfirmed ? '(最終確認済み)' : (myPlayer && myPlayer.accepted ? '(仮確定)' : '')}</div>
    <div>${myOffer.map((id,i)=> id ? `<button class="menu-btn" data-fbslot="${i}">${fbCardLabel(id)} ✕</button>` : `<span style="opacity:.5;">(空き枠)</span>`).join(' ')}</div>
    <div style="margin-top:8px;"><strong>相手のオファー</strong> ${otherPlayer.finalConfirmed ? '(最終確認済み)' : (otherPlayer.accepted ? '(仮確定)' : '')}</div>
    <div>${otherOffer.map(id=> id ? fbCardLabel(id) : '(空き枠)').join(' / ')}</div>
    <div style="margin-top:8px;font-size:11px;color:var(--ink-dim);">下の一覧からカードを選んでオファーに追加(所持数の範囲内・最大3枚):</div>
    <div style="max-height:120px;overflow-y:auto;">${pickerHtml}</div>
    <div style="margin-top:10px;">
      <button class="end-turn" id="fbTradeAcceptBtn">${myPlayer && myPlayer.accepted ? '確定を取り消す' : 'このオファーで確定する'}</button>
      <button class="end-turn secondary" id="fbTradeFinalBtn" ${(myPlayer && myPlayer.accepted && otherPlayer.accepted) ? '' : 'disabled'}>最終確認する</button>
    </div>
  `;
  treeRow.querySelectorAll('[data-fbcard]').forEach(elm=>{
    elm.onclick = ()=>{
      const id = elm.getAttribute('data-fbcard');
      const emptyIdx = fbTradeMyOffer.indexOf('');
      if(emptyIdx===-1){ showNotice('オファーは最大3枚までです'); return; }
      const wantCount = fbTradeMyOffer.filter(x=>x===id).length + 1;
      if((collection[id]||0) < wantCount){ showNotice('所持数が足りません'); return; }
      fbTradeMyOffer[emptyIdx] = id;
      fbSetTradeOffer(fbTradeMyOffer).catch(err=> showNotice(err.message));
    };
  });
  treeRow.querySelectorAll('[data-fbslot]').forEach(elm=>{
    elm.onclick = ()=>{
      const idx = parseInt(elm.getAttribute('data-fbslot'),10);
      fbTradeMyOffer[idx] = '';
      fbSetTradeOffer(fbTradeMyOffer).catch(err=> showNotice(err.message));
    };
  });
  const acceptBtn = document.getElementById('fbTradeAcceptBtn');
  if(acceptBtn) acceptBtn.onclick = ()=> fbSetTradeAccepted(!(myPlayer && myPlayer.accepted)).catch(err=> showNotice(err.message));
  const finalBtn = document.getElementById('fbTradeFinalBtn');
  if(finalBtn) finalBtn.onclick = ()=>{
    fbSetTradeFinalConfirmed(room).then(()=>{
      /* 両者finalConfirmedが揃った時点を検知した側(=後から確定した側、host/guestは
         問わない)が実行を試みる。同時に両者が検知して二重実行を試みても、
         executingByの排他ロック(fbExecuteTrade内、失敗側はロック取得できずエラーで
         抜けるだけ)で不整合は起きない */
      if(otherPlayer.finalConfirmed){
        fbExecuteTrade().then(()=> showNotice('トレードが成立しました!')).catch(err=> console.warn('trade execute (may be benign race):', err.message));
      }
    }).catch(err=> showNotice(err.message));
  };
}

function fbLeaveRoom(){
  if(fbRoomStateUnsub) fbRoomStateUnsub();
  if(fbRoomMetaUnsub) fbRoomMetaUnsub();
  fbRoomStateUnsub = null; fbRoomMetaUnsub = null;
  if(fbRoomRef && fbRoomSeat) fbRoomRef.child('players/'+fbRoomSeat+'/connected').set(false).catch(()=>{});
  fbRoomCode = null; fbRoomSeat = null; fbRoomRef = null;
  fbRoomOnPeerConnectedChange = null; fbRoomOnMessageReceived = null;
  fbClearRoomSession();
}
