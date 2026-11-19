// 御守りページ ── かざした先で、空模様（状態）と紋を表示する
import { $, $$, b64urlDecodeUtf8, fmtSats, fmtDateDot, fmtDateShort, daysBetweenJST, group4, store } from './util.js';
import { validateAddress } from './address.js';
import { loadOmamori, loadFeeRate, estimateSweepVbytes, NETS } from './chain.js';
import * as R from './raimon.js';
import { bip21, qrSvg } from './qr.js';

const COPY = {
  loading: { chip: '読み取り中', title: '　', desc: '空模様を読み取っています' },
  empty: { chip: 'まだ空', title: '空', desc: 'まだ何も宿っていません' },
  gathering: { chip: '入金を確認中', title: '雲集い', desc: '入金を確かめています。承認されると紋が描かれます' },
  sealed: { chip: '保管中', title: '雷雲', desc: 'この御守りには、雷が封じられています' },
  rumbling: { chip: '移動を確認中', title: '雷鳴', desc: '封が動きはじめました。承認されると稲妻に' },
  released: { chip: '移動済み', title: '稲妻', desc: '封は解かれ、雷は放たれました' },
  error: { chip: '読めません', title: '　', desc: '空模様を読めませんでした' },
};
const HALO = {
  loading: 'transparent',
  error: 'transparent',
  empty: 'transparent',
  gathering: 'radial-gradient(circle, rgba(159,199,255,.12), rgba(159,199,255,0) 65%)',
  sealed: 'radial-gradient(circle, rgba(220,228,232,.16), rgba(220,228,232,0) 62%)',
  rumbling: 'radial-gradient(circle, rgba(255,106,61,.16), rgba(255,106,61,0) 62%)',
  released: 'radial-gradient(circle, rgba(255,122,74,.32), rgba(255,122,74,0) 64%)',
};

// 見本（実在するブロック #840,000 と #905,900。金額は架空）
const DEMO_FIRST = { txid: 'demo', amount: 10000, height: 840000, hash: '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5', time: 1713571767 };
const DEMO_MOVE = { txid: 'demo-move', height: 905900, hash: '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572', time: 1752727208 };

const app = $('#app');
const stage = $('#stage');
const layers = [$('#em-a'), $('#em-b')];
let front = 0;
let current = null; // いま表示している model
let lastSvg = null;
let addrType = 'p2wpkh';
let pollTimer = null;
let seq = 0;

// ── URL を読む：#<アドレス>&n=<名前>&net=signet、または #demo=sealed
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
function emblemFor(model, idp) {
  const f = model.first, m = model.move;
  switch (model.state) {
    case 'empty': return R.empty();
    case 'gathering': return R.gathering({ id: idp + 'g' });
    case 'sealed': return R.sealed(f.hash, { id: idp + 's', block: String(f.height), date: fmtDateDot(f.time) });
    case 'rumbling': return R.rumbling(f.hash, { id: idp + 'r', block: String(f.height), date: fmtDateDot(f.time) });
    case 'released': return R.released(f.hash, m.hash, { id: idp + 'x', block: String(f.height), moveBlock: String(m.height), moveDate: fmtDateDot(m.time) });
    default: return '';
  }
}

function showEmblem(model) {
  const key = model.state + ':' + (model.first ? model.first.hash : '') + ':' + (model.move && model.move.hash ? model.move.hash : '');
  if (stage.dataset.key === key) return;
  stage.dataset.key = key;
  const svg = emblemFor(model, 'e' + (++seq));
  lastSvg = svg;
  const next = layers[1 - front];
  const prev = layers[front];
  next.innerHTML = svg;
  next.className = 'em' + (model.state === 'released' ? ' hex' : '') + (model.state === 'gathering' ? ' breath' : '');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.classList.add('on');
    prev.classList.remove('on');
  }));
  front = 1 - front;
  $$('.holo', stage).forEach((n) => n.remove());
  if (model.state === 'sealed') stage.insertAdjacentHTML('beforeend', '<span class="holo" aria-hidden="true"></span>');
}

function flash() {
  const el = document.createElement('span');
  el.className = 'flash';
  el.setAttribute('aria-hidden', 'true');
  stage.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

function shake() {
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

// ── 文言と数字
function setChip(state) {
  const chip = $('#chip');
  chip.className = 'tchip s-' + state;
  chip.innerHTML = '';
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = COPY[state].chip;
  chip.appendChild(t);
}

function fact(k, v, cls = '') {
  const d = document.createElement('div');
  const dt = document.createElement('dt'); dt.textContent = k;
  const dd = document.createElement('dd'); dd.textContent = v; if (cls) dd.className = cls;
  d.append(dt, dd);
  return d;
}

const shortAddr = (a) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function render(model, { animate = true } = {}) {
  const prevState = current ? current.state : null;
  current = model;
  const st = model.state;
  app.dataset.state = st;
  setChip(st);
  $('#halo').style.background = HALO[st] || 'transparent';
  $('#state-title').textContent = COPY[st].title;
  $('#state-desc').textContent = model.desc || COPY[st].desc;
  $('#state-title').parentElement.classList.remove('rise');
  void $('#state-title').offsetWidth;
  if (animate) $('#state-title').parentElement.classList.add('rise');

  if (st === 'loading' || st === 'error') showEmblem({ state: 'empty' });
  else showEmblem(model);
  $('#skeleton').hidden = !(st === 'loading' || st === 'error');

  // 金額
  const lbl = $('#amount-label'), num = $('#amount'), note = $('#amount-note');
  note.hidden = true;
  $('#amount-box').hidden = st === 'loading' || st === 'error';
  if (st === 'empty') { lbl.textContent = 'このアドレスの残高'; num.textContent = fmtSats(model.balance.confirmed); }
  else if (st === 'gathering') { lbl.textContent = '確認中の入金'; num.textContent = fmtSats(model.pendingIn); }
  else if (model.first) {
    lbl.textContent = '封じた額（最初の入金）';
    num.textContent = fmtSats(model.first.amount);
    const nowBal = model.balance.confirmed + model.balance.pending;
    if (nowBal !== model.first.amount) { note.textContent = `いまの残高 ${fmtSats(nowBal)} sats`; note.hidden = false; }
  }

  // 三つの数字
  const facts = $('#facts');
  facts.innerHTML = '';
  const now = Math.floor(Date.now() / 1000);
  if (st === 'empty') facts.append(fact('受取アドレス', shortAddr(model.address)), fact('入金', 'まだ'), fact('紋', '未定'));
  if (st === 'gathering') facts.append(fact('状態', '承認待ち', 'cool'), fact('入金の数', String(Math.max(1, model.pendingCount || 1)) + '件', 'cool'), fact('紋', '承認後に'));
  if (st === 'sealed') facts.append(fact('封じた日', fmtDateShort(model.first.time)), fact('封じてから', daysBetweenJST(model.first.time, model.nowTs || now) + '日'), fact('ブロック', '#' + fmtSats(model.first.height)));
  if (st === 'rumbling') facts.append(fact('封じた日', fmtDateShort(model.first.time)), fact('移動', '確認中', 'hot'), fact('ブロック', '#' + fmtSats(model.first.height)));
  if (st === 'released') facts.append(fact('封じていた', daysBetweenJST(model.first.time, model.move.time) + '日'), fact('入金', '#' + fmtSats(model.first.height)), fact('移動', '#' + fmtSats(model.move.height), 'hot'));

  // ボタン
  const acts = $('#actions');
  acts.innerHTML = '';
  const btn = (text, cls, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn wide ' + cls; b.textContent = text; b.addEventListener('click', on); acts.appendChild(b); return b; };
  const link = (text, href) => {
    const a = document.createElement('a');
    a.className = 'btn wide ghost-dark';
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = text;
    a.insertAdjacentHTML('beforeend', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>');
    acts.appendChild(a);
  };
  if (st === 'empty') { btn('入金用のQRを表示', 'light', openQr); if (model.web) link('mempoolでアドレスを見る', model.web); }
  if (st === 'gathering' || st === 'rumbling') { if (model.web) link('mempoolで確かめる', model.web); }
  if (st === 'sealed') { btn('受け取った方へ', 'light', () => openSheet('#guide-sheet')); if (model.web) link('mempoolで確かめる', model.web); }
  if (st === 'released') { btn('紋を画像で保存', 'bright', saveEmblem); if (model.web) link('mempoolで移動を確かめる', model.web); }

  // 動き
  if (animate && st === 'released' && prevState !== 'released' && model.flash !== false) flash();
  if (animate && st === 'rumbling' && prevState !== 'rumbling') shake();
}

// ── 失敗したとき
function renderError(kind, info = {}) {
  const ERR = {
    noaddr: ['アドレスがありません', 'このURLに、御守りのアドレスが入っていません'],
    badaddr: ['アドレスを読めません', 'このURLのアドレスを読み取れませんでした'],
    net: ['空模様を読めません', 'ブロックチェーンの公開データに届きませんでした'],
  }[kind] || ['読めません', ''];
  render({ state: 'error', desc: ERR[1] }, { animate: false });
  $('#state-title').textContent = ERR[0];
  const box = $('#err');
  box.hidden = false;
  box.innerHTML = '';
  const p = document.createElement('p');
  p.style.margin = '0 0 10px';
  if (kind === 'net') {
    p.textContent = 'ブロックチェーンの公開データを読めませんでした。通信をお確かめのうえ、もう一度お試しください。アドレスはこちらです。';
    const c = document.createElement('code'); c.textContent = info.address;
    box.append(p, c);
    const again = document.createElement('button');
    again.type = 'button'; again.className = 'btn wide light'; again.style.marginTop = '12px'; again.textContent = 'もう一度読む';
    again.addEventListener('click', () => { box.hidden = true; start(); });
    box.appendChild(again);
  } else {
    p.textContent = kind === 'noaddr'
      ? '御守りをかざして開いたのに、この表示が出る場合は、タグへの書き込みをやり直してください。'
      : 'タグに書かれたURLが途中で欠けているかもしれません。書き込みをやり直してください。';
    const a = document.createElement('a'); a.className = 'btn wide light'; a.href = '../setup/'; a.textContent = '封じの手順を開く';
    box.append(p, a);
  }
}

// ── 案内（下から出る）
let lastFocus = null;
function openSheet(sel) {
  lastFocus = document.activeElement;
  const sh = $(sel);
  sh.classList.add('on'); sh.setAttribute('aria-hidden', 'false');
  $('#sheet-back').classList.add('on');
  const f = sh.querySelector('[data-close]');
  if (f) setTimeout(() => f.focus(), 50);
}
function closeSheets() {
  $$('.sheet.on').forEach((s) => { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); });
  $('#sheet-back').classList.remove('on');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
$('#sheet-back').addEventListener('click', closeSheets);
$$('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));

function pick(which) {
  $('#pick-keep').setAttribute('aria-pressed', String(which === 'keep'));
  $('#pick-move').setAttribute('aria-pressed', String(which === 'move'));
  $('#keep-info').hidden = which !== 'keep';
  $('#move-info').hidden = which !== 'move';
  if (which === 'move') showFee();
}
$('#pick-keep').addEventListener('click', () => pick('keep'));
$('#pick-move').addEventListener('click', () => pick('move'));

async function showFee() {
  const n = $('#fee-n'), p = $('#fee-p');
  if (!current) return;
  if (current.demo) {
    n.textContent = '約220'; p.textContent = '2%';
    $('#fee-note').textContent = '見本：2 sat/vB、入力1つ・出力1つ（約110 vB）の場合。実際の手数料は、お使いのウォレットで決まります。';
    return;
  }
  n.textContent = '…'; p.textContent = '';
  const fee = await loadFeeRate(current.net);
  if (!fee) { n.textContent = '—'; $('#fee-note').textContent = 'いまの手数料を読めませんでした。お使いのウォレットの表示をご覧ください。'; return; }
  const vb = estimateSweepVbytes(addrType, current.balance.utxos);
  const sats = Math.ceil(vb * fee.rate);
  const bal = current.balance.confirmed;
  n.textContent = '約' + fmtSats(sats);
  p.textContent = bal > 0 ? Math.max(1, Math.round((sats / bal) * 100)) + '%' : '';
  $('#fee-note').textContent = `${fee.source} の推奨手数料（30分ほどで承認されるめやす：${fee.rate} sat/vB）と、およそ ${vb} vB から計算した値です。実際の手数料は、お使いのウォレットで決まります。`;
}

// ── 入金用のQR
function openQr() {
  if (!current || !current.address) return;
  if (current.demo) { toast('見本では入金用のQRを出しません'); return; }
  const a = current.address;
  $('#qr').innerHTML = qrSvg(bip21(a));
  $('#qr-addr').textContent = group4(a).join(' ');
  openSheet('#qr-sheet');
}
$('#copy-addr').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(current.address); toast('アドレスをコピーしました'); }
  catch { toast('コピーできませんでした。長押しで選んでください'); }
});

// ── 拡大
stage.addEventListener('click', () => {
  if (!current || current.state === 'loading' || current.state === 'error') return;
  $('#zimg').innerHTML = emblemFor(current, 'z' + (++seq));
  $('#zoom').classList.add('on');
});
$('#zoom').addEventListener('click', () => $('#zoom').classList.remove('on'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { $('#zoom').classList.remove('on'); closeSheets(); }
});

// ── 紋を画像で保存（アドレスは入らない）
async function saveEmblem() {
  if (!current) return;
  try {
    const size = 1200;
    const svg = emblemFor(current, 'p' + (++seq)).replace('<svg ', `<svg width="${size}" height="${size}" `);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#101416';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const fname = current.first ? `inazuma-${current.first.height}${current.move && current.move.height ? '-' + current.move.height : ''}.png` : 'inazuma.png';
    const file = new File([png], fname, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '稲妻守の紋' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(png); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('紋を保存しました');
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('保存できませんでした');
  }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

// ── 見本
function demoModel(state) {
  const base = { demo: true, address: 'bc1q…（見本）', net: 'main', web: null, balance: { confirmed: 10000, pending: 0, utxos: 1 }, pendingIn: 10000, flash: true, nowTs: Math.floor(Date.now() / 1000) };
  if (state === 'empty') return { ...base, state, balance: { confirmed: 0, pending: 0, utxos: 0 }, first: null, move: null };
  if (state === 'gathering') return { ...base, state, balance: { confirmed: 0, pending: 10000, utxos: 0 }, first: null, move: null };
  if (state === 'released') return { ...base, state, balance: { confirmed: 0, pending: 0, utxos: 0 }, first: DEMO_FIRST, move: DEMO_MOVE };
  if (state === 'rumbling') return { ...base, state, first: DEMO_FIRST, move: { txid: 'x', height: null, hash: null, time: null } };
  return { ...base, state: 'sealed', first: DEMO_FIRST, move: null };
}

function runDemo(initial) {
  $('#demo-badge').hidden = false;
  const bar = $('#demo-bar');
  bar.hidden = false;
  const set = (s) => {
    $$('button', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.demo === s)));
    render(demoModel(s));
    history.replaceState(null, '', '#demo=' + s);
  };
  $$('button', bar).forEach((b) => b.addEventListener('click', () => set(b.dataset.demo)));
  $('#copy-addr').disabled = true;
  set(['empty', 'gathering', 'sealed', 'rumbling', 'released'].includes(initial) ? initial : 'sealed');
}

// ── はじめる
async function start() {
  const p = parseParams();
  if (p.demo) { runDemo(p.demoState); return; }
  if (!p.addr) { renderError('noaddr'); return; }
  const v = await validateAddress(p.addr);
  if (!v.ok) { renderError('badaddr'); return; }
  addrType = v.type;
  const net = v.network === 'main' ? 'main' : (p.net === 'signet' ? 'signet' : 'test');
  if (p.name) { const nm = $('#name'); nm.textContent = p.name; nm.hidden = false; document.title = `${p.name} ── 稲妻守`; }
  render({ state: 'loading' }, { animate: false });
  await refresh(v.address, net, true);
}

async function refresh(address, net, firstTime) {
  try {
    const model = await loadOmamori(address, net);
    const seenKey = 'inazuma:seen:' + address;
    const seen = store.get(seenKey);
    model.flash = model.state === 'released' && seen !== 'released';
    if (!current || current.state !== model.state || firstTime) render(model);
    store.set(seenKey, model.state);
    if (net !== 'main') { const nb = $('#demo-badge'); nb.textContent = 'テスト用'; nb.hidden = false; }
    clearTimeout(pollTimer);
    if (model.state === 'gathering' || model.state === 'rumbling') {
      pollTimer = setTimeout(() => { if (!document.hidden) refresh(address, net, false); else document.addEventListener('visibilitychange', () => refresh(address, net, false), { once: true }); }, 60000);
    }
  } catch (e) {
    if (firstTime || !current || current.state === 'loading') renderError('net', { address });
  }
}

start();
window.addEventListener('hashchange', () => location.reload());
