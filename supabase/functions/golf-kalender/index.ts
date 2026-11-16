// Edge Function "golf-kalender": Kalender-Sync zwischen Golf-Trainingslog und iPhone.
//   GET ?t=<token>        → Kalender-Feed (.ics) mit allen geplanten Trainings. Am iPhone als Kalender-Abo eingetragen.
//   GET ?t=<token>&src=1  → holt den öffentlichen iCloud-Kalender, den der Benutzer in der App hinterlegt hat (für die App).
// Der token steht in Tabelle golf_cal (supabase-kalender.sql). Die Funktion muss ohne JWT-Prüfung laufen,
// weil die Kalender-App am iPhone keinen Login mitschickt ("Verify JWT" aus, siehe README).

const SB = Deno.env.get('SUPABASE_URL') ?? '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
// Nur diese Kalender-Server werden abgefragt, damit die Funktion kein offener Proxy ist.
const HOSTS = [/\.icloud\.com$/, /^calendar\.google\.com$/, /^outlook\.(live|office365)\.com$/, /^outlook\.office\.com$/];

const z = (n: number) => String(n).padStart(2, '0');
const esc = (t: unknown) => String(t).replace(/[\\;,]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
const BD = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

// Lange Zeilen nach RFC 5545 umbrechen.
function fold(l: string) {
  const out: string[] = [];
  while (l.length > 70) { out.push(l.slice(0, 70)); l = ' ' + l.slice(70); }
  out.push(l);
  return out.join('\r\n');
}

// Gleiche Logik wie ics() in index.html, aber ohne Browser: Zeiten bleiben "floating" (Ortszeit des iPhones).
export function icsFeed(D: any, now = new Date()) {
  const S0 = D && Array.isArray(D.s) ? D.s : [], P = D && Array.isArray(D.p) ? D.p : [];
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const loc = (d: string, t: string) => d.replace(/-/g, '') + 'T' + (t || '18:00').replace(':', '') + '00';
  const addMin = (d: string, t: string, m: number) => {
    const [y, mo, da] = d.split('-').map(Number), [h, mi] = (t || '18:00').split(':').map(Number);
    const x = new Date(Date.UTC(y, mo - 1, da, h, mi + (m || 60)));
    return `${x.getUTCFullYear()}${z(x.getUTCMonth() + 1)}${z(x.getUTCDate())}T${z(x.getUTCHours())}${z(x.getUTCMinutes())}00`;
  };
  const ev = P.map((p: any) => {
    if (!p || !/^\d{4}-\d\d-\d\d$/.test(p.d || '')) return '';
    const S = (p.ids || [p.sid]).map((id: string) => S0.find((s: any) => s.id === id)).filter(Boolean);
    if (!S.length) return '';
    const title = S.length === 1 ? S[0].title : 'Trainingseinheit: ' + S.map((s: any) => s.title).join(', ');
    const r = p.rep || '';
    const rr = r ? 'RRULE:FREQ=' + (r === 'd' ? 'DAILY' : 'WEEKLY') + (r === 'wd' ? ';BYDAY=' + (p.wd || []).map((i: number) => BD[i]).join(',') : '') + (p.to ? ';UNTIL=' + p.to.replace(/-/g, '') + 'T235959' : '') : '';
    return ['BEGIN:VEVENT', 'UID:' + p.id + '@golflog', 'DTSTAMP:' + stamp, 'DTSTART:' + loc(p.d, p.t), 'DTEND:' + addMin(p.d, p.t, p.dur), rr,
      ...(p.x || []).map((x: string) => 'EXDATE:' + loc(x, p.t)),
      'SUMMARY:' + esc('Golf: ' + title),
      'DESCRIPTION:' + esc(S.map((s: any) => s.title + (s.task ? ' – ' + s.task : '')).join('\n')),
      'END:VEVENT'].filter(Boolean).map(fold).join('\r\n');
  }).filter(Boolean);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Golflog//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Golf-Training', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

async function db(path: string) {
  const h: Record<string, string> = { apikey: KEY };
  if (KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + KEY;
  const r = await fetch(SB + '/rest/v1/' + path, { headers: h });
  if (!r.ok) throw new Error('db ' + r.status);
  return await r.json();
}

const txt = (s: string, status = 200) => new Response(s, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
const cal = (s: string) => new Response(s, { headers: { ...CORS, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Disposition': 'inline; filename="golf-training.ics"' } });

export async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'HEAD') return txt('Nur GET', 405);
  const u = new URL(req.url), t = (u.searchParams.get('t') || '').replace(/\.ics$/, '');
  if (!/^[a-f0-9]{32,64}$/.test(t)) return txt('Ungültiger Link', 404);
  try {
    const [c] = await db('golf_cal?select=user_id,src&token=eq.' + t);
    if (!c) return txt('Link nicht mehr gültig', 404);
    if (u.searchParams.has('src')) {
      if (!c.src) return txt('Kein iPhone-Kalender hinterlegt', 404);
      const s = new URL(String(c.src).replace(/^webcals?:/i, 'https:'));
      if (s.protocol !== 'https:' || !HOSTS.some((h) => h.test(s.hostname))) return txt('Dieser Kalender-Server wird nicht unterstützt', 400);
      const r = await fetch(s, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const f = new URL(r.url || s.href);
      if (!HOSTS.some((h) => h.test(f.hostname))) return txt('Umleitung zu fremdem Server', 400);
      if (!r.ok) return txt('Kalender nicht erreichbar (' + r.status + ')', 502);
      const body = await r.text();
      if (!/BEGIN:VCALENDAR/.test(body)) return txt('Der Link liefert keinen Kalender', 502);
      return cal(body.slice(0, 3_000_000));
    }
    const [g] = await db('golflog?select=data&user_id=eq.' + c.user_id);
    return cal(icsFeed(g && g.data));
  } catch (e) {
    return txt('Fehler: ' + ((e as Error).message || e), 500);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) Deno.serve(handle);
