// 日本語 / English
//  - 本文は HTML に <span class="ja">…</span><span class="en">…</span> と並べ、CSS で片方だけ見せる
//  - 属性は data-l-<属性名>="日本語|English"（例：data-l-aria-label、data-l-placeholder、data-l-content）
//  - <title data-l="日本語|English">
//  - JS で作る文字は L('日本語', 'English')
const KEY = 'infinity:lang';
const ATTRS = ['aria-label', 'placeholder', 'title', 'content', 'alt'];

export const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'ja');
export const isEn = () => lang() === 'en';
export const L = (ja, en) => (lang() === 'en' ? en : ja);

const subs = new Set();
export function onLang(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function part(v, l) {
  const i = String(v).indexOf('|');
  if (i < 0) return v;
  return l === 'en' ? v.slice(i + 1) : v.slice(0, i);
}

export function applyLang(root = document) {
  const l = lang();
  for (const a of ATTRS) {
    root.querySelectorAll(`[data-l-${a}]`).forEach((el) => el.setAttribute(a, part(el.getAttribute(`data-l-${a}`), l)));
  }
  const t = document.querySelector('title[data-l]');
  if (t) document.title = part(t.getAttribute('data-l'), l);
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => {
    b.setAttribute('aria-label', l === 'en' ? 'Language: English. Switch to Japanese' : '言語：日本語。英語に切り替える');
  });
}

export function setLang(l) {
  if (l !== 'ja' && l !== 'en') return;
  try { localStorage.setItem(KEY, l); } catch { /* 使えなくても続ける */ }
  if (l === lang()) return;
  document.documentElement.lang = l;
  applyLang();
  subs.forEach((fn) => { try { fn(l); } catch (e) { console.error(e); } });
}

// ヘッダーの「JA / EN」
export function mountLangToggle() {
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => setLang(lang() === 'en' ? 'ja' : 'en'));
  });
  applyLang();
}

// 数字（3桁区切りはどちらの言語でも同じにする）
export const nf = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
