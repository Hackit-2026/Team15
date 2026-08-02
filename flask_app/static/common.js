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
// スライドのページが取れていればページ単位で1つ。
// 同じページを何度押しても、メモは1つにまとまる。
// スライドを使わない講義ではページが無いので、従来どおり種類＋経過秒で代用する。
function pressKey(sid, p) {
  if (p.page != null) return "memo:" + sid + ":page:" + p.page;
  return "memo:" + sid + ":min:" + Math.floor(p.elapsed_sec / 60);
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

// 失敗レスポンスをErrorにする。
// バックエンドは失敗時に {"error": "..."} を返すので、
// あればそのまま画面に出せるメッセージとして使う。
async function apiError(res, path) {
  let msg = "APIエラー " + res.status + " : " + path;
  try {
    const j = await res.json();
    if (j && j.error) msg = j.error;
  } catch (e) {}
  return new Error(msg);
}

async function apiGet(path) {
  if (IS_MOCK) return mockGet(path);

  const res = await fetch(API_BASE + path);
  if (!res.ok) throw await apiError(res, path);
  return await res.json();
}

async function apiPost(path, body) {
  if (IS_MOCK) return mockPost(path, body || {});

  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw await apiError(res, path);
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
  if (!res.ok) throw await apiError(res, path);
  return await res.json();
}


// --------------------------------------------
// 経過時間（暫定：この端末の時計で計算）
// --------------------------------------------
// スライドを使う講義では、押した位置はサーバーが返す page で表せるので
// ここは使わない。使うのはスライドを使わない講義のときだけ。
// サーバーは押した時刻（reactions.timestamp）を保存しているが、
// 経過秒として返すAPIは無いため、暫定として
// 「この端末でこの部屋を最初に開いた時刻」からの経過を使う。
// 講義の途中で開いた人は 0分 から始まるズレがあるが、
// 自分用の復習リストの並び・位置には十分。

function roomEnteredAt(sid) {
  const key = "entered_at:" + sid;
  let v = null;
  try { v = localStorage.getItem(key); } catch (e) {}

  // 講義の長さより古い記録は、別の日に同じ部屋を開いたときの残骸とみなす。
  // これが無いと「961分」のような現実にありえない値が出る。
  if (v && Date.now() - Number(v) > LECTURE_MAX_SEC * 1000) {
    v = null;
  }

  if (!v) {
    // 仮データモードでは「開始40分後」から始める。
    // 0分だと進捗バーの印が左端に張り付いて見た目を確認しづらいため。
    v = String(Date.now() - (IS_MOCK ? 40 * 60 * 1000 : 0));
    try { localStorage.setItem(key, v); } catch (e) {}
  }
  return Number(v);
}

function localElapsedSec(sid) {
  // 初回は記録した瞬間との誤差でマイナスになりうるので0で止める
  return Math.max(0, Math.floor((Date.now() - roomEnteredAt(sid)) / 1000));
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
// スライドの総ページ数（ブラウザ保存）
// --------------------------------------------
// 進捗バーの分母に使う値。
// 講義が終わると /presentation/state は410を返して取れなくなる
// （スライドが消された場合は404）。ところが復習リストを見るのは
// まさに講義が終わったあとなので、そのままだと分母を失って
// 記録の印が全部バーの中央に重なってしまう。
// 一度取れた値を控えておき、取れなくなったらそれを使う。

function totalPagesKey(sid) {
  return "total_pages:" + sid;
}

function loadTotalPagesLocal(sid) {
  try {
    const v = Number(localStorage.getItem(totalPagesKey(sid)));
    return v > 0 ? v : null;
  } catch (e) {
    return null;
  }
}

function saveTotalPagesLocal(sid, n) {
  try {
    if (n > 0) localStorage.setItem(totalPagesKey(sid), String(n));
  } catch (e) {
    // 保存できない環境では、講義が終わるまでの間だけ正しく出る
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

// 仮データの現在ページ。先生がめくっている様子を再現するため、
// 30秒ごとに1ページ進む形にしてある（全20ページで折り返す）。
function mockPage() {
  return (Math.floor(Date.now() / 30000) % 20) + 1;
}

// 仮データのログイン状態。ブラウザに覚えさせて、リロードしても保つ。
function mockLoadUser() {
  try {
    return JSON.parse(localStorage.getItem("mock_user") || "null");
  } catch (e) {
    return null;
  }
}

function mockSaveUser(u) {
  try {
    if (u) {
      localStorage.setItem("mock_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("mock_user");
    }
  } catch (e) {}
}

function mockGet(path) {
  const [rawPath, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  const parts = rawPath.split("/").filter(Boolean);  // ["api","room","1"]

  // GET /api/me → ログイン状態 {"user": {...} か null}
  if (parts[1] === "me") {
    return { user: mockLoadUser() };
  }

  // GET /api/room/<id>/presentation/state → スライドの状態
  if (parts[1] === "room" && parts[3] === "presentation") {
    return { presentationId: 1, roomId: parts[2], currentPage: mockPage(), totalPages: 20, status: "ready" };
  }

  // GET /api/room/<id> → 部屋の情報
  if (parts[1] === "room") {
    return mockRoom(parts[2]);
  }

  // GET /api/reaction/<room_id>?user_id=xxx → 自分の押した分
  // （ブラウザに残した控えをそのまま返す）
  // page も必ず含めること。落とすとリロードした時にページ表示が
  // 時間表示に化けて、本物より悪い挙動になる。
  if (parts[1] === "reaction") {
    return loadMyPressesLocal(parts[2], "user:" + params.get("user_id"))
      .map(p => ({ id: p.id, type: p.type, page: p.page, elapsed_sec: p.elapsed_sec }));
  }

  throw new Error("仮データに無いURL: " + path);
}

let mockNextId = 1;

function mockPost(path, body) {
  const parts = path.split("/").filter(Boolean);

  // POST /api/login, /api/register → どんな名前でも通す
  if (parts[1] === "login" || parts[1] === "register") {
    const u = { id: 1, username: body.username || "テスト" };
    mockSaveUser(u);
    return u;
  }

  // POST /api/logout
  if (parts[1] === "logout") {
    mockSaveUser(null);
    return { message: "ログアウトしました" };
  }

  // POST /api/reaction/<id> → 実物と同じく部屋の情報＋page を返す
  if (parts[1] === "reaction") {
    const room = mockRoom(parts[2]);
    room.reaction_id = mockNextId++;
    room.page = mockPage();
    return room;
  }

  throw new Error("仮データに無いURL: " + path);
}