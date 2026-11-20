// 帰還の手順 ── 12語と秘密鍵の切り替え、言語、背景の星、現れる動き（どこにも通信しない）
import { $, $$ } from './util.js';
import { mountLangToggle } from './i18n.js';
import { mountAmbient } from './ambient.js';
import { initReveal } from './motion.js';

mountLangToggle();
mountAmbient({ lensX: 0.12 });

const seg = $('#kind-seg');
function pick(kind) {
  $('.seg-ind', seg).className = 'seg-ind ' + (kind === 'seed' ? 'l' : 'r');
  $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
  $('#k-seed').hidden = kind !== 'seed';
  $('#k-key').hidden = kind !== 'key';
}
$$('button', seg).forEach((b) => b.addEventListener('click', () => pick(b.dataset.kind)));

initReveal();
