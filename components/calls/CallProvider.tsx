import React from 'react';
import {
  AppState,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {
  CallingState,
  StreamVideo,
  type Call as StreamSdkCall,
  type StreamVideoClient,
} from '@stream-io/video-react-native-sdk';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, Phone, PhoneOff, Video } from 'lucide-react-native';
import { useAuth } from '../../lib/AuthProvider';
import {
  parseIncomingCallPushData,
  sendCallNotification,
  sendTestPushToSelf,
  type IncomingCallPushData,
} from '../../lib/pushNotifications';
import { registerPushNotifications } from '../../lib/registerPushNotifications';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import { supabase } from '../../lib/supabase';
import { getStreamVideoClient, prepareMessagesStreamUsers, resetStreamVideoClient } from '../../lib/streamVideo';
import {
  GlobalRingingCallHost,
  type CoupleCallRecord,
  type MessagesCallKind,
  type MessagesCallRole,
} from './GlobalRingingCallHost';

type CoupleCallStatus = CoupleCallRecord['status'];

type EndCallReason = 'user' | 'reject';
type CleanupReason = 'rejected' | 'cancelled' | 'ended' | 'timeout';
type CallPhase = 'idle' | 'outgoing_ringing' | 'incoming_banner' | 'incoming_decision' | 'connecting' | 'active' | 'ending';

type GlobalCallContextValue = {
  startGlobalCall: (kind: MessagesCallKind) => Promise<void>;
  openFullCallOverlay: () => void;
  dismissFullCallOverlay: () => void;
  endGlobalCall: (reason?: EndCallReason) => Promise<void>;
  isStartingCall: boolean;
  canStartCall: boolean;
  hasActiveCall: boolean;
  isFullCallOverlayVisible: boolean;
};

const CallContext = React.createContext<GlobalCallContextValue | null>(null);

const RINGING_TIMEOUT_MS = 40_000;
const INCOMING_CALL_MAX_AGE_MS = 45_000;
const NOTICE_DURATION_MS = 4200;
const ACTIVE = '#F4A6A6';
const TEXT_DARK = '#241D22';
const TEXT_MUTED = '#8D6675';
const BORDER = '#F3D9E2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const buildMessagesStreamCallId = (coupleId: string) => `messages-call-${coupleId}-${Date.now()}`;

const isCallRecent = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const createdAtTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtTime)) return false;
  return Date.now() - createdAtTime <= INCOMING_CALL_MAX_AGE_MS;
};

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getNoticeForTerminalStatus(status: CoupleCallStatus) {
  if (status === 'rejected') return 'La llamada fue rechazada.';
  if (status === 'cancelled') return 'Llamada cancelada.';
  if (status === 'ended') return 'La llamada terminó.';
  return null;
}

function getNoticeForCleanupReason(reason: CleanupReason) {
  if (reason === 'timeout') return 'No hubo respuesta.';
  return getNoticeForTerminalStatus(reason);
}

function getOutgoingCallText(callType: MessagesCallKind, name: string) {
  return callType === 'audio' ? `Llamando a ${name}...` : `Iniciando videollamada con ${name}...`;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();
  const { couple, loading: coupleLoading } = useProfileAndCouple();
  const authUser = session?.user ?? null;
  const authReady = !authLoading;
  const currentUserId = authUser?.id ?? null;
  const coupleId = couple?.couple_id ?? null;
  const partnerId = couple?.partner_id ?? null;
  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatarUrl = couple?.partner_avatar_url ?? null;
  const canStartCall =
    authReady &&
    !coupleLoading &&
    Boolean(authUser?.id) &&
    Boolean(coupleId) &&
    Boolean(partnerId) &&
    partnerId !== authUser?.id;

  const [activeCallRecord, setActiveCallRecord] = React.useState<CoupleCallRecord | null>(null);
  const [incomingCallRecord, setIncomingCallRecord] = React.useState<CoupleCallRecord | null>(null);
  const [callKind, setCallKind] = React.useState<MessagesCallKind | null>(null);
  const [streamCallId, setStreamCallId] = React.useState<string | null>(null);
  const [callRecordId, setCallRecordId] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<MessagesCallRole | null>(null);
  const [callStatus, setCallStatus] = React.useState<'idle' | 'ringing' | 'connecting' | 'connected' | 'ending'>('idle');
  const [phase, setPhase] = React.useState<CallPhase>('idle');
  const [isIncomingVisible, setIsIncomingVisible] = React.useState(false);
  const [isFullCallOverlayVisible, setIsFullCallOverlayVisible] = React.useState(false);
  const [isCallConnected, setIsCallConnected] = React.useState(false);
  const [isEndingCall, setIsEndingCall] = React.useState(false);
  const [isStartingCall, setIsStartingCall] = React.useState(false);
  const [isIncomingActionBusy, setIsIncomingActionBusy] = React.useState(false);
  const [noticeText, setNoticeText] = React.useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [streamClient, setStreamClient] = React.useState<StreamVideoClient | null>(null);

  const ringingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCallRecordRef = React.useRef<CoupleCallRecord | null>(null);
  const incomingCallRecordRef = React.useRef<CoupleCallRecord | null>(null);
  const callRecordIdRef = React.useRef<string | null>(null);
  const roleRef = React.useRef<MessagesCallRole | null>(null);
  const phaseRef = React.useRef<CallPhase>('idle');
  const callStatusRef = React.useRef<'idle' | 'ringing' | 'connecting' | 'connected' | 'ending'>('idle');
  const isCallConnectedRef = React.useRef(false);
  const isEndingCallRef = React.useRef(false);
  const isStartingCallRef = React.useRef(false);
  const isJoiningCallRef = React.useRef(false);
  const openedAcceptedOverlayRef = React.useRef<string | null>(null);
  const handledTerminalKeysRef = React.useRef<Set<string>>(new Set());
  const handledNotificationIdsRef = React.useRef<Set<string>>(new Set());
  const providerStartedAtRef = React.useRef(Date.now());
  const subscriptionReadyRef = React.useRef(false);
  const currentSessionCallIdRef = React.useRef<string | null>(null);
  const currentStreamUserIdRef = React.useRef<string | null>(null);
  const activeStreamCallRef = React.useRef<StreamSdkCall | null>(null);
  const registeredPushTokenUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    activeCallRecordRef.current = activeCallRecord;
  }, [activeCallRecord]);

  React.useEffect(() => {
    incomingCallRecordRef.current = incomingCallRecord;
  }, [incomingCallRecord]);

  React.useEffect(() => {
    callRecordIdRef.current = callRecordId;
  }, [callRecordId]);

  React.useEffect(() => {
    roleRef.current = role;
  }, [role]);

  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  React.useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  React.useEffect(() => {
    isCallConnectedRef.current = isCallConnected;
  }, [isCallConnected]);

  React.useEffect(() => {
    isEndingCallRef.current = isEndingCall;
  }, [isEndingCall]);

  React.useEffect(() => {
    isStartingCallRef.current = isStartingCall;
  }, [isStartingCall]);

  React.useEffect(() => {
    if (!noticeText) return;
    const timeout = setTimeout(() => setNoticeText(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [noticeText]);

  const clearRingingTimeout = React.useCallback(() => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  }, []);

  const showNotice = React.useCallback((message: string) => {
    setNoticeText(message);
  }, []);

  const assignActiveCallState = React.useCallback((record: CoupleCallRecord, nextRole: MessagesCallRole) => {
    setActiveCallRecord(record);
    setCallKind(record.call_type);
    setStreamCallId(record.stream_call_id);
    setCallRecordId(record.id);
    setRole(nextRole);
  }, []);

  const beginCallSession = React.useCallback((recordId: string) => {
    currentSessionCallIdRef.current = recordId;
  }, []);

  const clearGlobalCallState = React.useCallback(() => {
    clearRingingTimeout();
    setIncomingCallRecord(null);
    setIsIncomingVisible(false);
    setIsIncomingActionBusy(false);
    setActiveCallRecord(null);
    setCallKind(null);
    setStreamCallId(null);
    setCallRecordId(null);
    setRole(null);
    setCallStatus('idle');
    setPhase('idle');
    setIsCallConnected(false);
    setIsFullCallOverlayVisible(false);
    setIsEndingCall(false);
    setElapsedSeconds(0);
    isJoiningCallRef.current = false;
    currentSessionCallIdRef.current = null;
    openedAcceptedOverlayRef.current = null;
    activeStreamCallRef.current = null;
  }, [clearRingingTimeout]);

  const cleanupCallSession = React.useCallback(
    ({
      reason,
      shouldShowMessage,
    }: {
      reason: CleanupReason;
      shouldShowMessage: boolean;
    }) => {
      clearGlobalCallState();
      if (shouldShowMessage) {
        const nextNotice = getNoticeForCleanupReason(reason);
        if (nextNotice) {
          showNotice(nextNotice);
        }
      }
    },
    [clearGlobalCallState, showNotice]
  );

  const presentIncomingCallRecord = React.useCallback((record: CoupleCallRecord, nextPhase: 'incoming_banner' | 'incoming_decision' = 'incoming_banner') => {
    setActiveCallRecord(null);
    setIncomingCallRecord(record);
    setIsIncomingVisible(true);
    setIsIncomingActionBusy(false);
    setCallKind(record.call_type);
    setStreamCallId(record.stream_call_id);
    setCallRecordId(record.id);
    setRole('recipient');
    setCallStatus('ringing');
    setPhase(nextPhase);
    setIsCallConnected(false);
    setIsFullCallOverlayVisible(false);
    beginCallSession(record.id);
  }, [beginCallSession]);

  const ensureStreamClientReady = React.useCallback(async () => {
    const nextClient = await getStreamVideoClient();
    if (!nextClient) {
      throw new Error('Missing Stream client');
    }
    setStreamClient(nextClient);
    currentStreamUserIdRef.current = currentUserId;
    return nextClient;
  }, [currentUserId]);

  const fetchCallRecordByStreamCallId = React.useCallback(
    async (nextStreamCallId: string) => {
      if (!nextStreamCallId || !currentUserId || !coupleId) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('couple_calls')
          .select('*')
          .eq('stream_call_id', nextStreamCallId)
          .eq('couple_id', coupleId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        const record = data as CoupleCallRecord;
        const isCaller = String(record.caller_id) === String(currentUserId);
        const isRecipient = String(record.recipient_id) === String(currentUserId);
        if (!isCaller && !isRecipient) {
          return null;
        }

        return record;
      } catch (error) {
        console.log('[GlobalCall] stream call record fetch failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [coupleId, currentUserId]
  );

  const fetchCallRecordById = React.useCallback(
    async (nextCallRecordId: string) => {
      if (!nextCallRecordId || !currentUserId || !coupleId) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('couple_calls')
          .select('*')
          .eq('id', nextCallRecordId)
          .eq('couple_id', coupleId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        const record = data as CoupleCallRecord;
        const isCaller = String(record.caller_id) === String(currentUserId);
        const isRecipient = String(record.recipient_id) === String(currentUserId);
        if (!isCaller && !isRecipient) {
          return null;
        }

        return record;
      } catch (error) {
        console.log('[GlobalCall] call record fetch by id failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [coupleId, currentUserId]
  );

  const shouldHandleTerminalRealtime = React.useCallback((record: CoupleCallRecord) => {
    if (!subscriptionReadyRef.current) return false;
    if (!currentSessionCallIdRef.current) return false;
    if (currentSessionCallIdRef.current !== record.id) return false;

    const terminalTimestamp = new Date(record.updated_at || record.ended_at || record.created_at).getTime();
    if (Number.isNaN(terminalTimestamp)) return false;

    return terminalTimestamp >= providerStartedAtRef.current;
  }, []);

  const openFullCallOverlay = React.useCallback(() => {
    if (!activeCallRecordRef.current) return;
    setIsFullCallOverlayVisible(true);
  }, []);

  const dismissFullCallOverlay = React.useCallback(() => {
    setIsFullCallOverlayVisible(false);
  }, []);

  const handleIncomingCallNotification = React.useCallback(
    async (payload: IncomingCallPushData) => {
      if (!currentUserId || !coupleId) {
        return;
      }

      const nextCallRecordId = payload.callRecordId?.trim();
      if (!nextCallRecordId || handledNotificationIdsRef.current.has(nextCallRecordId)) {
        return;
      }

      handledNotificationIdsRef.current.add(nextCallRecordId);

      try {
        console.log('[PushTap] notification tapped', payload);
        const record = await fetchCallRecordById(nextCallRecordId);
        if (!record) {
          showNotice('La llamada ya no está disponible.');
          return;
        }

        const isCaller = String(record.caller_id) === String(currentUserId);
        const isRecipient = String(record.recipient_id) === String(currentUserId);
        if (!isCaller && !isRecipient) {
          return;
        }

        if (record.status === 'rejected' || record.status === 'cancelled' || record.status === 'ended') {
          showNotice('La llamada ya terminó.');
          return;
        }

        const nextRole: MessagesCallRole = isCaller ? 'caller' : 'recipient';

        beginCallSession(record.id);
        setCallKind(record.call_type);
        setStreamCallId(record.stream_call_id);
        setCallRecordId(record.id);
        setRole(nextRole);

        try {
          const nextClient = await ensureStreamClientReady();
          const nextCall = nextClient.call('default', record.stream_call_id, { reuseInstance: true });
          await nextCall.get({ video: record.call_type === 'video' });
          activeStreamCallRef.current = nextCall;
        } catch (error) {
          console.log('[GlobalCall] notification stream warmup failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }

        if (record.status === 'ringing' && nextRole === 'recipient') {
          presentIncomingCallRecord(record, 'incoming_decision');
          return;
        }

        if (record.status === 'accepted') {
          clearRingingTimeout();
          setIncomingCallRecord(null);
          setIsIncomingVisible(false);
          assignActiveCallState(record, nextRole);
          setCallStatus('connecting');
          setPhase('connecting');
          setIsCallConnected(false);
          setIsFullCallOverlayVisible(true);
          return;
        }
      } catch (error) {
        console.log('[GlobalCall] notification tap handling failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      assignActiveCallState,
      beginCallSession,
      clearRingingTimeout,
      coupleId,
      currentUserId,
      ensureStreamClientReady,
      fetchCallRecordById,
      presentIncomingCallRecord,
      showNotice,
    ]
  );


  const scheduleRingingTimeout = React.useCallback(
    (record: CoupleCallRecord) => {
      clearRingingTimeout();
      ringingTimeoutRef.current = setTimeout(async () => {
        const currentRole = roleRef.current;
        const activeRecord = activeCallRecordRef.current;
        if (
          !activeRecord ||
          activeRecord.id !== record.id ||
          activeRecord.status !== 'ringing' ||
          currentRole !== 'caller'
        ) {
          return;
        }

        try {
          const endedAt = new Date().toISOString();
          await supabase
            .from('couple_calls')
            .update({
              status: 'cancelled',
              ended_at: endedAt,
              updated_at: endedAt,
            })
            .eq('id', record.id)
            .eq('status', 'ringing');
        } catch (error) {
          console.log('[GlobalCall] timeout update error:', error);
        } finally {
          cleanupCallSession({ reason: 'timeout', shouldShowMessage: true });
        }
      }, RINGING_TIMEOUT_MS);
    },
    [clearRingingTimeout, cleanupCallSession]
  );

  const startGlobalCall = React.useCallback(
    async (kind: MessagesCallKind) => {
      const isExpoGo = Constants.appOwnership === 'expo';
      let createdRecord: CoupleCallRecord | null = null;

      if (isStartingCallRef.current) return;

      if (isExpoGo) {
        Alert.alert('Error de llamada', 'Las llamadas requieren la versión de desarrollo de Usfully.');
        return;
      }

      if (!authReady || coupleLoading) {
        return;
      }

      if (!authUser?.id) {
        console.log('[GlobalCall] auth validation', {
          hasAuthUser: Boolean(authUser),
          authUserId: authUser?.id ?? null,
          hasSupabaseSession: Boolean(session),
          sessionUserId: session?.user?.id ?? null,
          hasCurrentUserId: Boolean(currentUserId),
          currentUserId: currentUserId ?? null,
          authReady,
          hasCoupleId: Boolean(coupleId),
          hasPartnerId: Boolean(partnerId),
        });
        Alert.alert('Error de llamada', 'Tu sesión no está disponible. Inténtalo de nuevo.');
        return;
      }

      if (!coupleId) {
        Alert.alert('Error de llamada', 'No se pudo identificar la relación.');
        return;
      }

      if (!partnerId) {
        Alert.alert('Error de llamada', 'No se encontró a tu pareja para iniciar la llamada.');
        return;
      }

      if (partnerId === authUser.id) {
        Alert.alert('Error de llamada', 'No puedes iniciar una llamada contigo mismo.');
        return;
      }

      if (kind !== 'audio' && kind !== 'video') {
        Alert.alert('Error de llamada', 'No se pudo iniciar la llamada. Inténtalo de nuevo.');
        return;
      }

      setIsStartingCall(true);
      setNoticeText(null);
      handledTerminalKeysRef.current.clear();

      try {
        console.log('[MessagesCall] stage: create-call-record');
        const now = new Date().toISOString();
        const nextStreamCallId = buildMessagesStreamCallId(coupleId);
        const { data, error } = await supabase
          .from('couple_calls')
          .insert({
            couple_id: coupleId,
            caller_id: authUser.id,
            recipient_id: partnerId,
            stream_call_id: nextStreamCallId,
            call_type: kind,
            status: 'ringing',
            updated_at: now,
          })
          .select('*')
          .single();

        if (error || !data) {
          throw error || new Error('missing call record');
        }

        createdRecord = data as CoupleCallRecord;
        beginCallSession(createdRecord.id);
        assignActiveCallState(createdRecord, 'caller');
        setIncomingCallRecord(null);
        setIsIncomingVisible(false);
        setCallStatus('ringing');
        setPhase('outgoing_ringing');
        setIsCallConnected(false);
        setIsFullCallOverlayVisible(false);
        scheduleRingingTimeout(createdRecord);
        void (async () => {
          try {
            const { data: partnerTokenRow, error: partnerTokenError } = await supabase
              .from('push_tokens')
              .select('expo_push_token')
              .eq('user_id', partnerId)
              .limit(1)
              .maybeSingle();

            console.log('[CallPush] partner token status', {
              partnerId,
              hasPartnerToken: Boolean(partnerTokenRow?.expo_push_token),
              error: partnerTokenError?.message ?? null,
            });
          } catch (partnerTokenLookupError) {
            console.log('[CallPush] partner token lookup failed', {
              partnerId,
              message:
                partnerTokenLookupError instanceof Error
                  ? partnerTokenLookupError.message
                  : String(partnerTokenLookupError),
            });
          }

          try {
            await sendCallNotification(createdRecord.id);
          } catch (notificationError) {
            console.log('[GlobalCall] send call notification failed', {
              message: notificationError instanceof Error ? notificationError.message : String(notificationError),
            });
          }
        })();

        console.log('[MessagesCall] stage: get-stream-token');
        const nextClient = await ensureStreamClientReady();

        console.log('[MessagesCall] stage: prepare-stream-users-server-side');
        await prepareMessagesStreamUsers({
          callId: createdRecord.stream_call_id,
          callType: createdRecord.call_type,
          recipientId: partnerId,
          recipientName: partnerName,
          recipientImage: partnerAvatarUrl,
        });

        const nextCall = nextClient.call('default', createdRecord.stream_call_id, { reuseInstance: true });
        await nextCall.getOrCreate({
          ring: true,
          video: createdRecord.call_type === 'video',
          data: {
            members: [{ user_id: authUser.id }, { user_id: partnerId }],
            custom: {
              app_context: 'messages',
              call_kind: createdRecord.call_type,
            },
          },
        });
        activeStreamCallRef.current = nextCall;

        console.log('[StreamRinging] created outgoing call', {
          callId: createdRecord.stream_call_id,
          isCreatedByMe: nextCall.isCreatedByMe,
        });

      } catch (error) {
        console.log('[GlobalCall] start call error:', error);

        if (createdRecord?.id) {
          try {
            const endedAt = new Date().toISOString();
            await supabase
              .from('couple_calls')
              .update({
                status: 'cancelled',
                ended_at: endedAt,
                updated_at: endedAt,
              })
              .eq('id', createdRecord.id)
              .eq('status', 'ringing');
          } catch (cancelError) {
            console.log('[GlobalCall] cancel failed after start error:', cancelError);
          }
        }

        clearGlobalCallState();
        const userMessage =
          typeof error === 'object' && error && 'userMessage' in error && typeof (error as any).userMessage === 'string'
            ? (error as any).userMessage
            : 'No se pudo preparar la llamada. Inténtalo de nuevo.';
        Alert.alert('Error de llamada', userMessage);
      } finally {
        setIsStartingCall(false);
      }
    },
    [
      assignActiveCallState,
      beginCallSession,
      clearGlobalCallState,
      coupleId,
      currentUserId,
      authReady,
      authUser,
      coupleLoading,
      ensureStreamClientReady,
      partnerAvatarUrl,
      partnerId,
      partnerName,
      scheduleRingingTimeout,
      session,
    ]
  );

  const endGlobalCall = React.useCallback(
    async (reason: EndCallReason = 'user') => {
      const currentRecord = activeCallRecordRef.current ?? incomingCallRecordRef.current;
      const currentRole = roleRef.current;
      const currentCall = activeStreamCallRef.current;

      if (!currentRecord || isEndingCallRef.current) {
        clearGlobalCallState();
        return;
      }

      setIsEndingCall(true);
      clearRingingTimeout();

      try {
        const now = new Date().toISOString();
        let nextStatus: CoupleCallStatus | null = null;

        if (reason === 'reject') {
          nextStatus = 'rejected';
        } else if (currentRecord.status === 'ringing' && currentRole === 'caller') {
          nextStatus = 'cancelled';
        } else if (currentRecord.status === 'accepted') {
          nextStatus = 'ended';
        }

        if (nextStatus) {
          try {
            if (currentCall) {
              if (nextStatus === 'rejected') {
                await currentCall.leave({ reject: true, reason: 'decline' });
              } else if (nextStatus === 'cancelled') {
                await currentCall.leave({ reject: true, reason: 'cancel' });
              } else {
                await currentCall.leave();
              }
            }
          } catch (leaveError) {
            console.log('[GlobalCall] stream leave error:', {
              message: leaveError instanceof Error ? leaveError.message : String(leaveError),
            });
          }

          handledTerminalKeysRef.current.add(`${currentRecord.id}:${nextStatus}`);
          const query = supabase
            .from('couple_calls')
            .update({
              status: nextStatus,
              ended_at: now,
              updated_at: now,
            })
            .eq('id', currentRecord.id);

          if (nextStatus === 'rejected' || nextStatus === 'cancelled') {
            await query.eq('status', 'ringing');
          } else {
            await query.in('status', ['accepted']);
          }
        }

        if (reason === 'reject') {
          cleanupCallSession({ reason: 'rejected', shouldShowMessage: false });
        } else if (currentRecord.status === 'ringing' && currentRole === 'caller') {
          cleanupCallSession({ reason: 'cancelled', shouldShowMessage: false });
        } else if (currentRecord.status === 'accepted') {
          cleanupCallSession({ reason: 'ended', shouldShowMessage: false });
        } else {
          clearGlobalCallState();
        }
      } catch (error) {
        console.log('[GlobalCall] end call error:', error);
        clearGlobalCallState();
      }
    },
    [cleanupCallSession, clearGlobalCallState, clearRingingTimeout]
  );

  React.useEffect(() => {
    if (!activeCallRecord?.answered_at || activeCallRecord.status !== 'accepted') {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = new Date(activeCallRecord.answered_at).getTime();
    if (Number.isNaN(startedAt)) {
      setElapsedSeconds(0);
      return;
    }

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeCallRecord?.answered_at, activeCallRecord?.status]);

  const handleCallRealtimeChange = React.useCallback(
    (record: CoupleCallRecord | null, source: 'realtime' = 'realtime') => {
      if (!record || !currentUserId || !coupleId) return;
      if (record.couple_id !== coupleId) return;

      const isCaller = String(record.caller_id) === String(currentUserId);
      const isRecipient = String(record.recipient_id) === String(currentUserId);

      if (!isCaller && !isRecipient) return;

      const nextRole: MessagesCallRole = isCaller ? 'caller' : 'recipient';
      const hasMatchingSession = currentSessionCallIdRef.current === record.id;

      if (record.status === 'ringing') {
        return;
      }

      if (record.status === 'accepted') {
        if (!hasMatchingSession) {
          return;
        }
        clearRingingTimeout();
        assignActiveCallState(record, nextRole);
        return;
      }

      if (record.status === 'rejected' || record.status === 'cancelled' || record.status === 'ended') {
        if (source !== 'realtime' || !shouldHandleTerminalRealtime(record)) {
          return;
        }
        const key = `${record.id}:${record.status}`;
        if (handledTerminalKeysRef.current.has(key)) {
          return;
        }
        handledTerminalKeysRef.current.add(key);
        cleanupCallSession({
          reason: record.status === 'rejected' ? 'rejected' : record.status === 'cancelled' ? 'cancelled' : 'ended',
          shouldShowMessage: true,
        });
      }
    },
    [
      assignActiveCallState,
      cleanupCallSession,
      clearRingingTimeout,
      coupleId,
      currentUserId,
      shouldHandleTerminalRealtime,
    ]
  );

  const bindActiveStreamCall = React.useCallback((call: StreamSdkCall | null) => {
    activeStreamCallRef.current = call;
  }, []);

  const syncActiveCallRecord = React.useCallback(
    (record: CoupleCallRecord, nextRole: MessagesCallRole) => {
      const currentRecord = activeCallRecordRef.current;
      const sameRecord =
        currentRecord?.id === record.id &&
        currentRecord?.status === record.status &&
        currentRecord?.stream_call_id === record.stream_call_id &&
        currentRecord?.call_type === record.call_type;

      beginCallSession(record.id);

      if (sameRecord && roleRef.current === nextRole) {
        return;
      }

      assignActiveCallState(record, nextRole);
    },
    [assignActiveCallState, beginCallSession]
  );

  const persistAcceptedCall = React.useCallback(
    async (record: CoupleCallRecord) => {
      const answeredAt = new Date().toISOString();
      const { data, error } = await supabase
        .from('couple_calls')
        .update({
          status: 'accepted',
          answered_at: answeredAt,
          updated_at: answeredAt,
        })
        .eq('id', record.id)
        .eq('status', 'ringing')
        .select('*')
        .single();

      if (!error && data) {
        const acceptedRecord = data as CoupleCallRecord;
        const currentRecord = activeCallRecordRef.current;
        const sameRecord =
          currentRecord?.id === acceptedRecord.id &&
          currentRecord?.status === acceptedRecord.status &&
          roleRef.current === 'recipient';

        if (!sameRecord) {
          assignActiveCallState(acceptedRecord, 'recipient');
        }
      }
    },
    [assignActiveCallState]
  );

  const handleCallingStateChanged = React.useCallback(
    (state: CallingState, nextRole: MessagesCallRole, record: CoupleCallRecord | null) => {
      if (state === CallingState.RINGING) {
        if (callStatusRef.current !== 'ringing') {
          setCallStatus('ringing');
        }
        return;
      }

      if (state === CallingState.JOINING || state === CallingState.RECONNECTING) {
        if (callStatusRef.current !== 'connecting') {
          setCallStatus('connecting');
        }
        if (phaseRef.current !== 'connecting') {
          setPhase('connecting');
        }
        if (isCallConnectedRef.current) {
          setIsCallConnected(false);
        }
        return;
      }

      if (state === CallingState.JOINED) {
        if (callStatusRef.current !== 'connected') {
          setCallStatus('connected');
        }
        if (phaseRef.current !== 'active') {
          setPhase('active');
        }
        if (!isCallConnectedRef.current) {
          setIsCallConnected(true);
        }

        if (record) {
          const nextRecord = record.status === 'accepted' ? record : { ...record, status: 'accepted' as const };
          const currentRecord = activeCallRecordRef.current;
          const sameRecord =
            currentRecord?.id === nextRecord.id &&
            currentRecord?.status === nextRecord.status &&
            currentRecord?.stream_call_id === nextRecord.stream_call_id &&
            currentRecord?.call_type === nextRecord.call_type &&
            roleRef.current === nextRole;

          if (!sameRecord) {
            assignActiveCallState(nextRecord, nextRole);
          }
        }
        return;
      }

      if (state === CallingState.LEFT) {
        const hasLiveState =
          Boolean(activeCallRecordRef.current) ||
          Boolean(incomingCallRecordRef.current) ||
          phaseRef.current !== 'idle' ||
          callStatusRef.current !== 'idle' ||
          isCallConnectedRef.current;

        if (hasLiveState) {
          setIsCallConnected(false);
          clearGlobalCallState();
        }
      }
    },
    [assignActiveCallState, clearGlobalCallState]
  );

  React.useEffect(() => {
    if (!coupleId || !currentUserId) return;

    const channel = supabase
      .channel(`global-couple-calls:${coupleId}:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couple_calls', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const nextRecord = (payload.new || null) as CoupleCallRecord | null;
          handleCallRealtimeChange(nextRecord, 'realtime');
        }
      )
      .subscribe((status) => {
        subscriptionReadyRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      clearRingingTimeout();
      subscriptionReadyRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [clearRingingTimeout, coupleId, currentUserId, handleCallRealtimeChange]);

  React.useEffect(() => {
    let cancelled = false;

    if (!currentUserId) {
      handledNotificationIdsRef.current.clear();
      registeredPushTokenUserIdRef.current = null;
      currentStreamUserIdRef.current = null;
      setStreamClient(null);
      void resetStreamVideoClient();
      return;
    }

    if (currentStreamUserIdRef.current === currentUserId && streamClient) {
      return;
    }

    if (currentStreamUserIdRef.current && currentStreamUserIdRef.current !== currentUserId) {
      currentStreamUserIdRef.current = null;
      setStreamClient(null);
      void resetStreamVideoClient();
    }

    void ensureStreamClientReady().then((client) => {
      if (!cancelled && client) {
        setStreamClient(client);
        currentStreamUserIdRef.current = currentUserId;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, ensureStreamClientReady, streamClient]);

  React.useEffect(() => {
    if (!currentUserId) {
      registeredPushTokenUserIdRef.current = null;
      return;
    }

    if (registeredPushTokenUserIdRef.current === currentUserId) {
      return;
    }

    registeredPushTokenUserIdRef.current = currentUserId;
    void registerPushNotifications().catch((error) => {
      console.log('[Push] registration failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }, [currentUserId]);

  React.useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let cancelled = false;
    void supabase
      .from('profiles')
      .select('expo_push_token, push_token_updated_at')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }

        console.log('[Push] current user token saved?', {
          currentUserId,
          hasToken: Boolean(data?.expo_push_token),
          updatedAt: data?.push_token_updated_at ?? null,
          error: error?.message ?? null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, coupleId]);

  React.useEffect(() => {
    if (!currentUserId || !coupleId) {
      return;
    }

    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      console.log('[PushTap] last response', Boolean(response));
      if (cancelled || !response) {
        return;
      }

      const pushData = parseIncomingCallPushData((response.notification.request.content.data ?? null) as Record<string, unknown> | null);
      if (!pushData) {
        return;
      }

      void handleIncomingCallNotification(pushData);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const pushData = parseIncomingCallPushData((response.notification.request.content.data ?? null) as Record<string, unknown> | null);
      if (!pushData) {
        return;
      }

      void handleIncomingCallNotification(pushData);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [coupleId, currentUserId, handleIncomingCallNotification]);

  React.useEffect(() => {
    if (!currentUserId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void ensureStreamClientReady();
        void registerPushNotifications().catch((error) => {
          console.log('[Push] registration failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentUserId, ensureStreamClientReady]);

  React.useEffect(() => {
    if (!__DEV__) {
      return;
    }

    (globalThis as typeof globalThis & { sendTestPushToSelf?: () => Promise<void> }).sendTestPushToSelf = async () => {
      await sendTestPushToSelf();
    };

    return () => {
      delete (globalThis as typeof globalThis & { sendTestPushToSelf?: () => Promise<void> }).sendTestPushToSelf;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      clearRingingTimeout();
      void resetStreamVideoClient();
    };
  }, [clearRingingTimeout]);

  const contextValue = React.useMemo<GlobalCallContextValue>(
    () => ({
      startGlobalCall,
      openFullCallOverlay,
      dismissFullCallOverlay,
      endGlobalCall,
      isStartingCall,
      canStartCall,
      hasActiveCall: Boolean(activeCallRecord),
      isFullCallOverlayVisible,
    }),
    [
      activeCallRecord,
      dismissFullCallOverlay,
      endGlobalCall,
      isFullCallOverlayVisible,
      isStartingCall,
      canStartCall,
      openFullCallOverlay,
      startGlobalCall,
    ]
  );

  return (
    <CallContext.Provider value={contextValue}>
      {streamClient ? (
        <StreamVideo client={streamClient}>
          {children}
          <GlobalRingingCallHost
            currentUserId={currentUserId}
            partnerName={partnerName}
            partnerAvatarUrl={partnerAvatarUrl}
            preferredStreamCallId={streamCallId}
            resolveCallRecord={fetchCallRecordByStreamCallId}
            bindActiveCall={bindActiveStreamCall}
            syncCallRecord={syncActiveCallRecord}
            persistAccepted={persistAcceptedCall}
            endCall={endGlobalCall}
            onCallingStateChanged={handleCallingStateChanged}
            clearState={clearGlobalCallState}
          />
          <View pointerEvents="box-none" style={styles.host}>
            <AnimatedNotice visible={Boolean(noticeText)} topOffset={insets.top + 84} message={noticeText ?? ''} />
          </View>
        </StreamVideo>
      ) : (
        <>
          {children}
          <View pointerEvents="box-none" style={styles.host}>
            <AnimatedNotice visible={Boolean(noticeText)} topOffset={insets.top + 84} message={noticeText ?? ''} />
          </View>
        </>
      )}
    </CallContext.Provider>
  );
}

export function useGlobalCall() {
  const context = React.useContext(CallContext);
  if (!context) {
    throw new Error('useGlobalCall must be used within CallProvider');
  }
  return context;
}

function AnimatedBanner({
  visible,
  topOffset,
  children,
}: {
  visible: boolean;
  topOffset: number;
  children: React.ReactNode;
}) {
  const translateY = React.useRef(new Animated.Value(-140)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : -140,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.bannerHost,
        {
          top: topOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function AnimatedNotice({
  visible,
  topOffset,
  message,
}: {
  visible: boolean;
  topOffset: number;
  message: string;
}) {
  const translateY = React.useRef(new Animated.Value(-20)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : -20,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.noticeHost,
        {
          top: topOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.noticePill}>
        <Text style={styles.noticeText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

function FullScreenCallStage({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.fullScreenStage,
        {
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function IncomingCallBanner({
  callType,
  partnerName,
  partnerAvatarUrl,
  onPress,
}: {
  callType: MessagesCallKind;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.bannerCard} onPress={onPress}>
      <Avatar size={46} uri={partnerAvatarUrl} label={partnerName} />
      <View style={styles.bannerTextBox}>
        <View style={styles.bannerTag}>
          {callType === 'audio' ? <Phone size={13} color="#7A5563" /> : <Video size={13} color="#7A5563" />}
          <Text style={styles.bannerTagText}>{callType === 'audio' ? 'Llamada entrante' : 'Videollamada entrante'}</Text>
        </View>
        <Text style={styles.bannerTitle}>{partnerName}</Text>
        <Text style={styles.bannerSubtitle}>Toca para responder</Text>
      </View>
    </Pressable>
  );
}

function IncomingCallScreen({
  callType,
  partnerName,
  partnerAvatarUrl,
  isBusy,
  onAccept,
  onReject,
  topInset,
  bottomInset,
}: {
  callType: MessagesCallKind;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  isBusy: boolean;
  onAccept: () => void;
  onReject: () => void;
  topInset: number;
  bottomInset: number;
}) {
  return (
    <View style={[styles.fullScreenCallCard, { paddingTop: topInset + 24, paddingBottom: bottomInset + 28 }]}>
      <View style={styles.fullScreenCallTop}>
        <CallTypePill
          icon={callType === 'audio' ? <Phone size={16} color="#7A5563" /> : <Video size={16} color="#7A5563" />}
          label={callType === 'audio' ? 'Llamada entrante' : 'Videollamada entrante'}
        />
      </View>

      <View style={styles.fullScreenCallCenter}>
        <Avatar size={126} uri={partnerAvatarUrl} label={partnerName} />
        <Text style={styles.fullScreenPartnerName}>{partnerName}</Text>
        <Text style={styles.fullScreenSubtitle}>
          {callType === 'audio' ? 'Quiere hablar contigo' : 'Quiere iniciar una videollamada'}
        </Text>
      </View>

      <View style={styles.fullScreenActionsRow}>
        <Pressable
          style={[styles.fullScreenActionButton, styles.fullScreenRejectButton, isBusy && styles.disabledAction]}
          onPress={onReject}
          disabled={isBusy}
        >
          <PhoneOff size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Rechazar</Text>
        </Pressable>
        <Pressable
          style={[styles.fullScreenActionButton, styles.fullScreenAcceptButton, isBusy && styles.disabledAction]}
          onPress={onAccept}
          disabled={isBusy}
        >
          <Phone size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Aceptar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OutgoingCallScreen({
  callType,
  partnerName,
  partnerAvatarUrl,
  isBusy,
  onEnd,
  topInset,
  bottomInset,
}: {
  callType: MessagesCallKind;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  isBusy: boolean;
  onEnd: () => void;
  topInset: number;
  bottomInset: number;
}) {
  return (
    <View style={[styles.fullScreenCallCard, { paddingTop: topInset + 24, paddingBottom: bottomInset + 28 }]}>
      <View style={styles.fullScreenCallTop}>
        <CallTypePill
          icon={callType === 'audio' ? <Phone size={16} color="#7A5563" /> : <Video size={16} color="#7A5563" />}
          label={callType === 'audio' ? 'Llamada' : 'Videollamada'}
        />
      </View>

      <View style={styles.fullScreenCallCenter}>
        <AnimatedCallingHalo />
        <Avatar size={126} uri={partnerAvatarUrl} label={partnerName} />
        <Text style={styles.fullScreenPartnerName}>{partnerName}</Text>
        <Text style={styles.fullScreenSubtitle}>{getOutgoingCallText(callType, partnerName)}</Text>
      </View>

      <View style={styles.fullScreenActionsRow}>
        <Pressable
          style={[styles.fullScreenActionButton, styles.fullScreenRejectButton, isBusy && styles.disabledAction]}
          onPress={onEnd}
          disabled={isBusy}
        >
          <PhoneOff size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CallTypePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.callTypePill}>
      {icon}
      <Text style={styles.callTypePillText}>{label}</Text>
    </View>
  );
}

function AnimatedCallingHalo() {
  const scale = React.useRef(new Animated.Value(0.94)).current;
  const opacity = React.useRef(new Animated.Value(0.34)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.94,
            duration: 900,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.12,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.34,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return <Animated.View style={[styles.callingHalo, { opacity, transform: [{ scale }] }]} />;
}

function ActiveCallBar({
  callType,
  partnerName,
  partnerAvatarUrl,
  elapsedLabel,
  onPress,
  onEnd,
}: {
  callType: MessagesCallKind;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  elapsedLabel: string;
  onPress: () => void;
  onEnd: () => void;
}) {
  const pulse = React.useRef(new Animated.Value(0.7)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.7, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.activeBar}>
      <Pressable style={styles.activeBarLeft} onPress={onPress}>
        <Animated.View style={[styles.activeDot, { opacity: pulse, transform: [{ scale: pulse }] }]} />
        <Avatar size={36} uri={partnerAvatarUrl} label={partnerName} />
        <View style={styles.activeTextBox}>
          <Text style={styles.activeTitle}>
            {callType === 'audio' ? `En llamada con ${partnerName}` : `Videollamada activa con ${partnerName}`}
          </Text>
          <View style={styles.activeMetaRow}>
            <Mic size={12} color="#7A5563" />
            <Text style={styles.activeSubtitle}>{elapsedLabel}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable style={styles.activeEndButton} onPress={onEnd}>
        <PhoneOff size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function Avatar({ uri, label, size }: { uri?: string | null; label: string; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarFallbackText, { fontSize: size * 0.38 }]}>{(label || 'U').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
    elevation: 1200,
    pointerEvents: 'box-none',
  },
  fullScreenStage: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: 'rgba(28, 18, 24, 0.32)',
  },
  fullScreenCallCard: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#FFF8FB',
  },
  fullScreenCallTop: {
    width: '100%',
    alignItems: 'center',
  },
  fullScreenCallCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  callTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: '#F3D9E2',
  },
  callTypePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7A5563',
  },
  callingHalo: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: '#FDE4EC',
  },
  fullScreenPartnerName: {
    fontSize: 30,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  fullScreenSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 23,
  },
  fullScreenActionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  fullScreenActionButton: {
    minWidth: 148,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  fullScreenRejectButton: {
    backgroundColor: '#F06F8F',
  },
  fullScreenAcceptButton: {
    backgroundColor: '#64C79A',
  },
  fullScreenActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bannerHost: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  noticeHost: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#FFF9FB',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#B86A84',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 9,
  },
  bannerTextBox: {
    flex: 1,
    gap: 4,
  },
  bannerMainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF1F5',
  },
  bannerTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A5563',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  bannerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  roundAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectAction: {
    backgroundColor: '#F06F8F',
  },
  acceptAction: {
    backgroundColor: '#64C79A',
  },
  endButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F06F8F',
  },
  disabledAction: {
    opacity: 0.55,
  },
  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFF6FA',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#B86A84',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  activeBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACTIVE,
  },
  activeTextBox: {
    flex: 1,
    gap: 2,
  },
  activeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  activeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
  },
  activeEndButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F06F8F',
    marginLeft: 10,
  },
  noticePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF4F7',
    borderWidth: 1,
    borderColor: BORDER,
  },
  noticeText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDE4EC',
    borderWidth: 1,
    borderColor: '#F2D5DE',
  },
  avatarFallbackText: {
    color: '#E28FA6',
    fontWeight: '900',
  },
});
