// ミッションパッチ ── ブロックハッシュから描く（同じハッシュなら、いつ・どこで描いても同じ形）
//   sealed   … 降着円盤を抱えた特異点（入金が承認されたブロックで決まる）
//   released … 展開した超立方体（外の環は入金のブロック、中心は移動のブロックで決まる）
//   rumbling / gathering / empty … 途中の姿
//   いちばん外側は、刺繍の記章のような帯。上にミッション名とブロック番号、下に名前（なければ状態）と日付
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();

// ── ハッシュから数をとりだす
export function tailBytes(hex) {
  const h = String(hex || '').replace(/[^0-9a-f]/gi, '').toLowerCase().padStart(64, '0').slice(-64);
  const out = [];
  for (let i = 32; i < 64; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out; // 後ろの16バイト（先頭は0が並ぶので使わない）
}
function seedOf(bytes, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return h || 0x9e3779b9;
}
function rand(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (b, lo, hi) => lerp(lo, hi, b / 255);

// 入金ブロックの「円盤」の性質
export function diskDNA(hash) {
  const b = tailBytes(hash);
  const bits = [];
  for (const x of b) for (let k = 7; k >= 0; k--) bits.push((x >> k) & 1);
  return {
    bytes: b,
    incl: pick(b[0], 0.15, 0.27), // 円盤の傾き（縦横比）
    roll: pick(b[1], -13, 13), // 円盤の回転（度）
    spin: b[2] & 1 ? 1 : -1, // 明るい側（ドップラー）
    temp: b[3] % 3, // 色温度の系統
    rh: pick(b[4], 60, 70), // 事象の地平線の半径
    rOut: pick(b[5], 190, 212), // 円盤の外径
    bearing: pick(b[6], 0, 360), // 外輪の目印
    dust: 22 + (b[7] % 15), // 周回する塵の数
    tess: [pick(b[8], 0, TAU), pick(b[9], 0, TAU), pick(b[10], 0, TAU), pick(b[11], 0, TAU)],
    // 64本の輪の濃さ（2ビットずつ）
    rings: Array.from({ length: 64 }, (_, i) => bits[i * 2] * 2 + bits[i * 2 + 1]),
    seed: seedOf(b),
  };
}
// 移動ブロックの「超立方体」の性質
export function tessDNA(hash) {
  const b = tailBytes(hash);
  return {
    bytes: b,
    angles: [pick(b[0], 0, TAU), pick(b[1], 0, TAU), pick(b[2], 0, TAU), pick(b[3], 0, TAU)],
    tilt: pick(b[4], -24, -10),
    yaw: pick(b[5], 0, 360),
    d4: pick(b[6], 2.5, 3.1),
    strands: 9 + (b[7] % 6), // 時間の格子の本数（一辺あたり）
    depth: 5 + (b[8] % 3), // 回廊の奥行き
    jet: pick(b[9], -8, 8), // 噴流の傾き（度）
    seed: seedOf(b, 7),
  };
}

// ── 超立方体（4次元）の頂点と辺
const VERTS = Array.from({ length: 16 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const EDGES = [];
for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) { const x = i ^ j; if ((x & (x - 1)) === 0) EDGES.push([i, j, x]); }
function rot(v, a, b, t) {
  const c = Math.cos(t), s = Math.sin(t);
  const p = v[a], q = v[b];
  v[a] = p * c - q * s;
  v[b] = p * s + q * c;
}
// 2次元の点を返す（t は動かすときの時間、ラジアン）
export function tesseractPoints(dna, t = 0, scale = 60) {
  const [a1, a2, a3, a4] = dna.angles;
  const tilt = (dna.tilt || -16) * DEG, yaw = (dna.yaw || 0) * DEG;
  return VERTS.map((v0) => {
    const v = v0.slice();
    rot(v, 0, 3, a1 + t); // x-w
    rot(v, 1, 3, a2 + t * 0.62); // y-w
    rot(v, 2, 3, a3); // z-w
    rot(v, 0, 1, a4); // x-y
    const k = dna.d4 / (dna.d4 - v[3]);
    let x = v[0] * k, y = v[1] * k, z = v[2] * k;
    // 3次元の向き
    let c = Math.cos(yaw), s = Math.sin(yaw);
    [x, z] = [x * c - z * s, x * s + z * c];
    c = Math.cos(tilt); s = Math.sin(tilt);
    [y, z] = [y * c - z * s, y * s + z * c];
    const k2 = 7 / (7 - z);
    return [x * k2 * scale, y * k2 * scale, v[3]];
  });
}
export function tesseractPaths(dna, t = 0, scale = 60) {
  const p = tesseractPoints(dna, t, scale);
  let outer = '', inner = '', links = '';
  for (const [i, j, axis] of EDGES) {
    const seg = `M${f1(p[i][0])} ${f1(p[i][1])}L${f1(p[j][0])} ${f1(p[j][1])}`;
    if (axis === 8) links += seg;
    else if (VERTS[i][3] > 0) outer += seg;
    else inner += seg;
  }
  return { outer, inner, links, points: p };
}

// ── 色
const HOT = [
  ['#FFF7E6', '#FFD08A', '#FF9A3C', '#C9480F', '#5A1806'], // 琥珀
  ['#FFFBEF', '#FFE2A6', '#FFB45A', '#D2611A', '#5E2208'], // 金
  ['#FFF1E2', '#FFB98A', '#FF7A33', '#B83A12', '#4A1205'], // 熾火
];
const ICE = { line: '#9FD8FF', soft: 'rgba(159,216,255,', white: '#F2FBFF' };
const AMBER = { line: '#FFB04A', soft: 'rgba(255,176,74,' };

// ── 外輪（計器の縁）
function bezel(id, o) {
  const c = o.cool ? ICE : AMBER;
  const dim = o.dim ? 0.55 : 1;
  let ticks = '';
  for (let i = 0; i < 180; i++) {
    const a = i * 2 * DEG - Math.PI / 2;
    const major = i % 5 === 0;
    const r1 = major ? 271 : 279, r2 = 286;
    ticks += `M${f1(Math.cos(a) * r1)} ${f1(Math.sin(a) * r1)}L${f1(Math.cos(a) * r2)} ${f1(Math.sin(a) * r2)}`;
  }
  let labels = '';
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * DEG - Math.PI / 2;
    labels += `<text x="${f1(Math.cos(a) * 259)}" y="${f1(Math.sin(a) * 259 + 3.2)}">${String(i * 30).padStart(3, '0')}</text>`;
  }
  const b = (o.bearing || 0) * DEG - Math.PI / 2;
  const arc = (r, a0, a1) => `M${f1(Math.cos(a0) * r)} ${f1(Math.sin(a0) * r)}A${r} ${r} 0 0 1 ${f1(Math.cos(a1) * r)} ${f1(Math.sin(a1) * r)}`;
  const ringText = o.ringText
    ? `<path id="${id}-rt" d="M0 -244A244 244 0 1 1 -0.01 -244" fill="none"/>
       <text class="sg-rt" font-family="JetBrains Mono, IBM Plex Mono, ui-monospace, monospace" font-size="8.2" fill="${c.soft}${0.7 * dim})" letter-spacing="0.6"><textPath href="#${id}-rt" xlink:href="#${id}-rt" textLength="1520" lengthAdjust="spacing">${o.ringText}</textPath></text>`
    : '';
  return `<g class="sg-bezel">
    <circle r="294" fill="none" stroke="${c.soft}${0.18 * dim})" stroke-width="1"/>
    <path d="${ticks}" stroke="${c.soft}${0.42 * dim})" stroke-width="1.1" fill="none"/>
    <circle r="286" fill="none" stroke="${c.soft}${0.5 * dim})" stroke-width="1.2"/>
    <g font-family="JetBrains Mono, IBM Plex Mono, ui-monospace, monospace" font-size="9" fill="${c.soft}${0.55 * dim})" text-anchor="middle" letter-spacing="0.5">${labels}</g>
    ${ringText}
    <circle r="232" fill="none" stroke="${c.soft}${0.16 * dim})" stroke-width="1" stroke-dasharray="1 5"/>
    <path d="${arc(290, b - 9 * DEG, b + 9 * DEG)}" fill="none" stroke="${c.line}" stroke-opacity="${0.9 * dim}" stroke-width="3" stroke-linecap="round"/>
    <path d="M${f1(Math.cos(b) * 300)} ${f1(Math.sin(b) * 300)}L${f1(Math.cos(b - 2.2 * DEG) * 312)} ${f1(Math.sin(b - 2.2 * DEG) * 312)}L${f1(Math.cos(b + 2.2 * DEG) * 312)} ${f1(Math.sin(b + 2.2 * DEG) * 312)}Z" fill="${c.line}" fill-opacity="${dim}"/>
    <path d="M-300 0H-238M238 0H300M0 -300V-238M0 238V300" stroke="${c.soft}${0.3 * dim})" stroke-width="1"/>
  </g>`;
}
function svgOpen(o, cls) {
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-320 -320 640 640"${size} class="sg ${cls}" aria-hidden="true">`;
}
function hashRingText(label, hash) {
  const h = String(hash || '').toLowerCase();
  const groups = h.match(/.{1,8}/g) || [];
  const unit = `${label} · ${groups.join(' ')} · `;
  let s = unit;
  while (s.length < 196) s += unit;
  return s.slice(0, 196);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

const fmtH = (b) => { const n = Number(String(b || '').replace(/[^0-9]/g, '')); return Number.isFinite(n) && String(b || '').trim() !== '' ? n.toLocaleString('en-US') : '—'; };
// 帯の文字の大きさ（長い名前は小さく。日本語は幅を広めに数える）
function bandSize(t) {
  let w = 0;
  for (const ch of String(t)) w += /[⺀-鿿豈-﫿＀-￯]/.test(ch) ? 1.75 : 1;
  return Math.max(10.5, Math.min(19, (19 * 42) / Math.max(42, w)));
}
// ── ミッションパッチの帯（刺繍の縁取り）
function patchBand(id, o) {
  const acc = o.alert ? '#FF5A3C' : o.cool ? ICE.line : o.dim ? '#8A99A5' : AMBER.line;
  return `<g class="sg-band">
    <defs><path id="${id}-bt" d="M-288 0A288 288 0 0 1 288 0"/><path id="${id}-bb" d="M-302 0A302 302 0 0 0 302 0"/></defs>
    <circle r="295" fill="none" stroke="#06090c" stroke-width="40"/>
    <circle r="295" fill="none" stroke="${acc}" stroke-opacity=".06" stroke-width="40"/>
    <circle r="316" fill="none" stroke="${acc}" stroke-opacity=".85" stroke-width="2.2"/>
    <circle r="311" fill="none" stroke="${acc}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="3 4"/>
    <circle r="279" fill="none" stroke="${acc}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="3 4"/>
    <circle r="275" fill="none" stroke="${acc}" stroke-opacity=".7" stroke-width="1.6"/>
    <g font-family="Oxanium, 'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif" font-weight="600" fill="${acc}" text-anchor="middle">
      <text font-size="${f1(bandSize(o.top))}" letter-spacing="4.5"><textPath href="#${id}-bt" xlink:href="#${id}-bt" startOffset="50%">${esc(o.top)}</textPath></text>
      <text font-size="${f1(bandSize(o.bottom))}" letter-spacing="3.5"><textPath href="#${id}-bb" xlink:href="#${id}-bb" startOffset="50%">${esc(o.bottom)}</textPath></text>
    </g>
    <g fill="${acc}"><path d="M-295 -8l4.5 8-4.5 8-4.5-8z"/><path d="M295 -8l4.5 8-4.5 8-4.5-8z"/></g>
  </g>`;
}
function wrap(o, cls, inner, bandOpt) {
  return `${svgOpen(o, cls)}<g class="sg-core" transform="scale(.86)">${inner}</g>${patchBand(o.id || 'sg', bandOpt)}</svg>`;
}

// ── 光の輪：円盤の向こう側が重力で曲がり、影の上に厚く・下に薄く見える
function halo(rh) {
  const a = rh * 1.34, b = rh * 1.37, cy = -rh * 0.12, ri = rh * 1.07;
  return `M${f1(-a)} ${f1(cy)}A${f1(a)} ${f1(b)} 0 1 0 ${f1(a)} ${f1(cy)}A${f1(a)} ${f1(b)} 0 1 0 ${f1(-a)} ${f1(cy)}Z` +
    `M${f1(-ri)} 0A${f1(ri)} ${f1(ri)} 0 1 0 ${f1(ri)} 0A${f1(ri)} ${f1(ri)} 0 1 0 ${f1(-ri)} 0Z`;
}

// ── 降着円盤（後ろ半分か前半分）
function diskHalf(d, id, front, opt = {}) {
  const rIn = d.rh * 1.5, rOut = d.rOut;
  const n = d.rings.length;
  const w = ((rOut - rIn) / n) * 1.35;
  const sweep = front ? 0 : 1;
  const LV = [0.1, 0.32, 0.6, 0.92];
  let s = '';
  for (let k = 0; k < n; k++) {
    const r = lerp(rIn, rOut, k / (n - 1));
    const ry = r * d.incl;
    const fall = 1 - 0.62 * (k / (n - 1));
    const op = LV[d.rings[k]] * fall * (opt.ghost ? 0.22 : 1) * (front ? 1 : 0.86);
    if (op < 0.02) continue;
    const dash = opt.fracture && k % 3 === 0 ? ` stroke-dasharray="${f1(6 + (k % 7) * 3)} ${f1(4 + (k % 5) * 3)}"` : '';
    s += `<path d="M${f1(-r)} 0A${f1(r)} ${f1(ry)} 0 0 ${sweep} ${f1(r)} 0" stroke-width="${f2(w)}" stroke-opacity="${f2(op)}"${dash}/>`;
  }
  // 周回の流れ（点線を回す）
  if (!opt.ghost) {
    for (let k = 0; k < 6; k++) {
      const r = lerp(rIn * 1.05, rOut * 0.96, k / 5);
      const ry = r * d.incl;
      s += `<path class="sg-orbit sg-o${k % 3}" d="M${f1(-r)} 0A${f1(r)} ${f1(ry)} 0 0 ${sweep} ${f1(r)} 0" stroke-width="${f2(w * 0.9)}" stroke-opacity="${front ? 0.5 : 0.35}" stroke-dasharray="${f1(2 + k)} ${f1(18 + k * 9)}" stroke="#FFF6E2"/>`;
    }
  }
  return `<g transform="rotate(${f1(d.roll)})" fill="none" stroke="url(#${id}-dop)" stroke-linecap="round">${s}</g>`;
}
function dopplerGrad(d, id, colors) {
  const L = d.spin > 0;
  const stops = L ? colors : colors.slice().reverse();
  const o = [0, 0.22, 0.5, 0.78, 1];
  return `<linearGradient id="${id}-dop" gradientUnits="userSpaceOnUse" x1="${-d.rOut}" y1="0" x2="${d.rOut}" y2="0">${stops.map((c, i) => `<stop offset="${o[i]}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}
function dust(d, count, rmin, rmax, color) {
  const r = rand(d.seed ^ 0x51ed);
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const rr = lerp(rmin, rmax, r());
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * (0.55 + r() * 0.45);
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f2(0.5 + r() * 1.3)}" fill="${color}" fill-opacity="${f2(0.25 + r() * 0.6)}"/>`;
  }
  return `<g class="sg-dust">${s}</g>`;
}

// ── 保管中：特異点
export function sealed(hash, o = {}) {
  const id = o.id || 'sg';
  const d = diskDNA(hash);
  const C = HOT[d.temp];
  const rumble = !!o.rumbling;
  const t = tesseractPaths({ angles: d.tess, d4: 2.8, tilt: -18, yaw: 30 }, 0, d.rh * 0.22);
  const ring = hashRingText(`INFINITY · SEALED AT BLOCK ${o.block || '?'} · ${o.date || ''}`, hash);
  const inner = `<defs>
    ${dopplerGrad(d, id, C)}
    <linearGradient id="${id}-halo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C[1]}" stop-opacity=".95"/><stop offset=".35" stop-color="${C[2]}" stop-opacity=".85"/><stop offset=".7" stop-color="${C[3]}" stop-opacity=".6"/><stop offset="1" stop-color="${C[3]}" stop-opacity=".25"/></linearGradient>
    <radialGradient id="${id}-glow"><stop offset=".45" stop-color="${C[2]}" stop-opacity="0"/><stop offset=".62" stop-color="${C[2]}" stop-opacity=".28"/><stop offset="1" stop-color="${C[3]}" stop-opacity="0"/></radialGradient>
    <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="${id}-hole"><circle r="${f1(d.rh * 0.98)}"/></clipPath>
  </defs>
  ${bezel(id, { bearing: d.bearing, ringText: esc(ring) })}
  <circle r="${f1(d.rh * 2.6)}" fill="url(#${id}-glow)"/>
  ${dust(d, d.dust, 214, 236, C[1])}
  ${diskHalf(d, id, false, { fracture: rumble })}
  <g filter="url(#${id}-blur)" opacity=".55"><path d="${halo(d.rh)}" fill="url(#${id}-halo)" fill-rule="evenodd"/></g>
  <path class="sg-halo" d="${halo(d.rh)}" fill="url(#${id}-halo)" fill-rule="evenodd" opacity=".8"/>
  <circle r="${f1(d.rh * 1.09)}" fill="none" stroke="${C[0]}" stroke-width="1.4" stroke-opacity=".9"/>
  <circle r="${f1(d.rh)}" fill="#000"/>
  <g clip-path="url(#${id}-hole)" fill="none" stroke="${C[2]}" stroke-opacity=".13" stroke-width="1"><path d="${t.outer}${t.inner}${t.links}"/></g>
  <circle class="sg-photon" r="${f1(d.rh * 1.03)}" fill="none" stroke="${C[0]}" stroke-width="2" stroke-opacity=".95"/>
  ${diskHalf(d, id, true, { fracture: rumble })}
  ${rumble ? `<g class="sg-warn" fill="none" stroke="#FF5A3C" stroke-width="2.4" stroke-dasharray="14 10" stroke-opacity=".85"><circle r="226"/></g>` : ''}`;
  return wrap(o, 'sg-sealed' + (rumble ? ' sg-rumbling' : ''), inner, {
    top: `INFINITY MISSION · #${fmtH(o.block)}`,
    bottom: rumble ? 'CRITICAL · TRANSFER PENDING' : `${o.name ? o.name : 'SINGULARITY'} · ${o.date || '—'}`,
    alert: rumble,
  });
}

export function rumbling(hash, o = {}) {
  return sealed(hash, { ...o, rumbling: true });
}

// ── 移動後：超立方体（外の環は入金のブロックのまま）
export function released(depositHash, moveHash, o = {}) {
  const id = o.id || 'sg';
  const d = diskDNA(depositHash);
  const m = tessDNA(moveHash);
  const ring = hashRingText(`INFINITY · RELEASED AT BLOCK ${o.moveBlock || '?'} · ${o.moveDate || ''} · SEALED AT ${o.block || '?'}`, moveHash);
  const scale = 62;
  const t = tesseractPaths(m, 0, scale);
  // 時間の格子（奥へ続く回廊）
  const S = 226, n = m.strands;
  let lattice = '';
  for (let i = 0; i <= n; i++) {
    const u = lerp(-S, S, i / n);
    lattice += `M${f1(u)} ${-S}L0 0M${f1(u)} ${S}L0 0M${-S} ${f1(u)}L0 0M${S} ${f1(u)}L0 0`;
  }
  let frames = '';
  for (let k = 0; k < m.depth; k++) {
    const s = S * Math.pow(0.6, k + 1);
    frames += `M${f1(-s)} ${f1(-s)}H${f1(s)}V${f1(s)}H${f1(-s)}Z`;
  }
  const pts = t.points.map((p) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${p[2] > 0 ? 2.6 : 1.8}"/>`).join('');
  const inner = `<defs>
    ${dopplerGrad(d, id, ['#E8F6FF', '#B9E3FF', '#7FBCE6', '#3E6E92', '#1B3346'])}
    <radialGradient id="${id}-core"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".18" stop-color="#E6F7FF" stop-opacity=".95"/><stop offset=".5" stop-color="#7FC8FF" stop-opacity=".22"/><stop offset="1" stop-color="#7FC8FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-jet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6F7FF" stop-opacity="0"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset="1" stop-color="#E6F7FF" stop-opacity="0"/></linearGradient>
    <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    <clipPath id="${id}-in"><circle r="230"/></clipPath>
  </defs>
  ${bezel(id, { bearing: d.bearing, ringText: esc(ring), cool: true })}
  <g clip-path="url(#${id}-in)">
    <path d="${lattice}" stroke="${ICE.soft}0.13)" stroke-width=".8" fill="none"/>
    <path d="${frames}" stroke="${ICE.soft}0.22)" stroke-width="1" fill="none"/>
  </g>
  ${diskHalf(d, id, false, { ghost: true })}
  ${diskHalf(d, id, true, { ghost: true })}
  <circle r="150" fill="url(#${id}-core)"/>
  <g transform="rotate(${f1(m.jet)})"><rect class="sg-jet" x="-2.2" y="-300" width="4.4" height="600" fill="url(#${id}-jet)"/><rect x="-9" y="-300" width="18" height="600" fill="url(#${id}-jet)" opacity=".25" filter="url(#${id}-blur)"/></g>
  <g class="sg-tess" fill="none" stroke-linecap="round">
    <g filter="url(#${id}-blur)" opacity=".7"><path class="te-o" d="${t.outer}" stroke="#9FD8FF" stroke-width="4"/></g>
    <path class="te-l" d="${t.links}" stroke="#9FD8FF" stroke-opacity=".55" stroke-width="1.2"/>
    <path class="te-i" d="${t.inner}" stroke="#CFEFFF" stroke-opacity=".75" stroke-width="1.3"/>
    <path class="te-o" d="${t.outer}" stroke="#F2FBFF" stroke-width="1.8"/>
    <g class="te-p" fill="#F2FBFF">${pts}</g>
  </g>
  <circle r="5" fill="#FFFFFF"/>`;
  return wrap(o, 'sg-released', inner, {
    top: `INFINITY MISSION · #${fmtH(o.block)} → #${fmtH(o.moveBlock)}`,
    bottom: `${o.name ? o.name : 'TRANSCENDED'} · ${o.moveDate || '—'}`,
    cool: true,
  });
}

// ── 承認待ちの入金：塵が集まってくる
export function gathering(o = {}) {
  const r = rand(0x2f6a1c);
  let s = '';
  for (let arm = 0; arm < 3; arm++) {
    for (let i = 0; i < 46; i++) {
      const u = i / 45;
      const rr = lerp(228, 46, u);
      const a = arm * (TAU / 3) + u * 3.4 + (r() - 0.5) * 0.18;
      s += `<circle cx="${f1(Math.cos(a) * rr)}" cy="${f1(Math.sin(a) * rr * 0.62)}" r="${f2(0.7 + u * 1.6)}" fill-opacity="${f2(0.15 + u * 0.7)}"/>`;
    }
  }
  const inner = `${bezel('g', { bearing: 0, dim: true })}
  <g class="sg-spiral" fill="#FFD08A">${s}</g>
  <circle r="36" fill="none" stroke="#FFB04A" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="3 5"/>`;
  return wrap(o, 'sg-gathering', inner, { top: 'INFINITY MISSION · INBOUND', bottom: o.name ? `${o.name} · AWAITING` : 'AWAITING CONFIRMATION' });
}

// ── まだ空：信号なし
export function empty(o = {}) {
  let grid = '';
  for (const r of [60, 120, 180]) grid += `<circle r="${r}" fill="none" stroke="rgba(160,190,210,.12)" stroke-dasharray="2 6"/>`;
  const inner = `${bezel('e', { bearing: 0, dim: true })}
  ${grid}
  <path d="M-40 0H-12M12 0H40M0 -40V-12M0 12V40" stroke="rgba(255,176,74,.55)" stroke-width="1.4"/>
  <circle r="4" fill="none" stroke="rgba(255,176,74,.7)"/>`;
  return wrap(o, 'sg-empty', inner, { top: 'INFINITY MISSION · STANDBY', bottom: o.name ? `${o.name} · NO SIGNAL` : 'NO SIGNAL', dim: true });
}
