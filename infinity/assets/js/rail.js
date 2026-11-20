// ブロックの列（いまのチェーン）
// 箱の詰まり具合は、ブロックの重さ（上限 4,000,000 WU）に対する割合
const f1 = (n) => (Math.round(n * 10) / 10).toString();

function cube(fill) {
  const k = Math.max(0, Math.min(1, fill || 0));
  const h = 20 * k;
  const top = k >= 0.995 ? ' style="fill:rgba(255,190,110,.55)"' : '';
  return `<svg viewBox="0 0 40 44" aria-hidden="true">
    <path class="f-l" d="M2 12 20 22v20L2 32Z"/><path class="f-r" d="M38 12 20 22v20l18-10Z"/>
    <path class="fill-l" d="M2 32 20 42V${f1(42 - h)}L2 ${f1(32 - h)}Z"/><path class="fill-r" d="M20 42 38 32V${f1(32 - h)}L20 ${f1(42 - h)}Z"/>
    <path class="f-top" d="M20 2 38 12 20 22 2 12Z"${top}/></svg>`;
}

export function mountRail(el, { max = 7 } = {}) {
  if (!el) return null;
  el.classList.add('chain');
  el.innerHTML = `<p class="chain-h"><span class="label sig" data-st><i class="led" aria-hidden="true"></i>LIVE CHAIN</span><span class="label dim" data-src>—</span></p><ol class="rail" aria-label="Latest blocks"></ol>`;
  const ol = el.querySelector('.rail');
  const st = el.querySelector('[data-st]');
  const src = el.querySelector('[data-src]');
  let lastTip = null;

  function update(data, { isNew = false } = {}) {
    if (!data || !data.blocks || !data.blocks.length) {
      st.classList.add('off');
      st.lastChild.textContent = 'CHAIN · OFFLINE';
      src.textContent = '—';
      return;
    }
    st.classList.remove('off');
    st.lastChild.textContent = 'LIVE CHAIN';
    src.textContent = data.source;
    const list = data.blocks.slice(0, max);
    const fresh = isNew || (lastTip !== null && list[0].height !== lastTip);
    lastTip = list[0].height;
    // 新しいものが左。古いものは右へ流れて薄れていく
    ol.innerHTML = list.map((b, i) => `<li class="blk${i ? ' link' : ''}${fresh && i === 0 ? ' drop' : ''}" title="#${b.height.toLocaleString('en-US')} · ${b.hash.slice(0, 10)}…">
      ${cube((b.weight || 0) / 4e6)}<b>${b.height.toLocaleString('en-US')}</b><span>${Number.isFinite(b.tx) ? b.tx.toLocaleString('en-US') + ' tx' : ''}</span></li>`).join('');
    if (fresh) { ol.classList.remove('shift'); void ol.offsetWidth; ol.classList.add('shift'); }
  }
  return { update };
}
