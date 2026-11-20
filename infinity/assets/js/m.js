// INFINITY ── コックピット（コインをかざした先）
// URL の #<アドレス>&n=<名前> を読み、公開データから状態を判定して、紋と計器を出す。鍵は一切扱わない。
import { $, $$, b64urlDecodeUtf8, fmtSats, fmtDateDot, daysBetweenJST, group4, store, prefersReducedMotion } from './util.js';
import { validateAddress } from './address.js';
import { loadOmamori, loadFeeRate, estimateSweepVbytes, NETS } from './chain.js';
import { bip21, qrSvg } from './qr.js';
import * as S from './singularity.js';

const reduce = prefersReducedMotion();
const H840 = '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5';
const H905 = '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572';
const T840 = 1713571767;
const T905 = 1752727208;
const now = () => Math.floor(Date.now() / 1000);

const COPY = {
  loading: { en: 'ESTABLISHING LINK', title: '接続中', desc: 'ネットワークに問い合わせています', chip: 'LINK' },
  empty: { en: 'STANDBY · NO PAYLOAD', title: '静寂', desc: 'まだ何も封じられていません。入金が承認されると、そのブロックから紋が描かれます。', chip: 'STANDBY' },
  gathering: { en: 'INBOUND · AWAITING CONFIRMATION', title: '接近', desc: '入金を確かめています。承認されると、紋が描かれます。', chip: 'INBOUND' },
  sealed: { en: 'SINGULARITY · SEALED', title: '特異点', desc: 'このコインには、価値が封じられています。', chip: 'SEALED' },
  rumbling: { en: 'CRITICAL · TRANSFER PENDING', title: '臨界', desc: '中身が動き始めています。承認を待っています。', chip: 'CRITICAL' },
  released: { en: 'TRANSCENDED · RELEASED', title: '超越', desc: '封は解かれ、価値は外の宇宙へ。', chip: 'RELEASED' },
  error: { en: 'NO SIGNAL', title: '', desc: '', chip: 'NO SIGNAL' },
};

// ── URL を読む
function parseParams() {
  const raw = (location.hash || '').replace(/^#/, '');
  const q = new URLSearchParams(location.search);
  const dm = raw.match(/^demo(?:=(\w+))?$/);
  if (dm || q.has('demo')) return { demo: true, demoState: (dm && dm[1]) || q.get('demo') || 'sealed' };
  const parts = raw.split('&').filter(Boolean);
  const kv = new URLSearchParams(parts.filter((p) => p.includes('=')).join('&'));
  let addr = parts[0] && !parts[0].includes('=') ? parts[0] : kv.get('a') || q.get('a');
  try { addr = addr ? decodeURIComponent(addr) : null; } catch { addr = null; }
  const n = kv.get('n') || q.get('n');
  const name = n ? b64urlDecodeUtf8(n) : null;
  const net = kv.get('net') || q.get('net');
  return { demo: false, addr, name: name ? name.slice(0, 40) : null, net };
}

// ── 紋
let seq = 0;
function emblemFor(model, idp) {
  const f = model.first, m = model.move;
  switch (model.state) {
    case 'gathering': return S.gathering({ id: idp });
    case 'sealed': return S.sealed(f.hash, { id: idp, block: String(f.height), date: fmtDateDot(f.time) });
    case 'rumbling': return S.rumbling(f.hash, { id: idp, block: String(f.height), date: fmtDateDot(f.time) });
    case 'released': return S.released(f.hash, m.hash, { id: idp, block: String(f.height), date: fmtDateDot(f.time), moveBlock: String(m.height), moveDate: fmtDateDot(m.time) });
    default: return S.empty({ id: idp });
  }
}
const layers = [$('#em-a'), $('#em-b')];
let front = 1;
let shownKey = '';
let tessRaf = 0;
function showEmblem(model) {
  const key = [model.state, model.first && model.first.hash, model.move && model.move.hash].join(':');
  if (key === shownKey) return false;
  shownKey = key;
  const next = layers[1 - front], prev = layers[front];
  next.innerHTML = emblemFor(model, 'v' + ++seq);
  requestAnimationFrame(() => requestAnimationFrame(() => { next.classList.add('on'); prev.classList.remove('on'); }));
  front = 1 - front;
  spin(model);
  return true;
}
// 超立方体をゆっくり回す
function spin(model) {
  cancelAnimationFrame(tessRaf);
  if (reduce || model.state !== 'released' || !model.move || !model.move.hash) return;
  const g = $('.sg-tess', layers[front]);
  if (!g) return;
  const dna = S.tessDNA(model.move.hash);
  const outer = $$('.te-o', g), inner = $('.te-i', g), links = $('.te-l', g), dots = $$('.te-p circle', g);
  const t0 = performance.now();
  const loop = (t) => {
    if (!document.hidden) {
      const p = S.tesseractPaths(dna, ((t - t0) / 1000) * 0.3, 62);
      outer.forEach((el) => el.setAttribute('d', p.outer));
      inner.setAttribute('d', p.inner);
      links.setAttribute('d', p.links);
      dots.forEach((c, i) => { c.setAttribute('cx', p.points[i][0].toFixed(1)); c.setAttribute('cy', p.points[i][1].toFixed(1)); });
    }
    tessRaf = requestAnimationFrame(loop);
  };
  tessRaf = requestAnimationFrame(loop);
}
function flash() {
  if (reduce) return;
  const f = document.createElement('span');
  f.className = 'flash';
  f.setAttribute('aria-hidden', 'true');
  $('#stage').appendChild(f);
  setTimeout(() => f.remove(), 1100);
  stars.warp();
}
function shake() {
  if (reduce) return;
  const st = $('#stage');
  st.classList.remove('shake');
  void st.offsetWidth;
  st.classList.add('shake');
}

// ── 窓の外の星（ゆっくり進む。状態が変わると跳ぶ）
const stars = (() => {
  const cv = $('#stars');
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, list = [], speed = 0.35, boost = 0, raf = 0, tint = '255,236,210';
  function size() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.width = Math.max(2, Math.round(r.width * dpr));
    h = cv.height = Math.max(2, Math.round(r.height * dpr));
    list = Array.from({ length: 170 }, () => ({ x: (Math.random() - 0.5) * w * 2, y: (Math.random() - 0.5) * h * 2, z: Math.random() * w }));
  }
  function draw(step) {
    ctx.fillStyle = boost > 1 ? 'rgba(2,3,4,.35)' : '#020304';
    ctx.fillRect(0, 0, w, h);
    for (const s of list) {
      const pz = s.z;
      s.z -= step;
      if (s.z < 1) { s.x = (Math.random() - 0.5) * w * 2; s.y = (Math.random() - 0.5) * h * 2; s.z = w; continue; }
      const k = (w * 0.5) / s.z, kp = (w * 0.5) / pz;
      const x = s.x * k + w / 2, y = s.y * k + h / 2;
      const a = Math.min(1, (1 - s.z / w) * 1.3);
      ctx.strokeStyle = `rgba(${tint},${a})`;
      ctx.lineWidth = Math.max(0.6, (1 - s.z / w) * 2.2);
      ctx.beginPath();
      ctx.moveTo(s.x * kp + w / 2, s.y * kp + h / 2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  function frame() {
    boost *= 0.94;
    draw(speed + boost);
    raf = requestAnimationFrame(frame);
  }
  size();
  new ResizeObserver(size).observe(cv);
  if (reduce) draw(0);
  else raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !reduce) raf = requestAnimationFrame(frame);
  });
  return {
    warp() { boost = 26; },
    tint(t) { tint = t; if (reduce) draw(0); },
  };
})();

// ── 計器
function fact(en, ja, value, cls = '') {
  const d = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = en;
  const sm = document.createElement('small');
  sm.textContent = ja;
  dt.appendChild(sm);
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (cls) dd.className = cls;
  d.append(dt, dd);
  return d;
}
function key(code, text, onClick, cls = '', href = '') {
  const el = document.createElement(href ? 'a' : 'button');
  if (href) { el.href = href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  else el.type = 'button';
  el.className = 'key press ' + cls;
  const b = document.createElement('b');
  b.textContent = code;
  const s = document.createElement('span');
  s.textContent = text;
  el.append(b, s);
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
function logLines(lines) {
  const ol = $('#log');
  ol.innerHTML = '';
  lines.forEach(([text, cls], i) => {
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    li.style.setProperty('--i', String(i));
    ol.appendChild(li);
  });
}
const shortAddr = (a) => (!a ? '—' : a.length < 16 ? a : `${a.slice(0, 8)}…${a.slice(-6)}`);
const hnum = (n) => '#' + Number(n).toLocaleString('en-US');

let current = null;
let ctx = { demo: false, addr: null, name: null, net: 'main', type: null };

function setReadouts(model) {
  const f = model.first, m = model.move;
  const r = { tl: 'HDG ———', tr: 'INCL ———', bl: 'SEAL ———', br: 'Δt ———' };
  if ((model.state === 'sealed' || model.state === 'rumbling') && f) {
    const d = S.diskDNA(f.hash);
    Object.assign(r, { tl: `HDG ${d.bearing.toFixed(1)}°`, tr: `INCL ${d.incl.toFixed(3)}`, bl: `SEAL ${hnum(f.height)}`, br: `Δt ${daysBetweenJST(f.time, now())}D` });
    if (model.state === 'rumbling') r.br = 'XFER PENDING';
  } else if (model.state === 'released' && f && m) {
    const t = S.tessDNA(m.hash);
    Object.assign(r, { tl: `JET ${t.jet.toFixed(1)}°`, tr: `D4 ${t.d4.toFixed(2)}`, bl: `SEAL ${hnum(f.height)}`, br: `REL ${hnum(m.height)}` });
  } else if (model.state === 'gathering') {
    Object.assign(r, { tl: 'HDG ———', tr: 'INBOUND', bl: 'SEAL PENDING', br: `${Math.max(1, model.pendingCount || 1)} TX` });
  } else if (model.state === 'empty') {
    Object.assign(r, { tl: 'NO SIGNAL', tr: 'STANDBY', bl: 'SEAL ———', br: '0 TX' });
  }
  for (const k of Object.keys(r)) $('#vp-' + k).textContent = r[k];
}

function render(model, { animate = true } = {}) {
  current = model;
  const st = model.state;
  const c = COPY[st] || COPY.error;
  document.body.dataset.state = st;
  const chip = $('#chip');
  chip.className = 'tchip s-' + st;
  chip.innerHTML = '';
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = c.chip;
  chip.appendChild(t);
  $('#state-en').textContent = c.en;
  $('#state-en').className = 'label' + (st === 'released' ? ' ice' : st === 'gathering' ? ' sig' : '');
  $('#state-title').textContent = c.title;
  $('#state-desc').textContent = model.desc || c.desc;
  stars.tint(st === 'released' ? '200,232,255' : '255,236,210');

  // 額
  const box = $('#amount-box');
  const total = model.balance ? model.balance.confirmed + model.balance.pending : 0;
  const sub = $('#amount-sub');
  sub.hidden = true;
  box.hidden = !['gathering', 'sealed', 'rumbling', 'released'].includes(st);
  if (st === 'gathering') {
    $('#amount-label').textContent = 'INBOUND · 確認中の入金';
    $('#amount').textContent = fmtSats(model.pendingIn || 0);
  } else if (model.first) {
    $('#amount-label').textContent = 'PAYLOAD · 封じた額（最初の入金）';
    $('#amount').textContent = fmtSats(model.first.amount);
    if (st === 'released' || total !== model.first.amount) {
      sub.hidden = false;
      sub.textContent = `NOW · いまの残高 ${fmtSats(total)} sats`;
    }
  }

  // 計器
  const facts = $('#facts');
  facts.innerHTML = '';
  const f = model.first, m = model.move;
  const list = [];
  if (st === 'sealed' && f) {
    list.push(fact('SEALED', '封じた日', fmtDateDot(f.time)), fact('IN ORBIT', '周回', `${daysBetweenJST(f.time, now()).toLocaleString('en-US')} DAYS`, 'hot'), fact('BLOCK', '封印', hnum(f.height)));
    if ((model.depositCount || 1) > 1) list.push(fact('DEPOSITS', '入金', `${model.depositCount} TX`));
  } else if (st === 'rumbling' && f) {
    list.push(fact('SEALED', '封じた日', fmtDateDot(f.time)), fact('BLOCK', '封印', hnum(f.height)), fact('TRANSFER', '移動', '承認待ち', 'hot'));
  } else if (st === 'released' && f && m) {
    list.push(fact('ORBIT', '封じていた', `${daysBetweenJST(f.time, m.time).toLocaleString('en-US')} DAYS`, 'cool'), fact('SEAL', '入金', hnum(f.height)), fact('RELEASE', '移動', hnum(m.height), 'cool'), fact('DATE', '移動日', fmtDateDot(m.time)));
  } else if (st === 'gathering') {
    list.push(fact('STATUS', '状態', '承認待ち', 'sig'), fact('INBOUND', '入金', `${Math.max(1, model.pendingCount || 1)} TX`), fact('EMBLEM', '紋', '承認後に'));
  } else if (st === 'empty') {
    list.push(fact('TARGET', '宛先', shortAddr(model.address)), fact('PAYLOAD', '中身', '0 sats'));
  }
  list.forEach((el, i) => { el.style.setProperty('--i', String(i)); facts.appendChild(el); });

  // 操作卓
  const act = $('#actions');
  act.innerHTML = '';
  const verify = () => key('VERIFY', 'mempool で確かめる', ctx.demo ? () => toast('見本なので、確かめる先はありません') : null, '', ctx.demo ? '' : `${model.web}/address/${model.address}`);
  if (st === 'sealed') act.append(key('RETURN', '受け取った方へ', () => openSheet('#guide-sheet'), 'wide primary'), key('FUND', '入金用のQR', openQr), verify());
  else if (st === 'released') act.append(key('CAPTURE', '紋を画像で保存', saveEmblem, 'wide primary ice'), verify());
  else if (st === 'gathering') act.append(verify(), key('FUND', '入金用のQR', openQr));
  else if (st === 'rumbling') { const v = verify(); v.classList.add('wide'); act.append(v); }
  else if (st === 'empty') act.append(key('FUND', '入金用のQR', openQr, 'wide primary'), verify());

  // 記録
  const L = [];
  if (st === 'loading') L.push(['ESTABLISHING LINK…', '']);
  else if (ctx.demo) L.push(['DEMO MODE · 見本の記録（実在のブロック）', '']);
  if (st !== 'loading') L.push(['LINK ESTABLISHED', 'ok'], [`TARGET ${shortAddr(model.address)}`, '']);
  if (st === 'sealed') L.push([`SEAL BLOCK ${hnum(f.height)} VERIFIED`, ''], [`ORBIT ${daysBetweenJST(f.time, now())} DAYS`, ''], ['STATUS · SINGULARITY HOLDING', 'ok']);
  else if (st === 'released') L.push([`SEAL BLOCK ${hnum(f.height)}`, ''], [`RELEASE BLOCK ${hnum(m.height)} VERIFIED`, ''], ['STATUS · TESSERACT OPEN', 'ok']);
  else if (st === 'gathering') L.push([`INBOUND TX DETECTED · ${Math.max(1, model.pendingCount || 1)}`, ''], ['AWAITING CONFIRMATION', 'ok']);
  else if (st === 'rumbling') L.push(['OUTBOUND TX DETECTED', 'warn'], ['AWAITING CONFIRMATION', '']);
  else if (st === 'empty') L.push(['NO PAYLOAD DETECTED', ''], ['STANDBY', 'ok']);
  logLines(L);

  setReadouts(model);
  $('#err').hidden = true;
  const changed = showEmblem(model);
  if (animate && changed && st === 'released') flash();
  if (animate && st === 'rumbling') shake();
}

function renderError(kind) {
  const E = {
    noaddr: ['アドレスがありません', 'このURLに、コインのアドレスが入っていません'],
    badaddr: ['アドレスを読めません', 'このURLのアドレスを読み取れませんでした'],
    net: ['通信が途絶えました', 'ブロックチェーンの公開データに届きませんでした'],
  }[kind] || ['読めません', ''];
  current = null;
  document.body.dataset.state = 'error';
  const chip = $('#chip');
  chip.className = 'tchip s-error';
  chip.innerHTML = '<span class="t">NO SIGNAL</span>';
  $('#state-en').textContent = 'NO SIGNAL';
  $('#state-en').className = 'label';
  $('#state-title').textContent = E[0];
  $('#state-desc').textContent = E[1];
  $('#amount-box').hidden = true;
  $('#facts').innerHTML = '';
  $('#actions').innerHTML = '';
  setReadouts({ state: 'error' });
  showEmblem({ state: 'empty' });
  const err = $('#err');
  err.hidden = false;
  err.innerHTML = '';
  const p = document.createElement('p');
  if (kind === 'net') {
    p.textContent = '電波の届くところで、もう一度試してください。アドレスはURLに入っているので、ほかのブロックエクスプローラーでも確かめられます。';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn wide';
    b.textContent = 'もう一度つなぐ';
    b.addEventListener('click', () => refresh());
    err.append(p, b);
  } else {
    p.textContent = 'コインをかざして開いたのにこの表示が出る場合は、タグへの書き込みをやり直してください。';
    const a = document.createElement('a');
    a.className = 'btn wide';
    a.href = '../setup/';
    a.textContent = '打ち上げの手順を開く';
    err.append(p, a);
  }
  logLines([['LINK FAILED', 'warn'], [kind === 'net' ? 'NO RESPONSE FROM NODES' : 'NO TARGET IN URL', '']]);
}

// ── 見本
function demoModel(s) {
  const base = { address: 'DEMO', web: 'https://mempool.space', state: s, balance: { confirmed: 10000, pending: 0, utxos: 1 }, depositCount: 1, pendingIn: 0, pendingCount: 0, first: null, move: null };
  const first = { txid: 'demo', amount: 10000, height: 840000, hash: H840, time: T840 };
  if (s === 'empty') return { ...base, balance: { confirmed: 0, pending: 0, utxos: 0 }, depositCount: 0 };
  if (s === 'gathering') return { ...base, balance: { confirmed: 0, pending: 10000, utxos: 1 }, pendingIn: 10000, pendingCount: 1 };
  if (s === 'rumbling') return { ...base, first, move: { txid: 'demo2', height: null, hash: null, time: null } };
  if (s === 'released') return { ...base, balance: { confirmed: 0, pending: 0, utxos: 0 }, first, move: { txid: 'demo2', height: 905900, hash: H905, time: T905 } };
  return { ...base, first };
}
function runDemo(s) {
  const state = ['empty', 'gathering', 'sealed', 'rumbling', 'released'].includes(s) ? s : 'sealed';
  const prev = current && current.state;
  render(demoModel(state), { animate: prev !== undefined && prev !== state });
  $$('#demo-bar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.demo === state)));
}

// ── 本番
let pollTimer = 0;
async function refresh() {
  clearTimeout(pollTimer);
  try {
    const model = await loadOmamori(ctx.addr, ctx.net);
    const seenKey = 'infinity:seen:' + ctx.addr;
    const seen = store.get(seenKey);
    render(model, { animate: !!seen && seen !== model.state });
    store.set(seenKey, model.state);
    if (model.state === 'gathering' || model.state === 'rumbling') pollTimer = setTimeout(refresh, 60000);
  } catch {
    renderError('net');
  }
}
async function tipLine() {
  const apis = (NETS[ctx.net] || NETS.main).apis;
  for (const base of apis) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    try {
      const r = await fetch(base + '/blocks/tip/height', { signal: c.signal, referrerPolicy: 'no-referrer' });
      if (!r.ok) continue;
      const h = Number(await r.text());
      if (!Number.isFinite(h)) continue;
      const nl = $('#netline');
      nl.hidden = false;
      const conf = current && current.state === 'sealed' && current.first && current.first.height ? ` · ${(h - current.first.height + 1).toLocaleString('en-US')} CONFIRMATIONS` : '';
      nl.textContent = `NODE LINK · ${new URL(base).host} · TIP ${hnum(h)}${conf}`;
      return;
    } catch {
      /* 次へ */
    } finally {
      clearTimeout(t);
    }
  }
}

// ── 入金の QR
function openQr() {
  if (ctx.demo || !current) { toast('見本なので、入金先はありません'); return; }
  $('#qr').innerHTML = qrSvg(bip21(current.address));
  $('#qr-addr').textContent = group4(current.address).join(' ');
  openSheet('#qr-sheet');
}
$('#copy-addr').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(current.address); toast('アドレスをコピーしました'); }
  catch { toast('コピーできませんでした。長押しで選んでください'); }
});

// ── 受け取った方へ
function pick(which) {
  $('#pick-keep').setAttribute('aria-pressed', String(which === 'keep'));
  $('#pick-move').setAttribute('aria-pressed', String(which === 'move'));
  $('#keep-info').hidden = which !== 'keep';
  $('#move-info').hidden = which !== 'move';
  if (which === 'move') showFee();
}
async function showFee() {
  const n = $('#fee-n'), p = $('#fee-p');
  if (ctx.demo) { n.textContent = '約220 sats'; p.textContent = '（見本の額の約2%）'; return; }
  n.textContent = '計算中…';
  p.textContent = '';
  const fr = await loadFeeRate(ctx.net).catch(() => null);
  if (!fr || !current) { n.textContent = '取得できませんでした'; return; }
  const vb = estimateSweepVbytes(ctx.type, Math.max(1, (current.balance && current.balance.utxos) || 1));
  const fee = Math.ceil(fr.rate * vb);
  const total = current.balance ? current.balance.confirmed + current.balance.pending : 0;
  n.textContent = `約${fmtSats(fee)} sats`;
  p.textContent = total > 0 ? `（いまの残高の約${Math.max(1, Math.round((fee / total) * 100))}%）` : '';
}
$('#pick-keep').addEventListener('click', () => pick('keep'));
$('#pick-move').addEventListener('click', () => pick('move'));

// ── シート・拡大・知らせ
let lastFocus = null;
function openSheet(sel) {
  lastFocus = document.activeElement;
  const sh = $(sel);
  sh.classList.add('on');
  sh.setAttribute('aria-hidden', 'false');
  $('#sheet-back').classList.add('on');
  const x = $('[data-close]', sh);
  if (x) setTimeout(() => x.focus(), 60);
}
function closeSheets() {
  const open = $$('.sheet.on');
  if (!open.length) return false;
  open.forEach((s) => { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); });
  $('#sheet-back').classList.remove('on');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
  return true;
}
$('#sheet-back').addEventListener('click', closeSheets);
$$('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
$('#stage').addEventListener('click', () => {
  if (!current) return;
  $('#zimg').innerHTML = emblemFor(current, 'z' + ++seq);
  $('#zoom').hidden = false;
  $('#zoom').focus();
});
$('#zoom').addEventListener('click', () => { $('#zoom').hidden = true; $('#stage').focus(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#zoom').hidden) { $('#zoom').hidden = true; return; }
  closeSheets();
});
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ── 紋を画像に
async function saveEmblem() {
  if (!current) return;
  try {
    const size = 1400;
    const svg = emblemFor(current, 'p' + ++seq).replace('<svg ', `<svg width="${size}" height="${size}" `);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#030507';
    c2.fillRect(0, 0, size, size);
    c2.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const f = current.first, m = current.move;
    const fname = f ? `infinity-${f.height}${m && m.height ? '-' + m.height : ''}.png` : 'infinity.png';
    const file = new File([png], fname, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'INFINITY の紋' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(png);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('紋を保存しました');
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('保存できませんでした');
  }
}

// ── はじめる
async function start() {
  const p = parseParams();
  if (p.demo) {
    ctx = { demo: true, addr: null, name: 'はるへ', net: 'main', type: 'p2wpkh' };
    $('#demo-badge').hidden = false;
    $('#demo-bar').hidden = false;
    $('#name').hidden = false;
    $('#name').textContent = ctx.name;
    $$('#demo-bar button').forEach((b) => b.addEventListener('click', () => runDemo(b.dataset.demo)));
    runDemo(p.demoState);
    $('#netline').hidden = false;
    $('#netline').textContent = 'DEMO · 実在のブロック #840,000 と #905,900 で描いています';
    return;
  }
  if (!p.addr) { renderError('noaddr'); return; }
  const v = await validateAddress(p.addr);
  if (!v.ok) { renderError('badaddr'); return; }
  const net = v.network === 'main' ? 'main' : p.net === 'signet' ? 'signet' : 'test';
  ctx = { demo: false, addr: v.address, name: p.name, net, type: v.type };
  if (p.name) { $('#name').hidden = false; $('#name').textContent = p.name; }
  if (net !== 'main') { $('#demo-badge').hidden = false; $('#demo-badge').textContent = net === 'signet' ? 'SIGNET · テスト用' : 'TESTNET · テスト用'; }
  render({ state: 'loading', address: v.address }, { animate: false });
  await refresh();
  tipLine();
}
window.addEventListener('hashchange', () => location.reload());
start();
