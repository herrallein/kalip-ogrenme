// Open Peeps yollarını küçültür: q birimli tamsayı + göreli komutlar.
const ARITY = { M: 2, L: 2, C: 6, Q: 4 };
export function shrinkPath(d, q) {
  const toks = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  let out = '', cx = 0, cy = 0, sx = 0, sy = 0, i = 0, first = true;
  const fmt = a => a.join(' ').replace(/ -/g, '-');
  while (i < toks.length) {
    const cmd = toks[i++];
    if (cmd === 'Z') { out += 'z'; cx = sx; cy = sy; continue; }
    const ar = ARITY[cmd];
    let c = cmd;
    while (i < toks.length && !/^[A-Za-z]$/.test(toks[i])) {
      const nums = toks.slice(i, i + ar).map(v => Math.round(+v / q)); i += ar;
      const rel = nums.map((v, j) => v - (j % 2 ? cy : cx));
      if (c === 'M') { if (first) { out += 'M' + fmt(nums); first = false; } else out += 'm' + fmt(rel); sx = nums[0]; sy = nums[1]; c = 'L'; }
      else out += c.toLowerCase() + fmt(rel);
      cx = nums[ar - 2]; cy = nums[ar - 1];
    }
    first = false;
  }
  return out;
}
export const compactPeep = (s, q) => s
  .replace(/ d="([^"]*)"/g, (m, d) => ' d="' + shrinkPath(d, q) + '"')
  .replace(/translate\(([-\d.e]+) ([-\d.e]+)\)/g, (m, a, b) => `translate(${Math.round(a / q)} ${Math.round(b / q)})`)
  .replace(/ stroke="none"/g, '');
