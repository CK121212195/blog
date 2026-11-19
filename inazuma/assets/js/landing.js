// はじめのページ ── 見本の紋（実在ブロック #840,000・#905,900）を描き、切り替える
import { $, $$, prefersReducedMotion, fmtDateDot } from './util.js';
import * as R from './raimon.js';

const H840 = '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5';
const H905 = '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572';
// ブロックの時刻（#840,000: 1713571767、#905,900: 1752727208）を日本時間の日付に
const SEAL = { block: '840000', date: fmtDateDot(1713571767) };
const MOVE = { block: '840000', moveBlock: '905900', moveDate: fmtDateDot(1752727208) };

const HALO = {
  sealed: 'radial-gradient(circle, rgba(220,228,232,.16), rgba(220,228,232,0) 62%)',
  released: 'radial-gradient(circle, rgba(255,122,74,.32), rgba(255,122,74,0) 64%)',
};
const COPY = {
  sealed: { chip: '保管中', title: '雷雲', desc: 'この御守りには、雷が封じられています', btn: '動かしてみる（見本）' },
  released: { chip: '移動済み', title: '稲妻', desc: '封は解かれ、雷は放たれました', btn: '封じなおす（見本）' },
};

let seq = 0;
const svgFor = (state, idp) => (state === 'released'
  ? R.released(H840, H905, { id: idp + 'x', ...MOVE })
  : R.sealed(H840, { id: idp + 's', ...SEAL }));

// 紋の舞台：二枚を重ねて、弾みながら入れ替える
function makeStage(el) {
  const layers = $$('.em', el);
  let front = 0;
  return (state) => {
    const next = layers[1 - front], prev = layers[front];
    next.innerHTML = svgFor(state, `${el.dataset.stage}${++seq}`);
    next.className = 'em' + (state === 'released' ? ' hex' : '');
    requestAnimationFrame(() => requestAnimationFrame(() => { next.classList.add('on'); prev.classList.remove('on'); }));
    front = 1 - front;
    const halo = $('[data-halo]', el);
    if (halo) halo.style.background = HALO[state];
    $$('.holo', el).forEach((n) => n.remove());
    if (state === 'sealed') el.insertAdjacentHTML('beforeend', '<span class="holo" aria-hidden="true"></span>');
  };
}
const stages = $$('[data-stage]').map(makeStage);

function flash() {
  if (prefersReducedMotion()) return;
  $$('[data-stage]').forEach((el) => {
    const f = document.createElement('span');
    f.className = 'flash';
    f.setAttribute('aria-hidden', 'true');
    el.appendChild(f);
    setTimeout(() => f.remove(), 1100);
  });
}

let state = 'sealed';
function show(s, animate = true) {
  state = s;
  stages.forEach((fn) => fn(s));
  document.body.classList.toggle('is-released', s === 'released');
  const c = COPY[s];
  const chip = $('[data-chip]');
  chip.className = 'tchip s-' + s;
  chip.innerHTML = `<span class="t">${c.chip}</span>`;
  $('[data-title]').textContent = c.title;
  $('[data-desc]').textContent = c.desc;
  $$('[data-flip]').forEach((b) => b.setAttribute('aria-pressed', String(s === 'released')));
  $$('[data-flip-text]').forEach((t) => { t.textContent = c.btn; });
  if (animate && s === 'released') flash();
}
$$('[data-flip]').forEach((b) => b.addEventListener('click', () => show(state === 'released' ? 'sealed' : 'released')));

// 細部の拡大（同じ紋を、別の窓で）。ハッシュの環は、16進の並びが見える向きに回す
const turn = (svg, deg) => svg.replace(/(<svg[^>]*>)/, `$1<g transform="rotate(${deg})">`).replace(/<\/svg>$/, '</g></svg>');
const CU = {
  bolt: () => R.released(H840, H905, { id: 'cub', ...MOVE }).replace('viewBox="-300 -300 600 600"', 'viewBox="-104 -104 208 208"'),
  hash: () => turn(R.sealed(H840, { id: 'cuh', ...SEAL }), -165).replace('viewBox="-300 -300 600 600"', 'viewBox="-74 -152 148 148"'),
  rim: () => R.sealed(H840, { id: 'cur', ...SEAL }).replace('viewBox="-300 -300 600 600"', 'viewBox="-300 30 270 270"'),
};
$$('[data-cu]').forEach((el) => { el.innerHTML = CU[el.dataset.cu](); });

show('sealed', false);
