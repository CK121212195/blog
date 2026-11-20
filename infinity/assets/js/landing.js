// INFINITY ── はじめのページ
// 背景の特異点（WebGL）、いまのブロック、ふたつの姿の切り替え、現れる動き
import { $, $$, prefersReducedMotion, fmtDateDot, daysBetweenJST } from './util.js';
import * as S from './singularity.js';
import { mountSpace } from './space.js';

// 見本に使う実在のブロック（#840,000 と #905,900）
const H840 = '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5';
const H905 = '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572';
const T840 = 1713571767;
const T905 = 1752727208;
const SEAL = { block: '840000', date: fmtDateDot(T840) };
const MOVE = { block: '840000', moveBlock: '905900', moveDate: fmtDateDot(T905) };
const reduce = prefersReducedMotion();

// ── 上の帯：少し下ったら背景をつける
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ── 現れる
const seen = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach((el) => seen.observe(el));

// ── 背景の特異点
const canvas = $('#gl');
const space = mountSpace(canvas, {
  quality: 0.5,
  shift: (w) => (w > 1.25 ? 0.36 : w > 0.95 ? 0.2 : 0),
  zoom: (w) => (w > 1.25 ? 1 : w > 0.95 ? 0.86 : 0.5),
});
if (!space) {
  canvas.hidden = true;
  const fb = $('#gl-fallback');
  fb.hidden = false;
  fb.innerHTML = S.sealed(H840, { id: 'fb', ...SEAL });
}

// ── いまのブロック（公開データ。つながらなければ #840,000 の記録で描く）
const APIS = [['https://mempool.space/api', 'mempool.space'], ['https://blockstream.info/api', 'blockstream.info']];
async function getTip() {
  for (const [base, name] of APIS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(base + '/blocks', { signal: ctl.signal, referrerPolicy: 'no-referrer', cache: 'no-store' });
      if (!r.ok) continue;
      const list = await r.json();
      const b = Array.isArray(list) ? list[0] : null;
      if (b && /^[0-9a-f]{64}$/.test(b.id) && Number.isFinite(b.height)) return { height: b.height, hash: b.id, time: b.timestamp, source: name };
    } catch {
      /* 次の窓口へ */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
const fmtAge = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`);
function decode(el, text) {
  if (reduce) { el.textContent = text; return; }
  const glyphs = '0123456789abcdef';
  const t0 = performance.now();
  const D = 650; // 重い端末でも、この時間で必ず読み終える
  const step = (now) => {
    const u = Math.min(1, (now - t0) / D);
    if (u >= 1) { el.textContent = text; return; }
    const k = u * text.length;
    el.textContent = Array.from(text, (c, j) => (j < k || /[\s,#…·.+]/.test(c) ? c : glyphs[(Math.random() * 16) | 0])).join('');
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = text; }, D + 400);
}
function linkState(on) {
  const ls = $('#link-state');
  ls.classList.toggle('off', !on);
  ls.className = 'label link-state ' + (on ? 'sig' : 'off');
  $('.led', ls).classList.toggle('off', !on);
  $('span', ls).textContent = on ? 'NODE LINK · ONLINE' : 'NODE LINK · OFFLINE';
}
let tip = null;
let ageTimer = 0;
function showTip(t, fresh, archive = false) {
  const h = $('#t-height'), hs = $('#t-hash');
  decode(h, '#' + t.height.toLocaleString('en-US'));
  decode(hs, t.hash.slice(0, 6) + '…' + t.hash.slice(-8));
  $('#t-src').textContent = t.source;
  if (fresh) [h, hs].forEach((el) => { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); });
  clearInterval(ageTimer);
  const tick = () => { $('#t-age').textContent = archive || !t.time ? '—' : '+' + fmtAge(Math.max(0, Math.round(Date.now() / 1000 - t.time))); };
  tick();
  if (!archive) ageTimer = setInterval(tick, 1000);
  if (space) space.setSeed(S.tailBytes(t.hash));
  $('#live-em').innerHTML = S.sealed(t.hash, { id: 'live', block: String(t.height), date: t.time ? fmtDateDot(t.time) : '' });
  $('#live-cap').textContent = (archive ? 'ARCHIVE · ' : 'LATEST · ') + 'BLOCK #' + t.height.toLocaleString('en-US');
}
async function poll() {
  const t = await getTip();
  if (!t) {
    if (!tip) {
      linkState(false);
      showTip({ height: 840000, hash: H840, time: T840, source: 'ARCHIVE' }, false, true);
    }
    return;
  }
  linkState(true);
  const fresh = !!tip && t.hash !== tip.hash;
  if (!tip || fresh || tip.source === 'ARCHIVE') { tip = t; showTip(t, fresh); }
}
poll();
setInterval(() => { if (!document.hidden) poll(); }, 60000);

// ── ふたつの姿
const stage = $('#state-stage');
const layers = $$('.em', stage);
let front = 0;
let state = 'sealed';
let seq = 0;
const draw = (s) => (s === 'released' ? S.released(H840, H905, { id: 'st' + ++seq, ...MOVE }) : S.sealed(H840, { id: 'st' + ++seq, ...SEAL }));
layers[0].innerHTML = draw('sealed');
function setState(s) {
  state = s;
  const next = layers[1 - front], prev = layers[front];
  next.innerHTML = draw(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { next.classList.add('on'); prev.classList.remove('on'); }));
  front = 1 - front;
  document.body.classList.toggle('is-released', s === 'released');
  $('#lever').setAttribute('aria-pressed', String(s === 'released'));
  if (s === 'released' && !reduce) {
    const f = document.createElement('span');
    f.className = 'flash';
    f.setAttribute('aria-hidden', 'true');
    stage.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }
  spinTesseract();
}
$('#lever').addEventListener('click', () => setState(state === 'released' ? 'sealed' : 'released'));

// 超立方体をゆっくり回す（見えている間だけ）
const TD = S.tessDNA(H905);
let tessRaf = 0;
let stageSeen = false;
function spinTesseract() {
  cancelAnimationFrame(tessRaf);
  if (state !== 'released' || reduce || !stageSeen) return;
  const g = $('.sg-tess', layers[front]);
  if (!g) return;
  const outer = $$('.te-o', g), inner = $('.te-i', g), links = $('.te-l', g), dots = $$('.te-p circle', g);
  const t0 = performance.now();
  const loop = (now) => {
    const p = S.tesseractPaths(TD, ((now - t0) / 1000) * 0.32, 62);
    outer.forEach((el) => el.setAttribute('d', p.outer));
    inner.setAttribute('d', p.inner);
    links.setAttribute('d', p.links);
    dots.forEach((c, i) => { c.setAttribute('cx', p.points[i][0].toFixed(1)); c.setAttribute('cy', p.points[i][1].toFixed(1)); });
    tessRaf = requestAnimationFrame(loop);
  };
  tessRaf = requestAnimationFrame(loop);
}
new IntersectionObserver((es) => { stageSeen = es[0].isIntersecting; spinTesseract(); }).observe(stage);

// ── コックピットの見本
$('#mock-em').innerHTML = S.sealed(H840, { id: 'mk', ...SEAL });
$('#mock-days').textContent = `${daysBetweenJST(T840, Math.floor(Date.now() / 1000)).toLocaleString('en-US')} DAYS`;
