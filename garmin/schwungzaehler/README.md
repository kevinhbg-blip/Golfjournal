# Schwungzähler für die Garmin Approach S70

Connect-IQ-App, die auf der Range Schwünge pro Schläger zählt. Den Schläger wählst du vor dem Schlag auf der Uhr aus, den Schwung erkennt der Beschleunigungssensor am Handgelenk.

## Bedienung

| Taste / Geste | Wirkung |
| --- | --- |
| Hoch / Runter oder Wischen | Schläger wechseln |
| Antippen | nächster Schläger (linkes Drittel: vorheriger) |
| Start | Zählen pausieren / fortsetzen |
| Zurück | letzten Schwung löschen (Probeschwung); ohne Schwung: App verlassen |
| Hoch lang drücken | Menü: Letzten löschen, Empfindlichkeit, Einheit speichern, App beenden |

Jeder gezählte Schwung vibriert kurz. Unten steht die Spitze des letzten Schwungs in g und der Live-Wert. Damit lässt sich die Empfindlichkeit abstimmen:

- **Hoch:** ab 2,5 g
- **Mittel:** ab 3,5 g (Standard)
- **Niedrig:** ab 5 g

Zwischen zwei Schwüngen liegen mindestens 2,5 Sekunden. Die Zähler bleiben erhalten, wenn du die App verlässt. „Einheit speichern“ legt die Einheit auf der Uhr ab (die letzten 30) und setzt die Zähler zurück.

## Auf die Uhr bringen (Windows)

Einmalig einrichten:

1. **Connect IQ SDK Manager** installieren: https://developer.garmin.com/connect-iq/sdk/ . Mit dem Garmin-Konto anmelden, das neueste SDK laden und unter „Devices“ die **Approach S70** (42 und 47 mm) laden.
2. **Visual Studio Code** installieren und darin die Erweiterung **Monkey C** (von Garmin).
3. In VS Code `Strg+Umschalt+P` → **Monkey C: Generate a Developer Key**.

Bauen und aufspielen:

1. In VS Code den Ordner `garmin/schwungzaehler` öffnen.
2. `Strg+Umschalt+P` → **Monkey C: Build for Device** → `approachs7042mm` oder `approachs7047mm` wählen (je nach Gehäusegröße). Es entsteht eine Datei `schwungzaehler.prg`.
3. Die Uhr per USB anschließen. Im Explorer erscheint sie als Gerät. Die `.prg`-Datei in den Ordner `GARMIN\APPS` kopieren.
4. Uhr abstecken. Die App erscheint in der Liste der Connect-IQ-Apps.

Zum Ausprobieren ohne Uhr: **Monkey C: Run** startet den Simulator. Schwünge kann der Simulator allerdings nicht echt nachstellen.

## Noch nicht enthalten

Übertragung der gespeicherten Einheiten in die Trainingslog-App (über Garmin Connect Mobile an Supabase).
