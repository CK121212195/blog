// 稲妻守 雷紋 v2 ── 刻印メダル
// 入力はブロックハッシュ（64桁の16進）。先頭のゼロ列は採掘の難しさでほぼ決まるため、末尾16バイトだけを紋のもとに使う。
// 同じハッシュからは、いつ・どの端末でも同じ紋が描かれる。
//
//   保管中（雷雲）: 円い銀のメダル。帯は丸い渦（雲文）の連なり、中心は三つ巴。
//   移動後（稲妻）: 六角の朱金のメダル。帯は角ばった渦（雷文）の連なり、中心は雷文で刻んだ稲妻。
//   帯の24個の渦は、保管中と移動後で同じ巻き数・同じ向き（丸から角へ変わるだけ）。

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const f1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return (Object.is(v, -0) ? 0 : v).toString();
};
const pol = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

import GLYPHS from './glyphs.js';
let G = GLYPHS; // 刻印用の字形
export function setGlyphs(g) { G = g; }

export function tailBytes(hash) {
  const h = String(hash).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('ブロックハッシュは64桁の16進数で渡してください');
  const out = [];
  for (let i = 32; i < 64; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}

// ── 紋のもと ────────────────────────────────────────

// 最初の入金が承認されたブロックから
export function sealDNA(hash) {
  const d = tailBytes(hash);
  const units = [];
  for (let i = 0; i < 24; i++) {
    const bits = (d[Math.floor(i / 4)] >> ((i % 4) * 2)) & 3;
    units.push({ turns: bits & 1 ? 2 : 1, mirror: (bits >> 1) & 1 });
  }
  const guil = {
    n: 9 + (d[6] % 7), // 花弁の数 9〜15
    m: 3 + ((d[6] >> 3) % 4), // ゆらぎ 3〜6
    phase: (d[7] / 256) * TAU,
    psi: ((d[8] >> 4) / 16) * TAU,
    amp: 0.62 + ((d[8] & 15) / 15) * 0.22,
  };
  const tomoe = { rot: (d[9] / 256) * 120, dir: d[10] & 1 };
  const carts = [];
  for (let j = 0; j < 6; j++) {
    const b = j < 3 ? d[10] >> (2 + j * 2) : d[11] >> ((j - 3) * 2);
    carts.push({ turns: b & 1 ? 2 : 1, mirror: (b >> 1) & 1 });
  }
  const bits32 = ((d[12] << 24) | (d[13] << 16) | (d[14] << 8) | d[15]) >>> 0;
  const beads = Array.from({ length: 96 }, (_, i) => (bits32 >>> (i % 32)) & 1 ^ ((i >> 5) & 1));
  return { units, guil, tomoe, carts, beads };
}

// 資金の移動が承認されたブロックから
export function boltDNA(hash) {
  const m = tailBytes(hash);
  return {
    tilt: -6 + (m[0] / 255) * 12, // 傾き（度）
    jog: 0.18 + (m[1] / 255) * 0.1, // 折れの張り出し
    band: -0.08 + (m[2] / 255) * 0.16, // 折れの高さ
    width: 0.92 + (m[3] / 255) * 0.2, // 太さ
    rays: 36 + (m[4] % 4) * 6, // 光芒の本数
    sparks: [m[5], m[6], m[7], m[8]].map((b) => ({ a: (b / 256) * TAU, s: 0.6 + ((b >> 3) & 7) / 14 })),
    maze: m[9] & 1,
  };
}

// ── 渦の部品 ────────────────────────────────────────
// どちらも、左中央から入り、中心を通って右中央へ抜ける「二重の渦（S字）」。
// 横に並べると一本の線でつながる帯になる。

// 角ばった二重の渦（雷文）
export function squareS(rho, m) {
  const d = rho / (2 * m + 1);
  const a = (k) => rho - Math.floor(k / 2) * d;
  const A = [[-a(0), 0]];
  let x = -a(0), y = 0;
  for (let k = 1; k <= 4 * m; k++) {
    const s = (k - 1) % 4;
    if (s === 0) y = -a(k); // 左辺を上へ
    else if (s === 1) x = a(k); // 上辺を右へ
    else if (s === 2) y = a(k); // 右辺を下へ
    else x = -a(k); // 下辺を左へ
    A.push([x, y]);
  }
  A.push([x, 0]);
  const B = A.map(([px, py]) => [-px, -py]).reverse();
  return { pts: A.concat(B), w: d * 0.46, d };
}

// 丸い二重の渦（雲文）。巻き数・太さは squareS と同じ。
export function roundS(rho, m) {
  const d = rho / (2 * m + 1);
  const N = 40 * m;
  const A = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const phi = Math.PI + t * TAU * m;
    const r = rho - (rho - d) * t;
    A.push([r * Math.cos(phi), r * Math.sin(phi)]);
  }
  // 中心のS字：左の終点（−d,0）から右の終点（d,0）へ
  const S = [];
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const u = 1 - t;
    const P0 = [-d, 0], P1 = [-d, -d * 1.15], P2 = [d, d * 1.15], P3 = [d, 0];
    S.push([
      u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
      u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1],
    ]);
  }
  const B = A.map(([px, py]) => [-px, -py]).reverse();
  return { pts: A.concat(S, B), w: d * 0.46, d };
}

// 直線を細かく刻む（極座標に写すと弧になるように）
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

const toD = (pts, close) => 'M' + pts.map(([x, y]) => f1(x) + ' ' + f1(y)).join('L') + (close ? 'Z' : '');

// ── 浮き彫り（影・本体・光）────────────────────────────
function relief(d, w, paint, o = {}) {
  const sh = o.shadow ?? 0.5, hi = o.hi ?? 0.32;
  const cap = o.cap || 'round', join = o.join || 'round';
  return `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${sh}" stroke-width="${f1(w * 1.15)}" stroke-linecap="${cap}" stroke-linejoin="${join}" transform="translate(0.9 1.1)"/>` +
    `<path d="${d}" fill="none" stroke="${paint}" stroke-width="${f1(w)}" stroke-linecap="${cap}" stroke-linejoin="${join}"/>` +
    (hi > 0 ? `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${hi}" stroke-width="${f1(w * 0.38)}" stroke-linecap="${cap}" stroke-linejoin="${join}" transform="translate(-0.35 -0.45)"/>` : '');
}

// ── 刻印文字 ────────────────────────────────────────
function glyphRun(text, font) {
  const F = G[font];
  return [...text].map((c) => F.chars[c] || F.chars[' '] || { d: '', adv: F.upm * 0.5 });
}

// 円に沿って刻む。ふだんは字の頭が外側で時計回り。flip のときは字の頭が内側で、左から右へ読める（下半分用）
function textCircle(text, { font = 'serif', size, r, center = -Math.PI / 2, spacing = 0, fill, flip = false, opacity }) {
  const F = G[font], s = size / F.upm;
  const run = glyphRun(text, font);
  const advs = run.map((g) => g.adv * s + spacing);
  const total = advs.reduce((p, c) => p + c, 0) - spacing;
  const rb = flip ? r + size * 0.78 : r;
  let cum = 0, out = '';
  const a0 = flip ? center + total / rb / 2 : center - total / rb / 2;
  run.forEach((g, i) => {
    const mid = cum + (g.adv * s) / 2;
    const a = flip ? a0 - mid / rb : a0 + mid / rb;
    cum += advs[i];
    if (!g.d) return;
    const [x, y] = pol(rb, a);
    const rot = flip ? a / DEG - 90 : a / DEG + 90;
    out += `<path d="${g.d}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${s.toFixed(4)}) translate(${f1(-g.adv / 2)} 0)"/>`;
  });
  const op = opacity != null ? ` fill-opacity="${opacity}"` : '';
  return { svg: `<g fill="${fill}"${op}>${out}</g>`, arc: total / rb };
}

// 一周を文字で埋める（字間を自動で決める）
function fullRing(text, { font, size, r, fill, opacity }) {
  const F = G[font], s = size / F.upm;
  const run = glyphRun(text, font);
  const nat = run.reduce((p, g) => p + g.adv * s, 0);
  const spacing = (TAU * r - nat) / run.length;
  return textCircle(text, { font, size, r, spacing, fill, opacity, center: -Math.PI / 2 + (nat + spacing * (run.length - 1)) / (2 * r) }).svg;
}

// 一周ぴったりになるよう字間を決めて、円に沿って刻む
function ringText(parts, { font, size, r, fill, star }) {
  const F = G[font], s = size / F.upm;
  const words = parts.map((t) => glyphRun(t, font).reduce((p, g) => p + g.adv * s, 0));
  const nat = words.reduce((p, c) => p + c, 0);
  const starW = size * 1.4;
  const circ = TAU * r;
  const free = circ - nat - starW * parts.length;
  const gap = free / parts.length; // 各語の両側の余白（星の左右に半分ずつ）
  let a = -Math.PI / 2, svg = '';
  parts.forEach((t, i) => {
    const wa = words[i] / r;
    const c = a + wa / 2;
    const flip = Math.sin(c) > 0.34;
    const res = textCircle(t, { font, size, r, center: c, fill, flip });
    svg += res.svg;
    a += wa + gap / 2 / r;
    const sa = a + starW / 2 / r;
    svg += star4(...pol(r + size * 0.36, sa), size * 0.42, fill, sa);
    a += starW / r + gap / 2 / r;
  });
  return svg;
}

// 直線に沿って刻む（六角の辺）
function textLine(text, { font = 'serif', size, cx, cy, angle, fill, spacing = 0 }) {
  // angle は字の並ぶ向き。字の頭は angle から -90° の側
  const F = G[font], s = size / F.upm;
  const run = glyphRun(text, font);
  const advs = run.map((g) => g.adv * s + spacing);
  const total = advs.reduce((p, c) => p + c, 0) - spacing;
  let cum = -total / 2, out = '';
  const ca = Math.cos(angle), sa = Math.sin(angle);
  run.forEach((g, i) => {
    const mid = cum + (g.adv * s) / 2;
    cum += advs[i];
    if (!g.d) return;
    const x = cx + mid * ca, y = cy + mid * sa;
    out += `<path d="${g.d}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(angle / DEG)}) scale(${s.toFixed(4)}) translate(${f1(-g.adv / 2)} 0)"/>`;
  });
  return `<g fill="${fill}">${out}</g>`;
}

function star4(x, y, r, fill, rot = 0) {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.28 : r;
    const a = rot + (i * Math.PI) / 4;
    p.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  return `<path d="${toD(p, true)}" fill="${fill}"/>`;
}

function hashGroups(hash) {
  const h = hash.toUpperCase();
  return h.match(/.{8}/g).join(' ');
}

// ── 帯 ─────────────────────────────────────────────

// 円の帯：24の渦を一本の線でつなぐ
function circleBand(dna, kind, { rMid, rho, sx, paint }) {
  const per = TAU / 24;
  let pts = [];
  const step = 1.6;
  dna.units.forEach((u, i) => {
    const sp = kind === 'round' ? roundS(rho, u.turns) : squareS(rho, u.turns);
    const local = densify(sp.pts, step).map(([x, y]) => [x * sx, u.mirror ? -y : y]);
    const th = -Math.PI / 2 + (i + 0.5) * per;
    const mapped = local.map(([x, y]) => pol(rMid - y, th + x / rMid));
    // 前の渦の出口から、この渦の入口まで、帯の中心線でつなぐ
    if (pts.length) {
      const a1 = Math.atan2(pts[pts.length - 1][1], pts[pts.length - 1][0]);
      let a2 = th - (rho * sx) / rMid;
      let da = a2 - a1;
      while (da < 0) da += TAU;
      const n = Math.max(2, Math.ceil((da * rMid) / step));
      for (let k = 1; k < n; k++) pts.push(pol(rMid, a1 + (da * k) / n));
    }
    pts = pts.concat(mapped);
  });
  // 一周を閉じる
  const a1 = Math.atan2(pts[pts.length - 1][1], pts[pts.length - 1][0]);
  const a2 = Math.atan2(pts[0][1], pts[0][0]);
  let da = a2 - a1;
  while (da < 0) da += TAU;
  const n = Math.max(2, Math.ceil((da * rMid) / step));
  for (let k = 1; k < n; k++) pts.push(pol(rMid, a1 + (da * k) / n));
  const w = (rho / 3) * 0.46 * 1.05;
  return relief(toD(pts, true), w, paint, { cap: kind === 'round' ? 'round' : 'butt', join: kind === 'round' ? 'round' : 'miter' });
}

// 六角の帯：各辺に4つずつ雷文、角に菱形
function hexBand(dna, { apo, rho, sx, paint, corner }) {
  const out = [];
  const edgeHalf = apo * Math.tan(30 * DEG); // 辺の半分の長さ（この距離で）
  const unitW = (edgeHalf * 2 - rho * 2.2) / 4;
  let paths = '';
  for (let e = 0; e < 6; e++) {
    // 平らな上辺から時計回り。辺の中央の向き
    const na = -Math.PI / 2 + e * (Math.PI / 3);
    const n = [Math.cos(na), Math.sin(na)]; // 外向き
    const t = [-n[1], n[0]]; // 時計回りの向き
    const c = [n[0] * apo, n[1] * apo];
    let pts = [];
    for (let k = 0; k < 4; k++) {
      const i = e * 4 + k;
      const u = dna.units[i];
      const sp = squareS(rho, u.turns);
      const off = -edgeHalf + rho * 1.1 + unitW * (k + 0.5);
      const local = sp.pts.map(([x, y]) => [x * sx, u.mirror ? -y : y]);
      const mapped = local.map(([x, y]) => [c[0] + t[0] * (off + x) - n[0] * y, c[1] + t[1] * (off + x) - n[1] * y]);
      pts = pts.concat(mapped);
    }
    // 角の手前まで伸ばす
    const s0 = -edgeHalf + rho * 0.4, s1 = edgeHalf - rho * 0.4;
    const head = [c[0] + t[0] * s0, c[1] + t[1] * s0];
    const tail = [c[0] + t[0] * s1, c[1] + t[1] * s1];
    pts = [head].concat(pts, [tail]);
    paths += relief(toD(pts), (rho / 3) * 0.46 * 1.05, paint, { cap: 'butt', join: 'miter' });
    // 角の飾り（菱形）
    const va = na + Math.PI / 6;
    const vr = apo / Math.cos(30 * DEG);
    const [vx, vy] = pol(vr, va);
    const s = rho * 0.62;
    const dia = [[vx + Math.cos(va) * s, vy + Math.sin(va) * s], [vx + Math.cos(va + Math.PI / 2) * s, vy + Math.sin(va + Math.PI / 2) * s], [vx - Math.cos(va) * s, vy - Math.sin(va) * s], [vx - Math.cos(va + Math.PI / 2) * s, vy - Math.sin(va + Math.PI / 2) * s]];
    out.push(`<path d="${toD(dia, true)}" fill="${corner}"/>`);
  }
  return paths + out.join('');
}

// ── 地紋（ギョーシェ）────────────────────────────────
function guilloche(g, { r1, r2, k = 12, stroke, width, opacity, N = 540 }) {
  const rm = (r1 + r2) / 2, span = (r2 - r1) / 2;
  const A = span * 0.84, B = span * 0.12 * g.amp;
  let d = '';
  for (const sign of [1, -1]) {
    for (let i = 0; i < k; i++) {
      const ph = g.phase + (i * TAU) / k;
      const pts = [];
      for (let j = 0; j < N; j++) {
        const th = (j / N) * TAU;
        const r = rm + A * Math.sin(sign * g.n * th + ph) + B * Math.sin(g.m * th + g.psi);
        pts.push(pol(r, th));
      }
      d += toD(pts, true);
    }
  }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
}

// ── 麻の葉（中心の地）───────────────────────────────
function asanoha(R, a, stroke, width, opacity) {
  const h = (a * Math.sqrt(3)) / 2;
  let d = '';
  const rows = Math.ceil(R / h) + 2, cols = Math.ceil(R / a) + 2;
  for (let j = -rows; j <= rows; j++) for (let i = -cols; i <= cols; i++) {
    const ox = (j & 1) ? a / 2 : 0;
    const p = [i * a + ox, j * h];
    const up = [[p[0], p[1]], [p[0] + a, p[1]], [p[0] + a / 2, p[1] + h]];
    const dn = [[p[0] + a / 2, p[1] + h], [p[0] + a, p[1]], [p[0] + a * 1.5, p[1] + h]];
    for (const tri of [up, dn]) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      if (Math.hypot(cx, cy) > R + a) continue;
      for (let q = 0; q < 3; q++) {
        d += `M${f1(tri[q][0])} ${f1(tri[q][1])}L${f1(tri[(q + 1) % 3][0])} ${f1(tri[(q + 1) % 3][1])}`;
        d += `M${f1(cx)} ${f1(cy)}L${f1(tri[q][0])} ${f1(tri[q][1])}`;
      }
    }
  }
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
}

// ── 三つ巴（保管中の中心）────────────────────────────
function tomoePath(R) {
  const h = 0.34 * R, c = R - h, sweep = 98 * DEG;
  const T = pol(R, -sweep);
  const px = c - h, tx = T[0], ty = T[1];
  const rho = ((tx - px) ** 2 + ty ** 2) / (2 * (px - tx));
  return `M${f1(T[0])} ${f1(T[1])}A${f1(R)} ${f1(R)} 0 0 1 ${f1(R)} 0A${f1(h)} ${f1(h)} 0 1 1 ${f1(px)} 0A${f1(rho)} ${f1(rho)} 0 0 0 ${f1(T[0])} ${f1(T[1])}Z`;
}

// ── 稲妻（移動後の中心）─────────────────────────────
function boltPts(b, H) {
  const j = b.jog, y = b.band, w = b.width;
  const P = [
    [0.1, -0.5], // 上の先
    [0.035, y - 0.045], [j + 0.13, y - 0.045], // 右の折れ
    [-0.1, 0.5], // 下の先
    [-0.035, y + 0.045], [-(j + 0.13), y + 0.045], // 左の折れ
  ];
  const a = b.tilt * DEG;
  return P.map(([x, yy]) => {
    const X = x * H * w, Y = yy * H;
    return [X * Math.cos(a) - Y * Math.sin(a), X * Math.sin(a) + Y * Math.cos(a)];
  });
}

// 稲妻の内側を雷文で埋める
function boltMaze(clipId, H, b, stroke) {
  const rho = 6.2, m = 1;
  const unitW = rho * 2 * 1.25 + 2.4;
  let d = '';
  const rows = Math.ceil(H / (rho * 2 + 2)) + 2;
  for (let r = -rows; r <= rows; r++) {
    const yy = r * (rho * 2 + 1.6);
    const sp = squareS(rho, m);
    let pts = [];
    const shift = (r & 1) ? unitW / 2 : 0;
    for (let c = -8; c <= 8; c++) {
      const cx = c * unitW + shift;
      const mir = (r + c + b.maze) & 1;
      pts = pts.concat(sp.pts.map(([x, y]) => [cx + x * 1.25, yy + (mir ? -y : y)]));
    }
    d += toD(pts);
  }
  return `<g clip-path="url(#${clipId})"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.05" stroke-linejoin="miter" stroke-opacity=".9" transform="rotate(${f1(b.tilt)})"/></g>`;
}

const hexPts = (R) => Array.from({ length: 6 }, (_, i) => pol(R, i * (Math.PI / 3)));

// ── 色 ─────────────────────────────────────────────
function defs(id, extra = '') {
  return `<defs>
<radialGradient id="${id}-field" cx="0" cy="0" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2B3337"/><stop offset=".72" stop-color="#1A1F22"/><stop offset="1" stop-color="#111416"/></radialGradient>
<linearGradient id="${id}-ag" x1="-300" y1="-300" x2="300" y2="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".28" stop-color="#D3DADE"/><stop offset=".5" stop-color="#8F9AA0"/><stop offset=".7" stop-color="#E2E7EA"/><stop offset="1" stop-color="#9CA6AC"/></linearGradient>
<linearGradient id="${id}-holo" x1="-90" y1="-90" x2="90" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9FE6FF"/><stop offset=".3" stop-color="#F3B6FF"/><stop offset=".55" stop-color="#FFF0A6"/><stop offset=".8" stop-color="#A9FFD6"/><stop offset="1" stop-color="#9FC7FF"/></linearGradient>
<radialGradient id="${id}-lac" cx="0" cy="0" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#D2482A"/><stop offset=".6" stop-color="#A72F17"/><stop offset="1" stop-color="#6E180B"/></radialGradient>
<linearGradient id="${id}-au" x1="-300" y1="-300" x2="300" y2="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".3" stop-color="#EBCB86"/><stop offset=".52" stop-color="#B98A3C"/><stop offset=".72" stop-color="#F4DE9F"/><stop offset="1" stop-color="#C79A4C"/></linearGradient>
<linearGradient id="${id}-ver" x1="0" y1="-110" x2="0" y2="110" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF8A55"/><stop offset=".55" stop-color="#F04E24"/><stop offset="1" stop-color="#C8321A"/></linearGradient>
<radialGradient id="${id}-dia" cx="0" cy="0" r="130" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3A1F17"/><stop offset="1" stop-color="#160C0A"/></radialGradient>
<radialGradient id="${id}-sheen" cx="-120" cy="-150" r="340" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".03"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-glow" cx="0" cy="0" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFB37A" stop-opacity=".55"/><stop offset="1" stop-color="#FF6A3D" stop-opacity="0"/></radialGradient>
${extra}
</defs>`;
}

// ── 状態ごとの紋 ────────────────────────────────────

// 雷雲（保管中）
export function sealed(hash, o = {}) {
  const id = o.id || 'raiun';
  const dna = sealDNA(hash);
  const ag = `url(#${id}-ag)`;
  const block = o.block || '';
  const date = o.date || '';
  const extra = `<clipPath id="${id}-core"><circle r="98"/></clipPath><clipPath id="${id}-tomoe">${[0, 1, 2].map((k) => `<path d="${tomoePath(76)}" transform="${dna.tomoe.dir ? 'scale(-1 1) ' : ''}rotate(${f1(dna.tomoe.rot + k * 120)})"/>`).join('')}</clipPath>`;
  let s = defs(id, extra);
  s += `<circle r="294" fill="url(#${id}-field)"/>`;
  // 縁
  s += relief(`M0 -289A289 289 0 1 1 0 289A289 289 0 1 1 0 -289Z`, 5, ag);
  s += `<circle r="262" fill="none" stroke="${ag}" stroke-width="1.3"/>`;
  s += ringText(['稲妻守', 'INAZUMA MAMORI', '雷は雲に宿る', `SEALED AT BLOCK ${block}`, date].filter(Boolean), { font: 'serif', size: 15, r: 270, fill: ag });
  // 粒
  let beads = '';
  dna.beads.forEach((b, i) => { const [x, y] = pol(254, -Math.PI / 2 + (i * TAU) / 96); beads += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${b ? 2.6 : 1.5}"/>`; });
  s += `<g fill="${ag}">${beads}</g>`;
  // 雲文の帯
  s += `<circle r="247" fill="none" stroke="${ag}" stroke-width="1.1" stroke-opacity=".8"/><circle r="213" fill="none" stroke="${ag}" stroke-width="1.1" stroke-opacity=".8"/>`;
  s += circleBand(dna, 'round', { rMid: 230, rho: 13.5, sx: 1.55, paint: ag });
  // 地紋
  s += `<circle r="206" fill="none" stroke="${ag}" stroke-width="1.6"/><circle r="128" fill="none" stroke="${ag}" stroke-width="1.6"/>`;
  s += guilloche(dna.guil, { r1: 134, r2: 200, k: 12, stroke: '#C9D1D6', width: 0.55, opacity: 0.62 });
  // 六つの小窓
  dna.carts.forEach((c, j) => {
    const a = -Math.PI / 2 + (Math.PI / 6) + j * (Math.PI / 3);
    const [x, y] = pol(167, a);
    const sp = roundS(10.5, c.turns);
    const pts = sp.pts.map(([px, py]) => [px, c.mirror ? -py : py]);
    s += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a / DEG + 90)})"><circle r="21" fill="#171B1D"/><circle r="21" fill="none" stroke="${ag}" stroke-width="1.8"/><circle r="17" fill="none" stroke="${ag}" stroke-width=".6" stroke-opacity=".7"/>${relief(toD(pts), sp.w * 1.1, ag, { shadow: 0.4, hi: 0.25 })}</g>`;
  });
  // ブロックハッシュの環
  s += fullRing(`${hashGroups(hash)}  #${block}  `, { font: 'mono', size: 10.4, r: 113, fill: '#D5DBDE' });
  // 中心
  s += `<circle r="104" fill="#14181A"/>`;
  s += relief(`M0 -104A104 104 0 1 1 0 104A104 104 0 1 1 0 -104Z`, 3.4, ag);
  s += `<circle r="97" fill="none" stroke="${ag}" stroke-width=".7" stroke-opacity=".8"/>`;
  s += `<g clip-path="url(#${id}-core)">${asanoha(98, 18, '#AEB8BD', 0.6, 0.28)}</g>`;
  // 巴：本体・刻線・虹
  const tomoeG = (paint, extraAttr = '') => `<g fill="${paint}"${extraAttr}>${[0, 1, 2].map((k) => `<path d="${tomoePath(76)}" transform="${dna.tomoe.dir ? 'scale(-1 1) ' : ''}rotate(${f1(dna.tomoe.rot + k * 120)})"/>`).join('')}</g>`;
  s += `<g transform="translate(1.6 2)">${tomoeG('#000', ' fill-opacity=".55"')}</g>`;
  s += tomoeG(ag);
  let hatch = '';
  for (let yv = -80; yv <= 80; yv += 3.2) hatch += `M-80 ${f1(yv)}L80 ${f1(yv)}`;
  s += `<g clip-path="url(#${id}-tomoe)"><path d="${hatch}" stroke="#6F7A80" stroke-width=".7" stroke-opacity=".5" transform="rotate(${f1(-30 + dna.tomoe.rot)})"/><circle r="80" fill="url(#${id}-holo)" fill-opacity=".26"/></g>`;
  s += `<g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".9">${[0, 1, 2].map((k) => `<path d="${tomoePath(76)}" transform="${dna.tomoe.dir ? 'scale(-1 1) ' : ''}rotate(${f1(dna.tomoe.rot + k * 120)})"/>`).join('')}</g>`;
  // 中心の小さな稲妻（雷はここに宿る）
  s += `<path d="${toD(boltPts({ jog: 0.2, band: 0, width: 1, tilt: 0 }, 17), true)}" fill="#14181A" stroke="${ag}" stroke-width=".8"/>`;
  s += `<circle r="294" fill="url(#${id}-sheen)"/>`;
  return wrap(s, o.size);
}

// 稲妻（移動後）
export function released(depositHash, moveHash, o = {}) {
  const id = o.id || 'inazuma';
  const dna = sealDNA(depositHash);
  const b = boltDNA(moveHash);
  const au = `url(#${id}-au)`;
  const H = 168;
  const bp = boltPts(b, H);
  const extra = `<clipPath id="${id}-bolt"><path d="${toD(bp, true)}"/></clipPath><clipPath id="${id}-dia"><path d="M0 -112L112 0L0 112L-112 0Z"/></clipPath>`;
  let s = defs(id, extra);
  const outer = hexPts(292), inner = hexPts(262), bandO = hexPts(254), bandI = hexPts(214);
  s += `<path d="${toD(outer, true)}" fill="url(#${id}-lac)"/>`;
  s += relief(toD(hexPts(289), true), 5, au, { join: 'miter' });
  s += `<path d="${toD(inner, true)}" fill="none" stroke="${au}" stroke-width="1.3"/>`;
  // 六辺の刻印（上の三辺は外向き、下の三辺は内向きで左から右へ読める）
  const texts = ['稲妻守', `RELEASED AT BLOCK ${o.moveBlock || ''}`, o.moveDate || '', '雷は稲を実らす', 'INAZUMA MAMORI', `SEALED AT BLOCK ${o.block || ''}`];
  texts.forEach((t, e) => {
    const na = -Math.PI / 2 + e * (Math.PI / 3);
    const low = Math.sin(na) > 0.1;
    const apo = 262 * Math.cos(30 * DEG) + 9.5 + (low ? 13.5 * 0.78 : 0);
    s += textLine(t, { font: 'serif', size: 13.5, cx: Math.cos(na) * apo, cy: Math.sin(na) * apo, angle: low ? na - Math.PI / 2 : na + Math.PI / 2, fill: au, spacing: 1.2 });
  });
  hexPts(276).forEach(([x, y], i) => { s += star4(x, y, 7, au, i * (Math.PI / 3)); });
  // 雷文の帯
  s += `<path d="${toD(bandO, true)}" fill="none" stroke="${au}" stroke-width="1.1" stroke-opacity=".85"/><path d="${toD(bandI, true)}" fill="none" stroke="${au}" stroke-width="1.1" stroke-opacity=".85"/>`;
  s += hexBand(dna, { apo: 234 * Math.cos(30 * DEG), rho: 13.5, sx: 1.18, paint: au, corner: au });
  // 地紋
  s += `<circle r="184" fill="none" stroke="${au}" stroke-width="1.6"/><circle r="136" fill="none" stroke="${au}" stroke-width="1.6"/>`;
  s += guilloche(dna.guil, { r1: 141, r2: 179, k: 12, stroke: '#F3D99A', width: 0.55, opacity: 0.62 });
  // 最初の入金のハッシュ
  s += fullRing(`${hashGroups(depositHash)}  #${o.block || ''}  `, { font: 'mono', size: 8.4, r: 122.5, fill: '#F6E2AE' });
  // 菱形と光芒
  s += `<circle r="150" fill="url(#${id}-glow)"/>`;
  s += `<path d="M0 -112L112 0L0 112L-112 0Z" fill="url(#${id}-dia)"/>`;
  let rays = '';
  for (let i = 0; i < b.rays; i++) { const a = (i * TAU) / b.rays; const [x1, y1] = pol(18, a), [x2, y2] = pol(160, a); rays += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`; }
  s += `<g clip-path="url(#${id}-dia)"><path d="${rays}" stroke="#E9C77E" stroke-width=".7" stroke-opacity=".42"/>${fullRing(`${hashGroups(moveHash)}  #${o.moveBlock || ''}  `, { font: 'mono', size: 7, r: 70, fill: '#E9C77E', opacity: 0.5 })}</g>`;
  s += relief('M0 -112L112 0L0 112L-112 0Z', 3.6, au, { join: 'miter' });
  s += `<path d="M0 -102L102 0L0 102L-102 0Z" fill="none" stroke="${au}" stroke-width=".8" stroke-opacity=".8"/>`;
  // 稲妻（雷文で刻む）
  s += `<path d="${toD(bp, true)}" fill="#000" fill-opacity=".55" transform="translate(2.2 2.8)"/>`;
  s += `<path d="${toD(bp, true)}" fill="url(#${id}-ver)"/>`;
  s += boltMaze(`${id}-bolt`, H, b, '#FFE2A0');
  s += `<path d="${toD(bp, true)}" fill="none" stroke="${au}" stroke-width="3.4" stroke-linejoin="miter"/>`;
  s += `<path d="${toD(bp, true)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1" stroke-linejoin="miter" transform="translate(-0.5 -0.6)"/>`;
  s += `<path d="${toD(outer, true)}" fill="url(#${id}-sheen)"/>`;
  // 火花
  // 火花：六角の角の内側に。大きさは移動のブロックで決まる
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3);
    const sp = b.sparks[i % 4];
    const big = ((sp.a * 1000) | 0) % 6 === i || i % 2 === (b.maze & 1);
    const [x, y] = pol(199, a);
    s += star4(x, y, big ? 9 * sp.s + 4 : 5, '#FFE7B0', a);
  }
  return wrap(s, o.size);
}

// 雷鳴（移動を確認中）：雷雲の紋に、朱のひび
export function rumbling(hash, o = {}) {
  const base = sealed(hash, { ...o, size: undefined }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const d = tailBytes(hash);
  let cracks = '';
  for (let c = 0; c < 3; c++) {
    let a = (d[c] / 256) * TAU, r = 18;
    const pts = [pol(r, a)];
    while (r < 250) {
      r += 16 + (d[(c * 5 + pts.length) % 16] % 18);
      a += (((d[(c * 3 + pts.length) % 16] % 9) - 4) * DEG) * 3;
      pts.push(pol(Math.min(r, 252), a));
    }
    cracks += `<path d="${toD(pts)}" fill="none" stroke="#FF6A3D" stroke-width="3.2" stroke-linejoin="miter" stroke-opacity=".9"/><path d="${toD(pts)}" fill="none" stroke="#FFE1C9" stroke-width="1" stroke-linejoin="miter"/>`;
  }
  return wrap(base + cracks, o.size);
}

// 雲集い（入金を確認中）：まだブロックが決まらないので、紋の形は描かない
export function gathering(o = {}) {
  const id = o.id || 'kumo';
  let s = defs(id);
  const ag = `url(#${id}-ag)`;
  s += `<circle r="289" fill="none" stroke="${ag}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" stroke-opacity=".8"/>`;
  s += `<circle r="247" fill="none" stroke="${ag}" stroke-width="1" stroke-dasharray="1 6" stroke-opacity=".5"/><circle r="213" fill="none" stroke="${ag}" stroke-width="1" stroke-dasharray="1 6" stroke-opacity=".5"/>`;
  let clouds = '';
  for (let i = 0; i < 24; i++) {
    const sp = roundS(12, 1);
    const th = -Math.PI / 2 + (i + 0.5) * (TAU / 24);
    const pts = densify(sp.pts, 1.6).map(([x, y]) => pol(230 - y, th + (x * 1.5) / 230));
    clouds += `<path d="${toD(pts)}"/>`;
  }
  s += `<g fill="none" stroke="${ag}" stroke-width="1.9" stroke-linecap="round" stroke-opacity=".38">${clouds}</g>`;
  s += `<circle r="104" fill="none" stroke="${ag}" stroke-width="1.4" stroke-dasharray="1.5 7" stroke-linecap="round" stroke-opacity=".7"/>`;
  return wrap(s, o.size);
}

// 空（まだ入金がない）
export function empty(o = {}) {
  const s = `<circle r="289" fill="none" stroke="#5B6669" stroke-width="2.4" stroke-dasharray="1.5 12" stroke-linecap="round"/><circle r="104" fill="none" stroke="#5B6669" stroke-width="1.6" stroke-dasharray="1.5 9" stroke-linecap="round"/><circle r="4" fill="#5B6669"/>`;
  return wrap(s, o.size);
}

function wrap(body, size) {
  const sz = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-300 -300 600 600"${sz}>${body}</svg>`;
}
