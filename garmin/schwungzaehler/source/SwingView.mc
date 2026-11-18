import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Timer;
import Toybox.WatchUi;

class SwingView extends WatchUi.View {
    var model;
    var timer;

    function initialize(m) {
        View.initialize();
        model = m;
    }

    function onShow() {
        timer = new Timer.Timer();
        timer.start(method(:tick), 1000, true);
    }

    function onHide() {
        if (timer != null) { timer.stop(); }
    }

    function tick() {
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        // Zeit und Gesamtzahl oben
        var sec = model.elapsed();
        var tm = (sec / 60).format("%d") + ":" + (sec % 60).format("%02d");
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.12, Graphics.FONT_XTINY,
            tm + "   Gesamt " + model.total(), Graphics.TEXT_JUSTIFY_CENTER);

        // Gewählter Schläger
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.24, Graphics.FONT_MEDIUM, CLUBS[model.club], Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w * 0.12, h * 0.26, Graphics.FONT_SMALL, "<", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(w * 0.88, h * 0.26, Graphics.FONT_SMALL, ">", Graphics.TEXT_JUSTIFY_CENTER);

        // Schwünge mit diesem Schläger
        dc.setColor(model.paused ? Graphics.COLOR_DK_GRAY : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.52, Graphics.FONT_NUMBER_HOT, model.counts[model.club].toString(),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Status unten: Pause oder letzte Spitze, Empfindlichkeit
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        var info;
        if (model.paused) {
            info = "PAUSE";
        } else if (model.lastPeak > 0) {
            info = "Letzter " + (model.lastPeak / 1000.0).format("%.1f") + " g";
        } else {
            info = "Bereit";
        }
        dc.drawText(cx, h * 0.72, Graphics.FONT_XTINY, info, Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY,
            "Empf. " + SENS_NAMES[model.sens] + "  live " + (model.livePeak / 1000.0).format("%.1f"),
            Graphics.TEXT_JUSTIFY_CENTER);
    }
}

// Zusammenfassung nach dem Speichern einer Einheit
class SummaryView extends WatchUi.View {
    var ses;

    function initialize(s) {
        View.initialize();
        ses = s;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        var sum = 0;
        var c = ses["c"];
        for (var i = 0; i < c.size(); i++) { sum += c[i]; }
        dc.drawText(w / 2, h * 0.10, Graphics.FONT_SMALL, "Gespeichert: " + sum, Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        var lh = dc.getFontHeight(Graphics.FONT_XTINY);
        var y = h * 0.25;
        for (var i = 0; i < c.size(); i++) {
            if (c[i] > 0) {
                dc.drawText(w / 2, y, Graphics.FONT_XTINY, CLUBS[i] + ": " + c[i], Graphics.TEXT_JUSTIFY_CENTER);
                y += lh;
            }
        }
        var sec = ses["sec"];
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 0.82, Graphics.FONT_XTINY, (sec / 60).format("%d") + " min", Graphics.TEXT_JUSTIFY_CENTER);
    }
}
