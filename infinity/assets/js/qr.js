// 入金用の QR（BIP21）
import qrcode from '../lib/qrcode.js';

// bech32 は大文字にしても同じアドレス（QR が読み取りやすくなる）
export function bip21(address) {
  return 'bitcoin:' + (/^(bc1|tb1)/.test(address) ? address.toUpperCase() : address);
}

export function qrSvg(text, fill = '#14181A') {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="${fill}"/></svg>`;
}
