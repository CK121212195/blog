// HODLケースの蓋（4つの絵柄）と、分解図
// 絵柄は、いただいた見本の画像（3MF から描き直したもの）をもとに、サイト用に描き直した図です。
// 座標：蓋を上から見て、左右 895 × 上下 350（右端の段は、ケース本体の端）
export const OUTLINE = 'M125 0H818V28H823A72 72 0 0 1 895 100V250A72 72 0 0 1 823 322H818V350H125A125 125 0 0 1 0 225V125A125 125 0 0 1 125 0Z';

export const LIVERIES = {
  a: { code: 'A', name: 'ORBIT', ja: 'ミニマル', lid: '#0d0d0f', body: '#121214', side: '#050506', accent: '#FF7A1A' },
  b: { code: 'B', name: 'HODL', ja: 'かわいい', lid: '#6CC7EE', body: '#5FB8DF', side: '#3C8DB3', accent: '#FF6A13' },
  c: { code: 'C', name: 'TICK TOCK', ja: 'タイポグラフィ', lid: '#FF6A13', body: '#F2600C', side: '#B84505', accent: '#0B0B0B' },
  d: { code: 'D', name: 'RAIMON', ja: '和柄・雷紋', lid: '#0A4FC2', body: '#0947AE', side: '#06317A', accent: '#FF7A1A' },
};
export const ORDER = ['a', 'b', 'c', 'd'];

const FONT = "font-family=\"'Zen Kaku Gothic New','Noto Sans JP',system-ui,sans-serif\" font-weight=\"900\"";
// ビットコインのロゴの ₿（パブリックドメイン。64×64 の中で 14° 傾いている）
const BTC_B = 'm46.103 27.444c.637-4.258-2.605-6.547-7.038-8.074l1.438-5.768-3.511-.875-1.4 5.616c-.923-.23-1.871-.447-2.813-.662l1.41-5.653-3.509-.875-1.439 5.766c-.764-.174-1.514-.346-2.242-.527l.004-.018-4.842-1.209-.934 3.75s2.605.597 2.55.634c1.422.355 1.679 1.296 1.636 2.042l-1.638 6.571c.098.025.225.061.365.117-.117-.029-.242-.061-.371-.092l-2.296 9.205c-.174.432-.615 1.08-1.609.834.035.051-2.552-.637-2.552-.637l-1.743 4.019 4.569 1.139c.85.213 1.683.436 2.503.646l-1.453 5.834 3.507.875 1.439-5.772c.958.26 1.888.5 2.798.726l-1.434 5.745 3.511.875 1.453-5.823c5.987 1.133 10.489.676 12.384-4.739 1.527-4.36-.076-6.875-3.226-8.515 2.294-.529 4.022-2.038 4.483-5.155zm-8.022 11.249c-1.085 4.36-8.426 2.003-10.806 1.412l1.928-7.729c2.38.594 10.012 1.77 8.878 6.317zm1.086-11.312c-.99 3.966-7.1 1.951-9.082 1.457l1.748-7.01c1.982.494 8.365 1.416 7.334 5.553z';
const btc = (cx, cy, size, fill) => `<path d="${BTC_B}" fill="${fill}" transform="translate(${cx - (size * 32) / 64} ${cy - (size * 32.5) / 64}) scale(${size / 64})"/>`;
const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + Math.cos((a * Math.PI) / 180) * r, cy + Math.sin((a * Math.PI) / 180) * r].map((n) => n.toFixed(1)).join(' ');
  return `M${p(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
};
const star4 = (x, y, r, fill) => `<path d="M${x} ${y - r}Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z" fill="${fill}"/>`;
const heart = (x, y, s, fill) => `<path d="M${x} ${y + s * 0.9}C${x - s * 1.4} ${y - s * 0.1} ${x - s * 0.7} ${y - s * 1.2} ${x} ${y - s * 0.45}C${x + s * 0.7} ${y - s * 1.2} ${x + s * 1.4} ${y - s * 0.1} ${x} ${y + s * 0.9}Z" fill="${fill}"/>`;
// 雷紋（四角い渦）ひとつ
function raimon(x, y, s, stroke, w) {
  const k = (n) => (n * s).toFixed(1);
  return `<path transform="translate(${x} ${y})" d="M${k(0)} ${k(1)}V${k(0)}H${k(1)}V${k(1)}H${k(0.22)}V${k(0.22)}H${k(0.78)}V${k(0.78)}H${k(0.44)}V${k(0.44)}H${k(0.6)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="square"/>`;
}

// 蓋の絵（OUTLINE の中に収まる）
export function lidArt(k) {
  const L = LIVERIES[k] || LIVERIES.a;
  const O = L.accent;
  if (k === 'b') {
    return `<g>
      ${heart(168, 104, 22, '#0B0B0B')}${heart(752, 252, 20, '#0B0B0B')}
      ${star4(282, 112, 38, O)}${star4(236, 238, 30, O)}${star4(326, 272, 20, O)}${star4(724, 300, 22, O)}
      <circle cx="198" cy="186" r="9" fill="${O}"/><circle cx="292" cy="196" r="10" fill="${O}"/><circle cx="356" cy="62" r="8" fill="${O}"/>
      <ellipse cx="438" cy="306" rx="30" ry="15" fill="#0B0B0B"/><ellipse cx="520" cy="306" rx="30" ry="15" fill="#0B0B0B"/>
      <ellipse cx="368" cy="214" rx="36" ry="22" transform="rotate(-24 368 214)" fill="${O}" stroke="#0B0B0B" stroke-width="9"/>
      <ellipse cx="590" cy="214" rx="36" ry="22" transform="rotate(24 590 214)" fill="${O}" stroke="#0B0B0B" stroke-width="9"/>
      <circle cx="479" cy="184" r="112" fill="${O}" stroke="#0B0B0B" stroke-width="10"/>
      ${btc(479, 112, 64, '#0B0B0B')}
      <ellipse cx="442" cy="182" rx="12" ry="17" fill="#0B0B0B"/><ellipse cx="516" cy="182" rx="12" ry="17" fill="#0B0B0B"/>
      <circle cx="446" cy="175" r="4" fill="#fff"/><circle cx="520" cy="175" r="4" fill="#fff"/>
      <ellipse cx="418" cy="214" rx="20" ry="11" fill="#7FD3F5"/><ellipse cx="540" cy="214" rx="20" ry="11" fill="#7FD3F5"/>
      <path d="M462 214q8 12 17 0q9 12 17 0" fill="none" stroke="#0B0B0B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M612 128q-30 10-40 34q24-8 46-6Z" fill="${O}" stroke="#0B0B0B" stroke-width="9" stroke-linejoin="round"/>
      <rect x="612" y="62" width="214" height="118" rx="54" fill="${O}" stroke="#0B0B0B" stroke-width="10"/>
      <text x="719" y="146" text-anchor="middle" ${FONT} font-size="66" letter-spacing="2" fill="#0B0B0B">HODL</text>
    </g>`;
  }
  if (k === 'c') {
    return `<g fill="#0B0B0B">
      <text x="815" y="98" text-anchor="end" ${FONT} font-size="58" letter-spacing="7">TICK TOCK</text>
      <text x="96" y="246" ${FONT} font-size="168" letter-spacing="-2" textLength="722" lengthAdjust="spacingAndGlyphs">BITCOIN</text>
      <rect x="128" y="104" width="13" height="30"/><rect x="160" y="104" width="13" height="30"/>
      <rect x="128" y="246" width="13" height="17"/><rect x="160" y="246" width="13" height="17"/>
      <rect x="98" y="270" width="720" height="9"/>
      <text x="98" y="336" ${FONT} font-size="52" letter-spacing="4">NEXT BLOCK</text>
      <text x="818" y="336" text-anchor="end" ${FONT} font-size="52" letter-spacing="3">EST.2009</text>
    </g>`;
  }
  if (k === 'd') {
    const col = (x) => `<rect x="${x}" y="34" width="106" height="282" fill="none" stroke="${O}" stroke-width="8"/>${[48, 136, 224].map((y) => raimon(x + 15, y, 76, O, 9)).join('')}`;
    const vt = (chars, x, y0, step, size) => chars.map((c, i) => `<text x="${x}" y="${y0 + i * step}" text-anchor="middle" ${FONT} font-size="${size}" fill="${O}">${c}</text>`).join('');
    return `<g>
      ${col(36)}${col(752)}
      ${vt(['二', '千', '百', '万'], 232, 98, 68, 64)}
      ${vt(['ビ', 'ッ', 'ト', 'コ', 'イ', 'ン'], 666, 76, 50, 46)}
      <circle cx="448" cy="176" r="134" fill="none" stroke="${O}" stroke-width="14"/>
      <circle cx="448" cy="176" r="112" fill="none" stroke="${O}" stroke-width="5"/>
      <text x="448" y="236" text-anchor="middle" font-family="'Noto Serif JP',Georgia,'Times New Roman',serif" font-weight="900" font-size="176" fill="${O}">B</text>
      <rect x="418" y="98" width="12" height="26" fill="${O}"/><rect x="452" y="98" width="12" height="26" fill="${O}"/>
      <rect x="418" y="232" width="12" height="26" fill="${O}"/><rect x="452" y="232" width="12" height="26" fill="${O}"/>
    </g>`;
  }
  // a ORBIT
  return `<g>
    <path d="${arc(462, 176, 150, 34, 326)}" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/>
    <circle cx="612" cy="176" r="14" fill="${O}"/>
    <circle cx="462" cy="176" r="117" fill="${O}"/>
    ${btc(462, 176, 196, '#0B0B0B')}
    <text transform="translate(222 176) rotate(-90)" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="60" letter-spacing="7" fill="${O}">BITCOIN</text>
    <text transform="translate(740 176) rotate(90)" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="60" letter-spacing="5" fill="${O}">EST.2009</text>
  </g>`;
}

// 上から見た蓋（選ぶボタンや小さな見本に）
export function lidSVG(k, o = {}) {
  const L = LIVERIES[k] || LIVERIES.a;
  const id = o.id || 'ld' + k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 923 378" class="lid lid-${k}" aria-hidden="true">
    <defs><clipPath id="${id}-c"><path d="${OUTLINE}"/></clipPath>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>
    <path d="${OUTLINE}" fill="${L.body}" stroke="rgba(214,222,230,.55)" stroke-width="10" transform="translate(0 6)"/>
    <path d="${OUTLINE}" fill="${L.lid}"/>
    <g clip-path="url(#${id}-c)">${lidArt(k)}</g>
    <path d="${OUTLINE}" fill="url(#${id}-g)"/>
    <path d="${OUTLINE}" fill="none" stroke="rgba(230,236,242,.5)" stroke-width="6"/>
  </svg>`;
}

// 分解図：蓋（絵柄・NFCタグ）、鍵の札、ケース本体、側面のセキュリティシール
// 板を斜めに倒して（回転＋縦につぶす）重ね、厚みは同じ形を少しずつずらして描く
export function caseScene(k, o = {}) {
  const L = LIVERIES[k] || LIVERIES.a;
  const id = o.id || 'cs';
  const M = 'matrix(0.47 0.06 -0.12 0.235 0 0)'; // 895×350 → 斜めに倒した板
  const plate = (fill, dy) => `<path d="${OUTLINE}" fill="${fill}" transform="translate(0 ${dy})"/>`;
  const thick = (fill, n, step) => Array.from({ length: n }, (_, i) => plate(fill, (n - i) * step)).join('');
  const words = Array.from({ length: 12 }, (_, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    return `<rect x="${250 + col * 230}" y="${92 + row * 30}" width="${120 + ((i * 37) % 60)}" height="7" rx="3" fill="#6b7680" opacity=".55"/>`;
  }).join('');
  const mk = (n, x, y) => (o.marks === false ? '' : `<g class="cs-mk" font-family="'JetBrains Mono',ui-monospace,monospace" font-size="17" font-weight="600" text-anchor="middle"><circle cx="${x}" cy="${y}" r="15" fill="#05080b" stroke="#FFB04A" stroke-width="1.6"/><text x="${x}" y="${y + 6}" fill="#FFB04A">${n}</text></g>`);
  const ridges = Array.from({ length: 7 }, (_, i) => `<rect x="${560 + i * 26}" y="352" width="9" height="${o.flat ? 0 : 92}" fill="#000" opacity=".18"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 600" class="case-svg" role="img" aria-hidden="true">
  <defs>
    <clipPath id="${id}-c"><path d="${OUTLINE}"/></clipPath>
    <linearGradient id="${id}-holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9C4"/><stop offset=".3" stop-color="#9FD8FF"/><stop offset=".55" stop-color="#C9B8FF"/><stop offset=".8" stop-color="#FFB04A"/><stop offset="1" stop-color="#E6F7FF"/></linearGradient>
    <radialGradient id="${id}-tag"><stop offset="0" stop-color="#FFE3B8"/><stop offset=".55" stop-color="#FFB04A" stop-opacity=".55"/><stop offset="1" stop-color="#FFB04A" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
  </defs>
  <g class="cs-axis" stroke="rgba(150,180,200,.22)" stroke-dasharray="2 6" fill="none"><path d="M222 96V560M438 96V560"/></g>
  <g class="cs-ly cs-body" transform="translate(66 382)">
    <g transform="${M}">
      ${thick(L.side, 14, 7)}
      <path d="${OUTLINE}" fill="${L.body}"/>
      <path d="${OUTLINE}" fill="#000" opacity=".42" transform="translate(447.5 175) scale(.9 .78) translate(-447.5 -175)"/>
      <g opacity=".9">${ridges}</g>
      <path d="${OUTLINE}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="5"/>
    </g>
    <g class="cs-seal" transform="translate(372 46) skewY(8)"><rect width="26" height="54" fill="url(#${id}-holo)" opacity=".92"/><rect width="26" height="54" fill="none" stroke="rgba(255,255,255,.7)"/><path d="M3 10h20M3 18h14" stroke="rgba(3,5,7,.45)" stroke-width="2"/></g>
    ${mk(4, -30, 40)}${mk(5, 428, 64)}
  </g>
  <g class="cs-ly cs-slip" transform="translate(66 300)">
    <g transform="${M}">
      <rect x="200" y="62" width="500" height="226" rx="6" fill="#EEF1F3" transform="translate(0 10)" opacity=".35"/>
      <rect x="200" y="62" width="500" height="226" rx="6" fill="#F4F6F7"/>
      ${words}
      <rect x="200" y="62" width="500" height="226" rx="6" fill="none" stroke="#FFB04A" stroke-width="5" stroke-dasharray="18 14" opacity=".6"/>
    </g>
    ${mk(3, 56, 20)}
  </g>
  <g class="cs-ly cs-tag" transform="translate(66 218)">
    <g transform="${M}">
      <circle cx="448" cy="175" r="210" fill="url(#${id}-tag)" opacity=".5" class="cs-glow"/>
      <circle cx="448" cy="175" r="118" fill="#1A1206" stroke="#FFB04A" stroke-width="6"/>
      <circle cx="448" cy="175" r="98" fill="none" stroke="#FFB04A" stroke-width="4" opacity=".8"/>
      <circle cx="448" cy="175" r="80" fill="none" stroke="#FFB04A" stroke-width="4" opacity=".65"/>
      <circle cx="448" cy="175" r="62" fill="none" stroke="#FFB04A" stroke-width="4" opacity=".5"/>
      <rect x="430" y="157" width="36" height="36" fill="#FFB04A"/>
      <circle cx="448" cy="175" r="150" fill="none" stroke="#FFB04A" stroke-width="3" class="cs-wave"/>
      <circle cx="448" cy="175" r="150" fill="none" stroke="#FFB04A" stroke-width="3" class="cs-wave w2"/>
    </g>
    ${mk(2, 104, 44)}
  </g>
  <g class="cs-ly cs-lid" transform="translate(66 120)">
    <g transform="${M}">
      ${thick(L.side, 5, 7)}
      <path d="${OUTLINE}" fill="${L.lid}"/>
      <g clip-path="url(#${id}-c)" class="cs-art">${lidArt(k)}</g>
      <path d="${OUTLINE}" fill="url(#${id}-sheen)"/>
      <path d="${OUTLINE}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="5"/>
    </g>
    ${mk(1, -30, 30)}
  </g>
</svg>`;
}
