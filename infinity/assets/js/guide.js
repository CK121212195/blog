// 帰還の手順 ── 12語と秘密鍵の切り替えだけ
import { $, $$ } from './util.js';

const seg = $('#kind-seg');
function pick(kind) {
  $('.seg-ind', seg).className = 'seg-ind ' + (kind === 'seed' ? 'l' : 'r');
  $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
  $('#k-seed').hidden = kind !== 'seed';
  $('#k-key').hidden = kind !== 'key';
}
$$('button', seg).forEach((b) => b.addEventListener('click', () => pick(b.dataset.kind)));
