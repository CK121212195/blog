// 封じの手順 ── 鍵は扱わず、公開の受取アドレスだけで進める
import { $, $$, group4, store, prefersReducedMotion } from './util.js';
import { validateAddress, REASON_TEXT } from './address.js';
import { omamoriBase, omamoriUrl, ndefBytes, nameRoom, TAG_BYTES } from './site.js';
import * as NFC from './nfc.js';
import { bip21, qrSvg } from './qr.js';
import * as R from './raimon.js';

const KEY = 'inazuma:setup:v1';
const KEEP_MS = 14 * 86400 * 1000; // 途中の記録は2週間で捨てる
const BASE = omamoriBase(location.href);
const LAST = 6;
const HOLD_MS = 1200;
const RING = 2 * Math.PI * 60;

// ── 進みぐあい（この端末の中だけに残す。鍵は入らない）
function fresh() {
  return {
    step: 0, method: 'seed', checks: [false, false, false],
    addrInput: '', testNet: 'test', chips: [], chipsFor: '', name: '',
    os: NFC.nfcSupported() ? 'android' : 'iphone',
    writtenUrl: '', verifiedUrl: '', lockedUrl: '', iosUrl: '', sealedUrl: '',
  };
}
function load() {
  try {
    const raw = store.get(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || !o.t || Date.now() - o.t > KEEP_MS) return null;
    const s = { ...fresh(), ...o };
    if (!Array.isArray(s.checks) || s.checks.length !== 3) s.checks = [false, false, false];
    if (!Array.isArray(s.chips)) s.chips = [];
    if (!['seed', 'key'].includes(s.method)) s.method = 'seed';
    if (!['android', 'iphone'].includes(s.os)) s.os = fresh().os;
    if (!['test', 'signet'].includes(s.testNet)) s.testNet = 'test';
    s.name = String(s.name || '').slice(0, 40);
    return s;
  } catch {
    return null;
  }
}
let S = load() || fresh();
const save = () => store.set(KEY, JSON.stringify({ ...S, t: Date.now() }));

let V = null; // 受取アドレスを確かめた結果
let cur = -1;

const net = () => (V && V.ok ? (V.network === 'main' ? 'main' : S.testNet) : 'main');
const url = () => (V && V.ok ? omamoriUrl({ address: V.address, name: S.name, net: net() }, BASE) : '');

// ── 進めるかどうか
const okChecks = () => S.checks.every(Boolean);
const okChips = () => !!(V && V.ok && S.chipsFor === V.address && S.chips.length === group4(V.address).length && S.chips.every(Boolean));
const okName = () => !!(V && V.ok && ndefBytes(url()) <= TAG_BYTES);
const okAddr = () => okChips() && okName();
const okNfc = () => { const u = url(); return !!u && (S.writtenUrl === u || S.iosUrl === u); };
const okSeal = () => { const u = url(); return !!u && S.sealedUrl === u; };
const NEED = [() => true, () => true, () => true, okChecks, okAddr, okNfc, okSeal];
function clampStep(n) {
  for (let k = 3; k <= n; k++) if (!NEED[k]()) return k - 1;
  return n;
}

// ── 手順を移る
function go(n, { mode = 'push' } = {}) {
  const want = Math.max(0, Math.min(LAST, n | 0));
  n = clampStep(want);
  const prev = cur;
  if (prev === 4 && n !== 4) stopNfc();
  if (prev === 5 && n !== 5) holdEnd();
  $$('.step').forEach((sec) => { sec.hidden = Number(sec.dataset.step) !== n; });
  const sec = $('#s' + n);
  sec.classList.remove('enter-fwd', 'enter-back');
  if (!prefersReducedMotion()) { void sec.offsetWidth; sec.classList.add(prev < 0 || n >= prev ? 'enter-fwd' : 'enter-back'); }
  cur = n;
  if (n > 0) { S.step = n; save(); }
  renderTop();
  enter(n);
  window.scrollTo(0, 0);
  if (prev >= 0) { const h = $('.h', sec); if (h) h.focus({ preventScroll: true }); }
  if (prev >= 0 && n !== prev) {
    if (mode === 'push') history.pushState({ step: n, from: prev }, '');
    else if (mode === 'replace') history.replaceState({ step: n, from: -1 }, '');
  }
  if (mode === 'none' && n !== want) history.replaceState({ step: n, from: -1 }, '');
}
function back() {
  const st = history.state;
  if (st && st.step === cur && st.from === cur - 1) history.back();
  else go(cur - 1, { mode: 'replace' });
}
window.addEventListener('popstate', (e) => {
  closeSheet();
  const n = e.state && Number.isInteger(e.state.step) ? e.state.step : 0;
  go(n, { mode: 'none' });
});

function renderTop() {
  const inSteps = cur >= 1 && cur <= 5;
  $('#dots').hidden = !inSteps;
  $('#top-label').hidden = inSteps;
  $('#top-label').textContent = cur === 6 ? '封じました' : '封じの手順';
  $$('#dots span').forEach((d, i) => { const k = i + 1; d.className = k < cur ? 'done' : k === cur ? 'now' : ''; });
}

function enter(n) {
  [renderIntro, renderMethod, renderChecks, renderAddr, renderNfc, renderSeal, renderDone][n]();
}

function setNext(btn, ok, okText, ngText) {
  const was = btn.getAttribute('aria-disabled') === 'false';
  btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
  btn.textContent = ok ? okText : ngText;
  if (ok && !was && !prefersReducedMotion()) { btn.classList.remove('ready'); void btn.offsetWidth; btn.classList.add('ready'); }
}
function nudge(el) {
  el.classList.remove('nudge');
  void el.offsetWidth;
  el.classList.add('nudge');
}
const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* 震えなくても続ける */ } };

$$('[data-next]').forEach((b) => b.addEventListener('click', () => {
  if (b.getAttribute('aria-disabled') === 'true') { nudge(b); return; }
  go(cur + 1);
}));
$$('[data-back]').forEach((b) => b.addEventListener('click', back));

// ── 0 はじめに
function renderIntro() {
  const at = clampStep(S.step);
  const can = at >= 1;
  $('#resume').hidden = !can;
  $('#restart').hidden = !can;
  $('#start').hidden = can;
  if (can) $('#resume').textContent = at === LAST ? '前回の封じを見る' : `続きから（手順 ${at}）`;
}
$('#start').addEventListener('click', () => go(1));
$('#resume').addEventListener('click', () => go(clampStep(S.step)));
$('#restart').addEventListener('click', () => { reset(); go(1); });
function reset() {
  stopNfc();
  S = fresh();
  V = null;
  save();
  $('#addr').value = '';
  $('#name').value = '';
  $('#chips').dataset.addr = '';
}

// ── 1 鍵をつくり、札に書く
function renderMethod() {
  const seed = S.method === 'seed';
  const seg = $('#method-seg');
  $('.seg-ind', seg).className = 'seg-ind ' + (seed ? 'l' : 'r');
  $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.method === S.method)));
  $('#m-seed').hidden = !seed;
  $('#m-key').hidden = seed;
}
$$('#method-seg button').forEach((b) => b.addEventListener('click', () => {
  if (S.method === b.dataset.method) return;
  S.method = b.dataset.method;
  S.checks = [false, false, false]; // 形を変えたら、確かめ直す
  save();
  renderMethod();
}));

// ── 2 札を確かめる
const CHECK_TEXT = {
  seed: ['12語を、番号をつけて札に書いた（ウォレットの名前とアドレスの種類も）', '札と、ウォレットに表示された12語を、1語ずつ見比べた', '札の12語から復元して、同じ受取アドレスが出た'],
  key: ['秘密鍵を、札にはっきり書いた（ウォレットの名前も）', '札と、ウォレットに表示された秘密鍵を、1文字ずつ見比べた', '札の秘密鍵を読み込んで、同じ受取アドレスになった'],
};
const RESTORE_TEXT = {
  seed: '別のウォレットアプリ、またはウォレットの「復元」「インポート」で、新しいウォレットとして札の12語を入れます。',
  key: '秘密鍵を読み込める（インポートできる）ウォレットに、札の秘密鍵を入れます。',
};
function renderChecks() {
  const t = CHECK_TEXT[S.method];
  $$('#checks .ck').forEach((b, i) => {
    b.setAttribute('aria-pressed', String(!!S.checks[i]));
    $('.ck-t', b).textContent = t[i];
  });
  $('#rh-1').textContent = RESTORE_TEXT[S.method];
  setNext($('#checks-next'), okChecks(), '次へ：アドレスを照合する', 'すべて確かめると進めます');
}
$$('#checks .ck').forEach((b) => b.addEventListener('click', () => {
  const i = Number(b.dataset.ck);
  S.checks[i] = !S.checks[i];
  save();
  renderChecks();
}));

// ── 3 アドレスを照合する
const SHORT_TYPE = { p2wpkh: 'bc1q・ネイティブSegWit', p2wsh: 'bc1q・スクリプト', p2tr: 'bc1p・Taproot', p2pkh: '1で始まる・レガシー', p2sh: '3で始まる' };
const cleanAddr = (t) => String(t || '').trim().replace(/^bitcoin:/i, '').split('?')[0].replace(/\s+/g, '');
let vSeq = 0;
async function revalidate() {
  const raw = cleanAddr(S.addrInput);
  const my = ++vSeq;
  const v = raw ? await validateAddress(raw) : { ok: false, reason: 'empty' };
  if (my !== vSeq) return false;
  V = v;
  if (V.ok) {
    const n = group4(V.address).length;
    if (S.chipsFor !== V.address || S.chips.length !== n) { S.chips = new Array(n).fill(false); S.chipsFor = V.address; }
  }
  return true;
}

function renderAddr() {
  const ta = $('#addr');
  if (document.activeElement !== ta && ta.value !== S.addrInput) ta.value = S.addrInput;
  const has = cleanAddr(S.addrInput) !== '';
  const ok = !!(V && V.ok);
  ta.classList.toggle('ok', ok);
  ta.classList.toggle('ng', has && !ok);
  const msg = $('#addr-msg');
  if (!has) { msg.className = 'msg'; msg.textContent = ''; }
  else if (ok) {
    msg.className = 'msg ok';
    msg.innerHTML = '';
    const a = document.createElement('span'); a.className = 'ph'; a.textContent = '✓ 正しい形のアドレスです';
    const b = document.createElement('span'); b.className = 'ph'; b.textContent = `（${SHORT_TYPE[V.type] || V.type}${V.network === 'main' ? '' : '・テスト用'}）`;
    msg.append(a, b);
  } else {
    msg.className = 'msg ng';
    msg.textContent = REASON_TEXT[(V && V.reason) || 'format'] || REASON_TEXT.format;
  }

  const ns = $('#net-seg');
  ns.hidden = !(ok && V.network === 'test');
  if (!ns.hidden) {
    $('.seg-ind', ns).className = 'seg-ind ' + (S.testNet === 'signet' ? 'r' : 'l');
    $$('button', ns).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.net === S.testNet)));
  }

  $('#verify').hidden = !ok;
  if (ok) renderChips();
  renderName();
  const ngText = !ok ? 'アドレスを貼り付けると進めます' : !okChips() ? 'すべて照合すると進めます' : '名前を短くすると進めます';
  setNext($('#addr-next'), okAddr(), '次へ：NFCに書き込む', ngText);
}

function renderChips() {
  const g = group4(V.address);
  const box = $('#chips');
  if (box.dataset.addr !== V.address) {
    box.innerHTML = '';
    g.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = t;
      b.dataset.i = String(i);
      b.setAttribute('aria-label', `${i + 1}番目、${t.split('').join(' ')}`);
      box.appendChild(b);
    });
    box.dataset.addr = V.address;
  }
  $$('.chip', box).forEach((b, i) => b.setAttribute('aria-pressed', String(!!S.chips[i])));
  const n = S.chips.filter(Boolean).length;
  const c = $('#chip-count');
  c.textContent = n === g.length ? `✓ 照合 ${n} / ${g.length}` : `照合 ${n} / ${g.length}`;
  c.classList.toggle('all', n === g.length);
}
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b || !V || !V.ok) return;
  const i = Number(b.dataset.i);
  S.chips[i] = !S.chips[i];
  if (!S.chips[i]) { b.classList.remove('was'); void b.offsetWidth; b.classList.add('was'); }
  else vibrate(6);
  save();
  renderAddr();
});

function renderName() {
  const inp = $('#name');
  if (document.activeElement !== inp && inp.value !== S.name) inp.value = S.name;
  const msg = $('#name-msg');
  const meter = $('#meter');
  const bar = meter.firstElementChild;
  if (!(V && V.ok)) {
    bar.style.width = '0';
    meter.classList.remove('over');
    inp.classList.remove('ng');
    msg.className = 'msg sub';
    msg.textContent = '御守りのページの上に出ます。';
    return;
  }
  const used = ndefBytes(url());
  const over = used > TAG_BYTES;
  bar.style.width = Math.min(100, (used / TAG_BYTES) * 100) + '%';
  meter.classList.toggle('over', over);
  inp.classList.toggle('ng', over);
  if (over) {
    const chars = Array.from(S.name.trim());
    let k = 0;
    while (k < chars.length && ndefBytes(omamoriUrl({ address: V.address, net: net(), name: chars.slice(0, chars.length - k).join('') }, BASE)) > TAG_BYTES) k++;
    msg.className = 'msg ng';
    msg.textContent = `長すぎて、NFCタグに入りません。あと${k}文字ほど短くしてください。`;
  } else {
    const room = nameRoom({ address: V.address, net: net(), name: S.name }, BASE);
    msg.className = 'msg sub';
    msg.textContent = S.name.trim()
      ? `御守りのページの上に出ます。あと${room}文字（日本語）まで入ります。`
      : `御守りのページの上に出ます。日本語なら${room}文字まで入ります。`;
  }
}

let addrTimer = 0;
$('#addr').addEventListener('input', (e) => {
  S.addrInput = e.target.value;
  save();
  clearTimeout(addrTimer);
  addrTimer = setTimeout(async () => { if (await revalidate()) { save(); renderAddr(); } }, 120);
});
$('#addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
// 離れたら、確かめたアドレスの形（bech32 は小文字）にそろえる
$('#addr').addEventListener('blur', () => {
  if (V && V.ok && cleanAddr(S.addrInput).toLowerCase() === V.address.toLowerCase() && S.addrInput !== V.address) {
    S.addrInput = V.address;
    $('#addr').value = V.address;
    save();
  }
});
$('#paste').addEventListener('click', async () => {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('unsupported');
    const t = await navigator.clipboard.readText();
    if (!cleanAddr(t)) throw new Error('empty');
    S.addrInput = cleanAddr(t);
    $('#addr').value = S.addrInput;
    save();
    if (await revalidate()) { save(); renderAddr(); }
  } catch {
    toast('貼り付けできませんでした。欄を長押しして貼り付けてください');
    $('#addr').focus();
  }
});
$('#name').addEventListener('input', (e) => { S.name = e.target.value.slice(0, 40); save(); renderAddr(); });
$('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
$$('#net-seg button').forEach((b) => b.addEventListener('click', () => { S.testNet = b.dataset.net; save(); renderAddr(); }));

// ── 4 NFCに書き込む
let nfcBusy = null; // かざすのを待っている操作
let busyKind = '';
let lockArmed = 0;
const SUB = {
  '': '押したら、御守りをスマホの背面に当てて、そのまま待ちます。NFCの位置は機種によって違います。',
  wait: '御守りをスマホの背面に当てて、動かさずに。もう一度押すと止めます。',
  done: 'もう一度押すと、書き直せます（ロックするまで）。',
};
const LOOK = { '': 'NFCに書き込む', wait: 'かざしてください', done: '書き込みました', fail: '書き込めませんでした' };

function stopNfc() {
  if (nfcBusy) nfcBusy.abort();
  clearTimeout(lockArmed);
  lockArmed = 0;
}

function setNfcLook(state, sub) {
  const w = $('#nfc-write');
  w.classList.remove('wait', 'done', 'fail');
  if (state) w.classList.add(state);
  $('#nfc-text').textContent = LOOK[state];
  $('#nfc-sr').textContent = state === 'wait' ? '書き込みを止める' : state === 'done' ? 'もう一度書き込む' : 'NFCに書き込む';
  $('#nfc-sub').textContent = sub !== undefined ? sub : SUB[state] || SUB[''];
}

function renderNfc() {
  const u = url();
  $('#url').textContent = u;
  $('#url-size').textContent = `約${ndefBytes(u)} / ${TAG_BYTES}バイト`;
  const android = S.os === 'android';
  const seg = $('#os-seg');
  $('.seg-ind', seg).className = 'seg-ind ' + (android ? 'l' : 'r');
  $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.os === S.os)));
  $('#os-android').hidden = !android;
  $('#os-iphone').hidden = android;
  const sup = NFC.nfcSupported();
  $('#no-webnfc').hidden = sup;
  $('#nfc-write').setAttribute('aria-disabled', String(!sup));
  if (!nfcBusy) setNfcLook(S.writtenUrl === u ? 'done' : '');
  $('#ios-ck').setAttribute('aria-pressed', String(S.iosUrl === u));
  renderAfter();
}

function renderAfter() {
  const u = url();
  $('#nfc-after').hidden = S.writtenUrl !== u;
  const v = $('#nfc-verify');
  const l = $('#nfc-lock');
  if (busyKind !== 'read') v.textContent = S.verifiedUrl === u ? 'もう一度読み取る' : '読み取って確かめる';
  if (busyKind !== 'read' && S.verifiedUrl === u) { const m = $('#verify-msg'); m.className = 'msg ok'; m.textContent = '✓ 確かめました。この御守りのURLが入っています。'; }
  if (busyKind !== 'lock') {
    l.classList.remove('arm', 'good');
    if (S.lockedUrl === u) { l.classList.add('good'); l.setAttribute('aria-disabled', 'false'); l.textContent = '✓ ロックしました'; }
    else if (!NFC.lockSupported()) { l.setAttribute('aria-disabled', 'true'); l.textContent = 'このブラウザでは、ロックできません'; }
    else if (S.verifiedUrl !== u) { l.setAttribute('aria-disabled', 'true'); l.textContent = '確かめると、ロックできます'; }
    else if (lockArmed) { l.classList.add('arm'); l.setAttribute('aria-disabled', 'false'); l.textContent = 'もう一度押すとロック（取り消せません）'; }
    else { l.setAttribute('aria-disabled', 'false'); l.textContent = '書き換えできないようにする'; }
  }
  setNext($('#nfc-next'), okNfc(), '次へ：銀帯で封じる', '書き込むと進めます');
}

$('#nfc-write').addEventListener('click', async () => {
  if (!NFC.nfcSupported()) { nudge($('#no-webnfc')); return; }
  if (nfcBusy) { if (busyKind === 'write') nfcBusy.abort(); return; }
  const u = url();
  if (!u) return;
  nfcBusy = new AbortController();
  busyKind = 'write';
  setNfcLook('wait');
  try {
    await NFC.writeUrl(u, { signal: nfcBusy.signal });
    S.writtenUrl = u;
    S.verifiedUrl = '';
    save();
    vibrate([16, 40, 24]);
    setNfcLook('done');
    const m = $('#verify-msg');
    m.className = 'msg sub';
    m.textContent = '御守りをいったん離してから押し、もう一度当てます。';
  } catch (e) {
    if (e && e.name === 'AbortError') setNfcLook(S.writtenUrl === u ? 'done' : '');
    else setNfcLook('fail', NFC.errorText(e, 'write'));
  } finally {
    nfcBusy = null;
    busyKind = '';
    renderAfter();
  }
});

$('#nfc-verify').addEventListener('click', async () => {
  if (nfcBusy) { if (busyKind === 'read') nfcBusy.abort(); return; }
  const u = url();
  const btn = $('#nfc-verify');
  const msg = $('#verify-msg');
  nfcBusy = new AbortController();
  busyKind = 'read';
  btn.textContent = 'かざしてください（押すと止める）';
  msg.className = 'msg sub';
  msg.textContent = '御守りを、スマホの背面にもう一度当てます。';
  try {
    const r = await NFC.readUrlOnce({ signal: nfcBusy.signal });
    if (r.urls.some((x) => NFC.sameUrl(x, u))) {
      S.verifiedUrl = u;
      save();
      vibrate(20);
    } else {
      S.verifiedUrl = '';
      save();
      msg.className = 'msg ng';
      msg.textContent = r.urls.length
        ? `別のURLが入っています（${r.urls[0].slice(0, 48)}…）。もう一度書き込んでください。`
        : 'URLが入っていません。もう一度書き込んでください。';
    }
  } catch (e) {
    msg.className = e && e.name === 'AbortError' ? 'msg sub' : 'msg ng';
    msg.textContent = e && e.name === 'AbortError' ? '読み取りを止めました。' : NFC.errorText(e, 'read');
  } finally {
    nfcBusy = null;
    busyKind = '';
    renderAfter();
  }
});

$('#nfc-lock').addEventListener('click', async () => {
  const u = url();
  const btn = $('#nfc-lock');
  if (nfcBusy) { if (busyKind === 'lock') nfcBusy.abort(); return; }
  if (btn.getAttribute('aria-disabled') === 'true') { nudge(btn); return; }
  if (S.lockedUrl === u) return;
  if (!lockArmed) {
    lockArmed = setTimeout(() => { lockArmed = 0; renderAfter(); }, 6000);
    renderAfter();
    return;
  }
  clearTimeout(lockArmed);
  lockArmed = 0;
  nfcBusy = new AbortController();
  busyKind = 'lock';
  btn.classList.add('arm');
  btn.textContent = 'かざしてください（押すと止める）';
  try {
    await NFC.lockTag({ signal: nfcBusy.signal });
    S.lockedUrl = u;
    save();
    vibrate([20, 50, 20]);
    toast('ロックしました');
  } catch (e) {
    if (!(e && e.name === 'AbortError')) toast(NFC.errorText(e, 'lock'));
  } finally {
    nfcBusy = null;
    busyKind = '';
    renderAfter();
  }
});

$$('#os-seg button').forEach((b) => b.addEventListener('click', () => {
  if (S.os === b.dataset.os) return;
  stopNfc();
  S.os = b.dataset.os;
  save();
  renderNfc();
}));
$('#copy-url').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(url());
    toast('URLをコピーしました');
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#url'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    toast('URLを長押ししてコピーしてください');
  }
});
$('#ios-ck').addEventListener('click', () => {
  const u = url();
  S.iosUrl = S.iosUrl === u ? '' : u;
  save();
  renderNfc();
});

// ── 5 銀帯で封じる（長押しで、銀帯が継ぎ目に降りる）
const hold = $('#hold');
const scene = $('#scene');
let holdRaf = 0;
let holdT0 = 0;
let holdDone = false;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function renderSeal() {
  cancelAnimationFrame(holdRaf);
  holdT0 = 0;
  holdDone = okSeal();
  hold.classList.remove('holding');
  scene.classList.remove('holding');
  hold.classList.toggle('done', holdDone);
  scene.classList.toggle('sealed', holdDone);
  scene.style.setProperty('--p', holdDone ? '1' : '0');
  $('#hold-prog').style.strokeDasharray = holdDone ? `${RING} ${RING}` : `0 ${RING}`;
  hold.setAttribute('aria-disabled', String(holdDone));
  $('#hold-text').textContent = holdDone ? '封じました' : '銀帯を貼ったら、長押しで封じる';
  $('#hold-sub').textContent = holdDone ? '' : '押しつづけると、輪が一周して封じます';
  $('#hold-alt').textContent = holdDone ? '次へ：封じました' : '長押しせずに封じる';
}
function holdBegin() {
  if (holdDone || holdT0) return;
  holdT0 = performance.now();
  hold.classList.add('holding');
  scene.classList.add('holding');
  vibrate(8);
  const tick = (now) => {
    if (!holdT0) return;
    const p = Math.min(1, (now - holdT0) / HOLD_MS);
    $('#hold-prog').style.strokeDasharray = `${p * RING} ${RING}`;
    scene.style.setProperty('--p', (easeOut(p) * 0.9).toFixed(4));
    if (p >= 1) { holdComplete(); return; }
    holdRaf = requestAnimationFrame(tick);
  };
  holdRaf = requestAnimationFrame(tick);
}
function holdEnd() {
  if (!holdT0 || holdDone) return;
  holdT0 = 0;
  cancelAnimationFrame(holdRaf);
  hold.classList.remove('holding');
  scene.classList.remove('holding');
  $('#hold-prog').style.strokeDasharray = `0 ${RING}`;
  scene.style.setProperty('--p', '0');
}
function holdComplete() {
  holdT0 = 0;
  holdDone = true;
  S.sealedUrl = url();
  save();
  hold.classList.remove('holding');
  scene.classList.remove('holding');
  hold.classList.add('done');
  scene.classList.add('sealed');
  scene.style.setProperty('--p', '1');
  hold.setAttribute('aria-disabled', 'true');
  $('#hold-prog').style.strokeDasharray = `${RING} ${RING}`;
  $('#hold-text').textContent = '封じました';
  $('#hold-sub').textContent = '';
  $('#hold-alt').textContent = '次へ：封じました';
  vibrate([18, 40, 30]);
  setTimeout(() => { if (cur === 5) go(6); }, prefersReducedMotion() ? 300 : 1700);
}
hold.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || holdDone) return;
  e.preventDefault();
  try { hold.setPointerCapture(e.pointerId); } catch { /* 取れなくても続ける */ }
  holdBegin();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hold.addEventListener(t, holdEnd));
hold.addEventListener('contextmenu', (e) => e.preventDefault());
hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdBegin(); } });
hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holdEnd(); } });
$('#hold-alt').addEventListener('click', () => { if (holdDone) go(6); else holdComplete(); });

// ── 6 封じました
function renderDone() {
  $('#pv-em').innerHTML = R.empty();
  const nm = S.name.trim();
  const pn = $('#pv-name');
  pn.hidden = !nm;
  pn.textContent = nm;
  $('#open-m').href = url() || '../m/';
}
$('#show-qr').addEventListener('click', () => {
  if (!(V && V.ok)) return;
  $('#qr').innerHTML = qrSvg(bip21(V.address));
  $('#qr-addr').textContent = group4(V.address).join(' ');
  openSheet('#qr-sheet');
});
$('#copy-addr').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(V.address); toast('アドレスをコピーしました'); }
  catch { toast('コピーできませんでした。長押しで選んでください'); }
});
$('#again').addEventListener('click', () => { reset(); go(0); });

// ── 下から出る QR
let lastFocus = null;
function openSheet(sel) {
  lastFocus = document.activeElement;
  const sh = $(sel);
  sh.classList.add('on');
  sh.setAttribute('aria-hidden', 'false');
  $('#sheet-back').classList.add('on');
  const f = $('[data-close]', sh);
  if (f) setTimeout(() => f.focus(), 50);
}
function closeSheet() {
  const open = $$('.sheet.on');
  if (!open.length) return;
  open.forEach((s) => { s.classList.remove('on'); s.setAttribute('aria-hidden', 'true'); });
  $('#sheet-back').classList.remove('on');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
$('#sheet-back').addEventListener('click', closeSheet);
$$('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ── はじめる
async function init() {
  if (S.addrInput) await revalidate();
  history.replaceState({ step: 0, from: -1 }, '');
  go(0, { mode: 'none' });
}
init();
