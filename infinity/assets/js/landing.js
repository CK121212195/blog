// INFINITY ── はじめのページ
// 操縦席からの眺め（地球と特異点・取引の弧）、いまのブロック、価格の換算、ケースと絵柄、ミッションパッチ、現れる動き
import { $, $$, prefersReducedMotion, fmtDateDot, daysBetweenJST } from './util.js';
import * as S from './singularity.js';
import { mountSpace } from './space.js';
import { mountHero, reticleSVG } from './hero.js';
import { mountAmbient } from './ambient.js';
import { initReveal, initHeader, initTilt, sweep } from './motion.js';
import { mountLangToggle, onLang, L } from './i18n.js';
import { watchBlocks } from './tip.js';
import { mountRail } from './rail.js';
import { fetchPrices, convert, parseNum, fmt } from './fx.js';
import { LIVERIES, ORDER, lidSVG, caseScene } from './lids.js';

// 見本に使う実在のブロック（#840,000 と #905,900）
const H840 = '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5';
const H905 = '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572';
const T840 = 1713571767;
const T905 = 1752727208;
const reduce = prefersReducedMotion();
let front = 0, seq = 0, pmode = 'latest', latest = null, outTimer = 0; // ミッションパッチの見本（下で使う）

mountLangToggle();
initHeader();

// ── 背景の星（ヒーローが見えている間は止める）
const ambient = mountAmbient({ lensX: 0.82 });

// ── 操縦席からの眺め
const hero = $('#hero');
const canvas = $('#gl');
const space = mountSpace(canvas, { quality: 0.5 });
$('#reticle').innerHTML = reticleSVG();
if (!space) {
  canvas.hidden = true;
  $('#tx').hidden = true;
  $('#reticle').hidden = true;
  const fb = $('#gl-fallback');
  fb.hidden = false;
  $('#fb-bh').innerHTML = S.sealed(H840, { id: 'fb', block: '840000', date: fmtDateDot(T840) });
}
const cockpit = mountHero({ hero, space, txCanvas: $('#tx'), frameSvg: $('#frame'), reticle: $('#reticle') });
if (ambient && 'IntersectionObserver' in window) {
  new IntersectionObserver((es) => ambient.setActive(es[0].intersectionRatio < 0.55), { threshold: [0, 0.55, 1] }).observe(hero);
}

// ── いまのブロック
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
let online = null;
function linkState() {
  const ls = $('#link-state');
  ls.className = 'label link-state ' + (online ? 'sig' : online === false ? 'off' : 'dim');
  $('.led', ls).classList.toggle('off', online === false);
  $('span', ls).textContent = online === null ? L('NODE LINK · 接続中', 'NODE LINK · LINKING') : online ? 'NODE LINK · ONLINE' : 'NODE LINK · OFFLINE';
}
linkState();
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
  latest = { hash: t.hash, height: t.height, time: t.time, archive };
  if (pmode === 'latest') drawPatch(false);
}
const rail = mountRail($('#chain'));
watchBlocks((d, { isNew }) => {
  rail.update(d, { isNew });
  if (!d) {
    if (online !== false) { online = false; linkState(); }
    if (!tip) showTip({ height: 840000, hash: H840, time: T840, source: 'ARCHIVE' }, false, true);
    return;
  }
  online = true;
  linkState();
  const b = d.blocks[0];
  const t = { height: b.height, hash: b.hash, time: b.time, source: d.source };
  const fresh = !!tip && t.hash !== tip.hash;
  if (!tip || fresh || tip.source === 'ARCHIVE') { tip = t; showTip(t, fresh); }
  if (isNew) { cockpit.pulse(); if (ambient) ambient.pulse(); sweep(); }
});

// ── 価格（1ドル＝何BTC＝何sats＝何円）と換算
let price = null;
const fxOpen = $('#fx-open'), fxPanel = $('#fx-panel');
function fxLine() {
  const el = $('#fx-line');
  if (!price) { el.textContent = L('価格を取得できません', 'Price unavailable'); return; }
  const v = convert('usd', 1, price);
  el.innerHTML = '';
  const a = document.createElement('span'), b = document.createElement('span');
  a.textContent = `$1 = ₿${fmt('btc', v.btc)}`;
  b.textContent = `= ${fmt('sats', v.sats)} sats = ¥${fmt('jpy', v.jpy)}`;
  el.append(a, ' ', b); // 2つのまとまりの間でだけ折り返す
}
function fxSrc() {
  const el = $('#fx-src');
  if (!price) { el.textContent = L('価格：取得できません（BTC と sats の換算だけ使えます）', 'Price: unavailable (BTC ↔ sats still works)'); return; }
  const d = new Date(price.time * 1000);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  el.textContent = `1 BTC = $${fmt('usd', price.usd)} · ¥${fmt('jpy', price.jpy)} · ${price.source} · ${hm}`;
}
let fxLast = { f: 'usd', v: 1 };
function fxFill(skip) {
  const v = convert(fxLast.f, fxLast.v, price);
  for (const f of ['usd', 'btc', 'sats', 'jpy']) {
    if (f === skip) continue;
    $('#fx-' + f).value = Number.isFinite(v[f]) ? fmt(f, v[f]) : '';
    $('#fx-' + f).placeholder = Number.isFinite(v[f]) ? '' : '—';
  }
}
$$('.fx-row input').forEach((inp) => {
  inp.addEventListener('input', () => {
    const n = parseNum(inp.value);
    inp.closest('.fx-row').classList.toggle('ng', inp.value.trim() !== '' && n === null);
    if (n === null) return;
    fxLast = { f: inp.dataset.f, v: n };
    fxFill(inp.dataset.f);
  });
  inp.addEventListener('blur', () => { if (parseNum(inp.value) !== null) fxFill(); });
});
$('#fx-reset').addEventListener('click', () => { fxLast = { f: 'usd', v: 1 }; fxFill(); });
function setFx(open) {
  fxPanel.hidden = !open;
  fxOpen.setAttribute('aria-expanded', String(open));
  if (open) { fxFill(); setTimeout(() => $('#fx-usd').focus({ preventScroll: true }), 60); }
}
fxOpen.addEventListener('click', () => setFx(fxPanel.hidden));
$('#fx-close').addEventListener('click', () => { setFx(false); fxOpen.focus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fxPanel.hidden) { setFx(false); fxOpen.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!fxPanel.hidden && !fxPanel.contains(e.target) && !fxOpen.contains(e.target)) setFx(false); });
async function loadPrice(fresh = false) {
  const p = await fetchPrices({ fresh });
  const changed = p && (!price || p.usd !== price.usd);
  if (p) price = p;
  fxLine();
  fxSrc();
  mockFiat();
  if (changed && !fxPanel.hidden && document.activeElement && !document.activeElement.closest('.fx-row')) fxFill();
  if (changed) { const el = $('#fx-line'); el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); }
}
loadPrice();
setInterval(() => { if (!document.hidden) loadPrice(true); }, 5 * 60 * 1000);

// ── ケースと絵柄
let livery = 'a';
const DESC = {
  a: ['黒にオレンジ。軌道をめぐる ₿ と、BITCOIN・EST.2009 の縦文字。いちばん静かな一枚。', 'Black and orange. A ₿ in orbit, with BITCOIN and EST.2009 set vertically — the quietest of the four.'],
  b: ['水色にオレンジ。「HODL」と話す、まるいマスコット。贈り物にいちばん人気が出そうな一枚。', 'Sky blue and orange. A round little mascot that says “HODL” — made for gifting.'],
  c: ['オレンジに黒の文字。TICK TOCK、NEXT BLOCK、EST.2009。文字だけで押し切る一枚。', 'Orange with heavy black type: TICK TOCK, NEXT BLOCK, EST.2009. Type does all the talking.'],
  d: ['シルクブルーに、丸にB。両端に雷紋、縦書きの「二千百万」と「ビットコイン」。和の一枚。', 'Silk blue with a circled B, thunder-fret borders, and “21 million” and “Bitcoin” written vertically in Japanese.'],
};
const list = $('#livery-list');
list.innerHTML = ORDER.map((k) => `<button type="button" class="lv" data-livery="${k}" aria-pressed="${k === livery}">${lidSVG(k, { id: 'lv' + k })}<span>${LIVERIES[k].code} · ${LIVERIES[k].name}</span></button>`).join('');
const scene = $('#case-scene');
function liveryText() {
  const v = LIVERIES[livery];
  $('#livery-name').innerHTML = `${v.code} · ${v.name}<small>${L(v.ja, { a: 'Minimal', b: 'Cute', c: 'Typography', d: 'Japanese pattern' }[livery])}</small>`;
  $('#livery-desc').textContent = L(DESC[livery][0], DESC[livery][1]);
}
function drawCase(k) {
  const open = scene.classList.contains('open');
  scene.innerHTML = caseScene(k, { id: 'cs' });
  if (open) scene.classList.add('open');
}
drawCase(livery);
liveryText();
let swapT = 0;
list.addEventListener('click', (e) => {
  const b = e.target.closest('.lv');
  if (!b || b.dataset.livery === livery) return;
  livery = b.dataset.livery;
  $$('.lv', list).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  liveryText();
  if (reduce) { drawCase(livery); return; }
  scene.classList.add('swap');
  clearTimeout(swapT);
  swapT = setTimeout(() => { drawCase(livery); requestAnimationFrame(() => scene.classList.remove('swap')); }, 260);
});
$('#case-stage').addEventListener('click', () => scene.classList.toggle('open'));
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((es) => {
    if (es[0].isIntersecting) { setTimeout(() => scene.classList.add('open'), 450); io.disconnect(); }
  }, { threshold: 0.45 });
  io.observe(scene);
} else scene.classList.add('open');

// ── ミッションパッチ（最新ブロック／封印中／移動後）
const stage = $('#patch-stage');
const layers = $$('.em', stage);
function patchFor(m) {
  if (m === 'released') return S.released(H840, H905, { id: 'pt' + ++seq, block: '840000', date: fmtDateDot(T840), moveBlock: '905900', moveDate: fmtDateDot(T905) });
  if (m === 'sealed' || !latest) return S.sealed(H840, { id: 'pt' + ++seq, block: '840000', date: fmtDateDot(T840) });
  return S.sealed(latest.hash, { id: 'pt' + ++seq, block: String(latest.height), date: latest.time ? fmtDateDot(latest.time) : '' });
}
function patchCap() {
  const c = $('#patch-cap');
  if (pmode === 'released') c.textContent = L('移動後 · 入金 #840,000 → 移動 #905,900', 'RELEASED · DEPOSIT #840,000 → MOVE #905,900');
  else if (pmode === 'sealed') c.textContent = L('封印中 · ブロック #840,000', 'SEALED · BLOCK #840,000');
  else c.textContent = latest ? L(`${latest.archive ? '記録' : '最新'}のブロック #${latest.height.toLocaleString('en-US')} から描いた見本`, `${latest.archive ? 'ARCHIVED' : 'LATEST'} BLOCK #${latest.height.toLocaleString('en-US')} · SAMPLE`) : '—';
}
function drawPatch(animate = true) {
  const next = layers[1 - front], prev = layers[front];
  next.innerHTML = patchFor(pmode);
  next.classList.remove('out');
  if (!animate || reduce) {
    next.classList.add('on');
    prev.classList.remove('on');
    prev.innerHTML = '';
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => { next.classList.add('on'); prev.classList.remove('on'); prev.classList.add('out'); }));
    clearTimeout(outTimer);
    outTimer = setTimeout(() => { prev.classList.remove('out'); if (!prev.classList.contains('on')) prev.innerHTML = ''; }, 1500);
  }
  front = 1 - front;
  document.body.classList.toggle('is-released', pmode === 'released');
  if (animate && pmode === 'released' && !reduce) {
    const f = document.createElement('span');
    f.className = 'flash';
    f.setAttribute('aria-hidden', 'true');
    stage.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  }
  patchCap();
  spinTesseract();
}
const seg = $('#pmode');
seg.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.dataset.pmode === pmode) return;
  pmode = b.dataset.pmode;
  const i = ['latest', 'sealed', 'released'].indexOf(pmode);
  $('.seg-ind', seg).className = 'seg-ind' + (i ? ' p' + i : '');
  $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  drawPatch(true);
});
// 超立方体をゆっくり回す（見えている間だけ）
const TD = S.tessDNA(H905);
let tessRaf = 0, stageSeen = false;
function spinTesseract() {
  cancelAnimationFrame(tessRaf);
  if (pmode !== 'released' || reduce || !stageSeen) return;
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
drawPatch(false);

// ── コックピットの見本
$('#mock-em').innerHTML = S.sealed(H840, { id: 'mk', block: '840000', date: fmtDateDot(T840) });
$('#mock-days').textContent = `${daysBetweenJST(T840, Math.floor(Date.now() / 1000)).toLocaleString('en-US')} DAYS`;
function mockFiat() {
  const el = $('#mock-fiat');
  if (!price) { el.textContent = '—'; return; }
  const v = convert('sats', 10000, price);
  el.textContent = L(`¥${fmt('jpy', v.jpy)}`, `$${fmt('usd', v.usd)}`);
}

// ── 言語が変わったら、JS で書いた文字を書き直す
onLang(() => { linkState(); fxLine(); fxSrc(); liveryText(); patchCap(); mockFiat(); });

initReveal();
initTilt();
