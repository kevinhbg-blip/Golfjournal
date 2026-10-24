import Toybox.Application;
import Toybox.Attention;
import Toybox.Lang;
import Toybox.Math;
import Toybox.Sensor;
import Toybox.System;
import Toybox.Time;
import Toybox.WatchUi;

// Schlägerliste wie in der Trainingslog-App (ohne Putter)
const CLUBS = ["Driver", "3er-Holz", "7er", "8er", "9er", "PW", "GW", "SW", "LW"];
// Schwellwerte in milli-g: hohe, mittlere, niedrige Empfindlichkeit
const THRESH = [2500, 3500, 5000];
const SENS_NAMES = ["Hoch", "Mittel", "Niedrig"];
// Mindestabstand zwischen zwei Schwüngen in ms
const GAP_MS = 2500;

class SwingModel {
    var club = 0;
    var counts;
    var hist = [];      // Schlägerindex je gezähltem Schwung, für "Löschen"
    var t0 = 0;         // Start der Einheit (Sekunden seit 1970), 0 = noch kein Schwung
    var sens = 1;
    var paused = false;
    var lastSwingMs = -100000;
    var lastPeak = 0;   // Spitze des letzten gezählten Schwungs in mg
    var livePeak = 0;   // Spitze der letzten Sekunde in mg

    function initialize() {
        counts = newCounts();
        var s = Application.Storage.getValue("sens");
        if (s != null) { sens = s; }
        var cur = Application.Storage.getValue("cur");
        if (cur != null && cur["c"] != null && cur["c"].size() == CLUBS.size()) {
            counts = cur["c"];
            t0 = cur["t"];
            club = cur["k"];
            if (cur["h"] != null) { hist = cur["h"]; }
        }
    }

    function newCounts() {
        var c = new [CLUBS.size()];
        for (var i = 0; i < c.size(); i++) { c[i] = 0; }
        return c;
    }

    function start() {
        var rate = 25;
        if (Sensor has :getMaxSampleRate) {
            var m = Sensor.getMaxSampleRate();
            if (m != null && m > rate) { rate = m > 50 ? 50 : m; }
        }
        Sensor.registerSensorDataListener(method(:onData), {
            :period => 1,
            :accelerometer => { :enabled => true, :sampleRate => rate }
        });
    }

    function stop() {
        Sensor.unregisterSensorDataListener();
        persist();
    }

    function onData(data) {
        var a = data.accelerometerData;
        if (a == null || a.x == null) { return; }
        var xs = a.x;
        var ys = a.y;
        var zs = a.z;
        var max = 0;
        for (var i = 0; i < xs.size(); i++) {
            var m = Math.sqrt(xs[i] * xs[i] + ys[i] * ys[i] + zs[i] * zs[i]);
            if (m > max) { max = m; }
        }
        livePeak = max;
        var now = System.getTimer();
        if (!paused && max > THRESH[sens] && now - lastSwingMs > GAP_MS) {
            lastSwingMs = now;
            lastPeak = max;
            addSwing();
        }
        WatchUi.requestUpdate();
    }

    function addSwing() {
        if (t0 == 0) { t0 = Time.now().value(); }
        counts[club] += 1;
        hist.add(club);
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(60, 200)]);
        }
        persist();
    }

    function undo() {
        var n = hist.size();
        if (n == 0) { return false; }
        var c = hist[n - 1];
        hist = hist.slice(0, n - 1);
        if (counts[c] > 0) { counts[c] -= 1; }
        persist();
        return true;
    }

    function nextClub(step) {
        club = (club + step + CLUBS.size()) % CLUBS.size();
        persist();
    }

    function cycleSens() {
        sens = (sens + 1) % THRESH.size();
        Application.Storage.setValue("sens", sens);
    }

    function total() {
        var s = 0;
        for (var i = 0; i < counts.size(); i++) { s += counts[i]; }
        return s;
    }

    function elapsed() {
        return t0 == 0 ? 0 : Time.now().value() - t0;
    }

    function persist() {
        Application.Storage.setValue("cur", { "c" => counts, "t" => t0, "k" => club, "h" => hist });
    }

    // Einheit abschließen: in "sessions" ablegen und Zähler zurücksetzen.
    // Gibt die gespeicherte Einheit zurück oder null, wenn nichts gezählt wurde.
    function finish() {
        if (total() == 0) { return null; }
        var ses = { "t" => t0, "sec" => elapsed(), "c" => counts };
        var all = Application.Storage.getValue("sessions");
        if (all == null) { all = []; }
        all.add(ses);
        // Nur die letzten 30 Einheiten auf der Uhr behalten
        if (all.size() > 30) { all = all.slice(all.size() - 30, null); }
        Application.Storage.setValue("sessions", all);
        counts = newCounts();
        hist = [];
        t0 = 0;
        lastPeak = 0;
        persist();
        return ses;
    }
}
