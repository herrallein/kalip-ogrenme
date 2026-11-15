// Çizim yardımcıları (taslak/visuals/gen.py'den taşındı) + arka planlar + sahne nesneleri. Tuval: 320x200.
export const INK = '#2B2B3A';
export const n = v => (+v.toFixed(1)).toString();
export function shade(c, f = 0.82) {
  c = c.replace('#', ''); if (c.length === 3) c = [...c].map(x => x + x).join('');
  return '#' + [0, 2, 4].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const p = c => { c = c.replace('#', ''); if (c.length === 3) c = [...c].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const rect = (x, y, w, h, fill, rx = 0, ex = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${n(rx)}"` : ''} fill="${fill}"${ex ? ' ' + ex : ''}/>`;
export const circ = (x, y, r, fill, ex = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${ex ? ' ' + ex : ''}/>`;
export const ell = (x, y, rx, ry, fill, ex = '') => `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${ex ? ' ' + ex : ''}/>`;
export const path = (d, fill = 'none', stroke = null, sw = 3, ex = '') =>
  `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"` : ''}${ex ? ' ' + ex : ''}/>`;
export const g = (tf, inner) => `<g transform="${tf}">${inner}</g>`;
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export const cloud = (x, y, s = 1, fill = '#fff') =>
  g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, circ(0, 0, 10, fill) + circ(12, -4, 13, fill) + circ(26, 1, 9, fill) + rect(-10, 0, 45, 10, fill, 5));
export function windowP(x, y, w, h, sky = '#BFE3FF', frame = '#fff', curtain = null) {
  let o = rect(x - 4, y - 4, w + 8, h + 8, frame, 4) + rect(x, y, w, h, sky) + cloud(x + w * .3, y + h * .35, .45);
  o += path(`M${n(x + w / 2)} ${n(y)}v${n(h)}M${n(x)} ${n(y + h / 2)}h${n(w)}`, 'none', frame, 3);
  if (curtain) o += path(`M${n(x - 4)} ${n(y - 4)}h12q6 ${n(h / 2)} 0 ${n(h + 8)}h-12z`, curtain) + path(`M${n(x + w + 4)} ${n(y - 4)}h-12q-6 ${n(h / 2)} 0 ${n(h + 8)}h12z`, curtain);
  return o;
}
export function plant(x, y, s = 1, pot = '#D9692B', leaf = '#4FA861') {
  let o = '';
  for (const [a, h] of [[-30, 30], [-10, 38], [12, 34], [32, 28]]) o += `<ellipse cx="0" cy="-${h / 2 + 14}" rx="6" ry="${h / 2 + 2}" fill="${a % 20 ? leaf : shade(leaf)}" transform="rotate(${a} 0 -14)"/>`;
  o += path('M-12 -16h24l-4 16h-16z', pot) + rect(-13, -19, 26, 5, shade(pot), 2);
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, o);
}
export const floorP = (y, c, base = null) => rect(0, y, 320, 200 - y, c) + (base ? rect(0, y - 4, 320, 5, base) : '');
export const sun = (x, y, r = 14, c = '#FFD43B') => circ(x, y, r, c) + path(`M${x} ${y - r - 6}v-5M${x} ${y + r + 6}v5M${x - r - 6} ${y}h-5M${x + r + 6} ${y}h5M${n(x - r * .85 - 5)} ${n(y - r * .85 - 5)}l-3 -3M${n(x + r * .85 + 5)} ${n(y - r * .85 - 5)}l3 -3M${n(x - r * .85 - 5)} ${n(y + r * .85 + 5)}l-3 3M${n(x + r * .85 + 5)} ${n(y + r * .85 + 5)}l3 3`, 'none', c, 3);
export function tree(x, y, s = 1, crown = '#4FA861', trunk = '#8A5A3B') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-4, -34, 8, 34, trunk, 2) + circ(0, -48, 20, crown) + circ(-14, -38, 14, shade(crown, .92)) + circ(14, -38, 14, shade(crown, .92)) + circ(-5, -56, 10, shade(crown, 1.08)));
}
export function table(x, y, s = 1, top = '#B98A5E') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-34, -36, 5, 36, shade(top, .8), 1) + rect(29, -36, 5, 36, shade(top, .8), 1) + rect(-40, -42, 80, 8, top, 3) + rect(-40, -36, 80, 3, shade(top, .85)));
}
export function chair(x, y, s = 1, c = '#4C6EF5') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-10, -19, 4, 19, shade(c, .8), 1) + rect(11, -19, 4, 19, shade(c, .8), 1) + rect(-12, -46, 4, 28, c, 2) + rect(-12, -24, 28, 6, c, 2));
}
export function door(x, y, s = 1, c = '#8A5A3B') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-18, -78, 36, 78, shade(c, .7), 3) + rect(-15, -75, 30, 75, c, 2) + rect(-9, -68, 18, 22, shade(c, 1.12), 2) + rect(-9, -40, 18, 28, shade(c, 1.12), 2) + circ(10, -34, 2.2, '#FFD43B'));
}
export function bed(x, y, s = 1, c = '#74C0FC') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-48, -34, 7, 34, '#8A5A3B', 2) + rect(-45, -20, 92, 12, '#8A5A3B', 3) + rect(-42, -30, 86, 14, '#fff', 5) + rect(-42, -22, 86, 14, c, 5) + rect(-40, -36, 24, 10, '#fff', 5, 'stroke="#DEE2E6" stroke-width="1.5"') + rect(43, -26, 6, 26, '#8A5A3B', 2));
}
export function sofa(x, y, s = 1, c = '#6C8EBF') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-46, -44, 92, 30, shade(c, .9), 10) + rect(-52, -30, 18, 30, shade(c, .8), 8) + rect(34, -30, 18, 30, shade(c, .8), 8) + rect(-38, -26, 76, 20, c, 7) + rect(-34, -2, 5, 6, '#6B4A32') + rect(29, -2, 5, 6, '#6B4A32'));
}
export function bench(x, y, s = 1, c = '#B98A5E') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-30, -34, 4, 18, '#5B4636') + rect(-34, -34, 68, 5, c, 2) + rect(-34, -28, 68, 5, shade(c, .92), 2) + rect(-34, -20, 68, 6, c, 2) + rect(-30, -16, 5, 16, '#5B4636') + rect(25, -16, 5, 16, '#5B4636'));
}
export function lamp(x, y, s = 1, c = '#F4B740') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-1.5, -62, 3, 62, '#6B6B7B') + ell(0, -1, 10, 3, '#6B6B7B') + path('M-14 -60L-9 -78H9L14 -60z', c) + ell(0, -42, 22, 10, '#FFE08A', 'opacity=".25"'));
}
export function clock(x, y, s = 1) {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, circ(0, 0, 17, '#fff', 'stroke="#8A5A3B" stroke-width="4"') + path('M0 -10V0l7 4', 'none', INK, 2.5) + circ(0, 0, 1.8, INK) + path('M0 -14v2M0 14v-2M-14 0h2M14 0h-2', 'none', '#868E96', 1.6));
}
export function moon(x, y, r = 14, c = '#FFF3BF') {
  return `<path d="M${n(x + r * .35)} ${n(y - r)}A${n(r)} ${n(r)} 0 1 0 ${n(x + r * .35)} ${n(y + r)}A${n(r * .78)} ${n(r * .78)} 0 1 1 ${n(x + r * .35)} ${n(y - r)}z" fill="${c}"/>`;
}
export function box(x, y, s = 1, c = '#C8944F') {
  return g(`translate(${n(x)} ${n(y)}) scale(${n(s)})`, rect(-18, -28, 36, 28, c, 2) + rect(-18, -28, 36, 7, shade(c, 1.12), 2) + rect(-4, -28, 8, 12, '#EAD7B0'));
}
// x,y: zemin tipleri (table, chair, door, bed, sofa, tree, bench, lamp, box, plant) alt-orta noktadır; sun/moon/cloud/clock/window merkezdir.
export const PROPS = {
  table, chair, door, bed, sofa, tree, bench, lamp, clock, box, plant,
  sun: (x, y, s = 1) => sun(x, y, 14 * s), moon: (x, y, s = 1) => moon(x, y, 14 * s), cloud,
  window: (x, y, s = 1) => windowP(x - 24 * s, y - 28 * s, 48 * s, 56 * s, '#BFE3FF', '#fff', '#E9806E'),
};
export const PROP_NAMES = Object.keys(PROPS);

// ------------------------------------------------------------------ arka planlar
// Her biri { svg, ground (varsayılan ayak y), dark? } döndürür.
const wallTiles = (x0, y0, x1, y1, step, c) => { let d = ''; for (let x = x0; x <= x1; x += step) d += `M${x} ${y0}V${y1}`; for (let y = y0; y <= y1; y += step) d += `M${x0} ${y}H${x1}`; return path(d, 'none', c, 1); };
function checker(y0, y1, c1, c2, s = 20) { let o = rect(0, y0, 320, y1 - y0, c1); for (let y = y0, r = 0; y < y1; y += s / 2, r++) for (let x = (r % 2) * s; x < 320; x += s * 2) o += rect(x, y, s, Math.min(s / 2, y1 - y), c2); return o; }
function planks(y0, c, line) { let o = rect(0, y0, 320, 200 - y0, c); for (let y = y0 + 12; y < 200; y += 14) o += path(`M0 ${y}H320`, 'none', line, 1.2); return o; }

export const BG = {
  home: () => ({ ground: 180, svg:
    rect(0, 0, 320, 200, '#F8EBDA') + rect(0, 0, 320, 8, '#F1DEC6') + windowP(26, 26, 62, 66, '#BFE3FF', '#fff', '#E9806E') + plant(112, 154, 1.1) +
    rect(214, 28, 36, 28, '#fff', 2, 'stroke="#C9A37A" stroke-width="3"') + circ(226, 40, 6, '#F4B740') + path('M216 54l10 -8 8 6 10 -10 4 6v6h-32z', '#74B88C') +
    rect(260, 36, 22, 30, '#fff', 2, 'stroke="#C9A37A" stroke-width="3"') + circ(271, 51, 7, '#E9806E') +
    planks(152, '#D9AA78', '#C99863') + rect(0, 148, 320, 5, '#fff') + ell(150, 188, 82, 9, '#E9806E', 'opacity=".35"') + sofa(262, 158, 1.05) + lamp(196, 154, 1) }),
  kitchen: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#E6F4F0') + wallTiles(0, 0, 320, 120, 16, '#D3E8E2') +
    rect(0, 10, 100, 40, '#F2B96B', 3) + path('M33 10v40M66 10v40', 'none', '#D99B4A', 2) + circ(30, 38, 2, '#8A5A3B') + circ(36, 38, 2, '#8A5A3B') + circ(63, 38, 2, '#8A5A3B') +
    windowP(130, 24, 70, 52, '#BFE3FF', '#fff', null) + path('M222 18v26M240 18v22M258 18v26M214 18H266', 'none', '#6B6B7B', 2.5) + path('M222 44q-6 14 6 14t6 -14', '#868E96') + path('M242 40l-4 18h12z', '#E8590C') +
    rect(0, 112, 320, 14, '#C9CED6') + rect(0, 124, 320, 48, '#F2B96B') + path('M0 124H320M64 126v46M128 126v46M192 126v46M256 126v46', 'none', '#D99B4A', 2) + circ(58, 140, 2, '#8A5A3B') + circ(70, 140, 2, '#8A5A3B') +
    rect(236, 96, 52, 16, '#E8E8EE', 3) + rect(244, 84, 36, 14, '#E03131', 4) + circ(256, 90, 3, '#fff') +
    ell(110, 108, 22, 5, '#F8F8F8') + path('M90 108a20 14 0 0 1 40 0z', '#E9ECEF') + checker(172, 200, '#EDE6D6', '#D6CCB6', 20) }),
  cafe: () => ({ ground: 184, svg:
    rect(0, 0, 320, 200, '#F2DCB9') + rect(0, 96, 320, 60, '#9A6A44') + rect(0, 92, 320, 6, '#7D5535') +
    rect(20, 16, 84, 54, '#2F4B3F', 4, 'stroke="#8A5A3B" stroke-width="5"') + path('M32 32h40M32 44h28M32 56h46', 'none', '#EDEDED', 2.5) + path('M84 30l8 8M92 30l-8 8', 'none', '#F4B740', 2) +
    [140, 200, 260].map(x => path(`M${x} 0V24`, 'none', '#6B6B7B', 2) + path(`M${x - 13} 40L${x - 7} 24H${x + 7}L${x + 13} 40z`, '#F4B740') + ell(x, 41, 13, 3, '#FFE08A')).join('') +
    rect(130, 112, 190, 10, '#C48A5A', 3) + rect(130, 120, 190, 44, '#8A5A3B') + path('M190 124v40M250 124v40', 'none', shade('#8A5A3B'), 2) +
    rect(270, 78, 40, 34, '#868E96', 5) + rect(276, 84, 26, 8, '#E9ECEF', 3) + circ(289, 100, 4, '#E03131') + rect(278, 106, 22, 4, '#495057', 1) +
    rect(140, 86, 46, 26, '#E9F7FB', 4, 'opacity=".9" stroke="#C48A5A" stroke-width="3"') + ell(152, 104, 8, 4, '#E8A04F') + ell(168, 104, 8, 4, '#C97B3F') +
    checker(164, 200, '#EBD9BB', '#D3B991', 20) + rect(0, 160, 320, 5, '#7D5535') }),
  shop: () => ({ ground: 184, svg: (() => {
    const r = rng(7), cols = ['#F76707', '#4C6EF5', '#40C057', '#FAB005', '#E64980', '#15AABF', '#7950F2'];
    let o = rect(0, 0, 320, 200, '#EAF1F8');
    for (const y of [56, 96]) { o += rect(0, y, 320, 5, '#B98A5E'); for (let x = 6; x < 312;) { const w = 14 + r() * 14, h = 16 + r() * 16; o += rect(x, y - h, w, h, cols[Math.floor(r() * cols.length)], 2) + rect(x + 2, y - h + 4, w - 4, 4, '#fff', 1, 'opacity=".5"'); x += w + 3 + r() * 6; } }
    o += rect(0, 0, 320, 6, '#fff'); for (let x = 0; x < 320; x += 40) o += path(`M${x} 0h20v20a10 10 0 0 1-20 0z`, '#E03131');
    o += rect(0, 130, 320, 44, '#5C7AEA') + rect(0, 124, 320, 10, '#DCE3F5', 3) + path('M60 134v40M130 134v40M200 134v40M270 134v40', 'none', '#4A64C8', 2);
    o += rect(236, 100, 44, 24, '#495057', 4) + rect(242, 104, 24, 10, '#A5D8FF', 2) + rect(268, 114, 8, 8, '#E9ECEF', 1);
    return o + rect(0, 174, 320, 26, '#CFC8BF') + rect(0, 172, 320, 4, '#B8B0A6');
  })() }),
  street: () => ({ ground: 168, svg: (() => {
    const r = rng(11), cs = ['#F4A261', '#E5989B', '#90BE6D', '#8EA4D2', '#F6BD60'];
    let o = rect(0, 0, 320, 200, '#C2E4FB') + cloud(40, 28, .8) + cloud(250, 22, .6) + sun(290, 36, 11);
    for (let x = -6, i = 0; x < 320; i++) { const w = 46 + r() * 22, h = 60 + r() * 40, c = cs[i % cs.length]; o += rect(x, 138 - h, w, h, c); for (let wy = 138 - h + 10; wy < 120; wy += 18) for (let wx = x + 8; wx < x + w - 10; wx += 16) o += rect(wx, wy, 9, 11, '#fff', 1.5, 'opacity=".85"'); x += w + 2; }
    o += rect(0, 136, 320, 4, '#8A8A96') + rect(0, 140, 320, 36, '#DAD6CF') + path('M0 158H320', 'none', '#C7C2B8', 1.5) + rect(0, 176, 320, 24, '#6B7280');
    for (let x = 10; x < 320; x += 44) o += rect(x, 187, 24, 4, '#F1F3F5', 2);
    return o + lamp(34, 146, 1.1, '#868E96') + tree(300, 150, .8) + rect(0, 175, 320, 3, '#B5B0A6');
  })() }),
  park: () => ({ ground: 176, svg:
    rect(0, 0, 320, 200, '#C6E8FB') + sun(284, 32, 13) + cloud(60, 30, .9) + cloud(180, 52, .6) +
    path('M-10 120Q70 70 150 112T330 100V200H-10z', '#A7D88F') + rect(0, 120, 320, 80, '#8CCB6B') + path('M-10 200Q120 150 330 168V200z', '#E8D8B0') +
    tree(36, 128, 1.2) + tree(278, 124, 1.05, '#58B368') + tree(214, 118, .75, '#3F9A5C') + bench(142, 124, .85) +
    [[20, 166], [50, 180], [100, 190], [240, 188], [292, 176], [310, 150]].map(([x, y], i) => circ(x, y, 3, ['#FF6B6B', '#FFD43B', '#FFFFFF'][i % 3]) + circ(x, y, 1.1, '#E67700')).join('') }),
  office: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#E9EDF5') + rect(0, 0, 320, 6, '#DCE2EE') + rect(140, 20, 120, 64, '#CFE7FB', 3, 'stroke="#fff" stroke-width="4"') +
    rect(150, 58, 12, 26, '#B4CBE6') + rect(168, 44, 14, 40, '#A5BEDC') + rect(190, 62, 10, 22, '#B4CBE6') + rect(208, 50, 16, 34, '#A5BEDC') + rect(230, 66, 12, 18, '#B4CBE6') + path('M200 20v64', 'none', '#fff', 3) +
    rect(14, 18, 92, 6, '#B98A5E') + [['#4C6EF5', 20], ['#E8590C', 30], ['#40C057', 40], ['#FAB005', 50], ['#7950F2', 62], ['#E64980', 74]].map(([c, x]) => rect(x, 4, 8, 14, c, 1)).join('') + rect(14, 56, 92, 6, '#B98A5E') + [['#15AABF', 20], ['#F76707', 33], ['#4C6EF5', 47], ['#40C057', 58]].map(([c, x]) => rect(x, 40, 10, 16, c, 1)).join('') +
    clock(286, 36, .9) +
    rect(0, 156, 320, 44, '#B7C0CF') + rect(0, 154, 320, 4, '#9EA9BB') +
    rect(196, 112, 100, 8, '#C99A66', 3) + rect(204, 118, 6, 40, '#A47845') + rect(282, 118, 6, 40, '#A47845') + rect(236, 92, 36, 22, '#343A40', 3) + rect(240, 96, 28, 14, '#74C0FC', 2) + rect(250, 114, 8, 3, '#343A40') + rect(214, 106, 30, 6, '#CED4DA', 2) + plant(24, 166, 1) }),
  classroom: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#F6EDCB') + rect(34, 14, 180, 78, '#2F6B58', 4, 'stroke="#B98A5E" stroke-width="6"') + rect(34, 92, 180, 6, '#B98A5E') + path('M52 36q16 -10 28 0t28 0M52 56h60M52 74h44M140 34l24 24M164 34l-24 24', 'none', '#F1F3F5', 2.2) + rect(130, 90, 18, 4, '#fff', 1) +
    clock(256, 32, 1) + path('M236 62h40v12h-40z', '#E03131') + path('M244 70h24', 'none', '#fff', 2) + circ(290, 70, 11, '#4C6EF5') + path('M290 62v16M282 70h16', 'none', '#fff', 1.5) +
    rect(0, 164, 320, 36, '#D9B98A') + rect(0, 160, 320, 5, '#B98A5E') + path('M0 180H320M0 194H320', 'none', '#C7A472', 1.2) +
    [[236, 128], [288, 138]].map(([x, y]) => rect(x - 26, y, 52, 7, '#C99A66', 2) + rect(x - 22, y + 6, 4, 32, '#7B7F8C') + rect(x + 18, y + 6, 4, 32, '#7B7F8C') + rect(x - 8, y - 12, 16, 12, '#F8F9FA', 1, 'stroke="#ADB5BD" stroke-width="1"')).join('') }),
  station: () => ({ ground: 180, svg:
    rect(0, 0, 320, 200, '#DCE6F0') + rect(0, 0, 320, 18, '#7A869A') + rect(80, 24, 160, 26, '#2B3340', 4) + [0, 1, 2].map(i => rect(90, 30 + i * 7, 30, 3, ['#FFD43B', '#69DB7C', '#74C0FC'][i], 1) + rect(128, 30 + i * 7, 90, 3, '#868E96', 1)).join('') +
    rect(0, 62, 320, 60, '#C9362B') + rect(0, 112, 320, 8, '#8E2420') + [14, 64, 114, 164, 214, 264].map(x => rect(x, 72, 36, 28, '#BFE3FF', 4) + path(`M${x + 18} 72v28`, 'none', '#C9362B', 2)).join('') + rect(0, 120, 320, 12, '#4B5563') + [30, 90, 150, 210, 270].map(x => circ(x, 124, 6, '#2B3340')).join('') +
    rect(0, 132, 320, 68, '#B3BAC6') + rect(0, 130, 320, 5, '#9AA2B1') + rect(0, 160, 320, 5, '#F5C518') + lamp(300, 134, 1.2, '#868E96') + lamp(20, 134, 1.2, '#868E96') }),
  doctor: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#E4F4F0') + rect(0, 0, 320, 8, '#CDE7E1') + rect(20, 20, 44, 44, '#fff', 6, 'stroke="#BFE0D8" stroke-width="3"') + rect(38, 28, 8, 28, '#2FA37A', 2) + rect(28, 38, 28, 8, '#2FA37A', 2) +
    rect(86, 18, 40, 52, '#fff', 3, 'stroke="#BFE0D8" stroke-width="3"') + [0, 1, 2, 3].map(i => rect(94, 26 + i * 10, 24 - i * 5, 4, '#343A40', 1)).join('') +
    rect(214, 22, 80, 60, '#fff', 4, 'stroke="#BFE0D8" stroke-width="3"') + path('M214 52H294', 'none', '#BFE0D8', 2) + [226, 244, 262, 280].map((x, i) => rect(x - 4, 36, 8, 16, ['#74C0FC', '#FF8787', '#69DB7C', '#FFD43B'][i], 2) + rect(x - 3, 28, 6, 8, '#fff', 1)).join('') + circ(234, 70, 4, '#74C0FC') + circ(260, 70, 4, '#FF8787') +
    rect(0, 162, 320, 38, '#D3E4E8') + rect(0, 158, 320, 5, '#B9CFD4') +
    rect(200, 112, 108, 22, '#fff', 6) + rect(200, 128, 108, 8, '#74C0FC', 3) + rect(208, 134, 6, 30, '#9AA6B5') + rect(294, 134, 6, 30, '#9AA6B5') + rect(206, 104, 32, 10, '#BFE3F2', 4) }),
  sky: () => ({ ground: 178, svg:
    rect(0, 0, 320, 200, '#8FCBF7') + rect(0, 80, 320, 120, '#B6DEFA') + rect(0, 140, 320, 60, '#D6EDFC') + sun(270, 38, 17) + cloud(40, 40, 1.2) + cloud(150, 28, .8) + cloud(200, 96, 1) + cloud(24, 110, .9) +
    path('M96 60l5 -5 5 5M120 76l4 -4 4 4M250 100l4 -4 4 4', 'none', '#fff', 2) + cloud(40, 176, 1.8) + cloud(110, 184, 1.8) + cloud(190, 178, 1.9) + cloud(270, 184, 1.7) + rect(0, 190, 320, 10, '#fff') }),
  stage: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#7C1F40') + Array.from({ length: 14 }, (_, i) => rect(i * 24.5, 0, 12, 150, '#6A1936')).join('') + path('M0 0H320V16Q280 26 240 16T160 16T80 16T0 16z', '#A22B55') +
    path('M60 0L100 150H20z', '#FFF3BF', null, 0, 'opacity=".16"') + path('M260 0L300 150H220z', '#FFF3BF', null, 0, 'opacity=".16"') + path('M160 0L214 150H106z', '#FFF3BF', null, 0, 'opacity=".12"') +
    [60, 160, 260].map(x => rect(x - 9, 0, 18, 9, '#343A40', 2) + circ(x, 11, 5, '#FFF3BF')).join('') +
    rect(0, 150, 320, 50, '#A9714A') + rect(0, 148, 320, 5, '#C58F5D') + path('M0 166H320M0 182H320', 'none', '#8E5B3A', 1.4) }),
  meeting: () => ({ ground: 182, svg:
    rect(0, 0, 320, 200, '#EDF0F6') + rect(20, 16, 150, 84, '#fff', 4, 'stroke="#B7C0CF" stroke-width="5"') + rect(36, 62, 14, 22, '#4C6EF5') + rect(60, 44, 14, 40, '#F76707') + rect(84, 54, 14, 30, '#40C057') + path('M112 40Q130 24 150 46M112 60h38M112 72h26', 'none', '#E03131', 2.4) +
    windowP(200, 22, 90, 62, '#CFE7FB', '#fff', null) +
    rect(0, 158, 320, 42, '#BAC3D0') + rect(0, 156, 320, 4, '#A1ACBD') +
    rect(40, 120, 240, 10, '#C99A66', 4) + rect(52, 128, 7, 28, '#A47845') + rect(261, 128, 7, 28, '#A47845') + [90, 150, 210].map(x => rect(x - 12, 112, 24, 8, '#E9ECEF', 2) + circ(x - 4, 116, 3, '#A5D8FF')).join('') }),
  night: () => ({ ground: 178, dark: true, svg: (() => {
    const r = rng(3); let o = rect(0, 0, 320, 200, '#1C2447') + rect(0, 90, 320, 110, '#252E58', 0, 'opacity=".55"') + moon(270, 36, 15);
    for (let i = 0; i < 34; i++) o += circ(+(r() * 320).toFixed(0), +(r() * 110).toFixed(0), r() > .8 ? 1.6 : 1, '#FFF8D6', `opacity="${(.5 + r() * .5).toFixed(2)}"`);
    o += path('M30 150V100L70 70L110 100V150z', '#2F3A6B') + rect(42, 108, 14, 16, '#FFD76A', 2) + rect(74, 108, 14, 16, '#FFD76A', 2) + rect(58, 126, 14, 24, '#FFD76A', 2) + rect(220, 80, 60, 70, '#2C386B') + [0, 1, 2].map(i => rect(230 + (i % 2) * 24, 90 + Math.floor(i / 2) * 26, 12, 14, i === 1 ? '#FFD76A' : '#404D86', 2)).join('') +
      rect(0, 150, 320, 50, '#2E3F42') + rect(0, 148, 320, 4, '#3E5459') + lamp(160, 152, 1.2, '#FFD76A') + ell(160, 150, 44, 18, '#FFD76A', 'opacity=".12"');
    return o; })() }),
  plain: (c = '#EAF0FF') => ({ ground: 180, svg: rect(0, 0, 320, 200, c) + ell(160, 182, 130, 14, shade(c, .93)) }),
};
export const BG_DOC = {
  home: 'oturma odası: pencere+perde, kanepe, lamba, tablolar, ahşap zemin',
  kitchen: 'mutfak: fayans duvar, dolaplar, tezgâh, ocak, pencere',
  cafe: 'kafe: tebeşir menü, sarkıt lambalar, tezgâh + espresso makinesi, dama zemin',
  shop: 'dükkân: raflarda renkli kutular, kırmızı tente, kasa tezgâhı',
  street: 'sokak: renkli binalar, kaldırım, yol, lamba, ağaç, güneş',
  park: 'park: gökyüzü, tepeler, ağaçlar, bank, çiçekler, patika',
  office: 'ofis: pencere siluet, raflar, masa + monitör, saat, bitki',
  classroom: 'sınıf: yeşil tahta, saat, kırmızı/mavi afişler, sıralar',
  station: 'istasyon: kırmızı tren, varış tabelası, sarı çizgi, peron',
  doctor: 'doktor odası: yeşil haç, göz tablosu, ilaç dolabı, muayene yatağı',
  sky: 'açık gökyüzü: güneş, bulutlar, alt bulut zemini (soyut/serbest)',
  stage: 'sahne: bordo perde, spot ışıklar, ahşap sahne',
  meeting: 'toplantı odası: beyaz tahta grafik, pencere, uzun masa',
  night: 'gece: koyu lacivert, ay, yıldızlar, evler, sokak lambası',
  plain: 'düz renk ("bgColor" ile), yumuşak yer gölgesi',
};
