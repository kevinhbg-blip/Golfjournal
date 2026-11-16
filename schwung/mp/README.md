# MediaPipe (lokal mitgeliefert)

- `vision_bundle.mjs` und `wasm/` stammen aus dem npm-Paket `@mediapipe/tasks-vision` 0.10.21 (Apache-2.0, Google).
- `pose_landmarker_full.task` ist das Pose-Landmarker-Modell „full“ (float16, Version 1) von storage.googleapis.com/mediapipe-models (Apache-2.0).

Die Dateien liegen im Repo, damit die Schwunganalyse ohne fremde CDNs läuft und nach dem ersten Laden aus dem Cache kommt.
