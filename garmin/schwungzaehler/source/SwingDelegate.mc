import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// Hauptbildschirm: Tasten hoch/runter oder Antippen wechseln den Schläger,
// Start pausiert, Zurück löscht den letzten Schwung, Menü (lang hoch) öffnet das Menü.
class SwingDelegate extends WatchUi.BehaviorDelegate {
    var model;

    function initialize(m) {
        BehaviorDelegate.initialize();
        model = m;
    }

    function onNextPage() {
        model.nextClub(1);
        WatchUi.requestUpdate();
        return true;
    }

    function onPreviousPage() {
        model.nextClub(-1);
        WatchUi.requestUpdate();
        return true;
    }

    function onTap(evt) {
        var xy = evt.getCoordinates();
        var w = System.getDeviceSettings().screenWidth;
        model.nextClub(xy[0] < w / 3 ? -1 : 1);
        WatchUi.requestUpdate();
        return true;
    }

    function onSelect() {
        model.paused = !model.paused;
        WatchUi.requestUpdate();
        return true;
    }

    // Ohne Schwung zum Löschen beendet Zurück die App wie gewohnt
    function onBack() {
        var done = model.undo();
        WatchUi.requestUpdate();
        return done;
    }

    function onMenu() {
        WatchUi.pushView(buildMenu(model), new MainMenuDelegate(model), WatchUi.SLIDE_UP);
        return true;
    }
}

function buildMenu(model) {
    var menu = new WatchUi.Menu2({ :title => "Schwungzähler" });
    menu.addItem(new WatchUi.MenuItem("Letzten löschen", null, :undo, {}));
    menu.addItem(new WatchUi.MenuItem("Empfindlichkeit", SENS_NAMES[model.sens], :sens, {}));
    menu.addItem(new WatchUi.MenuItem("Einheit speichern", model.total().toString() + " Schwünge", :save, {}));
    menu.addItem(new WatchUi.MenuItem("App beenden", "Zähler bleiben erhalten", :exit, {}));
    return menu;
}

class MainMenuDelegate extends WatchUi.Menu2InputDelegate {
    var model;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        model = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :undo) {
            model.undo();
            WatchUi.popView(WatchUi.SLIDE_DOWN);
        } else if (id == :sens) {
            model.cycleSens();
            item.setSubLabel(SENS_NAMES[model.sens]);
            WatchUi.requestUpdate();
        } else if (id == :save) {
            var ses = model.finish();
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
            if (ses != null) {
                WatchUi.pushView(new SummaryView(ses), new SummaryDelegate(), WatchUi.SLIDE_UP);
            }
        } else if (id == :exit) {
            System.exit();
        }
    }
}

class SummaryDelegate extends WatchUi.BehaviorDelegate {
    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onBack() {
        WatchUi.popView(WatchUi.SLIDE_DOWN);
        return true;
    }

    function onSelect() {
        return onBack();
    }

    function onTap(evt) {
        return onBack();
    }
}
