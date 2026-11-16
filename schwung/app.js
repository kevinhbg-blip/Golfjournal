// Schwunganalyse (Beta) – Bedienung, Posenerkennung und Markierungen im Video.
import { analyse, INFO, LIMITS } from './analyse.js';

const $ = id => document.getElementById(id);
const vid = $('vid'), ov = $('ov'), stage = $('stage');
const PH = { addr: 'Ansprechen', top: 'Top', imp: 'Treffmoment', fin: 'Finish' };
const SEV = { 2: 'Deutlich', 1: 'Leicht', 0: 'OK' };
const COL = { ref: '#ffffff', bad: '#ff4d4f', good: '#5ee07a', p1: '#4da3ff', p2: '#ffad33' };
const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [27, 29], [28, 30]];
const HKEY = 'golfswing.v1';

let file = null, url = null, landmarker = null, tsBase = 0;
let R = null;            // Analyse-Ergebnis
let sel = -1;            // gewählte Prüfung
let show = { skel: true, ghost: false, path: false };
let drawMode = false, lines = [], drag = null;
let segEnd = null;

function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2600); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = t => t.toFixed(2).replace('.', ',') + ' s';

// ---------- Einstellungen merken ----------
try { const s = JSON.parse(localStorage.getItem(HKEY + '.opt') || '{}'); for (const k of ['hand', 'view', 'club']) if (s[k]) $(k).value = s[k]; } catch (e) {}
for (const k of ['hand', 'view', 'club']) $(k).addEventListener('change', () => { try { localStorage.setItem(HKEY + '.opt', JSON.stringify({ hand: $('hand').value, view: $('view').value, club: $('club').value })); } catch (e) {} });

$('file').addEventListener('change', e => {
  file = e.target.files[0] || null;
  $('fname').textContent = file ? file.name + ' · ' + (file.size / 1048576).toFixed(1) + ' MB' : '';
  $('go').disabled = !file;
});
$('go').addEventListener('click', run);
$('again').addEventListener('click', () => { $('res').hidden = true; $('start').hidden = false; $('errBox').innerHTML = ''; window.scrollTo(0, 0); });

// ---------- Posenerkennung ----------
async function loadModel(prog) {
  if (landmarker) return landmarker;
  prog('Lade Posenerkennung (einmalig ca. 30 MB) …', 0.02);
  const { FilesetResolver, PoseLandmarker } = await import('./mp/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks(new URL('./mp/wasm', import.meta.url).href);
  const base = { modelAssetPath: new URL('./mp/pose_landmarker_full.task', import.meta.url).href };
  const o = d => ({ baseOptions: { ...base, delegate: d }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { landmarker = await PoseLandmarker.createFromOptions(fs, o('GPU')); }
  catch (e) { console.warn('GPU nicht verfügbar, nutze CPU', e); landmarker = await PoseLandmarker.createFromOptions(fs, o('CPU')); }
  return landmarker;
}

function seek(t) {
  return new Promise(res => {
    let done = false; const fin = () => { if (done) return; done = true; vid.removeEventListener('seeked', fin); res(); };
    vid.addEventListener('seeked', fin); setTimeout(fin, 1500);
    vid.currentTime = t;
  });
}
const frameReady = () => new Promise(r => (vid.requestVideoFrameCallback ? (vid.requestVideoFrameCallback(() => r()), setTimeout(r, 120)) : requestAnimationFrame(() => r())));

async function run() {
  if (!file) return;
  $('errBox').innerHTML = '';
  const prog = (s, p) => { $('progS').textContent = s; if (p != null) $('progB').style.width = Math.round(p * 100) + '%'; };
  $('prog').hidden = false; $('start').hidden = true; $('res').hidden = true;
  $('progT').textContent = 'Analyse läuft …';
  try {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    vid.src = url; vid.muted = true;
    // iOS dekodiert Bilder erst nach einem Abspielversuch
    try { await vid.play(); vid.pause(); } catch (e) {}
    if (vid.readyState < 1) await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = () => rej(new Error('Video lässt sich nicht öffnen.')); setTimeout(res, 8000); });
    if (!vid.videoWidth) throw new Error('Das Video lässt sich in diesem Browser nicht öffnen.');
    if (window.__inject) return finish(window.__inject, 1 / 30); // nur für automatisierte Tests
    await loadModel(prog);
    const dur = Math.min(vid.duration || 0, 15);
    if (!(dur > 0.5)) throw new Error('Das Video ist zu kurz.');
    if (vid.duration > 15.5) toast('Video länger als 15 s: nur die ersten 15 s werden analysiert.');
    const W = vid.videoWidth, Hh = vid.videoHeight, k = Math.min(1, 720 / Math.max(W, Hh));
    const cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(Hh * k);
    const cx = cv.getContext('2d', { willReadFrequently: false });
    const step = Math.max(1 / 60, dur / 480);
    const frames = []; const t0 = performance.now();
    for (let t = 0; t <= dur + 1e-6; t += step) {
      await seek(t); await frameReady();
      cx.drawImage(vid, 0, 0, cv.width, cv.height);
      tsBase += Math.max(1, Math.round(step * 1000));
      const r = landmarker.detectForVideo(cv, tsBase);
      const lm = r.landmarks && r.landmarks[0], wl = r.worldLandmarks && r.worldLandmarks[0];
      frames.push({ t: vid.currentTime || t, p: lm ? lm.map(q => [q.x * W, q.y * Hh, q.visibility ?? 1]) : null, w: wl ? wl.map(q => [q.x, q.y, q.z]) : null });
      const pr = t / dur, el = (performance.now() - t0) / 1000;
      prog(`Bild ${frames.length} von ${Math.floor(dur / step) + 1}` + (pr > 0.05 ? ` · noch ca. ${Math.max(1, Math.round(el / pr - el))} s` : ''), 0.05 + 0.95 * pr);
    }
    finish(frames, step);
  } catch (e) {
    console.error(e);
    $('prog').hidden = true;
    showErr('Fehler: ' + (e.message || e) + ' Tipp: Safari aktuell halten; bei sehr großen Videos vorher in der Fotos-App kürzen.');
  }
}
function finish(frames, step) {
  const found = frames.filter(f => f.p).length;
  R = analyse(frames, { hand: $('hand').value, view: $('view').value, club: $('club').value });
  R.found = found; R.total = frames.length; R.step = step;
  $('prog').hidden = true;
  if (!R.ok) { showErr(R.error + (found < frames.length * 0.6 ? ` (Person nur in ${found} von ${frames.length} Bildern erkannt.)` : '')); return; }
  saveHist();
  render();
}
function showErr(t) { $('errBox').innerHTML = `<div class="err">${esc(t)}</div>`; $('start').hidden = false; }

// ---------- Ergebnis anzeigen ----------
function render() {
  $('res').hidden = false; $('start').hidden = true;
  sel = -1; lines = []; setDraw(false);
  fitStage();
  const I = R.idx, T = R.t;
  $('phases').innerHTML = Object.entries(PH).map(([k, n]) => `<button class="chip" data-ph="${k}">${n} · ${fmtT(T[I[k]])}</button>`).join('');
  const faults = R.checks.filter(c => c.sev > 0), oks = R.checks.filter(c => c.sev === 0), nas = R.checks.filter(c => c.sev < 0);
  $('sumT').textContent = faults.length ? `${faults.length} Hinweis${faults.length > 1 ? 'e' : ''} gefunden` : 'Keine Auffälligkeiten gefunden';
  $('sumS').textContent = `Perspektive: ${R.view === 'fo' ? 'frontal' : 'von hinten'}${R.view !== R.viewAuto ? ' (manuell gewählt)' : ' (erkannt)'} · Person in ${R.found} von ${R.total} Bildern erkannt · Tippe auf einen Hinweis, um ihn im Video zu sehen.`;
  $('notes').innerHTML = R.notes.map(n => `<div class="note">${esc(n)}</div>`).join('') + (R.found < R.total * 0.8 ? `<div class="note">Die Person wurde nicht in allen Bildern erkannt; Ergebnisse können ungenau sein.</div>` : '');
  $('faults').innerHTML = faults.map(c => card(c)).join('');
  $('okT').textContent = `Ohne Befund (${oks.length})` + (nas.length ? ` · nicht prüfbar (${nas.length})` : '');
  $('oks').innerHTML = oks.map(c => card(c)).join('') + nas.map(c => `<div class="okl">${esc(INFO[c.id]?.n || c.id)}: nicht prüfbar (Körperteil verdeckt)</div>`).join('');
  $('met').innerHTML = R.metrics.map(m => `<tr><td>${esc(m.label)}<small>${esc(m.note || '')}</small></td><td>${esc(m.val)}</td></tr>`).join('');
  $('limits').innerHTML = LIMITS.map(l => `<li>${esc(l)}</li>`).join('');
  // Zeitleiste
  const D = vid.duration || T[T.length - 1];
  $('tl').querySelectorAll('.mk,.fd').forEach(e => e.remove());
  for (const [k, n] of Object.entries({ addr: 'A', top: 'T', imp: 'I', fin: 'F' })) {
    const e = document.createElement('span'); e.className = 'mk'; e.textContent = n; e.style.left = (T[R.idx[k]] / D * 100) + '%'; $('tl').appendChild(e);
  }
  for (const c of faults) { const e = document.createElement('span'); e.className = 'fd'; e.style.background = c.sev === 2 ? '#d64545' : '#d9822b'; e.style.left = (T[c.frame] / D * 100) + '%'; $('tl').appendChild(e); }
  $('wbar').style.display = R.com ? 'flex' : 'none';
  vid.playbackRate = +$('rate').value;
  seekTo(T[I.addr]);
  if (faults[0]) select(R.checks.indexOf(faults[0]), false);
}

function card(c) {
  const i = R.checks.indexOf(c), inf = INFO[c.id] || { n: c.id };
  const name = c.sev === 0 && inf.ok ? inf.ok : inf.n;
  const body = c.sev > 0 && inf.was ? `<div class="more" hidden>
    <p><b>Was passiert:</b> ${esc(inf.was)}</p>
    <p><b>Folge:</b> ${esc(inf.folge)}</p>
    <p><b>So geht's richtig:</b> ${esc(inf.richtig)}</p>
    <b>Übungen:</b><ol>${inf.drills.map(d => `<li>${esc(d)}</li>`).join('')}</ol>
    <button class="btn" data-slow="${i}">▶︎ Stelle in Zeitlupe zeigen</button></div>` : '<div class="more" hidden></div>';
  return `<div class="fault s${c.sev}" data-i="${i}"><div class="fh"><span class="badge">${SEV[c.sev]}</span><b>${esc(name)}</b><span class="mut">${esc(inf.ph || '')} · ${fmtT(R.t[c.frame])}</span></div><div class="val">Messwert: ${esc(c.val)}</div>${body}</div>`;
}

document.addEventListener('click', e => {
  const sl = e.target.closest('[data-slow]');
  if (sl) { e.stopPropagation(); playAround(+sl.dataset.slow); return; }
  const f = e.target.closest('.fault');
  if (f) { select(+f.dataset.i, true); return; }
  const ph = e.target.closest('[data-ph]');
  if (ph) { sel = -1; markSel(); vid.pause(); seekTo(R.t[R.idx[ph.dataset.ph]]); return; }
  const tl = e.target.closest('[data-t]');
  if (tl) tool(tl.dataset.t, tl);
});

function select(i, scroll) {
  const was = sel === i;
  sel = i; markSel();
  document.querySelectorAll('.fault .more').forEach(m => { m.hidden = true; });
  const el = document.querySelector(`.fault[data-i="${i}"] .more`);
  if (el && !(was && scroll && !el.hidden)) el.hidden = false;
  vid.pause(); segEnd = null;
  seekTo(R.t[R.checks[i].frame]);
  if (scroll) $('stageWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function markSel() { document.querySelectorAll('.fault').forEach(e => e.classList.toggle('sel', +e.dataset.i === sel)); }

function playAround(i) {
  const c = R.checks[i]; sel = i; markSel();
  const t = R.t[c.frame];
  vid.playbackRate = 0.25; $('rate').value = '0.25';
  seekTo(Math.max(0, t - 0.6)).then(() => { segEnd = t; vid.play(); });
  $('stageWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function tool(t, el) {
  if (t === 'skel' || t === 'ghost' || t === 'path') { show[t] = !show[t]; el.classList.toggle('on', show[t]); draw(); }
  else if (t === 'draw') setDraw(!drawMode);
  else if (t === 'clear') { lines = []; draw(); }
  else if (t === 'snap') snap();
}
function setDraw(on) {
  drawMode = on; ov.classList.toggle('draw', on);
  const b = document.querySelector('[data-t="draw"]'); if (b) b.classList.toggle('on', on);
  if (on) { vid.pause(); toast('Mit dem Finger eine Linie ziehen (z. B. entlang des Schafts).'); }
}

// ---------- Video-Steuerung ----------
function seekTo(t) { return seek(Math.max(0, Math.min(t, (vid.duration || t) - 0.001))).then(draw); }
$('bPlay').onclick = () => { segEnd = null; if (vid.paused) { if (vid.ended || vid.currentTime >= vid.duration - 0.05) vid.currentTime = 0; vid.play(); } else vid.pause(); };
$('bPrev').onclick = () => { vid.pause(); seekTo(vid.currentTime - (R?.step || 1 / 30)); };
$('bNext').onclick = () => { vid.pause(); seekTo(vid.currentTime + (R?.step || 1 / 30)); };
$('rate').onchange = () => { vid.playbackRate = +$('rate').value; };
$('seek').oninput = () => { vid.pause(); vid.currentTime = (+$('seek').value / 1000) * (vid.duration || 0); };
vid.addEventListener('play', () => { $('bPlay').textContent = '❚❚'; loop(); });
vid.addEventListener('pause', () => { $('bPlay').textContent = '▶︎'; draw(); });
vid.addEventListener('seeked', draw);
ov.addEventListener('click', () => { if (!drawMode) $('bPlay').onclick(); });
function loop() {
  if (segEnd != null && vid.currentTime >= segEnd) { vid.pause(); segEnd = null; }
  draw();
  if (!vid.paused) requestAnimationFrame(loop);
}
window.addEventListener('resize', () => { if (R && R.ok) { fitStage(); draw(); } });

function fitStage() {
  const W = vid.videoWidth || 16, H = vid.videoHeight || 9;
  const maxW = Math.min(stage.parentElement.clientWidth - 32 > 0 ? stage.parentElement.clientWidth - 32 : 320, 728);
  const maxH = Math.max(220, window.innerHeight * 0.48);
  const s = Math.min(maxW / W, maxH / H);
  stage.style.width = Math.round(W * s) + 'px'; stage.style.height = Math.round(H * s) + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ov.width = Math.round(W * s * dpr); ov.height = Math.round(H * s * dpr);
}

function frameAt(t) {
  const T = R.t; let lo = 0, hi = T.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
  return Math.abs(T[hi] - t) < Math.abs(T[lo] - t) ? hi : lo;
}

// ---------- Zeichnen ----------
function draw() {
  if (!R || !R.ok) return;
  const D = vid.duration || 1;
  $('seek').value = Math.round(vid.currentTime / D * 1000);
  const ctx = ov.getContext('2d');
  paint(ctx, ov.width / vid.videoWidth, vid.currentTime);
  if (R.com) { const i = frameAt(vid.currentTime); $('wbar').querySelector('i').style.left = (6 + R.com[i] * 88) + '%'; }
}

function paint(ctx, s, time) {
  const W = ctx.canvas.width, Hh = ctx.canvas.height;
  ctx.clearRect(0, 0, W, Hh); ctx.__lab = [];
  const i = frameAt(time), F = R.frames, lw = Math.max(2, W / 260);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const X = p => [p[0] * s, p[1] * s];
  if (show.ghost) skeleton(ctx, F[R.idx.addr].p, s, lw, 'rgba(255,255,255,.45)', 'rgba(255,255,255,.45)');
  if (show.path) {
    const I = R.idx, end = Math.min(i, I.fin);
    poly(ctx, R.hands.slice(I.take, Math.min(end, I.top) + 1).map(X), COL.p1, lw);
    if (end > I.top) poly(ctx, R.hands.slice(I.top, end + 1).map(X), COL.p2, lw);
  }
  if (show.skel) skeleton(ctx, F[i].p, s, lw, R.lead === 'l' ? '#b9e56e' : '#6ec3e5', R.lead === 'l' ? '#6ec3e5' : '#b9e56e');
  if (sel >= 0) {
    const c = R.checks[sel], near = Math.abs(R.t[c.frame] - time) < 0.12;
    ctx.globalAlpha = near ? 1 : 0.55;
    for (const p of c.prims) prim(ctx, p, s, lw * 1.3);
    ctx.globalAlpha = 1;
  }
  for (const l of lines.concat(drag ? [drag] : [])) userLine(ctx, l, s, lw);
}

function skeleton(ctx, p, s, lw, cl, cr) {
  if (!p) return;
  ctx.lineWidth = lw;
  for (const [a, b] of BONES) {
    if (p[a][2] < 0.3 || p[b][2] < 0.3) continue;
    ctx.strokeStyle = (a % 2 && b % 2) ? cl : (!(a % 2) && !(b % 2)) ? cr : 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.moveTo(p[a][0] * s, p[a][1] * s); ctx.lineTo(p[b][0] * s, p[b][1] * s); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (const j of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) if (p[j][2] >= 0.3) { ctx.beginPath(); ctx.arc(p[j][0] * s, p[j][1] * s, lw * 1.1, 0, 7); ctx.fill(); }
}
function poly(ctx, pts, c, lw, dash) {
  if (pts.length < 2) return;
  ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.setLineDash(dash ? [lw * 3, lw * 2.5] : []);
  ctx.beginPath(); pts.forEach((q, k) => k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.setLineDash([]);
}
function label(ctx, txt, x, y, c, lw) {
  if (!txt) return;
  ctx.font = `600 ${Math.round(lw * 5.5)}px system-ui,-apple-system,sans-serif`;
  const w = ctx.measureText(txt).width + lw * 3, h = lw * 7.5;
  x = Math.max(2, Math.min(ctx.canvas.width - w - 2, x)); y = Math.max(h + 2, Math.min(ctx.canvas.height - 2, y));
  // nicht über bereits gesetzte Beschriftungen legen
  const P = ctx.__lab || (ctx.__lab = []);
  for (let k = 0; k < 8 && P.some(r => x < r[0] + r[2] && x + w > r[0] && y - h < r[1] && y > r[1] - r[3]); k++) y += h + 3;
  P.push([x, y, w, h]);
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = c; ctx.fillText(txt, x + lw * 1.5, y - lw * 2);
}
function prim(ctx, p, s, lw) {
  const c = COL[p.c] || '#fff', S = q => [q[0] * s, q[1] * s];
  if (p.k === 'line') { const a = S(p.a), b = S(p.b); poly(ctx, [a, b], c, lw, p.dash); label(ctx, p.label, Math.min(a[0], b[0]) + lw * 2, Math.min(a[1], b[1]) + lw * 2, c, lw); }
  else if (p.k === 'arrow') {
    const a = S(p.a), b = S(p.b); poly(ctx, [a, b], c, lw);
    const an = Math.atan2(b[1] - a[1], b[0] - a[0]), h = lw * 4;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > h) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - h * Math.cos(an - 0.45), b[1] - h * Math.sin(an - 0.45)); ctx.lineTo(b[0] - h * Math.cos(an + 0.45), b[1] - h * Math.sin(an + 0.45)); ctx.fill(); }
  }
  else if (p.k === 'poly') { poly(ctx, p.pts.map(S), c, lw); if (p.label) { const q = S(p.pts[Math.floor(p.pts.length / 2)]); label(ctx, p.label, q[0] + lw * 2, q[1], c, lw); } }
  else if (p.k === 'circle') { const a = S(p.at); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.setLineDash(p.dash ? [lw * 3, lw * 2.5] : []); ctx.beginPath(); ctx.arc(a[0], a[1], p.r * s, 0, 7); ctx.stroke(); ctx.setLineDash([]); label(ctx, p.label, a[0] - p.r * s, a[1] - p.r * s - lw, c, lw); }
  else if (p.k === 'dot') { const a = S(p.at); ctx.fillStyle = c; ctx.strokeStyle = '#000'; ctx.lineWidth = lw / 2; ctx.beginPath(); ctx.arc(a[0], a[1], lw * 3, 0, 7); ctx.fill(); ctx.stroke(); label(ctx, p.label, a[0] + lw * 4, a[1] - lw * 2, c, lw); }
  else if (p.k === 'angle') {
    const [a, b, d] = p.p.map(S);
    poly(ctx, [a, b, d], c, lw * 1.2);
    const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]), a2 = Math.atan2(d[1] - b[1], d[0] - b[0]);
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    ctx.beginPath(); ctx.arc(b[0], b[1], lw * 7, a1, a1 + da, da < 0); ctx.stroke();
    label(ctx, p.label, b[0] + lw * 8, b[1] + lw * 2, c, lw);
  }
}
function userLine(ctx, l, s, lw) {
  const a = [l.a[0] * s, l.a[1] * s], b = [l.b[0] * s, l.b[1] * s];
  poly(ctx, [a, b], '#ffe14d', lw);
  let an = Math.abs(Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]) * 180 / Math.PI); if (an > 90) an = 180 - an;
  label(ctx, Math.round(an) + '° zur Waagrechten', b[0] + lw * 2, b[1], '#ffe14d', lw);
}

// Linien-Werkzeug (Koordinaten im Videobild)
const vpt = e => { const r = ov.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * vid.videoWidth, (e.clientY - r.top) / r.height * vid.videoHeight]; };
ov.addEventListener('pointerdown', e => { if (!drawMode) return; e.preventDefault(); ov.setPointerCapture(e.pointerId); const p = vpt(e); drag = { a: p, b: p }; });
ov.addEventListener('pointermove', e => { if (!drag) return; drag.b = vpt(e); draw(); });
ov.addEventListener('pointerup', () => { if (!drag) return; if (Math.hypot(drag.b[0] - drag.a[0], drag.b[1] - drag.a[1]) > 8) lines.push(drag); drag = null; draw(); });

// Standbild mit Markierungen teilen
async function snap() {
  vid.pause();
  const k = Math.min(1, 1600 / Math.max(vid.videoWidth, vid.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.round(vid.videoWidth * k); c.height = Math.round(vid.videoHeight * k);
  const ctx = c.getContext('2d'); ctx.drawImage(vid, 0, 0, c.width, c.height);
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  paint(o.getContext('2d'), k, vid.currentTime); ctx.drawImage(o, 0, 0);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  const name = 'schwung-' + new Date().toISOString().slice(0, 10) + '.jpg';
  const f = new File([blob], name, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Schwunganalyse' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- Verlauf (nur Ergebnisse, kein Video) ----------
function loadHist() { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; } }
function saveHist() {
  const h = loadHist();
  h.unshift({ d: Date.now(), f: file?.name || '', v: R.view, c: R.club, x: R.checks.filter(c => c.sev > 0).map(c => [c.id, c.sev, c.val]), m: R.metrics.map(m => [m.label, m.val]) });
  try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 30))); } catch (e) {}
  renderHist();
}
function renderHist() {
  const h = loadHist(); $('histC').hidden = !h.length;
  const CL = { driver: 'Driver', holz: 'Holz', eisen: 'Eisen', wedge: 'Wedge' };
  $('hist').innerHTML = h.slice(0, 10).map(e => `<div class="hist"><b>${new Date(e.d).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}</b> · ${e.v === 'fo' ? 'frontal' : 'von hinten'} · ${CL[e.c] || ''}<br><span class="mut">${e.x.length ? e.x.map(x => esc((INFO[x[0]]?.n || x[0]) + (x[1] === 2 ? ' (deutlich)' : ''))).join(', ') : 'keine Auffälligkeiten'}</span></div>`).join('');
}
renderHist();

// Für automatisierte Tests
window.__swing = { get R() { return R; }, analyse };
