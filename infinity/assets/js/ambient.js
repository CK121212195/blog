// 窓の外の星（全ページの背景）
//  - 奥行きのある星が、ゆっくり流れる（無重力の漂い）。マウスで少しだけ視差がつく
//  - ページのどこかに見えない特異点があり、近くの星の光を外へ曲げる（重力レンズ）
//  - スクロールすると、特異点のまわりの星が渦を巻く（重力ターン）
//  - 動きを減らす設定では、止まった一枚だけを描く
import { prefersReducedMotion } from './util.js';

const TINTS = ['255,255,255', '255,240,222', '214,232,255', '255,226,196', '236,244,255'];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function mountAmbient(opts = {}) {
  const reduce = prefersReducedMotion();
  const cv = document.createElement('canvas');
  cv.className = 'ambient';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  document.body.classList.remove('stars');
  const ctx = cv.getContext('2d', { alpha: false });
  if (!ctx) return null;

  const lensOn = opts.lens !== false;
  const lx = opts.lensX ?? 0.8; // 特異点の横位置（画面幅に対する割合）
  let W = 0, H = 0, dpr = 1, lastW = 0, stars = [];
  let px = 0, py = 0, tpx = 0, tpy = 0;
  let lastY = window.scrollY, vel = 0, swirl = 0;
  let raf = 0, idle = 0, pulseT = -1, t0 = performance.now();

  function seed() {
    const n = Math.round(Math.min(380, Math.max(130, (W * H) / (dpr * dpr) / 3800)));
    stars = Array.from({ length: n }, () => {
      const d = 0.12 + Math.pow(Math.random(), 2.2) * 0.88;
      return {
        x: Math.random(), y: Math.random(), d,
        r: 0.35 + d * 1.15 + (Math.random() < 0.05 ? 0.8 : 0),
        a: 0.25 + d * 0.65,
        tw: Math.random() * 6.283, ts: 0.3 + Math.random() * 1.6,
        c: TINTS[(Math.random() * TINTS.length) | 0],
      };
    });
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.width = Math.max(2, Math.round(window.innerWidth * dpr));
    H = cv.height = Math.max(2, Math.round(window.innerHeight * dpr));
    // 幅が変わったときだけ星を撒き直す（スマホのアドレスバーの出入りでは撒き直さない）
    if (Math.abs(W - lastW) > 2) { lastW = W; seed(); }
  }

  function draw(now) {
    const t = (now - t0) / 1000;
    px += (tpx - px) * 0.045;
    py += (tpy - py) * 0.045;
    const sy = window.scrollY;
    const dv = sy - lastY;
    lastY = sy;
    vel = vel * 0.9 + dv * 0.1;
    swirl += vel * 0.0009;
    swirl *= 0.995; // 渦は少しずつほどける

    ctx.fillStyle = '#030507';
    ctx.fillRect(0, 0, W, H);

    const doc = document.documentElement;
    const prog = sy / Math.max(1, doc.scrollHeight - window.innerHeight);
    const E = Math.min(W, H) * 0.05; // 光が曲がる強さ（アインシュタイン半径）
    const Mx = W * lx + Math.sin(t * 0.05) * W * 0.025 - px * W * 0.012;
    const My = H * (0.2 + 0.55 * prog) + Math.cos(t * 0.043) * H * 0.02 - py * H * 0.01;

    for (const s of stars) {
      let x = ((((s.x + t * 0.0012 * s.d + px * 0.014 * s.d) % 1) + 1) % 1) * W;
      let y = ((((s.y - (sy / Math.max(1, window.innerHeight)) * 0.16 * s.d + py * 0.014 * s.d) % 1) + 1) % 1) * H;
      if (lensOn) {
        let dx = x - Mx, dy = y - My;
        const r0 = Math.hypot(dx, dy);
        if (r0 < E * 10) {
          const f = 1 - smooth(E * 5, E * 10, r0);
          const a = swirl * Math.pow(E / Math.max(r0, E * 0.6), 1.6) * f;
          if (a) { const c = Math.cos(a), sn = Math.sin(a); const nx = dx * c - dy * sn; dy = dx * sn + dy * c; dx = nx; }
          const r = Math.max(r0, 0.001);
          const k = ((E * E) / Math.max(r, E * 0.3)) * f;
          x = Mx + dx + (dx / r) * k;
          y = My + dy + (dy / r) * k;
        }
      }
      const tw = 0.72 + 0.28 * Math.sin(t * s.ts + s.tw);
      ctx.fillStyle = `rgba(${s.c},${(s.a * tw).toFixed(3)})`;
      const rr = s.r * dpr;
      if (rr < 1.4) ctx.fillRect(x, y, rr, rr);
      else { ctx.beginPath(); ctx.arc(x, y, rr * 0.62, 0, 6.2832); ctx.fill(); }
    }

    if (lensOn) {
      // 影と、光子の輪（ごく淡く）
      const g = ctx.createRadialGradient(Mx, My, 0, Mx, My, E * 2.3);
      g.addColorStop(0, 'rgba(1,2,3,.96)');
      g.addColorStop(0.55, 'rgba(1,2,3,.9)');
      g.addColorStop(1, 'rgba(1,2,3,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(Mx, My, E * 2.3, 0, 6.2832);
      ctx.fill();
      ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeStyle = 'rgba(255,196,128,.12)';
      ctx.beginPath();
      ctx.arc(Mx, My, E * 1.32, 0, 6.2832);
      ctx.stroke();
      ctx.save();
      ctx.translate(Mx, My);
      ctx.rotate(-0.22 + swirl * 0.05);
      ctx.scale(1, 0.2);
      ctx.strokeStyle = 'rgba(255,170,90,.07)';
      ctx.lineWidth = E * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, E * 2.6, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    // ブロックが届いた合図：特異点から光の輪が広がる
    if (pulseT >= 0) {
      const u = (t - pulseT) / 2.4;
      if (u >= 1) pulseT = -1;
      else {
        const R = E * 2 + u * Math.max(W, H) * 0.9;
        ctx.lineWidth = (1 + (1 - u) * 2) * dpr;
        ctx.strokeStyle = `rgba(255,190,110,${(0.35 * (1 - u)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(Mx, My, R, 0, 6.2832);
        ctx.stroke();
      }
    }
  }

  let active = true;
  function frame(now) {
    if (!active) { raf = requestAnimationFrame(frame); return; }
    // 何も動いていなければ、半分の頻度で描く（電池のため）
    const busy = Math.abs(vel) > 0.05 || Math.abs(tpx - px) > 0.002 || Math.abs(tpy - py) > 0.002 || pulseT >= 0;
    idle = busy ? 0 : idle + 1;
    if (busy || idle % 2 === 0) draw(now);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    cancelAnimationFrame(raf);
    if (reduce || document.hidden) { draw(performance.now()); return; }
    raf = requestAnimationFrame(frame);
  }

  size();
  draw(performance.now());
  window.addEventListener('resize', () => { size(); if (reduce) draw(performance.now()); }, { passive: true });
  if (reduce) window.addEventListener('scroll', () => { lastY = window.scrollY; draw(performance.now()); }, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tpx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    tpy = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? cancelAnimationFrame(raf) : start()));
  start();

  return {
    pulse() { if (!reduce) pulseT = (performance.now() - t0) / 1000; },
    // 上に重なる絵（はじめのページの操縦席）が画面を覆っている間は描かない
    setActive(on) {
      if (active === !!on) return;
      active = !!on;
      if (active && reduce) draw(performance.now());
    },
  };
}
