// Web NFC（Android の Chrome で使える）
// 書き込み・読み取り・ロックは、どれも「押してから、かざす」。

export const nfcSupported = () => typeof window !== 'undefined' && 'NDEFReader' in window;
export const lockSupported = () => nfcSupported() && typeof window.NDEFReader.prototype.makeReadOnly === 'function';

// かざすのを待つ時間。外から止めることもできる。
function waiter(ms, outer) {
  const ac = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ac.abort(); }, ms);
  const onOuter = () => ac.abort();
  if (outer) outer.addEventListener('abort', onOuter, { once: true });
  return {
    signal: ac.signal,
    timedOut: () => timedOut,
    stop() { clearTimeout(t); if (outer) outer.removeEventListener('abort', onOuter); ac.abort(); },
  };
}

function tagged(e, w) {
  if (w.timedOut()) { const t = new Error('timeout'); t.name = 'TimeoutError'; return t; }
  return e;
}

export async function writeUrl(url, { timeoutMs = 45000, signal } = {}) {
  const ndef = new window.NDEFReader();
  const w = waiter(timeoutMs, signal);
  try {
    await ndef.write({ records: [{ recordType: 'url', data: url }] }, { overwrite: true, signal: w.signal });
  } catch (e) {
    throw tagged(e, w);
  } finally {
    w.stop();
  }
}

// 1回だけ読み、最初のレコードの URL を返す
export function readUrlOnce({ timeoutMs = 45000, signal } = {}) {
  const ndef = new window.NDEFReader();
  const w = waiter(timeoutMs, signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, v) => { if (settled) return; settled = true; w.stop(); fn(v); };
    ndef.onreading = (ev) => {
      const recs = (ev.message && ev.message.records) || [];
      const urls = recs.filter((r) => r.recordType === 'url' || r.recordType === 'absolute-url').map(decodeUrlRecord);
      finish(resolve, { urls, count: recs.length });
    };
    ndef.onreadingerror = () => {
      const e = new Error('unreadable'); e.name = 'UnreadableError';
      finish(reject, e);
    };
    w.signal.addEventListener('abort', () => {
      const e = new Error('aborted'); e.name = 'AbortError';
      finish(reject, tagged(e, w));
    }, { once: true });
    ndef.scan({ signal: w.signal }).catch((e) => finish(reject, tagged(e, w)));
  });
}

export async function lockTag({ timeoutMs = 45000, signal } = {}) {
  const ndef = new window.NDEFReader();
  if (typeof ndef.makeReadOnly !== 'function') { const e = new Error('nolock'); e.name = 'NotSupportedError'; throw e; }
  const w = waiter(timeoutMs, signal);
  try {
    await ndef.makeReadOnly({ signal: w.signal });
  } catch (e) {
    throw tagged(e, w);
  } finally {
    w.stop();
  }
}

// URI レコードの中身を文字列に。先頭が略号（0x00〜0x23）なら展開する。
const PREFIX = ['', 'http://www.', 'https://www.', 'http://', 'https://', 'tel:', 'mailto:'];
export function decodeUrlBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
  if (u8.length && u8[0] <= 0x23) {
    const rest = new TextDecoder().decode(u8.subarray(1));
    return (PREFIX[u8[0]] || '') + rest;
  }
  return new TextDecoder().decode(u8);
}
function decodeUrlRecord(r) {
  try { return r.data ? decodeUrlBytes(r.data) : ''; } catch { return ''; }
}

// 書いた URL と読んだ URL が同じか（「https://」の有無の違いは同じとみなす）
export function sameUrl(a, b) {
  const n = (s) => String(s || '').trim().replace(/^https?:\/\//, '');
  return n(a) !== '' && n(a) === n(b);
}

// 失敗の理由を、ことばに
export function errorText(e, action = 'write') {
  const name = (e && e.name) || '';
  const verb = action === 'lock' ? 'ロック' : action === 'read' ? '読み取り' : '書き込み';
  switch (name) {
    case 'TimeoutError': return `時間内にかざされませんでした。もう一度押して、御守りをスマホの背面に当ててください。`;
    case 'AbortError': return `${verb}を止めました。`;
    case 'NotAllowedError': return `NFCの使用が許可されていません。表示された確認で「許可」を選ぶか、ブラウザのサイト設定でNFCを許可してください。`;
    case 'NotSupportedError': return action === 'lock'
      ? 'このブラウザでは、タグのロックに対応していません。Chromeを新しくするか、NFC Tools などのアプリでロックしてください。'
      : 'この端末・ブラウザでは、NFCを使えません。';
    case 'NotReadableError': return '端末のNFCがオフになっているか、NFCを使えない状態です。設定でNFCをオンにして、もう一度。';
    case 'NetworkError': return `タグとのやりとりが途中で切れました。御守りを動かさずに、もう一度${verb}してください。`;
    case 'UnreadableError': return 'タグを読めませんでした。書き込みがうまくいっていないかもしれません。';
    case 'InvalidStateError': return `ほかのNFCの操作が終わっていません。少し待って、もう一度。`;
    default: return `${verb}できませんでした（${name || '不明なエラー'}）。もう一度お試しください。`;
  }
}
