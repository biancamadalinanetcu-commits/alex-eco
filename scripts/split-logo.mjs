// Splits the traced logo (src/assets/img/logo-stacked.svg) into separately animatable pieces
// for the 3D intro: the two shapes of the mark (blade + arrow) and the seven letters of the
// wordmark. Each piece is its own <svg> sharing one viewBox, so the pieces line up exactly at rest
// and can fly apart independently in 3D (SVG children cannot take 3D transforms).
// Output: src/partials/intro-logo.html
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('src/assets/img/logo-stacked.svg', 'utf8');
const [markD, wordD] = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);

const subpaths = (d) => d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean).map((p) => {
  const n = p.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { d: p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
});

// Pieces overlapping horizontally belong to one glyph (the counter of "a", the dot of "i").
function group(parts) {
  const sorted = [...parts].sort((a, b) => a.x0 - b.x0);
  const groups = [];
  for (const p of sorted) {
    const g = groups.find((q) => Math.min(q.x1, p.x1) - Math.max(q.x0, p.x0) > 0.5 * Math.min(q.x1 - q.x0, p.x1 - p.x0));
    if (g) { g.d += ' ' + p.d; g.x0 = Math.min(g.x0, p.x0); g.x1 = Math.max(g.x1, p.x1); g.y0 = Math.min(g.y0, p.y0); g.y1 = Math.max(g.y1, p.y1); }
    else groups.push({ ...p });
  }
  return groups.sort((a, b) => a.x0 - b.x0);
}

const MARK_VB = [466, 410, 320, 235];
const WORD_VB = [280, 662, 694, 164];
const pct = (v, o, s) => (((v - o) / s) * 100).toFixed(2) + '%';
const piece = (cls, vb, fill, g, extra = '') =>
  `<span class="${cls}" style="--ox:${pct((g.x0 + g.x1) / 2, vb[0], vb[2])};--oy:${pct((g.y0 + g.y1) / 2, vb[1], vb[3])}${extra}">` +
  `<svg viewBox="${vb.join(' ')}" focusable="false"><path fill="${fill}" fill-rule="evenodd" d="${g.d}"/></svg></span>`;

const mark = subpaths(markD);
const arrow = mark.reduce((a, b) => (a.y0 < b.y0 ? a : b));
const blade = mark.find((p) => p !== arrow);
const letters = group(subpaths(wordD));
if (letters.length !== 7) throw new Error(`expected 7 letters, got ${letters.length}`);
const cx = (WORD_VB[0] * 2 + WORD_VB[2]) / 2, half = WORD_VB[2] / 2;

const html = `<div class="intro__mark" data-intro-mark>
${piece('intro__piece intro__blade', MARK_VB, '#0a6aff', blade)}
${piece('intro__piece intro__arrow', MARK_VB, '#0a6aff', arrow)}
<span class="intro__sheen"></span>
</div>
<div class="intro__word">
${letters.map((g, i) => piece('intro__letter', WORD_VB, '#fff', g, `;--i:${i};--dx:${(((g.x0 + g.x1) / 2 - cx) / half).toFixed(3)}`)).join('\n')}
</div>
`;
await writeFile('src/partials/intro-logo.html', html);
console.log('pieces: blade, arrow +', letters.length, 'letters');
