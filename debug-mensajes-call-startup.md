# Debug Session: mensajes-call-startup
- **Status**: [OPEN]
- **Issue**: Tapping the phone or video call button in `Mensajes` shows the generic startup error instead of completing the dedicated Mensajes call flow.
- **Debug Server**: http://192.168.100.35:7777/event
- **Log File**: .dbg/trae-debug-log-mensajes-call-startup.ndjson

## Reproduction Steps
1. Open `Mensajes`.
2. Tap the phone button or the video button.
3. Observe the startup path and identify the exact failing stage.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `couple_calls` insert fails because the table is missing in the actual DB or RLS blocks caller insert. | High | Low | Pending |
| B | Required startup data is missing (`currentUserId`, `coupleId`, `partnerId`, or valid `callKind`). | Medium | Low | Pending |
| C | `stream-token` / `getStreamVideoClient()` fails before the Stream client is ready. | High | Medium | Pending |
| D | Stream call creation or join fails due to the actual SDK/runtime method path. | Medium | Medium | Pending |
| E | The app is running in Expo Go or another unsupported runtime for native call features. | Medium | Low | Pending |

## Log Evidence
Instrumentation active in:
- `app/(tabs)/messages.tsx`
- `components/calls/MessagesCallOverlay.tsx`
- `lib/streamVideo.ts`

## Verification Conclusion
Pending runtime evidence.
