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


// --------------------------------------------
// 仮データ（?mock=1 のときだけ動く）
// --------------------------------------------
// バックエンドのAPIが出来るまで、ここが代わりに応答する。
// APIが出来たら ?mock=1 を外すだけで本物に切り替わる。
// このブロックは最後に消していい。

// 講義の開始時刻。初回に決めてブラウザに残す。
function mockStartedAt(sid) {
  const key = "mock_started_at:" + sid;
  let v = null;
  try {
    v = localStorage.getItem(key);
  } catch (e) {}

  if (!v) {
    // 「講義が始まって40分たったところ」から始める。
    // 0分スタートだと進捗バーの印が左端に張り付いて見た目を確認しづらいため。
    v = String(Date.now() - 40 * 60 * 1000);
    try {
      localStorage.setItem(key, v);
    } catch (e) {}
  }
  return Number(v);
}

function mockElapsed(sid) {
  return Math.floor((Date.now() - mockStartedAt(sid)) / 1000);
}

function mockPresses(sid) {
  try {
    return JSON.parse(localStorage.getItem("mock_presses:" + sid) || "[]");
  } catch (e) {
    return [];
  }
}

function mockSavePresses(sid, list) {
  try {
    localStorage.setItem("mock_presses:" + sid, JSON.stringify(list));
  } catch (e) {}
}

function mockGet(path) {
  const [rawPath, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  const parts = rawPath.split("/").filter(Boolean);   // ["api","sessions",sid,...]
  const sid = parts[2];

  // GET /api/sessions/<sid>
  if (parts.length === 3) {
    return {
      title: "情報セキュリティ（仮データ）",
      is_active: true,
      elapsed_sec: mockElapsed(sid),
    };
  }

  // GET /api/sessions/<sid>/presses?client_id=xxx
  if (parts[3] === "presses") {
    const cid = params.get("client_id");
    return mockPresses(sid)
      .filter(p => p.client_id === cid)
      .map(p => ({ id: p.id, type: p.type, elapsed_sec: p.elapsed_sec }));
  }

  // GET /api/sessions/<sid>/summary
  if (parts[3] === "summary") {
    const byMinute = {};
    mockPresses(sid).forEach(p => {
      const m = Math.floor(p.elapsed_sec / 60);
      if (!byMinute[m]) byMinute[m] = { minute: m, wakaran: 0, again: 0, fast: 0 };
      byMinute[m][p.type]++;
    });
    return Object.values(byMinute).sort((a, b) => a.minute - b.minute);
  }

  throw new Error("仮データに無いURL: " + path);
}

function mockPost(path, body) {
  const parts = path.split("/").filter(Boolean);
  const sid = parts[2];

  // POST /api/sessions/<sid>/presses
  if (parts[3] === "presses") {
    const list = mockPresses(sid);
    const elapsed = mockElapsed(sid);
    list.push({
      id: list.length + 1,
      type: body.type,
      client_id: body.client_id,
      elapsed_sec: elapsed,
    });
    mockSavePresses(sid, list);
    return { ok: true, id: list.length, elapsed_sec: elapsed };
  }

  throw new Error("仮データに無いURL: " + path);
}