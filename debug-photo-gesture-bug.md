# Debug Session: photo-gesture-bug [OPEN]

## Goal
- Fix photo gesture interaction inside `app/(tabs)/notes.tsx`.
- Prove with runtime evidence whether touches go to the photo layer or the drawing layer.

## User Symptoms
- Added photo cannot be dragged.
- Added photo cannot be pinch-scaled.
- Added photo cannot be rotated.
- Touching the photo either draws on the canvas or does nothing.

## Hypotheses
1. Drawing `PanResponder` captures touches before the photo gesture layer.
2. Gesture Handler/Reanimated root setup is incomplete at app root.
3. Photo gesture callbacks are mounted but never receive touches due to layering.
4. Photo transform state updates exist but are not applied to the active touch target.
5. Canvas touch handlers interfere with photo gestures after touch start.

## Planned Evidence
- Inspect root setup for gesture-handler integration.
- Inspect `notes.tsx` touch stack, z-index, pointer behavior, and transform usage.
- Add temporary runtime logs for:
  - drawing start
  - photo tap/start
  - photo pan update
  - photo pinch update
  - photo rotation update

## Status
- Inspection completed.

## Findings
- Drawing uses `PanResponder` in `app/(tabs)/notes.tsx`.
- Photo uses `GestureDetector` with `Pan`, `Pinch`, `Rotation`, and `Tap`.
- Photo is absolutely positioned above the drawing surface in the same canvas container.
- `react-native-gesture-handler` is installed and `GestureHandlerRootView` exists in `app/_layout.tsx`.
- `react-native-reanimated` is installed, but the project had no `babel.config.js`, so the Reanimated Babel plugin was missing.
- Temporary instrumentation was added for drawing start and photo tap/pan/pinch/rotation.

## Current Fix
- Added `babel.config.js` with `react-native-reanimated/plugin`.
- Full Metro restart is required before runtime verification.
