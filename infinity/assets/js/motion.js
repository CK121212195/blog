// 全ページ共通の動き
//  - 現れる：重力に引かれて、弧を描きながら所定の位置へ（左右どちらから来るかは置き場所で決める）
//  - 上の帯：少し下ったら背景をつける
//  - 傾く：data-tilt の板は、マウスに合わせてわずかに傾く（無重力の手ざわり）
import { $$, prefersReducedMotion } from './util.js';

export function initReveal(root = document) {
  const els = $$('.rv', root).filter((el) => !el.dataset.rvBound);
  if (!els.length) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -7% 0px' });
  const vw = window.innerWidth;
  const groups = new Map();
  els.forEach((el) => {
    el.dataset.rvBound = '1';
    if (!el.classList.contains('from-l') && !el.classList.contains('from-r') && el.dataset.orbit !== 'none') {
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.82) el.classList.add(r.left + r.width / 2 < vw / 2 ? 'from-l' : 'from-r');
    }
    // 同じ親の中では、少しずつ遅れて現れる
    const p = el.parentElement;
    const k = groups.get(p) || 0;
    groups.set(p, k + 1);
    if (k && !el.style.getPropertyValue('--rv-d')) el.style.setProperty('--rv-d', `${Math.min(k, 5) * 0.07}s`);
    io.observe(el);
  });
}

export function initHeader(cls = 'scrolled', y = 40) {
  const on = () => document.body.classList.toggle(cls, window.scrollY > y);
  window.addEventListener('scroll', on, { passive: true });
  on();
}

export function initTilt(root = document) {
  if (prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  $$('[data-tilt]', root).forEach((el) => {
    const max = Number(el.dataset.tilt) || 6;
    let raf = 0, rx = 0, ry = 0, tx = 0, ty = 0;
    const loop = () => {
      rx += (tx - rx) * 0.12;
      ry += (ty - ry) * 0.12;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      if (Math.abs(tx - rx) > 0.01 || Math.abs(ty - ry) > 0.01) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      tx = -((e.clientY - r.top) / r.height - 0.5) * max;
      ty = ((e.clientX - r.left) / r.width - 0.5) * max;
      kick();
    });
    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  });
}

// ブロックが届いたときに、ページの上から下へ一本の光を走らせる
export function sweep() {
  if (prefersReducedMotion()) return;
  const s = document.createElement('span');
  s.className = 'block-sweep';
  s.setAttribute('aria-hidden', 'true');
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 1800);
}
