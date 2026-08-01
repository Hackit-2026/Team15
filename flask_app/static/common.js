// ============================================
// common.js  —  student.html と teacher.html の両方が使う共通処理
// ============================================

// APIのURL。デプロイするときはここだけ書き換える。
const API_BASE = "";

// 講義の長さ（秒）。100分 = 6000秒。進捗バーの基準に使う。
const LECTURE_MAX_SEC = 6000;

// URLに ?mock=1 が付いていたら、サーバーに繋がずブラウザだけで動く。
// バックエンドのAPIが出来るまでの開発用。本番のQRには付けないこと。
const IS_MOCK = new URLSearchParams(location.search).get("mock") === "1";

// ボタンの種類。バックエンドと必ず同じ綴りにすること。
const PRESS_TYPES = {
  WAKARAN: "wakaran",  // 分からん
  AGAIN:   "again",    // もう一回
  FAST:    "fast",     // 速い
};

// 表示用のラベル
const TYPE_LABEL = {
  wakaran: "分からん",
  again:   "もう一回",
  fast:    "速い",
};

// 3種類の色（グラフとボタンで共通で使う）
const TYPE_COLOR = {
  wakaran: "#e05555",
  again:   "#e0a355",
  fast:    "#5580e0",
};


// --------------------------------------------
// 匿名アカウントのコード
// --------------------------------------------

// 6桁のコードを作る。1とI、0とOなど紛らわしい文字は入れない。
function genCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// 保存済みのコードを返す。まだ無ければ null を返す。
function getClientId() {
  try {
    return localStorage.getItem("client_id");
  } catch (e) {
    return window._fallbackClientId || null;
  }
}

// コードを保存する。
function saveClientId(id) {
  try {
    localStorage.setItem("client_id", id);
  } catch (e) {
    window._fallbackClientId = id;
  }
}


// --------------------------------------------
// 表示のヘルパー
// --------------------------------------------

// 経過秒 → 「8分」
function fmtMin(sec) {
  return Math.floor(sec / 60) + "分";
}

// URLの ?sid=xxx を取り出す
function getSidFromUrl() {
  return new URLSearchParams(location.search).get("sid");
}


// --------------------------------------------
// メモ（復習用）
// --------------------------------------------
// 今はブラウザにだけ保存している。
// バックエンドに PATCH /api/presses/<press_id> が出来たら、
// この2つの中身をfetchに差し替えればいい。呼び出し側は変えなくて済む。

// 記録1件を識別するキー。
// 将来 press に id が付いたらそれを使う。無い間は種類＋経過秒で代用する。
function pressKey(sid, p) {
  return "memo:" + sid + ":" + (p.id != null ? p.id : p.type + "@" + p.elapsed_sec);
}

function getMemo(sid, p) {
  try {
    return localStorage.getItem(pressKey(sid, p)) || "";
  } catch (e) {
    return "";
  }
}

function saveMemo(sid, p, text) {
  try {
    if (text) {
      localStorage.setItem(pressKey(sid, p), text);
    } else {
      localStorage.removeItem(pressKey(sid, p));
    }
  } catch (e) {
    // プライベートモードなどで保存できないときは黙って諦める
  }
}


// --------------------------------------------
// API呼び出し
// --------------------------------------------

async function apiGet(path) {
  if (IS_MOCK) return mockGet(path);

  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error("APIエラー " + res.status + " : " + path);
  return await res.json();
}

async function apiPost(path, body) {
  if (IS_MOCK) return mockPost(path, body || {});

  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error("APIエラー " + res.status + " : " + path);
  return await res.json();
}

// フォーム形式でPOSTする。
// バックエンドは request.form で読んでいる（JSONではない）ので、
// 実際のAPIを叩くときはこちらを使うこと。
async function apiPostForm(path, obj) {
  if (IS_MOCK) return mockPost(path, obj || {});

  const res = await fetch(API_BASE + path, {
    method: "POST",
    body: new URLSearchParams(obj || {}),
  });
  if (!res.ok) throw new Error("APIエラー " + res.status + " : " + path);
  return await res.json();
}


// --------------------------------------------
// 経過時間（暫定：この端末の時計で計算）
// --------------------------------------------
// 本来はサーバーが計算して返すべき値（設計判断どおり）。
// ただ今のバックエンドは押した時刻をそもそも保存していないため、
// サーバーが elapsed_sec を返すようになるまでの暫定として、
// 「この端末でこの部屋を最初に開いた時刻」からの経過を使う。
// 講義の途中で開いた人は 0分 から始まるズレがあるが、
// 自分用の復習リストの並び・位置には十分。

function roomEnteredAt(sid) {
  const key = "entered_at:" + sid;
  let v = null;
  try { v = localStorage.getItem(key); } catch (e) {}

  if (!v) {
    // 仮データモードでは「開始40分後」から始める。
    // 0分だと進捗バーの印が左端に張り付いて見た目を確認しづらいため。
    v = String(Date.now() - (IS_MOCK ? 40 * 60 * 1000 : 0));
    try { localStorage.setItem(key, v); } catch (e) {}
  }
  return Number(v);
}

function localElapsedSec(sid) {
  return Math.floor((Date.now() - roomEnteredAt(sid)) / 1000);
}


// --------------------------------------------
// 自分が押した記録（ブラウザ保存）
// --------------------------------------------
// 自分の記録を取り出すAPIがまだ無いため、押すたびにブラウザにも残す。
// APIが出来たら loadMyPressesLocal の呼び出し元を fetch に差し替える。

function myPressesKey(sid, clientId) {
  return "my_presses:" + sid + ":" + clientId;
}

function loadMyPressesLocal(sid, clientId) {
  try {
    return JSON.parse(localStorage.getItem(myPressesKey(sid, clientId)) || "[]");
  } catch (e) {
    return [];
  }
}

function saveMyPressLocal(sid, clientId, press) {
  try {
    const list = loadMyPressesLocal(sid, clientId);
    list.push(press);
    localStorage.setItem(myPressesKey(sid, clientId), JSON.stringify(list));
  } catch (e) {
    // 保存できない環境では画面に出ている分だけで我慢する
  }
}


// --------------------------------------------
// 仮データ（?mock=1 のときだけ動く）
// --------------------------------------------
// サーバー無しでもボタンと復習リストの動きを確認できるようにする。
// URLと返り値は実際のバックエンドとまったく同じ形にしてあるので、
// ?mock=1 を外すだけで本物に切り替わる。

function mockRoom(id) {
  return { id: id, name: "情報セキュリティ（仮データ）", isFinished: false };
}

function mockGet(path) {
  const [rawPath, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  const parts = rawPath.split("/").filter(Boolean);  // ["api","room","1"]

  // GET /api/room/<id> → 部屋の情報
  if (parts[1] === "room") {
    return mockRoom(parts[2]);
  }

  // GET /api/reaction/<id>?client_id=xxx → 自分の押した分
  // （ブラウザに残した控えをそのまま返す）
  if (parts[1] === "reaction") {
    return loadMyPressesLocal(parts[2], params.get("client_id"))
      .map(p => ({ id: p.id, type: p.type, elapsed_sec: p.elapsed_sec }));
  }

  throw new Error("仮データに無いURL: " + path);
}

let mockNextId = 1;

function mockPost(path, body) {
  const parts = path.split("/").filter(Boolean);

  // POST /api/reaction/<id> → 実物と同じく部屋の情報＋elapsed_sec を返す
  if (parts[1] === "reaction") {
    const room = mockRoom(parts[2]);
    room.reaction_id = mockNextId++;
    room.elapsed_sec = localElapsedSec(parts[2]);
    return room;
  }

  throw new Error("仮データに無いURL: " + path);
}