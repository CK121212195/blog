// いまのチェーン（最新のブロック数件）── 公開データ。アドレスなどは送らない
// mempool.space がだめなら blockstream.info。同じタブの中では30秒だけ使い回す
const APIS = [
  ['https://mempool.space/api', 'mempool.space'],
  ['https://blockstream.info/api', 'blockstream.info'],
];
const CK = 'infinity:blocks';
const KEEP = 30000;

function norm(list) {
  return (Array.isArray(list) ? list : [])
    .filter((b) => b && /^[0-9a-f]{64}$/.test(b.id) && Number.isFinite(b.height))
    .map((b) => ({ height: b.height, hash: b.id, time: b.timestamp, tx: b.tx_count, weight: b.weight, size: b.size }))
    .sort((a, b) => b.height - a.height);
}

export async function fetchBlocks({ fresh = false } = {}) {
  if (!fresh) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CK) || 'null');
      if (c && c.data && Date.now() - c.at < KEEP) return c.data;
    } catch { /* 使えなくても続ける */ }
  }
  for (const [base, name] of APIS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(base + '/blocks', { signal: ctl.signal, referrerPolicy: 'no-referrer', cache: 'no-store' });
      if (!r.ok) continue;
      const blocks = norm(await r.json());
      if (!blocks.length) continue;
      const data = { source: name, blocks };
      try { sessionStorage.setItem(CK, JSON.stringify({ at: Date.now(), data })); } catch { /* 使えなくても続ける */ }
      return data;
    } catch {
      /* 次の窓口へ */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// 定期的に見に行き、先頭のブロックが変わったら isNew を立てて知らせる
export function watchBlocks(cb, { interval = 60000 } = {}) {
  let last = null, timer = 0, stopped = false;
  const run = async (fresh) => {
    const d = await fetchBlocks({ fresh });
    if (stopped) return;
    const tip = d && d.blocks[0];
    const isNew = !!(tip && last && tip.hash !== last);
    if (tip) last = tip.hash;
    try { cb(d, { isNew }); } catch (e) { console.error(e); }
    timer = setTimeout(tick, interval);
  };
  const tick = () => {
    if (document.hidden) { timer = setTimeout(tick, interval); return; }
    run(true);
  };
  run(false);
  return () => { stopped = true; clearTimeout(timer); };
}
