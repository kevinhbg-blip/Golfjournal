import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

class SwingApp extends Application.AppBase {
    var model;

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        model = new SwingModel();
        model.start();
    }

    function onStop(state) {
        if (model != null) {
            model.stop();
        }
    }

    function getInitialView() {
        return [new SwingView(model), new SwingDelegate(model)];
    }
}
