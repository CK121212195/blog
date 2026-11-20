// 価格（参考値）── 1 BTC がいくらか（ドル・円）を公開データから
// mempool.space がだめなら CoinGecko。同じタブの中では5分だけ使い回す
const CK = 'infinity:fx';
const KEEP = 5 * 60 * 1000;

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal, referrerPolicy: 'no-referrer', cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const ok = (n) => Number.isFinite(n) && n > 0;

export async function fetchPrices({ fresh = false } = {}) {
  if (!fresh) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CK) || 'null');
      if (c && c.p && Date.now() - c.at < KEEP) return c.p;
    } catch { /* 使えなくても続ける */ }
  }
  let p = null;
  const m = await get('https://mempool.space/api/v1/prices');
  if (m && ok(m.USD) && ok(m.JPY)) p = { usd: m.USD, jpy: m.JPY, time: m.time || Math.floor(Date.now() / 1000), source: 'mempool.space' };
  if (!p) {
    const g = await get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,jpy&include_last_updated_at=true');
    const b = g && g.bitcoin;
    if (b && ok(b.usd) && ok(b.jpy)) p = { usd: b.usd, jpy: b.jpy, time: b.last_updated_at || Math.floor(Date.now() / 1000), source: 'CoinGecko' };
  }
  if (p) { try { sessionStorage.setItem(CK, JSON.stringify({ at: Date.now(), p })); } catch { /* 使えなくても続ける */ } }
  return p;
}

// ある欄の値から、4つの欄の値を出す（p が無ければ BTC と sats だけ）
export function convert(field, value, p) {
  let btc;
  if (field === 'btc') btc = value;
  else if (field === 'sats') btc = value / 1e8;
  else if (field === 'usd') btc = p ? value / p.usd : NaN;
  else if (field === 'jpy') btc = p ? value / p.jpy : NaN;
  else btc = NaN;
  return { btc, sats: btc * 1e8, usd: p ? btc * p.usd : NaN, jpy: p ? btc * p.jpy : NaN };
}

// 入力を数に（全角数字・カンマ・記号を許す）。読めなければ null
export function parseNum(s) {
  let t = String(s == null ? '' : s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[，、,\s_]/g, '')
    .replace(/^[¥￥$＄₿]/, '')
    .replace(/(sats?|btc|usd|jpy|円|ドル)$/i, '');
  if (!t || t === '.' || !/^\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const trim = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);

export function fmt(field, v) {
  if (!Number.isFinite(v)) return '—';
  if (field === 'btc') return trim(v.toFixed(8));
  if (field === 'sats') return v > 0 && v < 1 ? trim(v.toFixed(3)) : Math.round(v).toLocaleString('en-US');
  if (field === 'usd') return v >= 1 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : trim(v.toFixed(4));
  if (field === 'jpy') return v >= 100 ? Math.round(v).toLocaleString('en-US') : trim(v.toFixed(2));
  return String(v);
}
