// 稲妻守 共通の小道具

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// 名前（短い一言）は UTF-8 → base64url で URL に入れる
export function b64urlEncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecodeUtf8(s) {
  try {
    let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    const bin = atob(t);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export const fmtSats = (n) => Number(n).toLocaleString('en-US');

// 日付は日本時間で数える
const JST = 9 * 3600;
function jst(ts) {
  const d = new Date((ts + JST) * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
export function fmtDateJa(ts) {
  const { y, m, d } = jst(ts);
  return `${y}年${m}月${d}日`;
}
export function fmtDateDot(ts) {
  const { y, m, d } = jst(ts);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}
export function fmtDateShort(ts) {
  const { y, m, d } = jst(ts);
  return `${y}.${m}.${d}`;
}
// 日本時間の日付どうしの差（同じ日なら0）
export function daysBetweenJST(t0, t1) {
  return Math.floor((t1 + JST) / 86400) - Math.floor((t0 + JST) / 86400);
}

export const group4 = (addr) => String(addr).match(/.{1,4}/g) || [];

// localStorage は使えない環境があるので、失敗しても止めない
export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* 使えなくても続ける */ } },
};

export function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
