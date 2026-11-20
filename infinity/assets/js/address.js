// ビットコインの受取アドレスを確かめる（打ち間違いの検出）
// bech32 / bech32m（BIP173・BIP350）と base58check。鍵は一切扱わない。

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32 = 1;
const BECH32M = 0x2bc830a3;

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp) {
  const r = [];
  for (const c of hrp) r.push(c.charCodeAt(0) >> 5);
  r.push(0);
  for (const c of hrp) r.push(c.charCodeAt(0) & 31);
  return r;
}

function bech32Decode(str) {
  if (str.length > 90) return null;
  const lower = str.toLowerCase();
  const upper = str.toUpperCase();
  if (str !== lower && str !== upper) return null; // 大文字と小文字の混在は不可
  const s = lower;
  const pos = s.lastIndexOf('1');
  if (pos < 1 || pos + 7 > s.length) return null;
  const hrp = s.slice(0, pos);
  for (const c of hrp) { const code = c.charCodeAt(0); if (code < 33 || code > 126) return null; }
  const data = [];
  for (const c of s.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d === -1) return null;
    data.push(d);
  }
  const c = polymod(hrpExpand(hrp).concat(data));
  const enc = c === BECH32 ? 'bech32' : c === BECH32M ? 'bech32m' : null;
  if (!enc) return null;
  return { hrp, data: data.slice(0, -6), enc };
}

function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const ret = [];
  const maxv = (1 << to) - 1;
  for (const v of data) {
    if (v < 0 || v >> from) return null;
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) { bits -= to; ret.push((acc >> bits) & maxv); }
  }
  if (pad) { if (bits) ret.push((acc << (to - bits)) & maxv); }
  else if (bits >= from || ((acc << (to - bits)) & maxv)) return null;
  return ret;
}

export function decodeSegwit(addr) {
  const d = bech32Decode(addr);
  if (!d) return null;
  const { hrp, data, enc } = d;
  if (!['bc', 'tb', 'bcrt'].includes(hrp)) return null;
  if (data.length < 1) return null;
  const version = data[0];
  if (version > 16) return null;
  const program = convertBits(data.slice(1), 5, 8, false);
  if (!program || program.length < 2 || program.length > 40) return null;
  if (version === 0 && program.length !== 20 && program.length !== 32) return null;
  if (version === 0 && enc !== 'bech32') return null;
  if (version !== 0 && enc !== 'bech32m') return null;
  return { hrp, version, program };
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(s) {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c === '1') bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

async function sha256(u8) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', u8));
}

async function decodeBase58Check(addr) {
  const raw = b58decode(addr);
  if (!raw || raw.length !== 25) return null;
  const payload = raw.slice(0, 21);
  const h = await sha256(await sha256(payload));
  for (let i = 0; i < 4; i++) if (h[i] !== raw[21 + i]) return null;
  return { version: payload[0] };
}

export const TYPE_LABEL = {
  p2wpkh: 'bc1q（ネイティブSegWit）',
  p2wsh: 'bc1q（スクリプト）',
  p2tr: 'bc1p（Taproot）',
  p2pkh: '1で始まる（レガシー）',
  p2sh: '3で始まる',
};

/**
 * 受取アドレスを確かめる
 * @returns {Promise<{ok:boolean, address?:string, network?:'main'|'test', type?:string, reason?:string}>}
 */
export async function validateAddress(input) {
  const a = String(input || '').trim();
  if (!a) return { ok: false, reason: 'empty' };
  const sw = decodeSegwit(a);
  if (sw) {
    if (sw.hrp === 'bcrt') return { ok: false, reason: 'regtest' };
    const network = sw.hrp === 'bc' ? 'main' : 'test';
    let type = 'future';
    if (sw.version === 0) type = sw.program.length === 20 ? 'p2wpkh' : 'p2wsh';
    else if (sw.version === 1 && sw.program.length === 32) type = 'p2tr';
    if (type === 'future') return { ok: false, reason: 'future' };
    return { ok: true, address: a.toLowerCase(), network, type };
  }
  if (/^[123mn][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) {
    const b = await decodeBase58Check(a);
    const map = { 0: ['main', 'p2pkh'], 5: ['main', 'p2sh'], 111: ['test', 'p2pkh'], 196: ['test', 'p2sh'] };
    if (b && map[b.version]) return { ok: true, address: a, network: map[b.version][0], type: map[b.version][1] };
    return { ok: false, reason: 'checksum' };
  }
  if (/^(bc1|tb1)/i.test(a)) return { ok: false, reason: 'checksum' };
  return { ok: false, reason: 'format' };
}

export const REASON_TEXT = {
  empty: 'アドレスを貼り付けてください',
  checksum: '文字が一つ違うか、途中で切れています。ウォレットから貼り直してください',
  format: 'ビットコインのアドレスの形ではありません',
  regtest: '開発用（regtest）のアドレスには対応していません',
  future: 'まだ使われていない種類のアドレスです',
};
export const REASON_TEXT_EN = {
  empty: 'Paste an address',
  checksum: 'One character is off, or it was cut short. Paste it again from your wallet',
  format: 'This isn’t a Bitcoin address',
  regtest: 'Development (regtest) addresses aren’t supported',
  future: 'This address type isn’t in use yet',
};
