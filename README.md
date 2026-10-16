# Golf Training

Persönlicher Golf-Trainingslog im Fairway-Design: Übungen für Kurzspiel, Annäherung,
Transportschläge, Drive, Putten sowie Kraft & Mobilität, Trainingsplanung mit
Kalender-Export (.ics), Analyse und Foto-Auswertung mit Ballerkennung.

Reine HTML/JavaScript-App ohne Build-Schritt und ohne Server. Läuft direkt über GitHub Pages.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App |
| `img/*.jpg` | Übungsbilder (30 Renderings) |
| `manifest.webmanifest`, `icons/` | App-Name und Icon für „Zum Home-Bildschirm“ |
| `sw.js` | Offline-Cache, damit die App auch ohne Netz am Platz startet |
| `supabase-setup.sql` | Tabelle für Konto & Cloud-Speicher (einmal im Supabase SQL Editor ausführen) |
| `supabase-feedback.sql` | Tabelle für Feedback, nur für den Administrator Kevspam lesbar (einmal ausführen) |

## Daten

Alle Einträge bleiben im Browser des Geräts (localStorage, Fotos/Videos in IndexedDB).
Es gibt keinen Server und keine Synchronisation zwischen Geräten.
Sicherung: Start → „Datensicherung & Einstellungen“ → „Backup als Datei“.
Wiederherstellen: dort „Backup-Datei laden“.

## Lokal starten

```
python3 -m http.server 8000
```
dann http://localhost:8000 öffnen.

## Feedback

Angemeldete Benutzer schicken über ✉ oben rechts Feedback. Nur der Administrator
(Benutzer `kevspam`) sieht es dort als Nachrichten, mit Zähler für neue Nachrichten.
