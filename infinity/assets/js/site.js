// コックピット（m/）の URL と、NFC タグに入る大きさ
import { b64urlEncodeUtf8 } from './util.js';

// キットのタグは NTAG213（ユーザー領域 144 バイト）を想定。
// 容量の大きいタグ（NTAG215 は 504、NTAG216 は 888）に変えたら、ここを書き換える。
export const TAG_BYTES = 144;

// コックピット側でも、名前は 40 文字で切る
export const NAME_MAX = 40;

// /infinity/setup/ から見た /infinity/m/
export function omamoriBase(href) {
  return new URL('../m/', href).href;
}

export function omamoriUrl({ address, name = '', net = 'main' }, base) {
  let u = base + '#' + address;
  const nm = String(name || '').trim();
  if (nm) u += '&n=' + b64urlEncodeUtf8(nm);
  if (net === 'signet') u += '&net=signet';
  return u;
}

// URL を1件だけ書いた NDEF の大きさ（バイト）。
// 「https://」を1バイトの略号にしない書き方でも収まるよう、多めに数える。
//   TLV(03 長さ) + レコード(ヘッダ・型長・ペイロード長・型'U') + 略号1 + URL + 終端(FE)
export function ndefBytes(url) {
  const urlLen = new TextEncoder().encode(url).length;
  const payload = 1 + urlLen;
  const record = 1 + 1 + (payload > 255 ? 4 : 1) + 1 + payload;
  return 1 + (record > 254 ? 3 : 1) + record + 1;
}

// 名前に、あと何文字（日本語＝3バイトとして）入るか
export function nameRoom({ address, net = 'main', name = '' }, base, cap = TAG_BYTES) {
  const used = String(name || '').trim();
  let k = 0;
  while (used.length + k < NAME_MAX && ndefBytes(omamoriUrl({ address, net, name: used + '字'.repeat(k + 1) }, base)) <= cap) k++;
  return k;
}

export function fitsTag(url, cap = TAG_BYTES) {
  return ndefBytes(url) <= cap;
}
