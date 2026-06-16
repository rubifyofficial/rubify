# [OPEN] Mi Nota Drawing Lag

## Session
- id: mi-nota-drawing-lag
- goal: restore smooth, accurate, real-time drawing in the expanded `Mi nota` editor without breaking save or Album preview

## Symptoms
- stroke does not appear instantly under the finger
- drawing feels laggy and stuttery
- stroke placement feels inaccurate
- coordinates appear wrong while drawing

## Constraints
- do not redesign UI
- do not change Album UI
- do not change Supabase logic
- do not remove photo/text/sticker features
- keep drawing preview generation only after `Guardar`

## Hypotheses
1. The live drawing surface is wrapped by capture-related view logic that changes layout or touch coordinates.
2. The current stroke preview path rebuild is too expensive per frame, causing delayed stroke display.
3. Parent gesture handling in the editor is competing with the drawing responder and stealing motion.
4. The current `notes.tsx` drawing engine no longer matches the previously smooth engine behavior.
5. Heavy brush/path generation during move causes the visible offset and lag.

## Plan
1. Inspect the live editor canvas structure and compare it with the previously smooth drawing engine.
2. Add minimal instrumentation in the live drawing path to confirm which coordinate source and gesture path are active.
3. Reproduce and analyze evidence.
4. Apply the smallest fix that restores instant, accurate drawing.
5. Verify save and Album preview still work after `Guardar`.
