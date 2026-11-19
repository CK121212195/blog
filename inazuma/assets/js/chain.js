// ブロックチェーンの公開データから、御守りの状態を決める
// 読むのは公開APIだけ（mempool.space、つながらないときは blockstream.info）。鍵は扱わない。

export const NETS = {
  main: {
    apis: ['https://mempool.space/api', 'https://blockstream.info/api'],
    web: 'https://mempool.space',
    fees: 'https://mempool.space/api/v1/fees/recommended',
  },
  test: { // tb1 は testnet4 として読む
    apis: ['https://mempool.space/testnet4/api'],
    web: 'https://mempool.space/testnet4',
    fees: 'https://mempool.space/testnet4/api/v1/fees/recommended',
  },
  signet: {
    apis: ['https://mempool.space/signet/api', 'https://blockstream.info/signet/api'],
    web: 'https://mempool.space/signet',
    fees: 'https://mempool.space/signet/api/v1/fees/recommended',
  },
};

async function getJSON(bases, path, { timeout = 9000, fetchImpl = fetch } = {}) {
  let lastErr = null;
  for (const base of bases) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
    try {
      const r = await fetchImpl(base + path, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
    } finally {
      if (t) clearTimeout(t);
    }
  }
  throw lastErr || new Error('取得できませんでした');
}

const paysTo = (tx, address) => tx.vout.map((o, i) => ({ ...o, n: i })).filter((o) => o.scriptpubkey_address === address);

/**
 * 御守りの状態を読む
 * 状態: empty（空）/ gathering（入金を確認中）/ sealed（保管中）/ rumbling（移動を確認中）/ released（移動済み）
 * 最初の入金 ＝ このアドレスへ支払った、承認済みの取引のうち、最も早いブロックのもの
 * 移動 ＝ 最初の入金でこのアドレスに入った出力を使った取引
 */
export async function loadOmamori(address, net = 'main', opts = {}) {
  const N = NETS[net] || NETS.main;
  const get = (p) => getJSON(N.apis, p, opts);

  const info = await get(`/address/${address}`);
  const all = await get(`/address/${address}/txs`);
  let conf = all.filter((t) => t.status && t.status.confirmed);
  for (let pages = 0; conf.length === 25 && pages < 40; pages++) {
    const next = await get(`/address/${address}/txs/chain/${conf[conf.length - 1].txid}`);
    all.push(...next);
    conf = next;
  }

  const seen = new Set();
  const txs = all.filter((t) => (seen.has(t.txid) ? false : (seen.add(t.txid), true)));
  const funding = txs.filter((t) => paysTo(t, address).length > 0);
  const confirmedFunding = funding
    .filter((t) => t.status.confirmed)
    .sort((a, b) => a.status.block_height - b.status.block_height || (a.txid < b.txid ? -1 : 1));
  const pendingFunding = funding.filter((t) => !t.status.confirmed);

  const cs = info.chain_stats || {};
  const ms = info.mempool_stats || {};
  const balance = {
    confirmed: (cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0),
    pending: (ms.funded_txo_sum || 0) - (ms.spent_txo_sum || 0),
    utxos: (cs.funded_txo_count || 0) - (cs.spent_txo_count || 0),
  };
  const pendingIn = pendingFunding.reduce((s, t) => s + paysTo(t, address).reduce((p, o) => p + o.value, 0), 0);

  const base = { address, net, web: `${N.web}/address/${address}`, balance, pendingIn, pendingCount: pendingFunding.length, depositCount: confirmedFunding.length };

  if (!confirmedFunding.length) {
    return { ...base, state: pendingFunding.length ? 'gathering' : 'empty', first: null, move: null };
  }

  const ftx = confirmedFunding[0];
  const outs = paysTo(ftx, address);
  const first = {
    txid: ftx.txid,
    amount: outs.reduce((s, o) => s + o.value, 0),
    height: ftx.status.block_height,
    hash: ftx.status.block_hash,
    time: ftx.status.block_time,
  };

  const outspends = await get(`/tx/${ftx.txid}/outspends`);
  const spends = outs.map((o) => outspends[o.n]).filter((s) => s && s.spent);
  const confirmedSpends = spends
    .filter((s) => s.status && s.status.confirmed)
    .sort((a, b) => a.status.block_height - b.status.block_height);

  if (confirmedSpends.length) {
    const s = confirmedSpends[0];
    return { ...base, state: 'released', first, move: { txid: s.txid, height: s.status.block_height, hash: s.status.block_hash, time: s.status.block_time } };
  }
  if (spends.length) {
    return { ...base, state: 'rumbling', first, move: { txid: spends[0].txid, height: null, hash: null, time: null } };
  }
  return { ...base, state: 'sealed', first, move: null };
}

// いま移すときの手数料のめやす（sat/vB × おおよその大きさ）
const INPUT_VB = { p2wpkh: 68, p2wsh: 105, p2tr: 57.5, p2pkh: 148, p2sh: 91 };
export function estimateSweepVbytes(type, utxos) {
  const n = Math.max(1, utxos || 1);
  const overhead = type === 'p2pkh' ? 10 : 10.5;
  return Math.ceil(overhead + n * (INPUT_VB[type] || 68) + 31);
}

export async function loadFeeRate(net = 'main', opts = {}) {
  const N = NETS[net] || NETS.main;
  try {
    const f = await getJSON([N.fees.replace(/\/v1\/fees\/recommended$/, '')], '/v1/fees/recommended', opts);
    return { rate: f.halfHourFee, source: 'mempool.space' };
  } catch {
    if (net === 'main') {
      try {
        const f = await getJSON(['https://blockstream.info/api'], '/fee-estimates', opts);
        return { rate: Math.ceil(f['3'] || f['6'] || 1), source: 'blockstream.info' };
      } catch { /* どちらもだめなら出さない */ }
    }
    return null;
  }
}
