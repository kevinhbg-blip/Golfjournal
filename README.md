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
| `supabase-coach.sql` | Trainer-Freigabe und Trainer-Übersicht (einmal ausführen) |

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

## Trainer-Übersicht

Ein Spieler gibt seine Trainingsdaten über ☁ → „Trainer freigeben“ für den Benutzernamen
seines Trainers frei. Der Trainer öffnet ☁ → „Trainer-Übersicht“ (oder die Karte auf der
Startseite). Oben wählt er den Reiter „Übersicht“ oder eine Kategorie. Unter „⚙ Anzeige“
legt er fest, welche Kategorien und Abschnitte er sehen will (gespeichert in seinem Konto).
Er sieht je Spieler Einheiten, Trainingszeit, Trefferquoten je Bereich und
Übung, die Entwicklung pro Woche bzw. Monat, Schlag- und Rundenwerte, Pelz-Tests und die
letzten Einheiten. Der Zugriff ist nur lesend, das Tagebuch wird nicht übertragen. Die
Freigabe kann der Spieler jederzeit entfernen. Voraussetzung: `supabase-coach.sql` einmal im
SQL Editor ausführen.

## Launchmonitor-Import

Den eigenen Launchmonitor (Foresight, TrackMan, FlightScope, Garmin, Uneekor, Bushnell, SkyTrak, Rapsodo, Full Swing, Square Golf …) wählt man unter „Datensicherung & Einstellungen“ (`D.lm`). Analyse → Reiter „Launchmonitor“ → CSV-Datei wählen. Gelesen wird der CSV-Export aus FSX
(„Shot Analysis“ mit einem Block je Schläger, z. B. `Gw`, `7i`, `Dr,Epic`) und auch eine
einfache Tabelle mit Schläger-Spalte. Vor dem Import lassen sich Datum, Einheiten der Datei
(Yards/mph/Fuß oder Meter) und die Zuordnung zu den Schlägern der App prüfen. Gespeichert
wird metrisch in `D.gq`; die Anzeige wechselt zwischen Meter/km/h und Yards/mph. Gezeigt
werden Bälle je Schläger (getrennt nach Modell), Ø Carry/Gesamt/seitlich, Streuungsbild und
Ballflug- bzw. Schlägerdaten. Fehlende Schlägerdaten (0,0) werden ignoriert. Das „Streubild alle
Schläger“ zeigt alle Bälle farbig mit Ellipse je Schläger (wie FSX „Dispersion“); Schläger lassen
sich ein- und ausblenden, ein angetippter Ball zeigt seine Daten.

In der übrigen Analyse zählen Launchmonitor-Bälle mit Driver und 3er-Holz als Drives (Fairway-Quote,
Streuung, Miss-Tendenz). Die anderen Schläger erscheinen als „Transportschläge & Wedges laut Launchmonitor“
mit Miss-Tendenz (Mitte = seitlich innerhalb 10 % der Carry-Distanz), in der Schlägerstatistik,
in der Übersicht und auf der Startseite. Der Schalter „Launchmonitor-Schläge einbeziehen“ (`D.gqIn`)
blendet sie aus. In die Zielzonen-Quote fließen sie nicht ein, weil der Launchmonitor kein Ziel kennt.

Oben in der Analyse wählt man unter „Launchmonitor-Sessions“ aus, welche Sessions zählen (`D.gqOff`
= abgewählte), und unter „Zielkorridor“ die Breite für Drives (Standard 30 m) und
Transportschläge (Hölzer, Hybride, Eisen 3–9; leer = 10 % der Carry-Distanz) in `D.cor`.
Danach richten sich Fairway-Quote, Miss-Tendenz und die Übersicht.
