// node infinity/_tests/core.test.mjs で実行（公開されない _tests フォルダ）
import assert from 'node:assert/strict';
import { validateAddress } from '../assets/js/address.js';
import { loadOmamori, estimateSweepVbytes } from '../assets/js/chain.js';
import * as SG from '../assets/js/singularity.js';
import { omamoriBase, omamoriUrl, ndefBytes, nameRoom, TAG_BYTES } from '../assets/js/site.js';
import { decodeUrlBytes, sameUrl, errorText } from '../assets/js/nfc.js';

let pass = 0;
const t = async (name, fn) => { await fn(); pass++; console.log('ok', name); };

// ── アドレス（BIP173・BIP350 の例と、よく知られたレガシーアドレス）
await t('bech32 v0 大文字 → 小文字にして受け付ける', async () => {
  const r = await validateAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4');
  assert.deepEqual([r.ok, r.network, r.type, r.address], [true, 'main', 'p2wpkh', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4']);
});
await t('testnet p2wsh', async () => {
  const r = await validateAddress('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7');
  assert.deepEqual([r.ok, r.network, r.type], [true, 'test', 'p2wsh']);
});
await t('taproot（bech32m）', async () => {
  const r = await validateAddress('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0');
  assert.deepEqual([r.ok, r.type], [true, 'p2tr']);
});
await t('1文字違い → checksum', async () => {
  const r = await validateAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5');
  assert.deepEqual([r.ok, r.reason], [false, 'checksum']);
});
await t('v1 を bech32 で符号化したもの（BIP350 で無効）', async () => {
  const r = await validateAddress('bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx');
  assert.equal(r.ok, false);
});
await t('レガシー p2pkh / p2sh', async () => {
  const a = await validateAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
  const b = await validateAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
  assert.deepEqual([a.ok, a.type, b.ok, b.type], [true, 'p2pkh', true, 'p2sh']);
});
await t('レガシーの1文字違い → checksum', async () => {
  const r = await validateAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3');
  assert.deepEqual([r.ok, r.reason], [false, 'checksum']);
});
await t('デザイン案の見本アドレスは無効（誤送金しない）', async () => {
  const r = await validateAddress('bc1qmamorisampleaddressxxxxxxxxxxxxxxxxxxx');
  assert.equal(r.ok, false);
});

// ── 状態判定（mempool.space と同じ形の模擬データ）
const ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const H840 = '0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5';
const H905 = '00000000000000000001a931ea278526fe4f38e6cfabde3a252ee51536c27572';
const fund = (txid, value, status) => ({ txid, vin: [], vout: [{ scriptpubkey_address: 'bc1qother', value: 1 }, { scriptpubkey_address: ADDR, value }], status });
const conf = (h, hash, time) => ({ confirmed: true, block_height: h, block_hash: hash, block_time: time });
function mock(routes, { failFirstBase = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (failFirstBase && url.startsWith('https://mempool.space/')) throw new Error('down');
    const path = url.replace(/^https:\/\/[^/]+(\/[a-z0-9]+)?\/api/, '');
    if (!(path in routes)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(routes[path])) };
  };
  return { fetchImpl, calls };
}
const stats = (fund = 0, spent = 0, fc = 0, sc = 0) => ({ chain_stats: { funded_txo_sum: fund, spent_txo_sum: spent, funded_txo_count: fc, spent_txo_count: sc }, mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 } });

await t('入金なし → empty', async () => {
  const m = mock({ [`/address/${ADDR}`]: stats(), [`/address/${ADDR}/txs`]: [] });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.equal(r.state, 'empty');
});
await t('未承認の入金だけ → gathering', async () => {
  const m = mock({ [`/address/${ADDR}`]: stats(), [`/address/${ADDR}/txs`]: [fund('m1', 10000, { confirmed: false })] });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.deepEqual([r.state, r.pendingIn], ['gathering', 10000]);
});
await t('承認済み・未使用 → sealed（最初の入金のブロック）', async () => {
  const m = mock({
    [`/address/${ADDR}`]: stats(10000, 0, 1, 0),
    [`/address/${ADDR}/txs`]: [fund('f1', 10000, conf(840000, H840, 1713571767))],
    ['/tx/f1/outspends']: [{ spent: false }, { spent: false }],
  });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.deepEqual([r.state, r.first.height, r.first.hash, r.first.amount, r.balance.confirmed], ['sealed', 840000, H840, 10000, 10000]);
});
await t('使われたが未承認 → rumbling', async () => {
  const m = mock({
    [`/address/${ADDR}`]: stats(10000, 0, 1, 0),
    [`/address/${ADDR}/txs`]: [fund('s1', 0, { confirmed: false }), fund('f1', 10000, conf(840000, H840, 1713571767))],
    ['/tx/f1/outspends']: [{ spent: false }, { spent: true, txid: 's1', status: { confirmed: false } }],
  });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.equal(r.state, 'rumbling');
});
await t('移動が承認 → released（移動のブロック）', async () => {
  const m = mock({
    [`/address/${ADDR}`]: stats(10000, 10000, 1, 1),
    [`/address/${ADDR}/txs`]: [fund('f1', 10000, conf(840000, H840, 1713571767))],
    ['/tx/f1/outspends']: [{ spent: false }, { spent: true, txid: 's1', status: conf(905900, H905, 1752727208) }],
  });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.deepEqual([r.state, r.move.height, r.move.hash, r.balance.confirmed], ['released', 905900, H905, 0]);
});
await t('入金が複数 → いちばん早いブロックが最初の入金', async () => {
  const m = mock({
    [`/address/${ADDR}`]: stats(30000, 0, 2, 0),
    [`/address/${ADDR}/txs`]: [fund('f2', 20000, conf(850000, 'aa'.repeat(32), 1719000000)), fund('f1', 10000, conf(840000, H840, 1713571767))],
    ['/tx/f1/outspends']: [{ spent: false }, { spent: false }],
  });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.deepEqual([r.first.txid, r.depositCount], ['f1', 2]);
});
await t('25件を超えたら続きのページも読む', async () => {
  const page1 = Array.from({ length: 25 }, (_, i) => fund('p' + i, 1, conf(900000 - i, 'bb'.repeat(32), 1750000000)));
  const page2 = [fund('old', 5000, conf(840000, H840, 1713571767))];
  const m = mock({
    [`/address/${ADDR}`]: stats(5025, 0, 26, 0),
    [`/address/${ADDR}/txs`]: page1,
    ['/address/' + ADDR + '/txs/chain/p24']: page2,
    ['/tx/old/outspends']: [{ spent: false }, { spent: false }],
  });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.deepEqual([r.first.txid, r.first.height], ['old', 840000]);
});
await t('mempool.space が落ちていたら blockstream.info で読む', async () => {
  const m = mock({ [`/address/${ADDR}`]: stats(), [`/address/${ADDR}/txs`]: [] }, { failFirstBase: true });
  const r = await loadOmamori(ADDR, 'main', { fetchImpl: m.fetchImpl });
  assert.equal(r.state, 'empty');
  assert.ok(m.calls.some((u) => u.startsWith('https://blockstream.info/api/')));
});
await t('手数料の大きさのめやす', async () => {
  assert.equal(estimateSweepVbytes('p2wpkh', 1), 110);
  assert.equal(estimateSweepVbytes('p2tr', 1), 99);
});

// ── 紋（ブラウザと同じコードで描けるか）
await t('五つの状態の紋が描ける', async () => {
  const s = SG.sealed(H840, { id: 't1', block: '840000', date: '2024.04.20' });
  const r = SG.released(H840, H905, { id: 't2', block: '840000', moveBlock: '905900', moveDate: '2025.07.17' });
  const u = SG.rumbling(H840, { id: 't3', block: '840000' });
  for (const svg of [s, r, u]) assert.ok(svg.startsWith('<svg') && svg.trim().endsWith('</svg>'));
  assert.ok(s.includes('SINGULARITY') && r.includes('TRANSCENDED') && u.includes('sg-rumbling'));
  assert.ok(r.includes('sg-tess') && !s.includes('sg-tess'), '動かした後だけ超立方体');
  assert.ok(SG.gathering({ id: 't4' }).includes('<svg') && SG.empty().includes('NO SIGNAL'));
  assert.equal(SG.sealed(H840, { id: 'x', block: '840000' }), SG.sealed(H840, { id: 'x', block: '840000' }), '同じハッシュなら同じ紋');
  assert.notEqual(SG.sealed(H840, { id: 'x' }), SG.sealed(H905, { id: 'x' }), 'ハッシュが違えば違う紋');
  // 超立方体：16頂点・32辺、時間で回る
  const d = SG.tessDNA(H905);
  const p0 = SG.tesseractPaths(d, 0, 60), p1 = SG.tesseractPaths(d, 1, 60);
  assert.equal(p0.points.length, 16);
  assert.equal((p0.outer + p0.inner + p0.links).split('M').length - 1, 32);
  assert.notEqual(p0.outer, p1.outer);
  // 円盤の性質は範囲内
  const k = SG.diskDNA(H840);
  assert.ok(k.incl >= 0.15 && k.incl <= 0.27 && k.rings.length === 64 && k.rings.every((v) => v >= 0 && v <= 3));
});

// ── コインの URL と、NFC タグ（NTAG213・144バイト）に入る大きさ
const PROD = 'https://ck121212195.github.io/blog/infinity/m/';
const P2WPKH = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const P2TR = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
await t('手順のページから見た御守りページの場所', async () => {
  assert.equal(omamoriBase('https://ck121212195.github.io/blog/infinity/setup/'), PROD);
  assert.equal(omamoriBase('https://ck121212195.github.io/blog/infinity/setup/index.html'), PROD);
});
await t('URL の形（名前は base64url、signet だけ印をつける）', async () => {
  assert.equal(omamoriUrl({ address: P2WPKH, name: 'はるへ' }, PROD), PROD + '#' + P2WPKH + '&n=44Gv44KL44G4');
  assert.equal(omamoriUrl({ address: P2WPKH, name: '  ' }, PROD), PROD + '#' + P2WPKH);
  assert.equal(omamoriUrl({ address: 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7', net: 'test' }, PROD).includes('net='), false);
  assert.ok(omamoriUrl({ address: P2WPKH, net: 'signet' }, PROD).endsWith('&net=signet'));
});
await t('NDEF の大きさ（略号を使わない場合の多めの見積もり）', async () => {
  assert.equal(ndefBytes('https://a.b/'), 12 + 8);
  assert.equal(TAG_BYTES, 144);
  assert.ok(ndefBytes(omamoriUrl({ address: P2TR, net: 'signet' }, PROD)) <= TAG_BYTES); // 名前なしなら、どの形でも入る
});
await t('名前に入る文字数（日本語）', async () => {
  assert.equal(nameRoom({ address: P2WPKH }, PROD), 11);
  assert.equal(nameRoom({ address: P2TR }, PROD), 6);
  assert.ok(ndefBytes(omamoriUrl({ address: P2WPKH, name: '字'.repeat(11) }, PROD)) <= 144);
  assert.ok(ndefBytes(omamoriUrl({ address: P2WPKH, name: '字'.repeat(12) }, PROD)) > 144);
  assert.equal(nameRoom({ address: P2WPKH, name: 'はるへ' }, PROD), 8);
});
await t('NFC から読んだ URL を戻す・くらべる', async () => {
  const enc = (s) => new TextEncoder().encode(s);
  const a = new Uint8Array([0x04, ...enc('ck121212195.github.io/blog/infinity/m/#x')]);
  assert.equal(decodeUrlBytes(a), 'https://ck121212195.github.io/blog/infinity/m/#x');
  assert.equal(decodeUrlBytes(new DataView(enc('https://a.b/c').buffer)), 'https://a.b/c');
  assert.ok(sameUrl('https://a.b/c#d', 'a.b/c#d'));
  assert.equal(sameUrl('', ''), false);
  assert.ok(errorText({ name: 'TimeoutError' }).includes('かざされません'));
  assert.ok(errorText({ name: 'Weird' }).includes('Weird'));
});

console.log(`\n${pass} 件すべて通りました`);
