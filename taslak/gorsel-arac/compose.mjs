#!/usr/bin/env node
// Çevrimdışı SVG sahne birleştirici.
//   node compose.mjs scenes/*.json          -> ../../public/visuals/<id>.svg + meta.json (cue/alt) birleştirir
//   node compose.mjs scenes                 -> klasördeki tüm .json
// Sahne biçimi ve geçerli adlar: KATALOG.md
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as D from './lib/draw.mjs';
import { compactPeep } from './lib/shrink.mjs';

const require = createRequire(import.meta.url);
const P = require('./lib/peeps.cjs');
const BBOX = require('./lib/bbox.json');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.COMPOSE_OUT ? path.resolve(process.env.COMPOSE_OUT) : path.resolve(HERE, '../../public/visuals');
const EMOJI_DIR = path.join(HERE, 'twemoji');
const TWEMOJI_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/';
const { n, rect, circ, ell, path: pth, g, esc, INK } = D;

// ------------------------------------------------------------------ sabitler
// Başın (Short saç) kafatası merkezi x≈462; saç kutuları lib/bbox.json içinde "h:" ile saklanmadı, burada sabit:
const HEAD_CX = 462, HEAD_TOP = 65, HEAD_BOTTOM = 520, HEAD_HALF = 195;
const HAIR_TOP = { Bun: -34, BunCurly: -97, Buns: -28, FlatTopLong: -3, LongAfro: -120, LongCurly: -42, Mohawk: -13, MohawkDino: 0, Pomp: 0, ShavedSides: -15, ShavedWavy: -31, ShortWavy: 15, BunFancy: -66, BantuKnots: 3, GrayBun: 6, Turban: 1, Twists: 1, TwistsVolumed: 12, MediumShade: 14, DocBouffant: 6, DocSurgery: 15, Afro: 8, ShavedRight: 5, Bear: 24, HatHip: 17, CornRows: 28, CornRowsFilled: 23, Hijab: 37, BaldTop: 45, Bald: 65 };
const K = { standing: 0.046, sitting: 0.05, bust: 0.1 };           // ham birim -> px (scale=1)
const SKIN = { light: '#F2CBA6', medium: '#D9A066', brown: '#A8693F', dark: '#7A4A2E' };
const COLORS = { red: '#E03131', orange: '#F76707', yellow: '#FAB005', green: '#40C057', teal: '#20A39E', blue: '#4C6EF5', purple: '#7950F2', pink: '#E64980', white: '#F8F9FA', gray: '#868E96', navy: '#2F3E7A', black: '#2B2B3A', brown: '#8A5A3B' };
const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

const list = a => a.join(', ');
const resolveColor = (v, map, what, errs) => {
  if (v == null) return null;
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) return v;
  if (map[v]) return map[v];
  errs.push(`${what}: bilinmeyen renk "${v}". Geçerli adlar: ${list(Object.keys(map))} veya #rrggbb`);
  return null;
};

// ------------------------------------------------------------------ Twemoji
const cpHex = s => Array.from(s).map(c => c.codePointAt(0).toString(16));
function emojiFiles(s) {
  const cps = cpHex(s), a = cps.includes('200d') ? cps : cps.filter(c => c !== 'fe0f');
  const names = [a.join('-')]; if (cps.join('-') !== names[0]) names.push(cps.join('-'));
  return names;
}
const emojiCache = new Map();
async function loadEmoji(s) {
  if (emojiCache.has(s)) return emojiCache.get(s);
  fs.mkdirSync(EMOJI_DIR, { recursive: true });
  let txt = null, tried = [];
  for (const name of emojiFiles(s)) {
    const f = path.join(EMOJI_DIR, name + '.svg'); tried.push(name + '.svg');
    if (fs.existsSync(f)) { txt = fs.readFileSync(f, 'utf8'); break; }
    try {
      const r = await fetch(TWEMOJI_URL + name + '.svg');
      if (r.ok) { txt = await r.text(); fs.writeFileSync(f, txt); break; }
    } catch (e) { throw new Error(`Twemoji indirilemedi (${name}.svg): ${e.message}`); }
  }
  if (!txt) throw new Error(`emoji "${s}" Twemoji'de yok (denenen: ${tried.join(', ')}). Daha yaygın bir emoji seç (bkz. KATALOG.md emoji kuralları).`);
  const m = txt.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  const inner = m[1].replace(/<!--[\s\S]*?-->/g, '').trim();
  emojiCache.set(s, inner);
  return inner;
}
const round1 = s => s.replace(/ d="([^"]*)"/g, (m, d) => {
  if (/[aA]/.test(d)) return m;                     // yay bayrakları sıkıştırılmış olabilir; dokunma
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  return ' d="' + t.map(x => /[A-Za-z]/.test(x) ? x : String(+(+x).toFixed(1))).join(' ').replace(/([A-Za-z]) /g, '$1').replace(/ ([A-Za-z])/g, '$1').replace(/ -/g, '-').replace(/(^|[ \-A-Za-z])0\./g, '$1.') + '"';
});
function prefixIds(inner, pre) {
  const ids = [...inner.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  for (const id of ids) inner = inner.split(`id="${id}"`).join(`id="${pre}${id}"`).split(`url(#${id})`).join(`url(#${pre}${id})`).split(`href="#${id}"`).join(`href="#${pre}${id}"`);
  return inner;
}

// ------------------------------------------------------------------ peeps
function parsePose(v, errs, where) {
  let kind = null, name = v;
  if (v.includes(':')) [kind, name] = v.split(':');
  const real = P.kindOf(name);
  if (!real) { errs.push(`${where}: bilinmeyen pose "${v}". Geçerli: standing: ${list(P.POSES.standing)} | sitting: ${list(P.POSES.sitting)} | bust: ${list(P.POSES.bust)}`); return null; }
  if (kind && kind !== real) { errs.push(`${where}: "${name}" bir ${real} poz; ${kind}: değil. "${real}:${name}" veya yalnız "${name}" yaz.`); return null; }
  return { name, kind: real };
}
const checkName = (v, listArr, what, where, errs) => {
  if (v == null) return true;
  if (!listArr.includes(v)) { errs.push(`${where}: bilinmeyen ${what} "${v}". Geçerli: ${list(listArr)}`); return false; }
  return true;
};

// ------------------------------------------------------------------ yerleşim yardımcıları
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function renderPerson(p, i, count, groundDef, errs) {
  const where = `people[${i}]`;
  const pose = parsePose(p.pose || 'ShirtPantsBW', errs, where + '.pose'); if (!pose) return null;
  const faceN = p.face || 'Calm', hairN = p.hair || 'Short';
  const ok = [checkName(faceN, P.FACE, 'face', where, errs), checkName(hairN, P.HAIR, 'hair', where, errs), checkName(p.accessory, P.ACC, 'accessory', where, errs), checkName(p.facialHair, P.FH, 'facialHair', where, errs)];
  if (ok.includes(false)) return null;
  const skin = resolveColor(p.skin || 'medium', SKIN, where + '.skin', errs) || SKIN.medium;
  const shirt = p.shirt ? resolveColor(p.shirt, COLORS, where + '.shirt', errs) : null;
  const dark = p.dark ? resolveColor(p.dark, COLORS, where + '.dark', errs) : null;
  const s = p.scale ?? 1, fx = p.flip ? -1 : 1, k = K[pose.kind] * s;
  const x = p.x ?? Math.round(320 * (i + 1) / (count + 1));
  const feetY = p.y ?? (pose.kind === 'bust' ? 202 : groundDef);
  const bb = BBOX[pose.name], bottom = bb[3];
  const q = pose.kind === 'bust' ? 2 : 4;                         // ham birim kuantumu (≈0.2 px)
  const body = compactPeep(P.pose(pose.name, dark || INK, shirt || skin), q);
  const head = compactPeep(P.head({ hair: hairN, face: faceN, facialHair: p.facialHair, accessory: p.accessory, stroke: INK, skin }), q);
  let svg = '';
  if (pose.kind !== 'bust') svg += ell(x, feetY, clamp((bb[2] - bb[0]) * 0.3 * k, 14, 70), 4, '#000', 'opacity=".12"');
  svg += `<g transform="translate(${n(x)} ${n(feetY)}) scale(${+(fx * k * q).toFixed(4)} ${+(k * q).toFixed(4)}) translate(${Math.round(-HEAD_CX / q)} ${Math.round(-bottom / q)})">${body}${head}</g>`;
  const hTop = HAIR_TOP[hairN] ?? HEAD_TOP;
  const px = rx => x + (rx - HEAD_CX) * k * fx, py = ry => feetY + (ry - bottom) * k;
  const xs = [px(bb[0]), px(bb[2])].sort((a, b) => a - b);
  const personBox = [xs[0], py(Math.min(hTop, bb[1])), xs[1], feetY];
  const headBox = [x - HEAD_HALF * k, py(hTop), x + HEAD_HALF * k, py(HEAD_BOTTOM)];
  return { svg, x, feetY, k, fx, personBox, headBox, hx: x, headTop: py(hTop), headH: py(HEAD_BOTTOM) - py(hTop), headHalf: HEAD_HALF * k };
}

// ------------------------------------------------------------------ balon, ok, anahtar kelime
async function bubbleContent(b, errs, uses) {
  const items = [];
  if (Array.isArray(b.emoji)) for (const e of b.emoji) items.push({ emoji: e });
  else if (b.emoji) items.push({ emoji: b.emoji });
  if (b.word) items.push({ word: b.word });
  if (!items.length) errs.push('bubble: "emoji" (1–3) veya "word" gerekli');
  if (items.length > 3) errs.push('bubble: en fazla 3 öğe');
  return items;
}
function bubbleShape(type, cx, cy, w, h, tip) {
  const fill = '#fff', st = '#AEB7C8';
  let outline = '', body = '';
  if (type === 'thought') {
    const rx = w / 2 - 4, ry = h / 2 - 2, r = Math.min(rx, ry) * .5;
    const pts = Array.from({ length: 12 }, (_, a) => [cx + (rx - r * .55) * Math.cos(a * Math.PI / 6), cy + (ry - r * .55) * Math.sin(a * Math.PI / 6)]);
    outline = ell(cx, cy, rx * .9, ry * .9, fill, `stroke="${st}" stroke-width="3"`) + pts.map(([x, y]) => circ(x, y, r, fill, `stroke="${st}" stroke-width="3"`)).join('');
    body = ell(cx, cy, rx * .9, ry * .9, fill) + pts.map(([x, y]) => circ(x, y, r, fill)).join('');
    const sx = cx, sy = cy + h / 2 - 2;
    [[6, .22], [4.4, .52], [3, .8]].forEach(([rr, t]) => { const X = sx + (tip[0] - sx) * t, Y = sy + (tip[1] - sy) * t; outline += circ(X, Y, rr, fill, `stroke="${st}" stroke-width="3"`); body += circ(X, Y, rr, fill); });
  } else {
    const r = Math.min(16, h / 2), bx = clamp(tip[0], cx - w / 2 + r + 6, cx + w / 2 - r - 6), by = tip[1] > cy ? cy + h / 2 : cy - h / 2, sg = tip[1] > cy ? 1 : -1;
    const tail = `M${n(bx - 7)} ${n(by - sg)}L${n(tip[0])} ${n(tip[1])}L${n(bx + 7)} ${n(by - sg)}z`;
    outline = rect(cx - w / 2, cy - h / 2, w, h, fill, r, `stroke="${st}" stroke-width="3"`) + pth(tail, fill, st, 3);
    body = rect(cx - w / 2, cy - h / 2, w, h, fill, r) + pth(tail, fill);
  }
  return outline + body;
}

function arrowSvg(a, accent) {
  const [x1, y1] = a.from, [x2, y2] = a.to, col = a.color || accent;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const tl = a.marker === 'timeline';
  const bend = a.bend ?? (tl ? 0 : Math.min(34, len * .28));
  const mx = (x1 + x2) / 2 - dy / len * bend, my = (y1 + y2) / 2 + dx / len * bend;       // kontrol noktası
  const tx = x2 - mx, ty = y2 - my, tn = Math.hypot(tx, ty) || 1, ux = tx / tn, uy = ty / tn;
  const ex = x2 - ux * 5, ey = y2 - uy * 5;                                                   // gövde ucu (ok başının altı)
  const dash = a.style === 'solid' || tl ? '' : ' stroke-dasharray="0.1 7"';
  let o = `<path d="M${n(x1)} ${n(y1)}Q${n(mx)} ${n(my)} ${n(ex)} ${n(ey)}" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" opacity=".55"${dash}/>`;
  o += `<path d="M${n(x1)} ${n(y1)}Q${n(mx)} ${n(my)} ${n(ex)} ${n(ey)}" fill="none" stroke="${col}" stroke-width="${tl ? 3 : 4}" stroke-linecap="round"${dash}/>`;
  o += pth(`M${n(x2)} ${n(y2)}L${n(x2 - ux * 13 - uy * 8)} ${n(y2 - uy * 13 + ux * 8)}L${n(x2 - ux * 13 + uy * 8)} ${n(y2 - uy * 13 - ux * 8)}z`, col, col, 1.5);
  if (tl) {
    for (let t = 0; t <= 1.001; t += 1 / Math.max(2, Math.round(len / 30))) o += pth(`M${n(x1 + dx * t - dy / len * 5)} ${n(y1 + dy * t + dx / len * 5)}l${n(dy / len * 10)} ${n(-dx / len * 10)}`, 'none', col, 2);
    o += circ(x1, y1, 5.5, '#fff', `stroke="${col}" stroke-width="3"`);
  }
  if (a.marker === 'rewind') {
    const qx = (x1 + 2 * mx + x2) / 4 + (mx - (x1 + x2) / 2) * 0, qy = (y1 + 2 * my + y2) / 4;     // eğri ortası
    o += circ(qx, qy, 12, '#fff', `stroke="${col}" stroke-width="2.5"`) + pth(`M${n(qx + 1)} ${n(qy - 6)}L${n(qx - 5)} ${n(qy)}L${n(qx + 1)} ${n(qy + 6)}zM${n(qx + 7)} ${n(qy - 6)}L${n(qx + 1)} ${n(qy)}L${n(qx + 7)} ${n(qy + 6)}z`, col);
  }
  const bx0 = Math.min(x1, x2, mx), bx1 = Math.max(x1, x2, mx), by0 = Math.min(y1, y2, my), by1 = Math.max(y1, y2, my);
  return { svg: o, box: [bx0 - 4, by0 - 4, bx1 + 4, by1 + 4] };
}

function keywordSvg(text, accent, obstacles, pos, dark) {
  const len = Array.from(text).length;
  const size = clamp(Math.floor(270 / (len * 0.6)), 15, 30);
  const w = Math.min(300, len * size * 0.6 + 26), h = size + 14;
  const cands = {
    top: [160, 8 + h / 2], 'top-left': [8 + w / 2, 8 + h / 2], 'top-right': [312 - w / 2, 8 + h / 2],
    bottom: [160, 192 - h / 2], 'bottom-left': [8 + w / 2, 192 - h / 2], 'bottom-right': [312 - w / 2, 192 - h / 2],
    left: [8 + w / 2, 100], right: [312 - w / 2, 100], center: [160, 100],
  };
  let order = ['top', 'top-left', 'top-right', 'bottom-right', 'bottom-left', 'bottom', 'left', 'right', 'center'];
  let c;
  if (Array.isArray(pos)) c = pos;
  else if (pos && cands[pos]) c = cands[pos];
  else {
    let best = null;
    for (const name of order) {
      const [cx, cy] = cands[name], box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      let cost = 0; for (const o of obstacles) cost += overlap(box, o.box) * o.wt;
      if (best === null || cost < best.cost) best = { cost, c: [cx, cy], name };
      if (cost === 0) break;
    }
    c = best.c;
  }
  const bg = dark ? '#FFFFFF' : '#FFFFFF';
  const svg = rect(c[0] - w / 2, c[1] - h / 2, w, h, bg, h / 2.4, 'opacity=".9"') +
    `<text x="${n(c[0])}" y="${n(c[1] + size * 0.35)}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${size}" fill="${accent}">${esc(text)}</text>`;
  return { svg, box: [c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2] };
}

// ------------------------------------------------------------------ sahne
async function build(scene, file) {
  const errs = [], warns = [];
  const id = scene.id;
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) errs.push('id gerekli ve [a-z0-9-] olmalı');
  if (!scene.alt || typeof scene.alt !== 'string') errs.push('"alt" (kısa Türkçe betimleme) gerekli');
  const bgName = scene.bg || 'plain';
  if (!D.BG[bgName]) errs.push(`bilinmeyen bg "${bgName}". Geçerli: ${list(Object.keys(D.BG))}`);
  if (errs.length) return { errs };
  const pre = id + '-';
  const bgColor = bgName === 'plain' ? resolveColor(scene.bgColor || '#EAF0FF', COLORS, 'bgColor', errs) : null;
  const bg = D.BG[bgName](bgColor || undefined);
  const dark = !!bg.dark;
  const accent = resolveColor(scene.accent || (dark ? '#FFD76A' : '#C2410C'), COLORS, 'accent', errs) || '#C2410C';
  const kwColor = dark ? '#7A3B00' : accent;

  const defs = [];
  const emoUse = new Map();                   // emoji -> kullanım sayısı
  const countE = e => emoUse.set(e, (emoUse.get(e) || 0) + 1);
  for (const o of scene.objects || []) if (o.emoji) countE(o.emoji);
  const bub = scene.bubble;
  const bItems = bub ? await bubbleContent(bub, errs) : [];
  for (const it of bItems) if (it.emoji) countE(it.emoji);
  const emoIds = new Map(); let eN = 0;
  const emoSvg = async (e, cx, cy, size, rot = 0, extra = '') => {
    let inner;
    try { inner = await loadEmoji(e); } catch (err) { errs.push(err.message); return ''; }
    const uses = emoUse.get(e) || 1;
    const tf = `translate(${n(cx)} ${n(cy)})${rot ? ` rotate(${rot})` : ''}`;
    if (uses > 1) {
      if (!emoIds.has(e)) { const sid = `${pre}e${++eN}`; emoIds.set(e, sid); defs.push(`<symbol id="${sid}" viewBox="0 0 36 36">${round1(prefixIds(inner, sid + '-'))}</symbol>`); }
      return `<use href="#${emoIds.get(e)}" x="${n(-size / 2)}" y="${n(-size / 2)}" width="${n(size)}" height="${n(size)}" transform="${tf}"${extra}/>`;
    }
    return `<g transform="${tf} scale(${n(size / 36)}) translate(-18 -18)"${extra}>${round1(prefixIds(inner, `${pre}e${++eN}-`))}</g>`;
  };

  const obstacles = [];
  let layers = { back: '', props: '', people: '', front: '', arrow: '', bubble: '', kw: '' };

  // props
  for (const [i, pr] of (scene.props || []).entries()) {
    const f = D.PROPS[pr.type];
    if (!f) { errs.push(`props[${i}]: bilinmeyen tür "${pr.type}". Geçerli: ${list(D.PROP_NAMES)}`); continue; }
    layers.props += f(pr.x, pr.y ?? bg.ground, pr.scale ?? 1, ...(pr.color ? [resolveColor(pr.color, COLORS, `props[${i}].color`, errs)] : []));
  }
  // insanlar
  const people = scene.people || [];
  if (people.length > 3) errs.push('en fazla 3 kişi');
  const figs = [];
  for (const [i, p] of people.entries()) {
    const f = renderPerson(p, i, people.length, bg.ground, errs); if (!f) { figs.push(null); continue; }
    figs.push(f); layers.people += f.svg;
    obstacles.push({ box: f.headBox, wt: 12 }, { box: f.personBox, wt: 1.5 });
    if (f.personBox[0] < -20 || f.personBox[2] > 340) warns.push(`people[${i}] kadrajdan taşıyor (x ${Math.round(f.personBox[0])}..${Math.round(f.personBox[2])}); x/scale ayarla`);
    if (f.headTop < 2) warns.push(`people[${i}] başı üstten kesiliyor (scale küçült veya y artır)`);
  }
  // nesneler
  for (const [i, o] of (scene.objects || []).entries()) {
    if (!o.emoji) { errs.push(`objects[${i}]: "emoji" gerekli`); continue; }
    const size = o.size ?? 36;
    const svgE = await emoSvg(o.emoji, o.x, o.y, size, o.rot || 0);
    if (o.layer === 'back') layers.back += svgE; else layers.front += svgE;
    obstacles.push({ box: [o.x - size / 2, o.y - size / 2, o.x + size / 2, o.y + size / 2], wt: 4 });
    if (o.x - size / 2 < -2 || o.x + size / 2 > 322 || o.y - size / 2 < -2 || o.y + size / 2 > 202) warns.push(`objects[${i}] (${o.emoji}) kadrajdan taşıyor`);
  }
  // balon
  if (bub && bItems.length) {
    const type = bub.type === 'speech' ? 'speech' : 'thought';
    if (!['speech', 'thought'].includes(bub.type)) errs.push('bubble.type "thought" veya "speech" olmalı');
    const f = figs[bub.from ?? 0];
    const emojiN = bItems.filter(x => x.emoji).length, word = bItems.find(x => x.word);
    const w = Math.max(56, emojiN * 34 + (word ? Array.from(word.word).length * 9 + 12 : 0) + 22), h = word && !emojiN ? 40 : 52;
    if (bub.x == null && !f) errs.push(`bubble.from=${bub.from ?? 0}: böyle bir kişi yok (veya hatalı); x,y ver`);
    else {
      let cx, cy, tip;
      if (bub.x != null) { cx = bub.x; cy = bub.y ?? 40; tip = f ? [f.hx, f.headTop + f.headH * .15] : [cx, cy + h / 2 + 18]; }
      else {
        const side = bub.side || (f.headTop - 14 - h >= 6 ? 'above' : (f.hx < 160 ? 'right' : 'left'));
        if (side === 'above') {
          cx = clamp(f.hx + (f.hx < 160 ? 22 : -22), w / 2 + 6, 314 - w / 2); cy = f.headTop - 14 - h / 2;
          tip = [f.hx, f.headTop - 1];
        } else {
          const sg = side === 'right' ? 1 : -1;
          cx = clamp(f.hx + sg * (f.headHalf + w / 2 + 14), w / 2 + 6, 314 - w / 2); cy = clamp(f.headTop + f.headH * .1, h / 2 + 6, 120);
          tip = [f.hx + sg * f.headHalf * 1.05, f.headTop + f.headH * (type === 'speech' ? .6 : .3)];
        }
      }
      let s = bubbleShape(type, cx, cy, w, h, tip);
      // içerik
      const total = emojiN * 30 + (word ? Array.from(word.word).length * 9 : 0) + (emojiN && word ? 6 : 0);
      let px = cx - total / 2;
      for (const it of bItems) {
        if (it.emoji) { s += await emoSvg(it.emoji, px + 15, cy, 28); px += 30 + (word ? 3 : 0); }
        else { const tw = Array.from(it.word).length * 9; s += `<text x="${n(px + tw / 2)}" y="${n(cy + 5.5)}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="17" fill="${INK}">${esc(it.word)}</text>`; px += tw; }
      }
      layers.bubble += s;
      obstacles.push({ box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], wt: 6 });
      if (cx - w / 2 < 0 || cy - h / 2 < 0) warns.push('balon kadrajdan taşıyor');
    }
  }
  // ok
  if (scene.arrow) {
    const a = scene.arrow;
    if (!Array.isArray(a.from) || !Array.isArray(a.to)) errs.push('arrow.from ve arrow.to [x,y] olmalı');
    else { const r = arrowSvg(a, dark ? '#FFD76A' : '#E8590C'); layers.arrow = r.svg; obstacles.push({ box: r.box, wt: 1 }); if (a.marker && !['timeline', 'rewind'].includes(a.marker)) errs.push('arrow.marker "timeline", "rewind" veya null olmalı'); }
  }
  // anahtar kelime
  if (scene.keyword) {
    const k = keywordSvg(String(scene.keyword), kwColor, obstacles, scene.keywordPos, dark);
    layers.kw = k.svg;
    for (const o of obstacles) { if (o.wt >= 12 && overlap(k.box, o.box) > 40) { warns.push('anahtar kelime bir yüzle çakışıyor: keywordPos ver ("top","bottom-left"... veya [x,y])'); break; } }
  }
  if (errs.length) return { errs };

  const body = layers.props + layers.back + layers.people + layers.front + layers.arrow + layers.bubble + layers.kw;
  const attrib = (emoUse.size ? 'Twemoji (c) Twitter/jdecked, CC-BY 4.0. ' : '') + (people.length ? 'Open Peeps (c) Pablo Stanley, CC0.' : '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="${esc(scene.alt)}">` +
    (attrib ? `<!-- ${attrib.trim()} -->` : '') +
    `<defs><clipPath id="${pre}c"><rect width="320" height="200" rx="20"/></clipPath>${defs.join('')}</defs>` +
    `<g clip-path="url(#${pre}c)">${bg.svg}${body}</g></svg>`;
  return { svg, warns };
}

// ------------------------------------------------------------------ ana akış
function expandArgs(args) {
  const out = [];
  for (const a of args) {
    if (a.includes('*')) {
      const dir = path.dirname(a), re = new RegExp('^' + path.basename(a).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      if (fs.existsSync(dir)) out.push(...fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f)));
    } else if (fs.existsSync(a) && fs.statSync(a).isDirectory()) out.push(...fs.readdirSync(a).filter(f => f.endsWith('.json')).sort().map(f => path.join(a, f)));
    else out.push(a);
  }
  return out;
}

async function main() {
  const files = expandArgs(process.argv.slice(2));
  if (!files.length) { console.error('Kullanım: node compose.mjs scenes/*.json'); process.exit(2); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const metaFile = path.join(OUT_DIR, 'meta.json');
  const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  let failed = 0;
  for (const f of files) {
    let scene;
    try { scene = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`HATA ${f}: JSON okunamadı: ${e.message}`); failed++; continue; }
    const r = await build(scene, f);
    if (r.errs) { console.error(`HATA ${path.basename(f)}:\n  - ${r.errs.join('\n  - ')}`); failed++; continue; }
    fs.writeFileSync(path.join(OUT_DIR, scene.id + '.svg'), r.svg, 'utf8');
    meta[scene.id] = { cue: scene.cue || '', alt: scene.alt };
    const kb = Buffer.byteLength(r.svg) / 1024;
    console.log(`${scene.id}.svg  ${kb.toFixed(1)} KB${kb > 30 ? '  (!) 30 KB üstü' : ''}`);
    for (const w of r.warns) console.log(`  uyarı: ${w}`);
    if (!scene.cue) console.log('  uyarı: "cue" yok');
  }
  const sorted = Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(metaFile, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  if (failed) { console.error(`${failed} sahne başarısız`); process.exit(1); }
}
main();
