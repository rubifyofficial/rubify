# Debug Session: pinch-scale-bug [OPEN]

## Goal
- Debug why two-finger pinch scale does not work on the photo element in `app/(tabs)/notes.tsx`.

## Symptoms
- One-finger drag works.
- Two-finger pinch does not resize the photo.
- Photo touch ownership appears to work for drag only.

## Hypotheses
1. `gestureState.numberActiveTouches` never reaches `2` for the photo PanResponder.
2. `nativeEvent.touches` does not reliably expose two touch coordinates during move events.
3. Scale values are computed but not propagated into `editorPhotos` parent state.
4. Parent state updates happen, but `photo.scale` is not causing visible transform re-render.
5. Another touch path interrupts the photo gesture after the second finger is added.

## Plan
- Add instrumentation only to:
  - photo `onPanResponderMove`
  - `updateEditorPhotoPosition`
  - photo render path
- Reproduce with two fingers
- Analyze runtime evidence before changing any business logic

## Status
- Instrumentation updated in `app/(tabs)/notes.tsx`
- Waiting for runtime reproduction with the latest bundle loaded
- Current server state before new reproduction: `count = 0`
