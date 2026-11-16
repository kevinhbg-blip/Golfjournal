// Schwunganalyse (Beta): reine Auswertung der Körperpunkte, ohne DOM.
// Eingabe: frames = [{t, p:[[x,y,vis]×33] in Pixeln (y nach unten) | null, w:[[x,y,z]×33] in Metern | null}]
// Ausgabe: Phasen, Prüfungen (mit Zeichen-Primitiven für die Markierung im Video), Kennzahlen.

export const LM = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28 };
const SIDE = {
  l: { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 },
  r: { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 }
};

// Alle Schwellen an einem Ort, damit sie nach echten Videos nachjustiert werden können.
export const TH = {
  viewRatio: 0.42,          // Schulterbreite/Rumpflänge: darüber frontal, darunter von hinten
  sway: [0.15, 0.27],       // Hüftverschiebung weg vom Ziel bis zum Top, × Schulterbreite
  headSide: [0.28, 0.45],   // Kopf seitlich bis zum Top, × Schulterbreite
  headDip: [0.10, 0.17],    // Kopf tiefer im Treffmoment, × Rumpflänge
  rsa: [3, 10],             // Oberkörper am Top zum Ziel geneigt, Grad
  slide: [0.10, 0.22],      // vordere Hüfte über den vorderen Knöchel hinaus im Treffmoment, × Schulterbreite
  hang: [0.65, 0.5],        // Hüftposition im Finish zwischen den Füßen (0 hinten, 1 vorne), darunter Fehler
  chicken: [140, 120],      // vorderer Ellbogen kurz nach dem Treffmoment, Grad
  leadArm: [145, 125],      // vorderer Ellbogen am Top, Grad
  turn: 65,                 // Schulterdrehung (Schätzung) am Top, Grad, darunter Hinweis
  ee: [0.08, 0.15],         // Hüfte Richtung Ball im Treffmoment, × Rumpflänge
  lop: [7, 12],             // Vorbeuge im Treffmoment kleiner als beim Ansprechen, Grad
  lopTop: [8, 14],          // Vorbeuge am Top kleiner als beim Ansprechen, Grad
  ott: [0.07, 0.15],        // Hände im Abschwung weiter außen als im Rückschwung, × Rumpflänge
  bend: [25, 50],           // Vorbeuge beim Ansprechen, Gradbereich
  knee: [135, 172],         // Kniewinkel beim Ansprechen, Gradbereich
  reach: [-0.06, 0.28],     // Hände vor den Schultern beim Ansprechen, × Rumpflänge
  tempo: [2.0, 4.5],        // Verhältnis Rückschwung:Abschwung, Bereich
  stance: { driver: [0.95, 1.9], holz: [0.9, 1.8], eisen: [0.75, 1.55], wedge: [0.55, 1.35] }
};

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = r => r * 180 / Math.PI;
function ang(a, b, c) { // Winkel bei b
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const d = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d))));
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const r1 = (x, d = 0) => Number(x.toFixed(d));

// Lücken füllen (lineare Interpolation) und leicht glätten.
export function prepare(raw) {
  const n = raw.length, ok = raw.map(f => !!f.p);
  const first = ok.indexOf(true);
  if (first < 0) return null;
  const out = raw.map(f => ({ t: f.t, p: f.p && f.p.map(q => q.slice()), w: f.w && f.w.map(q => q.slice()), est: !f.p }));
  for (let i = 0; i < n; i++) {
    if (ok[i]) continue;
    let a = i - 1; while (a >= 0 && !ok[a]) a--;
    let b = i + 1; while (b < n && !ok[b]) b++;
    const A = a >= 0 ? raw[a] : null, B = b < n ? raw[b] : null;
    const src = A && B ? null : (A || B);
    if (src) { out[i].p = src.p.map(q => q.slice()); out[i].w = src.w && src.w.map(q => q.slice()); continue; }
    const k = (raw[i].t - A.t) / (B.t - A.t || 1);
    out[i].p = A.p.map((q, j) => [q[0] + (B.p[j][0] - q[0]) * k, q[1] + (B.p[j][1] - q[1]) * k, Math.min(q[2], B.p[j][2])]);
    out[i].w = A.w && B.w ? A.w.map((q, j) => q.map((v, m) => v + (B.w[j][m] - v) * k)) : (A.w || B.w);
  }
  // Glättung über 3 Bilder (Mitte doppelt gewichtet)
  const sm = out.map((f, i) => {
    if (i === 0 || i === n - 1) return f;
    const a = out[i - 1].p, b = out[i + 1].p;
    return { ...f, p: f.p.map((q, j) => [(a[j][0] + 2 * q[0] + b[j][0]) / 4, (a[j][1] + 2 * q[1] + b[j][1]) / 4, q[2]]) };
  });
  return sm;
}

export function analyse(raw, opt = {}) {
  const hand = opt.hand === 'L' ? 'L' : 'R';
  const club = TH.stance[opt.club] ? opt.club : 'eisen';
  const F = prepare(raw);
  if (!F || F.length < 10) return { ok: false, error: 'Im Video wurde keine Person erkannt. Achte darauf, dass der ganze Körper inklusive Füße im Bild ist.' };
  const n = F.length, T = F.map(f => f.t), P = i => F[i].p;
  const shC = i => mid(P(i)[11], P(i)[12]), hipC = i => mid(P(i)[23], P(i)[24]), ankC = i => mid(P(i)[27], P(i)[28]);
  const torso = F.map((f, i) => dist(shC(i), hipC(i)));
  const Lm = median(torso) || 1;
  const H = F.map(f => mid(f.p[15], f.p[16]));

  // Handgeschwindigkeit in Rumpflängen pro Sekunde
  const sp = H.map((h, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return dist(H[b], H[a]) / Math.max(1e-3, T[b] - T[a]) / Lm;
  });

  // --- Phasen ---
  // Treffmoment-Kandidat: schnellste Hände, solange sie unter Hüfthöhe sind
  let iv = -1;
  for (let i = 1; i < n - 1; i++) if (H[i][1] > hipC(i)[1] - 0.3 * Lm && (iv < 0 || sp[i] > sp[iv])) iv = i;
  if (iv < 0) return { ok: false, error: 'Kein Schwung gefunden: Die Hände kommen nie in Hüfthöhe.' };
  // Top: höchste Hände in den 2,5 s davor
  let top = -1;
  for (let i = iv - 1; i >= 0 && T[iv] - T[i] <= 2.5; i--) if (top < 0 || H[i][1] < H[top][1]) top = i;
  if (top < 0) return { ok: false, error: 'Der Rückschwung fehlt im Video. Starte die Aufnahme schon vor dem Ansprechen.' };
  // Ansprechen: letzte ruhige Position mit tiefen Händen vor dem Top
  let yb = -Infinity; for (let i = 0; i < top; i++) yb = Math.max(yb, H[i][1]);
  let addr = -1;
  for (let i = top - 1; i >= 0; i--) if (sp[i] < 0.35 && H[i][1] > yb - 0.12 * Lm) { addr = i; break; }
  if (addr < 0) { addr = 0; for (let i = 0; i < top; i++) if (H[i][1] > H[addr][1]) addr = i; }
  let take = addr; for (let i = addr + 1; i < top; i++) if (dist(H[i], H[addr]) > 0.08 * Lm) { take = i; break; }
  // Treffmoment: erste Position nach dem Top, in der die Hände wieder auf Ansprechhöhe sind
  let imp = -1;
  for (let i = top + 1; i < n && T[i] - T[top] <= 1.0; i++) if (H[i][1] >= H[addr][1] - 0.05 * Lm) { imp = i; break; }
  if (imp < 0) imp = iv;
  else { let b = imp; for (let i = Math.max(top + 1, imp - 1); i <= Math.min(n - 1, imp + 2); i++) if (dist(H[i], H[addr]) < dist(H[b], H[addr])) b = i; imp = b; }
  // Finish: höchste Hände in den 2 s danach
  let fin = imp; for (let i = imp + 1; i < n && T[i] - T[imp] <= 2; i++) if (H[i][1] < H[fin][1]) fin = i;
  // Durchschwung: Hände wieder auf Hüfthöhe
  let fol = Math.min(n - 1, imp + 1); for (let i = imp + 1; i <= fin; i++) if (H[i][1] <= hipC(i)[1]) { fol = i; break; }

  const rise = (H[addr][1] - H[top][1]) / Lm;
  if (rise < 0.5) return { ok: false, error: 'Der Rückschwung ist zu kurz für eine Analyse (Chip oder Putt?). Die Beta ist für volle Schwünge gedacht.' };
  const bt = T[top] - T[take], dt = T[imp] - T[top];
  if (dt < 0.08 || dt > 1.0 || bt < 0.25) return { ok: false, error: 'Die Schwungphasen ließen sich nicht sicher bestimmen. Bitte nur einen Schwung pro Video und die Kamera ruhig halten.' };

  // --- Perspektive ---
  const swr = Math.abs(P(addr)[11][0] - P(addr)[12][0]) / torso[addr];
  const viewAuto = swr > TH.viewRatio ? 'fo' : 'dtl';
  const view = opt.view === 'fo' || opt.view === 'dtl' ? opt.view : viewAuto;

  const notes = [];
  // Seiten: frontal anhand der Fußstellung bestimmen (Ziel = Gegenrichtung der Hände am Top)
  const away = Math.sign(H[top][0] - H[addr][0]) || 1, tgt = -away;
  let lead = hand === 'R' ? SIDE.l : SIDE.r, trail = hand === 'R' ? SIDE.r : SIDE.l;
  if (view === 'fo') {
    const geo = (P(addr)[lead.an][0] - P(addr)[trail.an][0]) * tgt;
    if (geo < 0) { [lead, trail] = [trail, lead]; notes.push('Seiten wurden anhand der Fußstellung getauscht (Linkshänder oder gespiegeltes Selfie-Video?).'); }
  }
  const ballDir = Math.sign(H[addr][0] - hipC(addr)[0]) || 1;
  const vis = (i, ...ids) => ids.every(j => P(i)[j][2] >= 0.5);
  const S = Math.abs(P(addr)[11][0] - P(addr)[12][0]) || Lm * 0.8;

  const checks = [], metrics = [];
  const sev = (v, [a, b]) => v >= b ? 2 : v >= a ? 1 : 0;
  const sevLow = (v, [a, b]) => v <= b ? 2 : v <= a ? 1 : 0;
  const add = (id, frame, s, val, prims, extra = {}) => checks.push({ id, frame, sev: s, val, prims, ...extra });
  const na = (id, frame, why) => checks.push({ id, frame, sev: -1, val: why || 'nicht sicher erkennbar', prims: [] });
  const vline = (x, y0, y1, c, label, dash) => ({ k: 'line', a: [x, y0], b: [x, y1], c, label, dash });
  const line = (a, b, c, label, dash) => ({ k: 'line', a, b, c, label, dash });
  const pathPts = (a, b) => H.slice(a, b + 1).map(h => h.slice());

  const sp2 = Lm * 0.15; // Ränder für Hilfslinien

  // Gemeinsam: Tempo
  const tempo = bt / dt;
  metrics.push({ k: 'tempo', label: 'Tempo Rückschwung : Abschwung', val: r1(tempo, 1) + ' : 1', note: 'Tour-Schnitt etwa 3 : 1' });
  metrics.push({ k: 'bt', label: 'Rückschwung', val: r1(bt, 2) + ' s', note: 'bei Zeitlupe gestreckt' });
  metrics.push({ k: 'dt', label: 'Abschwung', val: r1(dt, 2) + ' s', note: 'bei Zeitlupe gestreckt' });
  add('tempo', top, tempo < TH.tempo[0] || tempo > TH.tempo[1] ? 1 : 0, r1(tempo, 1) + ' : 1', [{ k: 'poly', pts: pathPts(take, top), c: 'p1' }, { k: 'poly', pts: pathPts(top, imp), c: 'p2' }]);

  // Drehung (Schätzung aus den 3D-Weltkoordinaten)
  const yaw = (i, a, b) => { const w = F[i].w; if (!w) return null; return deg(Math.atan2(w[b][2] - w[a][2], w[b][0] - w[a][0])); };
  const turn = (a, b) => { const y0 = yaw(addr, a, b), y1 = yaw(top, a, b); if (y0 == null || y1 == null) return null; let d = Math.abs(y1 - y0) % 360; return d > 180 ? 360 - d : d; };
  const shT = turn(11, 12), hipT = turn(23, 24);
  if (shT != null) metrics.push({ k: 'shT', label: 'Schulterdrehung am Top', val: '≈ ' + Math.round(shT) + '°', note: 'Schätzung, Tour etwa 85–100°' });
  if (hipT != null) metrics.push({ k: 'hipT', label: 'Hüftdrehung am Top', val: '≈ ' + Math.round(hipT) + '°', note: 'Schätzung, Tour etwa 40–50°' });

  if (view === 'fo') {
    // Standbreite
    const st = Math.abs(P(addr)[27][0] - P(addr)[28][0]) / S, rng = TH.stance[club];
    metrics.push({ k: 'stance', label: 'Standbreite / Schulterbreite', val: r1(st, 2), note: 'Bereich ' + rng.join('–') });
    if (vis(addr, 27, 28, 11, 12)) add(st < rng[0] ? 'stanceN' : st > rng[1] ? 'stanceW' : 'stance', addr, st < rng[0] || st > rng[1] ? 1 : 0, r1(st, 2) + '× Schulterbreite',
      [vline(P(addr)[27][0], P(addr)[27][1] - sp2, P(addr)[27][1] + sp2 / 2, 'ref'), vline(P(addr)[28][0], P(addr)[28][1] - sp2, P(addr)[28][1] + sp2 / 2, 'ref'),
       vline(P(addr)[11][0], P(addr)[11][1] - sp2, P(addr)[11][1] + sp2, 'good', '', true), vline(P(addr)[12][0], P(addr)[12][1] - sp2, P(addr)[12][1] + sp2, 'good', '', true)]);
    else na('stance', addr);

    // Sway: Hüfte relativ zu den Füßen
    if (vis(addr, 23, 24, 27, 28) && vis(top, 23, 24)) {
      const rel = i => hipC(i)[0] - ankC(i)[0];
      const v = (rel(top) - rel(addr)) * away / S;
      const th = P(addr)[trail.hip], thTop = P(top)[trail.hip];
      add('sway', top, sev(v, TH.sway), Math.round(v * 100) + ' % der Schulterbreite', [
        vline(th[0] + (ankC(top)[0] - ankC(addr)[0]), th[1] - Lm * 0.6, P(addr)[trail.an][1], 'ref', 'Hüfte beim Ansprechen', true),
        vline(thTop[0], thTop[1] - Lm * 0.6, P(top)[trail.an][1], v >= TH.sway[0] ? 'bad' : 'good', 'Hüfte am Top'),
        { k: 'arrow', a: [th[0] + (ankC(top)[0] - ankC(addr)[0]), thTop[1] - Lm * 0.3], b: [thTop[0], thTop[1] - Lm * 0.3], c: v >= TH.sway[0] ? 'bad' : 'good' }]);
      metrics.push({ k: 'sway', label: 'Hüftverschiebung bis zum Top', val: Math.round(v * 100) + ' %', note: 'der Schulterbreite, weg vom Ziel' });
    } else na('sway', top);

    // Kopf seitlich
    if (vis(addr, 0) && vis(top, 0)) {
      const v = (P(top)[0][0] - P(addr)[0][0]) * away / S;
      const r = Lm * 0.22;
      add('head', top, sev(v, TH.headSide), Math.round(v * 100) + ' % der Schulterbreite', [
        { k: 'circle', at: P(addr)[0].slice(0, 2), r, c: 'ref', dash: true, label: 'Kopf beim Ansprechen' },
        { k: 'circle', at: P(top)[0].slice(0, 2), r, c: v >= TH.headSide[0] ? 'bad' : 'good' }]);
    } else na('head', top);

    // Reverse Spine Angle am Top
    if (vis(top, 11, 12, 23, 24)) {
      const tilt = i => deg(Math.atan2((shC(i)[0] - hipC(i)[0]) * tgt, hipC(i)[1] - shC(i)[1]));
      const v = tilt(top);
      const h = hipC(top);
      add('rsa', top, sev(v, TH.rsa), (v > 0 ? Math.round(v) + '° zum Ziel' : Math.round(-v) + '° vom Ziel weg'), [
        line(h, [h[0], h[1] - Lm * 1.25], 'ref', 'senkrecht', true),
        line(h, [h[0] + (shC(top)[0] - h[0]) * 1.25, h[1] + (shC(top)[1] - h[1]) * 1.25], v >= TH.rsa[0] ? 'bad' : 'good', 'Oberkörper')]);
      metrics.push({ k: 'tilt', label: 'Oberkörperneigung am Top', val: (v > 0 ? '+' : '') + Math.round(v) + '°', note: 'plus = zum Ziel' });
    } else na('rsa', top);

    // Slide im Treffmoment
    if (vis(imp, lead.hip, lead.an)) {
      const v = (P(imp)[lead.hip][0] - P(imp)[lead.an][0]) * tgt / S;
      const ax = P(imp)[lead.an][0];
      add('slide', imp, sev(v, TH.slide), (v > 0 ? Math.round(v * 100) + ' % über den vorderen Fuß hinaus' : 'Hüfte innerhalb des vorderen Fußes'), [
        vline(ax, P(imp)[lead.hip][1] - Lm * 0.7, P(imp)[lead.an][1], 'ref', 'vorderer Fuß', true),
        { k: 'dot', at: P(imp)[lead.hip].slice(0, 2), c: v >= TH.slide[0] ? 'bad' : 'good', label: 'vordere Hüfte' }]);
    } else na('slide', imp);

    // Hängenbleiben im Finish
    if (vis(fin, 23, 24) && vis(addr, 27, 28)) {
      const ta = P(addr)[trail.an][0], la = P(addr)[lead.an][0];
      const v = (hipC(fin)[0] - ta) / ((la - ta) || 1);
      const y = P(addr)[27][1] + Lm * 0.1;
      add('hang', fin, sevLow(v, TH.hang), Math.round(Math.max(0, Math.min(1.2, v)) * 100) + ' % Richtung vorderer Fuß', [
        line([ta, y], [la, y], 'ref', '', false),
        { k: 'dot', at: [ta + (la - ta) * Math.max(-0.1, Math.min(1.2, v)), y], c: v <= TH.hang[0] ? 'bad' : 'good', label: 'Hüfte' },
        vline(hipC(fin)[0], hipC(fin)[1], y, v <= TH.hang[0] ? 'bad' : 'good', '', true)]);
      metrics.push({ k: 'fin', label: 'Hüfte im Finish', val: Math.round(v * 100) + ' %', note: '0 = hinterer Fuß, 100 = vorderer Fuß' });
    } else na('hang', fin);

    // Chicken Wing nach dem Treffmoment
    // kleinster Ellbogenwinkel zwischen Treffmoment und Händen auf Bauchhöhe
    let cw = -1, cv = 999;
    for (let i = imp + 1; i <= fin; i++) {
      if (H[i][1] < (shC(i)[1] + hipC(i)[1]) / 2) break;
      if (!vis(i, lead.sh, lead.el, lead.wr)) continue;
      const a = ang(P(i)[lead.sh], P(i)[lead.el], P(i)[lead.wr]);
      if (a < cv) { cv = a; cw = i; }
    }
    if (cw >= 0) {
      const p = P(cw), v = cv;
      add('chicken', cw, sevLow(v, TH.chicken), Math.round(v) + '° im vorderen Ellbogen', [
        { k: 'angle', p: [p[lead.sh].slice(0, 2), p[lead.el].slice(0, 2), p[lead.wr].slice(0, 2)], c: v <= TH.chicken[0] ? 'bad' : 'good', label: Math.round(v) + '°' }]);
    } else na('chicken', fol);

    // Gebeugter Führungsarm am Top
    if (vis(top, lead.sh, lead.el, lead.wr)) {
      const p = P(top), v = ang(p[lead.sh], p[lead.el], p[lead.wr]);
      add('leadArm', top, sevLow(v, TH.leadArm), Math.round(v) + '° im vorderen Ellbogen', [
        { k: 'angle', p: [p[lead.sh].slice(0, 2), p[lead.el].slice(0, 2), p[lead.wr].slice(0, 2)], c: v <= TH.leadArm[0] ? 'bad' : 'good', label: Math.round(v) + '°' }]);
    } else na('leadArm', top);

    // Kopf taucht ab
    if (vis(addr, 0) && vis(imp, 0)) {
      const v = (P(imp)[0][1] - P(addr)[0][1]) / Lm;
      const x = P(addr)[0][0];
      add('dip', imp, sev(v, TH.headDip), (v >= 0 ? Math.round(v * 100) + ' % tiefer' : Math.round(-v * 100) + ' % höher') + ' (Rumpflänge)', [
        line([x - Lm * 0.5, P(addr)[0][1]], [x + Lm * 0.5, P(addr)[0][1]], 'ref', 'Kopfhöhe Ansprechen', true),
        { k: 'dot', at: P(imp)[0].slice(0, 2), c: v >= TH.headDip[0] ? 'bad' : 'good' }]);
    } else na('dip', imp);

    if (shT != null) add('turn', top, shT < TH.turn ? 1 : 0, '≈ ' + Math.round(shT) + '° (Schätzung)', [
      line(P(top)[11].slice(0, 2), P(top)[12].slice(0, 2), shT < TH.turn ? 'bad' : 'good', 'Schulterlinie'),
      line(P(addr)[11].slice(0, 2), P(addr)[12].slice(0, 2), 'ref', 'Ansprechen', true)]);
  } else {
    // ---------- Von hinten (Down the line) ----------
    const bend = i => deg(Math.atan2((shC(i)[0] - hipC(i)[0]) * ballDir, hipC(i)[1] - shC(i)[1]));
    const spinePrims = (i, bad) => {
      const h0 = hipC(addr), s0 = shC(addr), h = hipC(i), s = shC(i);
      return [line(h0, [h0[0] + (s0[0] - h0[0]) * 1.2, h0[1] + (s0[1] - h0[1]) * 1.2], 'ref', 'Ansprechen ' + Math.round(bend(addr)) + '°', true),
              line(h, [h[0] + (s[0] - h[0]) * 1.2, h[1] + (s[1] - h[1]) * 1.2], bad ? 'bad' : 'good', Math.round(bend(i)) + '°')];
    };

    // Ansprechhaltung
    if (vis(addr, 11, 12, 23, 24)) {
      const b = bend(addr);
      add(b < TH.bend[0] ? 'bendLow' : b > TH.bend[1] ? 'bendHigh' : 'bend', addr, b < TH.bend[0] || b > TH.bend[1] ? 1 : 0, Math.round(b) + '° Vorbeuge', spinePrims(addr, b < TH.bend[0] || b > TH.bend[1]).slice(1));
      metrics.push({ k: 'bend', label: 'Vorbeuge beim Ansprechen', val: Math.round(b) + '°', note: 'üblich 30–45°' });
    } else na('bend', addr);
    const kneeSide = P(addr)[trail.kn][2] >= P(addr)[lead.kn][2] ? trail : lead;
    if (vis(addr, kneeSide.hip, kneeSide.kn, kneeSide.an)) {
      const p = P(addr), v = ang(p[kneeSide.hip], p[kneeSide.kn], p[kneeSide.an]);
      const bad = v < TH.knee[0] || v > TH.knee[1];
      add(v > TH.knee[1] ? 'kneeStraight' : v < TH.knee[0] ? 'kneeDeep' : 'knee', addr, bad ? 1 : 0, Math.round(v) + '° im Knie',
        [{ k: 'angle', p: [p[kneeSide.hip].slice(0, 2), p[kneeSide.kn].slice(0, 2), p[kneeSide.an].slice(0, 2)], c: bad ? 'bad' : 'good', label: Math.round(v) + '°' }]);
    } else na('knee', addr);
    if (vis(addr, 11, 12, 15, 16)) {
      const v = (H[addr][0] - shC(addr)[0]) * ballDir / Lm;
      const bad = v < TH.reach[0] || v > TH.reach[1];
      add(v > TH.reach[1] ? 'reachFar' : v < TH.reach[0] ? 'reachClose' : 'reach', addr, bad ? 1 : 0, (v >= 0 ? Math.round(v * 100) + ' % vor' : Math.round(-v * 100) + ' % hinter') + ' der Schulter (Rumpflänge)', [
        vline(shC(addr)[0], shC(addr)[1], H[addr][1] + Lm * 0.15, 'ref', 'unter der Schulter', true),
        { k: 'dot', at: H[addr].slice(), c: bad ? 'bad' : 'good', label: 'Hände' }]);
    } else na('reach', addr);

    // Early Extension: Hüfte Richtung Ball (relativ zu den Füßen)
    if (vis(addr, 23, 24) && vis(imp, 23, 24)) {
      const rel = i => hipC(i)[0] - ankC(i)[0];
      // größter Wert rund um den Treffmoment (±50 ms), weil das Treffbild oft verwischt ist
      let ei = imp;
      for (let i = imp - 3; i <= imp + 3; i++) if (i > top && i < n && Math.abs(T[i] - T[imp]) <= 0.05 && (rel(i) - rel(ei)) * ballDir > 0) ei = i;
      const v = (rel(ei) - rel(addr)) * ballDir / Lm;
      const back = i => hipC(i)[0] - ballDir * 0.2 * Lm;
      const sh = ankC(ei)[0] - ankC(addr)[0];
      const y0 = hipC(addr)[1] - Lm * 0.35, y1 = hipC(addr)[1] + Lm * 0.45;
      add('ee', ei, sev(v, TH.ee), (v >= 0 ? Math.round(v * 100) + ' % zum Ball' : Math.round(-v * 100) + ' % vom Ball weg') + ' (Rumpflänge)', [
        vline(back(addr) + sh, y0, y1, 'ref', 'Gesäßlinie Ansprechen', true),
        vline(back(ei), y0 + (hipC(ei)[1] - hipC(addr)[1]), y1 + (hipC(ei)[1] - hipC(addr)[1]), v >= TH.ee[0] ? 'bad' : 'good', 'Treffmoment'),
        { k: 'arrow', a: [back(addr) + sh, hipC(ei)[1]], b: [back(ei), hipC(ei)[1]], c: v >= TH.ee[0] ? 'bad' : 'good' }]);
      metrics.push({ k: 'ee', label: 'Hüfte Richtung Ball im Treffmoment', val: Math.round(v * 100) + ' %', note: 'der Rumpflänge' });
    } else na('ee', imp);

    // Haltungsverlust im Treffmoment und am Top
    if (vis(addr, 11, 12, 23, 24) && vis(imp, 11, 12, 23, 24)) {
      const v = bend(addr) - bend(imp);
      add('lop', imp, sev(v, TH.lop), (v >= 0 ? Math.round(v) + '° aufgerichtet' : Math.round(-v) + '° tiefer'), spinePrims(imp, v >= TH.lop[0]));
      metrics.push({ k: 'bendImp', label: 'Vorbeuge im Treffmoment', val: Math.round(bend(imp)) + '°', note: 'Ansprechen ' + Math.round(bend(addr)) + '°' });
    } else na('lop', imp);
    if (vis(addr, 11, 12, 23, 24) && vis(top, 11, 12, 23, 24)) {
      const v = bend(addr) - bend(top);
      add('lopTop', top, sev(v, TH.lopTop), (v >= 0 ? Math.round(v) + '° aufgerichtet' : Math.round(-v) + '° tiefer'), spinePrims(top, v >= TH.lopTop[0]));
    } else na('lopTop', top);

    // Over the Top: Handweg im Abschwung gegenüber Rückschwung
    {
      const cross = (a, b, y) => { // erste Stelle zwischen a und b, an der die Hände die Höhe y kreuzen
        const st = a < b ? 1 : -1;
        for (let i = a; i !== b; i += st) {
          const y1 = H[i][1], y2 = H[i + st][1];
          if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) { const k = (y - y1) / (y2 - y1); return H[i][0] + (H[i + st][0] - H[i][0]) * k; }
        }
        return null;
      };
      const ds = [];
      for (const f of [0.35, 0.5, 0.65]) {
        const y = H[addr][1] - f * (H[addr][1] - H[top][1]);
        const xb = cross(addr, top, y), xd = cross(top, imp, y);
        if (xb != null && xd != null) ds.push({ y, xb, xd, d: (xd - xb) * ballDir / Lm });
      }
      if (ds.length && vis(top, 15, 16)) {
        const v = ds.reduce((s, d) => s + d.d, 0) / ds.length;
        let dmid = top; while (dmid < imp && H[dmid][1] < ds[Math.floor(ds.length / 2)].y) dmid++;
        add('ott', dmid, sev(v, TH.ott), (v >= 0 ? Math.round(v * 100) + ' % weiter außen' : Math.round(-v * 100) + ' % weiter innen') + ' als im Rückschwung', [
          { k: 'poly', pts: pathPts(addr, top), c: 'p1', label: 'Rückschwung' },
          { k: 'poly', pts: pathPts(top, imp), c: v >= TH.ott[0] ? 'bad' : 'p2', label: 'Abschwung' },
          ...ds.map(d => ({ k: 'arrow', a: [d.xb, d.y], b: [d.xd, d.y], c: d.d >= TH.ott[0] ? 'bad' : 'good' }))]);
      } else na('ott', top);
    }
  }

  // Für Anzeige: Gewichtsverteilung (Schwerpunkt-Schätzung) – nur frontal sinnvoll
  let com = null;
  if (view === 'fo') {
    const ta = P(addr)[trail.an][0], la = P(addr)[lead.an][0];
    com = F.map((f, i) => {
      const p = f.p, x = 0.1 * p[0][0] + 0.3 * shC(i)[0] + 0.4 * hipC(i)[0] + 0.2 * (p[25][0] + p[26][0]) / 2;
      return Math.max(0, Math.min(1, (x - ta) / ((la - ta) || 1)));
    });
  }

  checks.sort((a, b) => b.sev - a.sev);
  return {
    ok: true, view, viewAuto, hand, club, notes,
    idx: { addr, take, top, imp, fol, fin }, t: T, frames: F, hands: H, com, S, L: Lm, ballDir, tgt,
    lead: lead.sh === 11 ? 'l' : 'r',
    checks, metrics
  };
}

// Texte je Prüfung: Name, was passiert, Folge, richtig, Übungen. Quelle der Begriffe: TPI-Schwungcharakteristiken und gängige Lehrmeinung.
export const INFO = {
  sway: { n: 'Sway (Hüfte weicht seitlich aus)', ok: 'Hüfte bleibt im Rückschwung über den Füßen', ph: 'Top',
    was: 'Im Rückschwung schiebt sich die Hüfte vom Ziel weg, statt sich zu drehen. Der Körper „fällt“ über den hinteren Fuß hinaus.',
    folge: 'Der Tiefpunkt des Schwungs wandert; fette und dünne Treffer, weniger Kraft, weil der Körper erst zurückfinden muss.',
    richtig: 'Die Hüfte dreht um das hintere Bein. Das hintere Knie bleibt leicht gebeugt, der Druck bleibt auf der Innenseite des hinteren Fußes.',
    drills: ['Alignment-Stick senkrecht außen neben die hintere Hüfte stecken: Rückschwung, ohne den Stab zu berühren.', 'Golfball unter die Außenkante des hinteren Fußes legen und Halbschwünge machen; der Druck bleibt innen.', 'Wenn es trotz Übung nicht klappt: Hüft-Innenrotation prüfen (z. B. 90/90-Dehnung aus „Kraft & Mobilität“).'] },
  head: { n: 'Kopf wandert seitlich', ok: 'Kopf bleibt im Rückschwung ruhig', ph: 'Top',
    was: 'Der Kopf bewegt sich im Rückschwung deutlich vom Ziel weg. Ein paar Zentimeter sind normal, viel mehr meist ein Zeichen für einen Sway des Oberkörpers.',
    folge: 'Unbeständiger Ballkontakt, weil der Schwungmittelpunkt wandert.',
    richtig: 'Der Oberkörper dreht um eine ruhige Achse; der Kopf darf leicht mitgehen, bleibt aber innerhalb der hinteren Fußinnenseite.',
    drills: ['Schatten-Übung: Sonne im Rücken, Kopfschatten auf einen Ball oder Tee legen und im Rückschwung dort halten.', 'Vor dem Spiegel in Zeitlupe bis zum Top drehen, Kopf als Bezugspunkt beobachten.'] },
  rsa: { n: 'Reverse Spine Angle', ok: 'Oberkörper bleibt am Top hinter dem Ball', ph: 'Top',
    was: 'Am Top neigt sich der Oberkörper zum Ziel statt leicht vom Ziel weg.',
    folge: 'Laut TPI die häufigste Ursache für Rückenschmerzen im Golf. Dazu steiler Abschwung, Slice oder Pull, Kraftverlust.',
    richtig: 'Am Top zeigt der Rücken zum Ziel, die Wirbelsäule bleibt leicht vom Ziel weg geneigt; die Brust ist über dem hinteren Oberschenkel.',
    drills: ['Schläger quer vor die Brust halten, Grundhaltung, Rückschwung-Drehung: der Schaft soll am Ende auf den Ball zeigen, der Kopf bleibt hinter dem Ball.', 'Hintere Hüfte im Rückschwung bewusst nach hinten (Gesäßtasche weg vom Ball) drehen statt seitlich schieben.'] },
  slide: { n: 'Slide (Hüfte schiebt zum Ziel)', ok: 'Hüfte dreht im Abschwung, statt zu schieben', ph: 'Treffmoment',
    was: 'Im Abschwung schiebt die Hüfte über den vorderen Fuß hinaus, statt nach einer kurzen Verlagerung zu drehen.',
    folge: 'Der Schläger bleibt zurück: offene Schlagfläche (Push, Slice) oder, wenn die Hände retten, Hook.',
    richtig: 'Erst eine kleine Verlagerung zum Ziel, dann dreht die vordere Hüfte nach hinten weg. Im Treffmoment ist die vordere Hüfte etwa über dem vorderen Fuß.',
    drills: ['Alignment-Stick senkrecht außen neben den vorderen Fuß stecken: im Durchschwung darf die Hüfte ihn nicht berühren.', '„Bump and Turn“: langsam in die vordere Seite drücken und sofort die vordere Gesäßtasche nach hinten drehen.'] },
  hang: { n: 'Hängenbleiben (Gewicht bleibt hinten)', ok: 'Gewicht im Finish auf dem vorderen Fuß', ph: 'Finish',
    was: 'Im Abschwung verlagert sich das Gewicht nicht nach vorne; im Finish ist die Hüfte noch zwischen den Füßen oder hinten.',
    folge: 'Tiefpunkt hinter dem Ball: fett, dünn, hohe schwache Bälle, Kraftverlust.',
    richtig: 'Im Finish steht man fast ganz auf dem vorderen Fuß, die hintere Ferse ist oben, Gürtelschnalle und Brust zeigen zum Ziel.',
    drills: ['Step-Drill: Füße zusammen, im Rückschwung mit dem vorderen Fuß Richtung Ziel steigen, dann schwingen.', 'Jeden Schwung im Finish 3 Sekunden halten, nur auf der vorderen Ferse und der hinteren Fußspitze.'] },
  chicken: { n: 'Chicken Wing', ok: 'Vorderer Arm bleibt nach dem Treffmoment lang', ph: 'Durchschwung',
    was: 'Der vordere Ellbogen knickt nach dem Treffmoment ab und zeigt zum Ziel, statt dass beide Arme lang werden.',
    folge: 'Offene Schlagfläche (Slice, Push), dünne Treffer, weniger Geschwindigkeit.',
    richtig: 'Nach dem Treffmoment strecken sich beide Arme, die Unterarme drehen über; auf Hüfthöhe zeigt die Schlägerspitze nach oben.',
    drills: ['Handtuch unter beide Achseln klemmen und Halbschwünge (9 bis 3 Uhr) machen, ohne dass es fällt.', 'Split-Hand-Drill: Hände am Griff 10 cm auseinander, Halbschwünge, die hintere Hand überholt die vordere nach dem Ball.'] },
  leadArm: { n: 'Stark gebeugter Führungsarm am Top', ok: 'Führungsarm am Top lang', ph: 'Top',
    was: 'Der vordere Arm knickt am Top deutlich ein. Etwas Beugung ist normal, ein stark gebeugter Arm kostet Schwungbreite.',
    folge: 'Schwankende Schwungbreite, unbeständiger Kontakt, weniger Kraft.',
    richtig: 'Der Arm ist lang, aber nicht verkrampft. Lieber ein kürzerer Rückschwung mit langem Arm als ein langer mit Knick.',
    drills: ['Rückschwung nur so weit, wie der vordere Arm lang bleibt (vor dem Spiegel prüfen), dann von dort schwingen.', '„Breite“-Gefühl: am Top Hände so weit wie möglich vom Kopf weg.'] },
  dip: { n: 'Kopf taucht ab', ok: 'Kopfhöhe bleibt bis zum Treffmoment', ph: 'Treffmoment',
    was: 'Im Abschwung senkt sich der Kopf deutlich (der Oberkörper fällt nach unten).',
    folge: 'Fette Treffer, Ausgleichsbewegungen der Hände.',
    richtig: 'Die Höhe bleibt bis zum Treffmoment etwa gleich; die Beine drücken vom Boden weg.',
    drills: ['Ein Stab oder die Hand eines Partners leicht am Kopf: bis zum Treffmoment Kontakt halten, ohne darunter abzutauchen.'] },
  turn: { n: 'Wenig Schulterdrehung', ok: 'Schulterdrehung ausreichend', ph: 'Top',
    was: 'Die Schultern drehen am Top deutlich weniger als die übliche Vierteldrehung (Wert ist eine grobe Schätzung aus einem einzigen Video).',
    folge: 'Der Schwung wird armlastig, weniger Kraft, oft steiler Abschwung.',
    richtig: 'Am Top zeigt der Rücken zum Ziel (Schultern etwa 90°, Hüfte etwa 45°).',
    drills: ['Brustwirbelsäulen-Rotation im Vierfüßlerstand oder im Sitzen (aus „Kraft & Mobilität“).', 'Rückschwung mit Schläger quer vor der Brust, bis der Schaft auf den Ball zeigt.'] },
  tempo: { n: 'Tempo außerhalb des üblichen Bereichs', ok: 'Tempo im üblichen Bereich', ph: 'Top',
    was: 'Das Verhältnis von Rückschwung- zu Abschwungzeit weicht stark vom Tour-Schnitt (etwa 3 : 1) ab.',
    folge: 'Unter 2 : 1 meist ein hastiger Rückschwung, über 4,5 : 1 oft ein zögerlicher Übergang.',
    richtig: 'Ein ruhiger, gleichmäßiger Rückschwung und ein flüssiger Übergang; das Verhältnis ist persönlich, liegt aber meist um 3 : 1.',
    drills: ['Mit Metronom-App üben: drei Schläge Rückschwung, ein Schlag Abschwung.', 'Hinweis: Die Zeitwerte gelten nur, wenn das Video in Echtzeit läuft; das Verhältnis passt aber auch bei Zeitlupe.'] },
  stance: { n: 'Standbreite', ok: 'Standbreite passt zum Schläger', ph: 'Ansprechen' },
  stanceN: { n: 'Stand eher schmal', ok: '', ph: 'Ansprechen',
    was: 'Die Füße stehen schmaler als für diesen Schläger üblich.', folge: 'Weniger Stabilität, Gleichgewicht geht im Durchschwung leicht verloren.',
    richtig: 'Eisen: Fußinnenseiten etwa schulterbreit; Driver etwas breiter.', drills: ['Zwei Schläger als Fußlinien auf den Boden legen und die Breite je Schläger markieren.'] },
  stanceW: { n: 'Stand eher breit', ok: '', ph: 'Ansprechen',
    was: 'Die Füße stehen breiter als für diesen Schläger üblich.', folge: 'Die Hüfte kann schlecht drehen, häufig Sway oder Slide.',
    richtig: 'Eisen: Fußinnenseiten etwa schulterbreit; Wedges schmaler.', drills: ['Zwei Schläger als Fußlinien auf den Boden legen und die Breite je Schläger markieren.'] },
  bend: { n: 'Vorbeuge beim Ansprechen', ok: 'Vorbeuge im üblichen Bereich', ph: 'Ansprechen' },
  bendLow: { n: 'Zu aufrechte Ansprechhaltung', ok: '', ph: 'Ansprechen',
    was: 'Der Oberkörper ist beim Ansprechen kaum aus der Hüfte nach vorne geneigt.', folge: 'Flache Schwungebene, Arme haben keinen Platz, oft Haltungsverlust später im Schwung.',
    richtig: 'Aus der Hüfte (nicht aus dem Rücken) nach vorne neigen, Gesäß nach hinten, Arme hängen locker unter den Schultern.', drills: ['Schläger an Hinterkopf, Brustwirbelsäule und Steißbein halten und aus der Hüfte nach vorne kippen, bis die Arme frei hängen.'] },
  bendHigh: { n: 'Zu stark gebeugte Ansprechhaltung', ok: '', ph: 'Ansprechen',
    was: 'Der Oberkörper ist beim Ansprechen sehr stark nach vorne gebeugt (oft mit rundem Rücken, „C-Haltung“).', folge: 'Eingeschränkte Drehung, der Körper richtet sich im Schwung auf.',
    richtig: 'Brust raus, aus der Hüfte neigen, Gewicht über der Fußmitte.', drills: ['Stab-Übung wie oben: drei Kontaktpunkte am Rücken halten.'] },
  knee: { n: 'Kniebeuge beim Ansprechen', ok: 'Kniebeuge im üblichen Bereich', ph: 'Ansprechen' },
  kneeStraight: { n: 'Knie fast gestreckt', ok: '', ph: 'Ansprechen',
    was: 'Die Knie sind beim Ansprechen nahezu durchgestreckt.', folge: 'Wenig Stabilität, der Oberkörper muss die Neigung allein halten.',
    richtig: 'Knie leicht gebeugt, wie vor einem kleinen Sprung; Kniescheiben etwa über den Fußballen.', drills: ['Vor dem Spiegel: Hüfte nach hinten, dann nur so viel Kniebeuge, bis die Knie über den Schnürsenkeln sind.'] },
  kneeDeep: { n: 'Zu viel Kniebeuge', ok: '', ph: 'Ansprechen',
    was: 'Die Knie sind beim Ansprechen sehr stark gebeugt (Sitzhaltung).', folge: 'Hüfte kann schlecht drehen, Gewicht oft auf den Fersen.',
    richtig: 'Mehr aus der Hüfte neigen, weniger in die Knie gehen.', drills: ['Stab-Übung wie oben, Gewicht auf die Fußmitte.'] },
  reach: { n: 'Abstand der Hände zum Körper', ok: 'Hände hängen etwa unter den Schultern', ph: 'Ansprechen' },
  reachFar: { n: 'Hände weit weg vom Körper', ok: '', ph: 'Ansprechen',
    was: 'Die Hände sind beim Ansprechen deutlich vor den Schultern (man greift nach dem Ball).', folge: 'Gewicht auf den Zehen, Haltungsverlust und Early Extension werden wahrscheinlicher.',
    richtig: 'Die Arme hängen locker nach unten, die Hände sind etwa eine Handbreite vor den Oberschenkeln.', drills: ['Arme beim Ansprechen locker hängen lassen und erst dann den Schläger greifen; Abstand mit der Hand prüfen.'] },
  reachClose: { n: 'Hände sehr nah am Körper', ok: '', ph: 'Ansprechen',
    was: 'Die Hände sind beim Ansprechen hinter der Schulterlinie, sehr nah am Körper.', folge: 'Arme haben keinen Platz, steiler Schwung.',
    richtig: 'Die Arme hängen locker nach unten, die Hände sind etwa eine Handbreite vor den Oberschenkeln.', drills: ['Abstand Hände–Oberschenkel mit einer Handbreite prüfen.'] },
  ee: { n: 'Early Extension', ok: 'Hüfte bleibt bis zum Treffmoment auf ihrer Linie', ph: 'Treffmoment',
    was: 'Im Abschwung bewegt sich die Hüfte Richtung Ball, das Gesäß verlässt seine Linie vom Ansprechen. Laut TPI bei 67 % von über 90.000 untersuchten Golfern vorhanden.',
    folge: 'Kein Platz für die Arme: Blocks, Hooks, getoppte und Shank-Schläge.',
    richtig: 'Das Gesäß bleibt bis in den Treffmoment an der Linie vom Ansprechen (oder geht sogar etwas zurück); die Hüfte dreht, statt nach vorne zu schieben.',
    drills: ['Stuhl-Drill: Stuhl oder Golfbag ans Gesäß, Schwünge ohne den Kontakt zu verlieren (erst halbe Geschwindigkeit).', 'Hosentasche-zurück: Im Abschwung bewusst die vordere Gesäßtasche nach hinten drehen.', 'Wenn es trotz Übung nicht klappt: Tiefe-Kniebeuge-Test (TPI) und Hüftmobilität aus „Kraft & Mobilität“.'] },
  lop: { n: 'Haltungsverlust (Aufrichten im Treffmoment)', ok: 'Vorbeuge bleibt bis zum Treffmoment', ph: 'Treffmoment',
    was: 'Der Oberkörper richtet sich bis zum Treffmoment deutlich auf, die Vorbeuge vom Ansprechen geht verloren.',
    folge: 'Getoppte und dünne Schläge, Schlagfläche offen (Push) oder durch Handarbeit geschlossen (Hook).',
    richtig: 'Die Neigung des Oberkörpers bleibt bis nach dem Treffmoment etwa gleich; die Brust schaut im Treffmoment noch auf den Ball.',
    drills: ['Stuhl-Drill (siehe Early Extension).', 'Halbschwünge mit Blick auf einen Punkt hinter dem Ball, bis der Ball weg ist.'] },
  lopTop: { n: 'Aufrichten im Rückschwung (flache Schulterebene)', ok: 'Vorbeuge bleibt im Rückschwung', ph: 'Top',
    was: 'Im Rückschwung richtet sich der Oberkörper auf; die Schultern drehen dadurch zu flach.',
    folge: 'Der Abschwung wird steil oder die Höhe muss wieder gefunden werden: unbeständiger Kontakt.',
    richtig: 'Die Schultern drehen rechtwinklig zur Wirbelsäule; die vordere Schulter geht nach unten, nicht nur herum.',
    drills: ['Schläger quer über die Schultern, Grundhaltung, drehen: am Top zeigt der Schaft vor den Ball.'] },
  ott: { n: 'Over the Top (Hände kommen von außen)', ok: 'Hände kommen im Abschwung von innen', ph: 'Abschwung',
    was: 'Der Abschwung startet mit Schultern und Armen; die Hände bewegen sich nach außen, über den Weg des Rückschwungs.',
    folge: 'Schwungbahn von außen nach innen: Slice und Pull, oft steile Divots.',
    richtig: 'Der Abschwung beginnt mit Druck in den vorderen Fuß und der Hüfte; die Hände fallen zuerst nach unten und kommen unterhalb des Rückschwung-Wegs zum Ball.',
    drills: ['Headcover etwa 10 cm außerhalb und hinter dem Ball: im Abschwung nicht berühren.', 'Pump-Drill: vom Top zweimal bis Hüfthöhe nach unten „pumpen“ (Ellbogen zur Hüfte), beim dritten Mal durchschwingen.'] }
};

export const LIMITS = [
  'Schläger und Schlagfläche werden nicht erkannt. Casting, Scooping, Schaftebene und Schlagflächenstellung kann die Beta deshalb nicht messen; nutze dafür das Linien-Werkzeug.',
  'Druck und Bodenkräfte (wie bei Smart2Move- oder Swing-Catalyst-Druckplatten) lassen sich aus Video nicht messen. Die Gewichtsanzeige ist eine Schätzung des Körperschwerpunkts.',
  'Drehwinkel (Schulter, Hüfte) sind aus einer Kamera nur grob schätzbar. 3D-Systeme wie Sportsbox rechnen aus einem Video ein Körpermodell; die Beta nutzt dazu die einfacheren 3D-Schätzwerte der Posenerkennung.',
  'Die Kamera muss ruhig stehen (Stativ) und den ganzen Körper inklusive Füße zeigen. Schnelle Hände verwischen im Treffmoment, besonders bei 30 Bildern pro Sekunde; Zeitlupe (120/240 fps) hilft.',
  'Grenzwerte sind Startwerte aus der Literatur und noch nicht an echten Videos abgestimmt. Ein Hinweis ist ein Anlass zum Hinschauen, kein Urteil.'
];
