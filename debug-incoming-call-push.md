# Debug Session: incoming-call-push [OPEN]

## Scope
- Bug: incoming call push notifications are not arriving reliably.
- Constraint: debug and fix only the push-notification chain without rewriting the call system.
- Protected areas: Stream call creation logic, call UI/video rendering, Supabase call-state flow, `/ver-juntos`, normal messages.

## Symptoms
- In-app incoming call UI may appear.
- Partner does not receive a push notification when a call starts.
- Notification tap handling is unverified until delivery works.

## Hypotheses
### A. Token registration fails on device
- Expected evidence: permission denied, missing projectId, or no Expo push token generated.
- Observation point: client token registration path in `lib/pushNotifications.ts` / `CallProvider.tsx`.

### B. Token is generated but not saved where delivery looks
- Expected evidence: token exists on device but recipient lookup returns no token.
- Observation point: Supabase write path and server-side token lookup in `send-call-notification`.

### C. Call-start path does not invoke push delivery correctly
- Expected evidence: no invoke log or invoke payload missing `callRecordId`.
- Observation point: `startGlobalCall()` after `couple_calls` insert.

### D. Edge Function runs but Expo delivery fails
- Expected evidence: Edge Function logs reach Expo API and response contains error or invalid token status.
- Observation point: `supabase/functions/send-call-notification/index.ts`.

### E. Push arrives but notification response handling fails
- Expected evidence: notification tap logs are missing or call record validation rejects the tap payload.
- Observation point: app-root `CallProvider` notification listeners and cold-start handler.

## Plan
1. Start Debug Server for runtime evidence collection.
2. Add instrumentation logs only to the existing push chain.
3. Reproduce token registration, manual push send, call-start push send, and notification tap.
4. Analyze logs to confirm or reject hypotheses.
5. Apply the smallest fix only after evidence identifies the failing stage.
