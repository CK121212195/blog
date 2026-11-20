// INFINITY ── NFC Tools の使い方（このページはどこにも通信しない）
import { $, $$ } from './util.js';
import { mountLangToggle } from './i18n.js';
import { mountAmbient } from './ambient.js';
import { initReveal } from './motion.js';

mountLangToggle();
mountAmbient({ lensX: 0.84 });

// iPhone / Android の切り替え（Android の端末なら最初から Android）
const tabs = $('#os-tabs');
function show(os, animate) {
  $('.seg-ind', tabs).className = 'seg-ind ' + (os === 'android' ? 'r' : 'l');
  $$('button', tabs).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.os === os)));
  for (const k of ['iphone', 'android']) {
    const ol = $('#steps-' + k);
    ol.hidden = k !== os;
    if (k === os) {
      $$('.rv', ol).forEach((li) => li.classList.add('in'));
      if (animate) { ol.classList.remove('swap'); void ol.offsetWidth; ol.classList.add('swap'); }
    }
  }
}
$$('button', tabs).forEach((b) => b.addEventListener('click', () => show(b.dataset.os, true)));
show(/android/i.test(navigator.userAgent) ? 'android' : 'iphone', false);

initReveal();
