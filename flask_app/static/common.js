// ============================================
// common.js  —  student.html と teacher.html の両方が使う共通処理
// ============================================

// APIのURL。デプロイするときはここだけ書き換える。
const API_BASE = "";

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
// API呼び出し
// --------------------------------------------

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error("APIエラー " + res.status + " : " + path);
  return await res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error("APIエラー " + res.status + " : " + path);
  return await res.json();
}