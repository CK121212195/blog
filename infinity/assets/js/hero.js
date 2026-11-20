// はじめのページの「操縦席からの眺め」
//  - 窓の外（WebGL）の向きを、画面の形に合わせて決める
//  - 窓枠・天井・計器盤（SVG）を画面の大きさに合わせて描く
//  - 特異点を追う照準（ガラスに映る表示）
//  - 地球の上を移っていく価値の光（取引の弧）── 控えめに
//  - ただよう（無重力）・マウスの視差・スクロールで特異点へ引き寄せられる
import { view } from './space.js';
import { prefersReducedMotion } from './util.js';

const TAU = Math.PI * 2;
const ALT = 0.085;
const SPIN = 0.0045;
const SUN = [0.92, 0.18, -0.12];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

// 画面の形ごとの構図（uv は高さを1とした座標。上が +）
export function layoutFor(w, h) {
  const a = w / Math.max(1, h);
  let F, yh, bx, by, s, mode;
  if (a >= 1.15) { mode = 'wide'; F = 1.05; yh = -0.115; bx = clamp(0.2 * a, 0.22, 0.42); by = 0.115; s = 0.6; }
  else if (w >= 760) { mode = 'mid'; F = 1.0; yh = -0.16; bx = 0.06; by = 0.0; s = 0.46; }
  else { mode = 'tall'; F = 0.95; yh = -0.075; bx = 0; by = 0.095; s = 0.44; }
  const pitch = Math.acos(1 / (1 + ALT)) + Math.atan(yh / F);
  return { mode, F, pitch, yh, bhScreen: [bx, by], bhScale: s };
}

// ── 窓枠（ピクセルで描く）
function framePaths(W, H, mode) {
  const top = mode === 'tall' ? 66 : 76;
  const cH = mode === 'tall' ? clamp(H * 0.27, 196, 250) : clamp(H * 0.2, 128, 186);
  const cy = H - cH;
  const p = (pts) => 'M' + pts.map((q) => q.map((n) => n.toFixed(1)).join(' ')).join('L') + 'Z';
  const topPath = `M-14 -14H${W + 14}V${top + 14}Q${W / 2} ${top - 10} -14 ${top + 14}Z`;
  const consolePath = mode === 'tall'
    ? p([[-14, H + 14], [-14, cy + 26], [W * 0.14, cy + 6], [W * 0.86, cy + 6], [W + 14, cy + 26], [W + 14, H + 14]])
    : p([[-14, H + 14], [-14, cy + 34], [W * 0.17, cy + 12], [W * 0.25, cy], [W * 0.75, cy], [W * 0.83, cy + 12], [W + 14, cy + 34], [W + 14, H + 14]]);
  const pw = mode === 'tall' ? 9 : 22;
  const xt = mode === 'tall' ? W * 0.045 : W * 0.05;
  const xb = mode === 'tall' ? -4 : W * 0.012;
  const yb = cy + (mode === 'tall' ? 28 : 36);
  const left = p([[xt, top + 6], [xt + pw, top + 4], [xb + pw * 1.5, yb], [xb, yb]]);
  const right = p([[W - xt, top + 6], [W - xt - pw, top + 4], [W - xb - pw * 1.5, yb], [W - xb, yb]]);
  return { top, cH, cy, topPath, consolePath, left, right, xt, xb, yb };
}

export function drawFrame(svg, W, H, mode) {
  const f = framePaths(W, H, mode);
  const leds = [];
  const n = mode === 'tall' ? 5 : 11;
  for (let i = 0; i < n; i++) {
    const x = W * (0.3 + (0.4 * i) / Math.max(1, n - 1));
    leds.push(`<rect x="${(x - 7).toFixed(1)}" y="${(f.top - 2).toFixed(1)}" width="14" height="2.4" class="${i % 4 === 1 ? 'led-g' : 'led-a'}"/>`);
  }
  const slots = [];
  if (mode !== 'tall') {
    for (let i = 0; i < 6; i++) slots.push(`<rect x="${(W * 0.03 + i * 22).toFixed(1)}" y="${(H - 18).toFixed(1)}" width="14" height="4" class="${i === 2 ? 'led-g' : 'led-d'}"/>`, `<rect x="${(W * 0.97 - 14 - i * 22).toFixed(1)}" y="${(H - 18).toFixed(1)}" width="14" height="4" class="${i === 4 ? 'led-a' : 'led-d'}"/>`);
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs>
    <linearGradient id="fr-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a21"/><stop offset=".55" stop-color="#0a0f14"/><stop offset="1" stop-color="#05080b"/></linearGradient>
    <linearGradient id="fr-console" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151e26"/><stop offset=".12" stop-color="#0b1116"/><stop offset="1" stop-color="#030507"/></linearGradient>
    <linearGradient id="fr-pillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06090c"/><stop offset=".5" stop-color="#1a242d"/><stop offset="1" stop-color="#080b0f"/></linearGradient>
    <linearGradient id="fr-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe3ff" stop-opacity=".05"/><stop offset=".35" stop-color="#bfe3ff" stop-opacity="0"/><stop offset=".62" stop-color="#bfe3ff" stop-opacity="0"/><stop offset=".7" stop-color="#bfe3ff" stop-opacity=".035"/><stop offset=".78" stop-color="#bfe3ff" stop-opacity="0"/></linearGradient>
    <radialGradient id="fr-vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fr-vig)"/>
  <rect width="${W}" height="${H}" fill="url(#fr-glass)"/>
  <path d="${f.left}" fill="url(#fr-pillar)"/><path d="${f.right}" fill="url(#fr-pillar)"/>
  <path d="${f.left}" fill="none" class="fr-hl"/><path d="${f.right}" fill="none" class="fr-hl"/>
  <path d="${f.topPath}" fill="url(#fr-metal)"/>
  <path d="M-14 ${f.top + 14}Q${W / 2} ${f.top - 10} ${W + 14} ${f.top + 14}" fill="none" class="fr-edge"/>
  <g class="fr-leds">${leds.join('')}</g>
  <path d="${f.consolePath}" fill="url(#fr-console)"/>
  <path d="${f.consolePath}" fill="none" class="fr-edge c"/>
  <g class="fr-leds">${slots.join('')}</g>`;
  return f;
}

// ── 照準（特異点を追う）
export function reticleSVG() {
  let segs = '';
  for (let i = 0; i < 12; i++) {
    const a0 = (i * 30 + 4) * (Math.PI / 180), a1 = (i * 30 + 15) * (Math.PI / 180);
    segs += `<path d="M${Math.cos(a0) * 112} ${Math.sin(a0) * 112}A112 112 0 0 1 ${Math.cos(a1) * 112} ${Math.sin(a1) * 112}"/>`;
  }
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * (Math.PI / 180), r1 = i % 6 === 0 ? 96 : 100;
    ticks += `M${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}L${(Math.cos(a) * 104).toFixed(1)} ${(Math.sin(a) * 104).toFixed(1)}`;
  }
  return `<svg viewBox="-160 -160 320 320" aria-hidden="true">
    <circle r="104" class="rt-ring"/>
    <path d="${ticks}" class="rt-tick"/>
    <g class="rt-seg">${segs}</g>
    <path d="M-138 -96V-138H-96M96 -138H138V-96M138 96V138H96M-96 138H-138V96" class="rt-brk"/>
    <path d="M-14 0H-5M5 0H14M0 -14V-5M0 5V14" class="rt-x"/>
  </svg>`;
}

// ── 価値の光（取引の弧）。地球の表面にくっついて回り、地平線の向こうは隠れる
function makeArcs(cv) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const arcs = [];
  const pings = [];
  let next = 0;
  const C = [0, -(1 + ALT), 0];
  const cc = dot(C, C) - 1;

  function size() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = Math.max(2, Math.round(r.width * dpr));
    H = cv.height = Math.max(2, Math.round(r.height * dpr));
  }
  const toPx = (uv) => [W / 2 + uv[0] * H, H / 2 - uv[1] * H];
  function hit(uv, P) {
    const d = view.dir(uv, P);
    const b = dot(d, C), h = b * b - cc;
    if (h <= 0 || b <= 0) return null;
    const t = b - Math.sqrt(h);
    return [d[0] * t, d[1] * t, d[2] * t];
  }
  const toPlanet = (p, t) => rotX(nrm(sub(p, C)), -t * SPIN);
  const toWorld = (q, t, h = 0) => { const n = rotX(q, t * SPIN); const k = 1 + h; return [C[0] + n[0] * k, C[1] + n[1] * k, C[2] + n[2] * k]; };
  function seen(p) {
    const L = len(p);
    const d = [p[0] / L, p[1] / L, p[2] / L];
    const b = dot(d, C), h = b * b - cc;
    if (h <= 0) return true;
    const t = b - Math.sqrt(h);
    return !(t > 0 && t < L - 1e-3);
  }
  function slerp(a, b, s) {
    const c = clamp(dot(a, b), -1, 1);
    const w = Math.acos(c);
    if (w < 1e-4) return a;
    const k0 = Math.sin((1 - s) * w) / Math.sin(w), k1 = Math.sin(s * w) / Math.sin(w);
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
  }
  function randomSurface(t, P, yh) {
    const aspect = W / Math.max(1, H);
    for (let k = 0; k < 8; k++) {
      const uv = [rnd(-0.48, 0.48) * aspect, rnd(-0.5, yh - 0.015)];
      const p = hit(uv, P);
      if (p) return toPlanet(p, t);
    }
    return null;
  }
  function spawn(t, P, yh, kind = 'surface') {
    const q0 = randomSurface(t, P, yh);
    if (!q0) return;
    if (kind === 'up') {
      arcs.push({ kind, q0, t0: t, dur: rnd(4.2, 6) });
      return;
    }
    for (let k = 0; k < 6; k++) {
      const q1 = randomSurface(t, P, yh);
      if (!q1) continue;
      const ang = Math.acos(clamp(dot(q0, q1), -1, 1));
      if (ang < 0.035 || ang > 0.32) continue;
      arcs.push({ kind, q0, q1, ang, t0: t, dur: rnd(2.2, 3.6), done: false });
      return;
    }
  }
  function draw(t, P, opts) {
    ctx.clearRect(0, 0, W, H);
    if (t > next) {
      spawn(t, P, opts.yh, Math.random() < 0.14 ? 'up' : 'surface');
      next = t + rnd(0.5, 1.3);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      const u = (t - a.t0) / a.dur;
      if (u > 1.35) { arcs.splice(i, 1); continue; }
      const head = Math.min(1, u), tail = Math.max(0, head - (a.kind === 'up' ? 0.5 : 0.38));
      const N = 26;
      let prev = null;
      for (let j = 0; j <= N; j++) {
        const s = tail + ((head - tail) * j) / N;
        let pw;
        if (a.kind === 'up') {
          const p0 = toWorld(a.q0, t), up = nrm(sub(p0, C));
          const e = [P.bhDir[0] * 4, P.bhDir[1] * 4, P.bhDir[2] * 4];
          const c1 = [p0[0] + up[0] * 0.5, p0[1] + up[1] * 0.5, p0[2] + up[2] * 0.5];
          const k = s, m = 1 - k;
          pw = [m * m * p0[0] + 2 * m * k * c1[0] + k * k * e[0], m * m * p0[1] + 2 * m * k * c1[1] + k * k * e[1], m * m * p0[2] + 2 * m * k * c1[2] + k * k * e[2]];
        } else {
          pw = toWorld(nrm(slerp(a.q0, a.q1, s)), t, a.ang * 0.32 * Math.sin(Math.PI * s));
        }
        if (!seen(pw)) { prev = null; continue; }
        const uv = view.project(pw, P);
        if (!uv) { prev = null; continue; }
        const px = toPx(uv);
        if (prev) {
          const rel = j / N;
          const fade = a.kind === 'up' ? (1 - head) * 0.9 : u > 1 ? Math.max(0, 1 - (u - 1) / 0.35) : 1;
          const al = Math.pow(rel, 1.6) * (a.kind === 'up' ? 0.32 : 0.5) * fade;
          if (al > 0.01) {
            ctx.strokeStyle = a.kind === 'up' ? `rgba(159,216,255,${al.toFixed(3)})` : `rgba(255,186,96,${al.toFixed(3)})`;
            ctx.lineWidth = (a.kind === 'up' ? 1 : 1.25) * dpr;
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(px[0], px[1]);
            ctx.stroke();
          }
        }
        prev = px;
        if (j === N && u <= 1) {
          ctx.fillStyle = a.kind === 'up' ? 'rgba(200,236,255,.5)' : 'rgba(255,214,150,.75)';
          ctx.beginPath();
          ctx.arc(px[0], px[1], 1.6 * dpr, 0, TAU);
          ctx.fill();
          ctx.fillStyle = a.kind === 'up' ? 'rgba(159,216,255,.12)' : 'rgba(255,170,80,.16)';
          ctx.beginPath();
          ctx.arc(px[0], px[1], 5 * dpr, 0, TAU);
          ctx.fill();
        }
      }
      if (a.kind === 'surface' && u >= 1 && !a.done) { a.done = true; pings.push({ q: a.q1, t0: t, big: false }); }
    }
    // 届いた先の、小さな波紋（地表に沿った円）
    for (let i = pings.length - 1; i >= 0; i--) {
      const g = pings[i];
      const u = (t - g.t0) / (g.big ? 3 : 1.1);
      if (u > 1) { pings.splice(i, 1); continue; }
      const rad = (g.big ? 0.16 : 0.009) * Math.pow(u, 0.6);
      const ax = Math.abs(g.q[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = nrm([g.q[1] * ax[2] - g.q[2] * ax[1], g.q[2] * ax[0] - g.q[0] * ax[2], g.q[0] * ax[1] - g.q[1] * ax[0]]);
      const e2 = [g.q[1] * e1[2] - g.q[2] * e1[1], g.q[2] * e1[0] - g.q[0] * e1[2], g.q[0] * e1[1] - g.q[1] * e1[0]];
      ctx.strokeStyle = `rgba(255,190,110,${((g.big ? 0.38 : 0.32) * (1 - u)).toFixed(3)})`;
      ctx.lineWidth = (g.big ? 1.4 : 1) * dpr;
      ctx.beginPath();
      let started = false;
      for (let k = 0; k <= 40; k++) {
        const th = (k / 40) * TAU;
        const qq = nrm([g.q[0] + (e1[0] * Math.cos(th) + e2[0] * Math.sin(th)) * rad, g.q[1] + (e1[1] * Math.cos(th) + e2[1] * Math.sin(th)) * rad, g.q[2] + (e1[2] * Math.cos(th) + e2[2] * Math.sin(th)) * rad]);
        const pw = toWorld(qq, t);
        const uv = seen(pw) ? view.project(pw, P) : null;
        if (!uv) { started = false; continue; }
        const px = toPx(uv);
        if (!started) { ctx.moveTo(px[0], px[1]); started = true; } else ctx.lineTo(px[0], px[1]);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function burst(t, P, yh) {
    for (let k = 0; k < 3; k++) spawn(t, P, yh, 'surface');
    const q = randomSurface(t, P, yh);
    if (q) pings.push({ q, t0: t, big: true });
  }
  size();
  return { size, draw, burst, clear: () => ctx.clearRect(0, 0, W, H) };
}

// ── 全部をつなぐ
export function mountHero({ hero, space, txCanvas, frameSvg, reticle, onLayout }) {
  const reduce = prefersReducedMotion();
  let L = null, f = null, bhDir = [0, 0, 1];
  let px = 0, py = 0, tpx = 0, tpy = 0, approach = 0, pulse = 0;
  const arcs = txCanvas && space && !reduce ? makeArcs(txCanvas) : null;

  function relayout() {
    const r = hero.getBoundingClientRect();
    L = layoutFor(r.width, r.height);
    f = drawFrame(frameSvg, Math.round(r.width), Math.round(r.height), L.mode);
    hero.style.setProperty('--cy', `${f.cy}px`);
    hero.style.setProperty('--ch', `${f.cH}px`);
    hero.style.setProperty('--top', `${f.top}px`);
    hero.dataset.mode = L.mode;
    bhDir = view.dir(L.bhScreen, { shift: [0, 0], roll: 0, F: L.F, pitch: L.pitch });
    if (space) space.set({ F: L.F, pitch: L.pitch, bh: bhDir, bhScale: L.bhScale, earth: [ALT, 0, SPIN, 1], sun: SUN });
    if (arcs) arcs.size();
    if (onLayout) onLayout(L, f);
    place(space ? space.time : 24);
  }

  // 照準を、いまの特異点の位置へ
  function place(t) {
    if (!reticle || !L) return;
    const P = current(t);
    const uv = view.project([bhDir[0] * 10, bhDir[1] * 10, bhDir[2] * 10], P);
    if (!uv) return;
    const r = hero.getBoundingClientRect();
    const x = r.width / 2 + uv[0] * r.height, y = r.height / 2 - uv[1] * r.height;
    const size = Math.round(r.height * (L.mode === 'tall' ? 0.4 : 0.5) * (L.bhScale / 0.6) * (1 + approach * 0.9));
    reticle.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - size / 2).toFixed(1)}px)`;
    reticle.style.width = reticle.style.height = `${size}px`;
  }

  function current(t) {
    const P = {
      F: L.F,
      pitch: L.pitch - approach * 0.2,
      roll: reduce ? 0 : Math.sin(t * 0.11) * 0.008 + approach * 0.09,
      shift: reduce ? [0, 0] : [Math.sin(t * 0.23) * 0.004 + px * 0.012, Math.cos(t * 0.19) * 0.0035 - py * 0.009],
      bhDir,
    };
    return P;
  }

  if (space) {
    space.onFrame((t, SP) => {
      px += (tpx - px) * 0.05;
      py += (tpy - py) * 0.05;
      pulse *= 0.975;
      const P = current(t);
      SP.shift = P.shift;
      SP.roll = P.roll;
      SP.pitch = P.pitch;
      SP.bhScale = L.bhScale * (1 + approach * 0.9);
      SP.pulse = pulse;
      if (arcs) arcs.draw(t, P, { yh: L.yh });
      place(t);
      frameSvg.style.translate = `${(-px * 7).toFixed(2)}px ${(-py * 5).toFixed(2)}px`;
    });
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tpx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    tpy = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  }, { passive: true });
  const onScroll = () => {
    const h = hero.offsetHeight || 1;
    approach = reduce ? 0 : clamp(window.scrollY / h, 0, 1);
    hero.style.setProperty('--ap', approach.toFixed(3));
    if (space && !space.running) space.redraw();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(relayout).observe(hero);
  relayout();
  onScroll();

  return {
    // ブロックが届いた：地上の灯が強まり、円盤が明るくなり、光が飛ぶ
    pulse() {
      if (reduce || !space) return;
      pulse = 1;
      if (arcs) arcs.burst(space.time, current(space.time), L.yh);
    },
    get layout() { return L; },
  };
}
