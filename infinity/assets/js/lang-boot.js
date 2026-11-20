// 言語を、画面を描く前に決める（ちらつかないように <head> で同期的に読む）
// 優先：URL の ?lang= → 前回選んだ言語 → 端末の言語（日本語なら ja、それ以外は en）
(function () {
  var KEY = 'infinity:lang';
  var l = null;
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'ja' || q === 'en') { l = q; localStorage.setItem(KEY, q); }
  } catch (e) { /* 使えなくても続ける */ }
  if (!l) { try { l = localStorage.getItem(KEY); } catch (e) { l = null; } }
  if (l !== 'ja' && l !== 'en') {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ja'];
    l = /^ja\b/i.test(String(list[0] || '')) ? 'ja' : 'en';
  }
  document.documentElement.lang = l;
})();
