// Künstliche Schwünge (Körperpunkte) zum Prüfen der Auswertungslogik ohne Video.
// node schwung/test/synth.mjs
import { analyse } from '../analyse.js';

const KT = [0, 0.8, 1.7, 2.0, 2.1, 2.8, 3.2]; // Ansprechen bis Ende, Top bei 1.7, Treffmoment bei 2.0
const ease = x => x * x * (3 - 2 * x);
function key(vals, t) {
  for (let i = 0; i < KT.length - 1; i++) if (t <= KT[i + 1]) {
    const k = (t - KT[i]) / (KT[i + 1] - KT[i]);
    return vals[i] + (vals[i + 1] - vals[i]) * ease(Math.max(0, Math.min(1, k)));
  }
  return vals[vals.length - 1];
}
const rad = d => d * Math.PI / 180;
function blank() { return Array.from({ length: 33 }, () => [0, 0, 0.9]); }
function elbow(sh, wr, angle, side) { // Ellbogen so legen, dass der Winkel stimmt
  const dx = wr[0] - sh[0], dy = wr[1] - sh[1], d = Math.hypot(dx, dy) || 1;
  const up = d / 2 / Math.tan(rad(angle / 2));
  const mx = (sh[0] + wr[0]) / 2, my = (sh[1] + wr[1]) / 2;
  return [mx - dy / d * up * side, my + dx / d * up * side, 0.9];
}

export function faceOn(f = {}, hand = 'R', fps = 30) {
  const S = 160, L = 200, cx = 500, hy = 500, ay = 900;
  const dir = hand === 'R' ? 1 : -1; // Ziel in Bildrichtung
  const phi = [0, 0, 150, 0, -60, -160, -160];
  const hip = [0, 0, f.sway ? -0.3 : -0.04, f.slide ? 0.4 : 0.12, 0.2, f.hang ? -0.05 : 0.45, f.hang ? -0.05 : 0.45];
  const tilt = [-8, -8, f.rsa ? 12 : -6, -12, -10, 0, 0];
  const nose = [0, 0, f.head ? -0.55 : -0.1, -0.05, 0, 0.2, 0.2];
  const drop = [0, 0, 0, f.dip ? 0.22 : 0.02, 0, -0.05, -0.05];
  const turn = [0, 0, f.turn ? 45 : 90, 20, 50, 100, 100];
  const lel = [170, 170, f.leadArm ? 115 : 165, 172, f.chicken ? 105 : 170, 90, 90];
  const frames = [];
  for (let t = 0; t <= 3.2 + 1e-9; t += 1 / fps) {
    const p = blank();
    const hx = cx + dir * key(hip, t) * S;
    const tl = rad(key(tilt, t)), tr = rad(key(turn, t));
    const lh = [hx + dir * 0.3 * S, hy], rh = [hx - dir * 0.3 * S, hy];
    const shc = [hx + dir * Math.sin(tl) * L, hy - Math.cos(tl) * L];
    const w = Math.cos(tr) * S / 2;
    const ls = [shc[0] + dir * w, shc[1]], rs = [shc[0] - dir * w, shc[1]];
    const ph = rad(key(phi, t)), R = 1.05 * L;
    const H = [shc[0] - dir * Math.sin(ph) * R, shc[1] + Math.cos(ph) * R];
    const lw = [H[0] + dir * 6, H[1]], rw = [H[0] - dir * 6, H[1]];
    p[0] = [cx + dir * key(nose, t) * S + (shc[0] - cx) * 0.3, shc[1] - 0.6 * L + key(drop, t) * L, 0.95];
    p[11] = [...(hand === 'R' ? ls : rs), 0.9]; p[12] = [...(hand === 'R' ? rs : ls), 0.9];
    p[23] = [...(hand === 'R' ? lh : rh), 0.9]; p[24] = [...(hand === 'R' ? rh : lh), 0.9];
    p[15] = [...(hand === 'R' ? lw : rw), 0.9]; p[16] = [...(hand === 'R' ? rw : lw), 0.9];
    const la = [cx + dir * 0.55 * S, ay], ra = [cx - dir * 0.55 * S, ay];
    p[27] = [...(hand === 'R' ? la : ra), 0.9]; p[28] = [...(hand === 'R' ? ra : la), 0.9];
    p[25] = [(p[23][0] + p[27][0]) / 2, 700, 0.9]; p[26] = [(p[24][0] + p[28][0]) / 2, 700, 0.9];
    const leadI = hand === 'R' ? [11, 13, 15] : [12, 14, 16], trI = hand === 'R' ? [12, 14, 16] : [11, 13, 15];
    p[leadI[1]] = elbow(p[leadI[0]], p[leadI[2]], key(lel, t), 1);
    p[trI[1]] = elbow(p[trI[0]], p[trI[2]], 150, -1);
    const W = blank().map(() => [0, 0, 0]);
    W[11] = [Math.cos(tr) * 0.2 * dir, -0.5, Math.sin(tr) * 0.2]; W[12] = [-W[11][0], -0.5, -W[11][2]];
    const th = tr * 0.5; W[23] = [Math.cos(th) * 0.12 * dir, 0, Math.sin(th) * 0.12]; W[24] = [-W[23][0], 0, -W[23][2]];
    if (hand === 'L') { [W[11], W[12]] = [W[12], W[11]]; [W[23], W[24]] = [W[24], W[23]]; }
    for (const [j, a] of [[29, 27], [31, 27], [30, 28], [32, 28]]) p[j] = p[a].slice();
    frames.push({ t, p, w: W });
  }
  return frames;
}

export function dtl(f = {}, fps = 30) {
  const L = 200, hx0 = 400, hy = 500;
  const bend = [38, 38, f.lopTop ? 24 : 36, f.lop ? 24 : 37, 30, 5, 5];
  const hipS = [0, 0, -0.03, f.ee ? 0.22 : -0.03, 0, 0.1, 0.1];
  // Handweg relativ zur Schultermitte (× L): Ansprechen, Rückschwung, Top; Abschwung = umgekehrt + Versatz
  const back = [[0.12, 1.1], [-0.2, 0.75], [-0.25, 0.1], [-0.1, -0.55]];
  const interp = (pts, k) => { const s = k * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(s)), r = s - i; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; };
  const frames = [];
  for (let t = 0; t <= 3.2 + 1e-9; t += 1 / fps) {
    const p = blank();
    const hx = hx0 + key(hipS, t) * L, b = rad(key(bend, t));
    const hc = [hx, hy], sc = [hx + Math.sin(b) * L, hy - Math.cos(b) * L];
    let H;
    if (t <= 0.8) H = back[0];
    else if (t <= 1.7) H = interp(back, ease((t - 0.8) / 0.9));
    else if (t <= 2.0) { const k = ease((t - 1.7) / 0.3); H = interp(back, 1 - k); H = [H[0] + (f.ott ? 0.22 : -0.06) * Math.sin(Math.PI * k), H[1]]; }
    else { const k = Math.min(1, (t - 2.0) / 0.8); H = interp([back[0], [0.35, 0.6], [0.1, -0.2], [-0.05, -0.65]], ease(k)); }
    const Hp = [sc[0] + H[0] * L, sc[1] + H[1] * L];
    p[0] = [sc[0] + 0.45 * L * Math.sin(b + 0.3), sc[1] - 0.45 * L * Math.cos(b + 0.3), 0.95];
    p[11] = [sc[0] + 4, sc[1], 0.9]; p[12] = [sc[0] - 4, sc[1] + 2, 0.9];
    p[23] = [hc[0] + 3, hy, 0.9]; p[24] = [hc[0] - 3, hy, 0.9];
    p[15] = [Hp[0] + 2, Hp[1], 0.9]; p[16] = [Hp[0] - 2, Hp[1] + 3, 0.9];
    p[13] = [(p[11][0] + Hp[0]) / 2 + 5, (p[11][1] + Hp[1]) / 2, 0.9]; p[14] = [(p[12][0] + Hp[0]) / 2 - 5, (p[12][1] + Hp[1]) / 2, 0.9];
    p[25] = [470, 700, 0.9]; p[26] = [468, 702, 0.9]; p[27] = [430, 900, 0.9]; p[28] = [428, 902, 0.9];
    for (const [j, a] of [[29, 27], [31, 27], [30, 28], [32, 28]]) p[j] = p[a].slice();
    frames.push({ t, p, w: null });
  }
  return frames;
}

// ---- Tests ----
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) runTests();
function runTests() {
let fail = 0;
function expect(name, res, fault, want) {
  const c = res.checks.find(c => c.id === fault || c.id.startsWith(fault));
  const s = c ? c.sev : 'fehlt';
  const ok = want === 'ok' ? s === 0 : (s === 1 || s === 2);
  if (!ok) fail++;
  console.log((ok ? '✓' : '✗') + ' ' + name + ': ' + fault + ' → ' + s + (c ? ' (' + c.val + ')' : ''));
}
function phases(name, r, view) {
  const t = r.t, i = r.idx;
  const ok = r.ok && r.view === view && Math.abs(t[i.top] - 1.7) < 0.07 && Math.abs(t[i.imp] - 2.0) < 0.07 && Math.abs(t[i.addr] - 0.8) < 0.15;
  if (!ok) fail++;
  console.log((ok ? '✓' : '✗') + ' ' + name + ' Phasen: Ansicht ' + r.view + ', Ansprechen ' + t[i.addr]?.toFixed(2) + ', Start ' + t[i.take]?.toFixed(2) + ', Top ' + t[i.top]?.toFixed(2) + ', Treff ' + t[i.imp]?.toFixed(2) + ', Finish ' + t[i.fin]?.toFixed(2));
}

const FO = ['sway', 'head', 'rsa', 'slide', 'hang', 'chicken', 'leadArm', 'dip', 'turn'];
for (const hand of ['R', 'L']) for (const fps of [30, 60]) {
  const clean = analyse(faceOn({}, hand, fps), { hand: 'R', view: 'auto', club: 'eisen' });
  if (!clean.ok) { console.log('✗ Fehler', clean.error); fail++; continue; }
  phases(`frontal ${hand} ${fps}fps sauber`, clean, 'fo');
  if (hand === 'L') console.log('  Hinweise:', clean.notes.join(' '));
  for (const k of FO) expect(`frontal ${hand} ${fps}fps sauber`, clean, k, 'ok');
  expect(`frontal ${hand} ${fps}fps sauber`, clean, 'tempo', 'ok');
  for (const k of FO) { const r = analyse(faceOn({ [k]: 1 }, hand, fps), { hand, club: 'eisen' }); if (!r.ok) { fail++; console.log('✗', k, r.error); continue; } expect(`frontal ${hand} ${fps}fps mit ${k}`, r, k, 'bad'); }
}
const DT = ['ee', 'lop', 'lopTop', 'ott'];
for (const fps of [30, 60, 120]) {
  const clean = analyse(dtl({}, fps), { hand: 'R' });
  if (!clean.ok) { console.log('✗ Fehler', clean.error); fail++; continue; }
  phases(`hinten ${fps}fps sauber`, clean, 'dtl');
  for (const k of [...DT, 'bend', 'knee', 'reach']) expect(`hinten ${fps}fps sauber`, clean, k, 'ok');
  for (const k of DT) { const r = analyse(dtl({ [k]: 1 }, fps), { hand: 'R' }); expect(`hinten ${fps}fps mit ${k}`, r, k, 'bad'); }
}
// Fehlerfälle
const still = faceOn({}, 'R').map(f => ({ ...f, p: faceOn({}, 'R')[0].p }));
const rs = analyse(still, {}); console.log((rs.ok ? '✗' : '✓') + ' ruhiges Video → ' + (rs.error || 'kein Fehler')); if (rs.ok) fail++;
const none = analyse(faceOn({}, 'R').map(f => ({ t: f.t, p: null, w: null })), {}); console.log((none.ok ? '✗' : '✓') + ' keine Person → ' + none.error); if (none.ok) fail++;
// Lücken in der Erkennung
const gap = faceOn({}, 'R').map((f, i) => i % 4 === 1 ? { t: f.t, p: null, w: null } : f);
const rg = analyse(gap, {}); phases('frontal mit Lücken', rg, 'fo');
console.log(fail ? `\n${fail} FEHLGESCHLAGEN` : '\nAlle Tests bestanden');
process.exit(fail ? 1 : 0);
}
