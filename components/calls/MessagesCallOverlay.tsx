import React from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera as ExpoCamera } from 'expo-camera';
import Constants from 'expo-constants';
import {
  CallingState,
  ParticipantView,
  StreamCall,
  StreamVideo,
  callManager,
  useCallStateHooks,
  type Call,
  type StreamVideoClient,
} from '@stream-io/video-react-native-sdk';
import {
  Camera,
  CameraOff,
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Volume2,
  VolumeX,
  UserRound,
} from 'lucide-react-native';

export type MessagesCallKind = 'audio' | 'video';
export type MessagesCallStatus = 'idle' | 'connecting' | 'ringing' | 'connected' | 'error';
export type MessagesCallRole = 'caller' | 'recipient';
const MESSAGES_CALL_DEBUG_URL = 'http://192.168.100.35:7777/event';
const MESSAGES_CALL_DEBUG_SESSION = 'mensajes-call-startup';

type MessagesCallOverlayProps = {
  visible: boolean;
  callKind: MessagesCallKind | null;
  streamCallId: string | null;
  callRecordId: string | null;
  role: MessagesCallRole | null;
  callRecordStatus?: 'ringing' | 'accepted' | 'rejected' | 'cancelled' | 'ended' | null;
  coupleId: string | null;
  currentUserId: string | null;
  partnerId?: string | null;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  connectEnabled?: boolean;
  streamClient?: StreamVideoClient | null;
  onEnd: () => void;
  onMinimize?: () => void;
  onConnected?: () => void;
};

const getMessagesCallId = (coupleId: string) => `messages-call-${coupleId}`;
const getParticipantUserId = (participant: any) =>
  participant?.userId || participant?.user_id || participant?.user?.id || null;

const reportMessagesCallDebug = (hypothesisId: string, location: string, msg: string, data?: Record<string, unknown>) => {
  void fetch(MESSAGES_CALL_DEBUG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: MESSAGES_CALL_DEBUG_SESSION,
      runId: 'pre-fix',
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
};

export function MessagesCallOverlay({
  visible,
  callKind,
  streamCallId,
  callRecordId,
  role,
  callRecordStatus = null,
  coupleId,
  currentUserId,
  partnerId,
  partnerName,
  partnerAvatarUrl,
  connectEnabled = false,
  streamClient = null,
  onEnd,
  onMinimize,
  onConnected,
}: MessagesCallOverlayProps) {
  const [call, setCall] = React.useState<Call | null>(null);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [callStatus, setCallStatus] = React.useState<MessagesCallStatus>('idle');
  const callRef = React.useRef<Call | null>(null);
  const isCleaningUpRef = React.useRef(false);
  const isJoiningExistingCallRef = React.useRef(false);
  const initKeyRef = React.useRef<string | null>(null);

  const cleanupCall = React.useCallback(async (callToCleanup?: Call | null, options?: { reject?: boolean }) => {
    if (!callToCleanup || isCleaningUpRef.current) return;

    isCleaningUpRef.current = true;

    try {
      const anyCall = callToCleanup as any;
      await anyCall?.screenShare?.disable?.();
      await anyCall?.screenSharing?.disable?.();
      await anyCall?.microphone?.disable?.();
      await anyCall?.camera?.disable?.();
    } catch (error) {
      console.log('[MessagesCallOverlay] device cleanup ignored:', error);
    }

    try {
      if ((callToCleanup as any)?.ringing && options?.reject) {
        await callToCleanup.leave({ reject: true });
      } else {
        await callToCleanup.leave();
      }
    } catch (error) {
      console.log('[MessagesCallOverlay] leave call ignored:', error);
    } finally {
      if (callRef.current === callToCleanup) {
        callRef.current = null;
      }
      setCall((prev) => (prev === callToCleanup ? null : prev));
      setCallStatus('idle');
      isCleaningUpRef.current = false;
    }
  }, []);

  const ensureCallPermissions = React.useCallback(async (kind: MessagesCallKind) => {
    try {
      // #region debug-point D:request-permissions
      reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:ensureCallPermissions:start', '[DEBUG] stage: request-permissions', {
        callKind: kind,
      });
      // #endregion
      const currentMic = await ExpoCamera.getMicrophonePermissionsAsync();
      const micResult =
        currentMic.granted || currentMic.status === 'granted'
          ? currentMic
          : await ExpoCamera.requestMicrophonePermissionsAsync();

      if (!micResult.granted && micResult.status !== 'granted') {
        // #region debug-point D:microphone-permission-denied
        reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:ensureCallPermissions:microphone-denied', '[DEBUG] stage: request-permissions microphone denied', {
          microphoneStatus: micResult.status,
          granted: micResult.granted,
        });
        // #endregion
        const message = 'No tenemos permiso para usar el micrófono.';
        setErrorMessage(message);
        setCallStatus('error');
        Alert.alert('Permiso requerido', message);
        return false;
      }

      if (kind === 'video') {
        const currentCamera = await ExpoCamera.getCameraPermissionsAsync();
        const cameraResult =
          currentCamera.granted || currentCamera.status === 'granted'
            ? currentCamera
            : await ExpoCamera.requestCameraPermissionsAsync();

        if (!cameraResult.granted && cameraResult.status !== 'granted') {
          // #region debug-point D:camera-permission-denied
          reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:ensureCallPermissions:camera-denied', '[DEBUG] stage: request-permissions camera denied', {
            cameraStatus: cameraResult.status,
            granted: cameraResult.granted,
          });
          // #endregion
          const message = 'No tenemos permiso para usar la cámara.';
          setErrorMessage(message);
          setCallStatus('error');
          Alert.alert('Permiso requerido', message);
          return false;
        }
      }

      // #region debug-point D:request-permissions-success
      reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:ensureCallPermissions:success', '[DEBUG] stage: request-permissions success', {
        callKind: kind,
      });
      // #endregion
      return true;
    } catch (error) {
      // #region debug-point D:request-permissions-failed
      reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:ensureCallPermissions:catch', '[DEBUG] startup failed', {
        stage: 'request-permissions',
        message: error instanceof Error ? error.message : String(error),
      });
      // #endregion
      console.log('[MessagesCallOverlay] permissions error:', error);
      setErrorMessage('No se pudo iniciar la llamada. Inténtalo de nuevo.');
      setCallStatus('error');
      return false;
    }
  }, []);

  const syncCallDevices = React.useCallback(async (streamCall: Call, kind: MessagesCallKind) => {
    try {
      await streamCall.microphone.enable();
    } catch (error) {
      console.log('[MessagesCallOverlay] microphone sync ignored:', error);
    }

    try {
      if (kind === 'video') {
        await streamCall.camera.enable();
      } else {
        await streamCall.camera.disable();
      }
    } catch (error) {
      console.log('[MessagesCallOverlay] camera sync ignored:', error);
    }
  }, []);

  const joinExistingMessagesCall = React.useCallback(
    async ({
      nextStreamClient,
      nextStreamCallId,
      nextCallKind,
      nextRole,
      nextCallRecordId,
    }: {
      nextStreamClient: StreamVideoClient;
      nextStreamCallId: string;
      nextCallKind: MessagesCallKind;
      nextRole: MessagesCallRole;
      nextCallRecordId: string | null;
    }) => {
      if (isJoiningExistingCallRef.current && callRef.current) {
        return callRef.current;
      }

      isJoiningExistingCallRef.current = true;

      try {
        const nextCall = nextStreamClient.call('default', nextStreamCallId, { reuseInstance: true });
        callRef.current = nextCall;
        setCall(nextCall);

        await nextCall.get({ video: nextCallKind === 'video' });
        await nextCall.join();
        await syncCallDevices(nextCall, nextCallKind);

        if (nextRole === 'caller' && nextCallRecordId) {
          console.log('[GlobalCall] caller joined accepted call', {
            callRecordId: nextCallRecordId,
          });
        }

        return nextCall;
      } finally {
        isJoiningExistingCallRef.current = false;
      }
    },
    [syncCallDevices]
  );

  React.useEffect(() => {
    if (!connectEnabled || !callKind || !currentUserId || !role || !streamClient) return;

    let cancelled = false;
    const startMessagesCall = async () => {
      let startupStage = 'initial';

      console.log('[MessagesCall] overlay context', {
        callKind,
        hasCurrentUserId: Boolean(currentUserId),
        hasCoupleId: Boolean(coupleId),
        hasPartnerUserId: Boolean(partnerId),
        hasStreamCallId: Boolean(streamCallId),
        hasCallRecordId: Boolean(callRecordId),
        role: role ?? null,
        isExpoGo: Constants.appOwnership === 'expo',
      });

      // #region debug-point C:overlay-start
      reportMessagesCallDebug('C', 'MessagesCallOverlay.tsx:startMessagesCall:entry', '[DEBUG] stage: initialize-overlay-call', {
        hasVisible: visible,
        hasCallKind: Boolean(callKind),
        hasStreamCallId: Boolean(streamCallId),
        hasCallRecordId: Boolean(callRecordId),
        hasCoupleId: Boolean(coupleId),
        hasCurrentUserId: Boolean(currentUserId),
        hasPartnerId: Boolean(partnerId),
        role: role ?? null,
        appOwnership: Constants.appOwnership ?? null,
      });
      // #endregion
      const resolvedCallId = streamCallId ?? (coupleId ? getMessagesCallId(coupleId) : null);
      if (!resolvedCallId) {
        // #region debug-point B:missing-stream-call-id
        reportMessagesCallDebug('B', 'MessagesCallOverlay.tsx:startMessagesCall:missing-call-id', '[DEBUG] stage: validate-call-data failed', {
          hasStreamCallId: Boolean(streamCallId),
          hasCoupleId: Boolean(coupleId),
        });
        // #endregion
        setErrorMessage('No se pudo iniciar la llamada. Inténtalo de nuevo.');
        setCallStatus('error');
        return;
      }

      const initKey = `${role}:${callKind}:${resolvedCallId}:${callRecordId ?? 'none'}`;
      if (initKeyRef.current === initKey && callRef.current) {
        return;
      }
      initKeyRef.current = initKey;

      setIsPreparing(true);
      setErrorMessage(null);
      setCallStatus('connecting');
      setCall(null);
      callRef.current = null;

      try {
        startupStage = 'request-permissions';
        const hasPermissions = await ensureCallPermissions(callKind);
        if (!hasPermissions) {
          return;
        }

        // #region debug-point C:fetch-stream-client
        startupStage = 'connect-stream-client';
        reportMessagesCallDebug('C', 'MessagesCallOverlay.tsx:startMessagesCall:get-client', '[DEBUG] stage: connect-stream-client', {
          callKind,
          resolvedCallId,
          role: role ?? null,
        });
        // #endregion
        const nextClient = streamClient;
        if (cancelled) return;
        // #region debug-point D:get-stream-call
        reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:startMessagesCall:get-call', '[DEBUG] stage: get-stream-call', {
          resolvedCallId,
          role: role ?? null,
          callKind,
        });
        // #endregion
        startupStage = 'get-stream-call';
        setCallStatus('connecting');
        // #region debug-point D:join-stream-call
        startupStage = 'join-stream-call';
        reportMessagesCallDebug(
          'D',
          role === 'recipient'
            ? 'MessagesCallOverlay.tsx:startMessagesCall:join-recipient'
            : 'MessagesCallOverlay.tsx:startMessagesCall:join-caller',
          '[DEBUG] stage: join-stream-call',
          {
            resolvedCallId,
            role: role ?? null,
          }
        );
        // #endregion
        await joinExistingMessagesCall({
          nextStreamClient: nextClient,
          nextStreamCallId: resolvedCallId,
          nextCallKind: callKind,
          nextRole: role,
          nextCallRecordId: callRecordId,
        });
        // #region debug-point D:join-stream-call-success
        reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:startMessagesCall:join-success', '[DEBUG] stage: join-stream-call success', {
          resolvedCallId,
          role: role ?? null,
          callKind,
        });
        // #endregion
        if (!cancelled) {
          setCallStatus('connected');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const userMessage =
          typeof error === 'object' && error && 'userMessage' in error && typeof (error as any).userMessage === 'string'
            ? (error as any).userMessage
            : null;
        // #region debug-point D:startMessagesCall-failed
        reportMessagesCallDebug('D', 'MessagesCallOverlay.tsx:startMessagesCall:catch', '[DEBUG] startup failed', {
          stage: startupStage,
          message: errorMessage,
          resolvedCallId: streamCallId ?? (coupleId ? getMessagesCallId(coupleId) : null),
          role: role ?? null,
          callKind: callKind ?? null,
        });
        // #endregion
        console.error('[MessagesCall] failed', {
          startupStage,
          error,
          errorMessage,
        });
        if (!cancelled) {
          setErrorMessage(userMessage ?? `Paso: ${startupStage}\n\n${errorMessage}`);
          setCallStatus('error');
        }
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
        if (cancelled) {
          isJoiningExistingCallRef.current = false;
        }
      }
    };

    void startMessagesCall();

    return () => {
      cancelled = true;
      initKeyRef.current = null;
      if (callRef.current) {
        void cleanupCall(callRef.current);
      }
    };
  }, [callKind, callRecordId, cleanupCall, connectEnabled, coupleId, currentUserId, ensureCallPermissions, joinExistingMessagesCall, partnerId, role, streamCallId, streamClient]);

  React.useEffect(() => {
    callRef.current = call;
  }, [call]);

  React.useEffect(() => {
    if (callStatus === 'connected') {
      onConnected?.();
    }
  }, [callStatus, onConnected]);

  const handleEndPress = React.useCallback(async () => {
    await cleanupCall(callRef.current, { reject: Boolean((callRef.current as any)?.ringing) });
    onEnd();
  }, [cleanupCall, onEnd]);

  const handleMinimizePress = React.useCallback(() => {
    onMinimize?.();
  }, [onMinimize]);

  const title = callKind === 'audio' ? 'Llamada' : 'Videollamada';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onMinimize ? handleMinimizePress : handleEndPress}
    >
      <View style={[styles.overlayBase, callKind === 'video' ? styles.videoOverlay : styles.audioOverlay]}>
        {!streamClient || !call || !callKind ? (
          <CallFallbackCard
            title={title}
            partnerName={partnerName}
            partnerAvatarUrl={partnerAvatarUrl}
            statusText={errorMessage || (isPreparing ? 'Conectando...' : 'Llamando...')}
            errorMessage={errorMessage}
            onEnd={handleEndPress}
            onMinimize={onMinimize ? handleMinimizePress : undefined}
          />
        ) : (
          <StreamVideo client={streamClient}>
            <StreamCall call={call}>
              <MessagesCallOverlayContent
                callKind={callKind}
                partnerName={partnerName}
                partnerAvatarUrl={partnerAvatarUrl}
                currentUserId={currentUserId}
                role={role}
                callRecordStatus={callRecordStatus}
                callStatus={callStatus}
                isPreparing={isPreparing}
                errorMessage={errorMessage}
                onEnd={handleEndPress}
                onMinimize={onMinimize ? handleMinimizePress : undefined}
              />
            </StreamCall>
          </StreamVideo>
        )}
      </View>
    </Modal>
  );
}

function MessagesCallOverlayContent({
  callKind,
  partnerName,
  partnerAvatarUrl,
  currentUserId,
  role,
  callRecordStatus,
  callStatus,
  isPreparing,
  errorMessage,
  onEnd,
  onMinimize,
}: {
  callKind: MessagesCallKind;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  currentUserId?: string | null;
  role: MessagesCallRole | null;
  callRecordStatus: 'ringing' | 'accepted' | 'rejected' | 'cancelled' | 'ended' | null;
  callStatus: MessagesCallStatus;
  isPreparing: boolean;
  errorMessage: string | null;
  onEnd: () => void;
  onMinimize?: () => void;
}) {
  const { useCallCallingState, useMicrophoneState, useCameraState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, optimisticIsMute: microphoneMuted } = useMicrophoneState();
  const { camera, optimisticIsMute: cameraMuted } = useCameraState();
  const participants = useParticipants();

  const [speakerOn, setSpeakerOn] = React.useState(callKind === 'video');
  const [connectedAt, setConnectedAt] = React.useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  const remoteParticipants = participants.filter(
    (participant) => String((participant as any)?.userId || (participant as any)?.user?.id || '') !== String(currentUserId ?? '')
  );
  const remoteParticipant = remoteParticipants[0];
  const localParticipant =
    participants.find((participant) => String(getParticipantUserId(participant)) === String(currentUserId ?? '')) ||
    participants.find((participant) => participant?.isLocalParticipant);

  React.useEffect(() => {
    callManager.start({
      audioRole: 'communicator',
      deviceEndpointType: callKind === 'audio' ? 'earpiece' : 'speaker',
    });
    callManager.speaker.setForceSpeakerphoneOn(callKind === 'video');

    return () => {
      callManager.stop();
    };
  }, [callKind]);

  React.useEffect(() => {
    if (callingState === CallingState.JOINED) {
      setConnectedAt((prev) => prev ?? Date.now());
      return;
    }

    setConnectedAt(null);
    setElapsedSeconds(0);
  }, [callingState]);

  React.useEffect(() => {
    if (!connectedAt) return;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [connectedAt]);

  const statusText = React.useMemo(() => {
    if (errorMessage) return errorMessage;
    if (callStatus === 'error') return 'No se pudo iniciar la llamada. Inténtalo de nuevo.';
    if (callRecordStatus === 'ringing' && role === 'caller') return 'Llamando...';
    if (callStatus === 'ringing') return 'Llamando...';
    if (isPreparing) return 'Conectando...';
    if (
      (callRecordStatus === 'accepted' && (callStatus === 'connected' || callingState === CallingState.JOINED)) ||
      (callRecordStatus == null && (callStatus === 'connected' || callingState === CallingState.JOINED))
    ) {
      return elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : 'En llamada';
    }
    if (callingState === CallingState.RINGING) return 'Llamando...';
    return 'Conectando...';
  }, [callRecordStatus, role, callStatus, callingState, elapsedSeconds, errorMessage, isPreparing]);

  const toggleSpeaker = React.useCallback(() => {
    const next = !speakerOn;
    setSpeakerOn(next);
    callManager.speaker.setForceSpeakerphoneOn(next);
  }, [speakerOn]);

  const toggleMicrophone = React.useCallback(async () => {
    try {
      await microphone.toggle();
    } catch (error) {
      console.log('[MessagesCallOverlay] microphone toggle error:', error);
    }
  }, [microphone]);

  const toggleCamera = React.useCallback(async () => {
    try {
      await camera.toggle();
    } catch (error) {
      console.log('[MessagesCallOverlay] camera toggle error:', error);
    }
  }, [camera]);

  const flipCamera = React.useCallback(async () => {
    try {
      await camera.flip();
    } catch (error) {
      console.log('[MessagesCallOverlay] camera flip error:', error);
    }
  }, [camera]);

  if (callKind === 'audio') {
    return (
      <View style={styles.audioCallShell}>
        <View style={styles.audioCallTop}>
          <View style={styles.audioCallTopRow}>
            <View style={styles.audioCallTopSpacer} />
            <Text style={styles.audioCallTitle}>Llamada</Text>
            <Pressable style={styles.minimizeButton} onPress={onMinimize}>
              <ChevronDown size={20} color="#7A5563" />
            </Pressable>
          </View>
          <Text style={styles.audioCallStatus}>{statusText}</Text>
        </View>

        <View style={styles.audioCallCenter}>
          <AvatarCircle uri={partnerAvatarUrl} label={partnerName} size={132} />
          <Text style={styles.audioPartnerName}>{partnerName}</Text>
          <Text style={styles.audioPartnerHint}>
            {remoteParticipants.length > 0 ? 'En llamada' : 'Esperando a tu pareja'}
          </Text>
        </View>

        <View style={styles.audioControlsRow}>
          <ControlButton
            icon={microphoneMuted ? <MicOff size={22} color="#7A5563" /> : <Mic size={22} color="#7A5563" />}
            label="Micrófono"
            active={!microphoneMuted}
            onPress={() => {
              void toggleMicrophone();
            }}
          />
          <ControlButton
            icon={speakerOn ? <Volume2 size={22} color="#7A5563" /> : <VolumeX size={22} color="#7A5563" />}
            label="Altavoz"
            active={speakerOn}
            onPress={toggleSpeaker}
          />
          <ControlButton
            icon={<PhoneOff size={22} color="#FFFFFF" />}
            label="Finalizar"
            danger
            onPress={onEnd}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.videoCallShell}>
      <View style={styles.videoStage}>
        {callingState === CallingState.JOINED && remoteParticipant ? (
          <ParticipantView participant={remoteParticipant} style={styles.videoStageFill} />
        ) : (
          <View style={styles.videoFallbackStage}>
            <UserRound size={54} color="#FFFFFF" />
            <Text style={styles.videoFallbackTitle}>Esperando a tu pareja</Text>
            <Text style={styles.videoFallbackSubtitle}>{statusText}</Text>
          </View>
        )}

        {remoteParticipants.length === 0 ? (
          <View style={styles.videoWaitingState}>
            <AvatarCircle uri={partnerAvatarUrl} label={partnerName} size={84} />
            <Text style={styles.videoWaitingTitle}>{partnerName}</Text>
            <Text style={styles.videoWaitingText}>{statusText}</Text>
          </View>
        ) : null}

        <View style={styles.videoTopInfo}>
          <Pressable style={styles.videoMinimizeButton} onPress={onMinimize}>
            <ChevronDown size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.videoTitle}>Videollamada</Text>
          <Text style={styles.videoStatus}>{statusText}</Text>
        </View>

        <View style={styles.localPreviewCard}>
          {callingState === CallingState.JOINED && localParticipant && !cameraMuted ? (
            <ParticipantView participant={localParticipant} style={styles.videoStageFill} />
          ) : (
            <View style={styles.localPreviewFallback}>
              <CameraOff size={24} color="#FFFFFF" />
              <Text style={styles.localPreviewFallbackText}>Tú</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.videoBottomInfo}>
        <Text style={styles.videoPartnerName}>{partnerName}</Text>
      </View>

      <View style={styles.videoControlsRow}>
        <ControlButton
          icon={microphoneMuted ? <MicOff size={22} color="#FFFFFF" /> : <Mic size={22} color="#FFFFFF" />}
          label="Micrófono"
          dark
          active={!microphoneMuted}
          onPress={() => {
            void toggleMicrophone();
          }}
        />
        <ControlButton
          icon={cameraMuted ? <CameraOff size={22} color="#FFFFFF" /> : <Camera size={22} color="#FFFFFF" />}
          label="Cámara"
          dark
          active={!cameraMuted}
          onPress={() => {
            void toggleCamera();
          }}
        />
        <ControlButton
          icon={<RefreshCw size={20} color="#FFFFFF" />}
          label="Cambiar cámara"
          dark
          onPress={() => {
            void flipCamera();
          }}
        />
        <ControlButton
          icon={<PhoneOff size={22} color="#FFFFFF" />}
          label="Finalizar"
          danger
          onPress={onEnd}
        />
      </View>
    </View>
  );
}

function CallFallbackCard({
  title,
  partnerName,
  partnerAvatarUrl,
  statusText,
  errorMessage,
  onEnd,
  onMinimize,
}: {
  title: string;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  statusText: string;
  errorMessage?: string | null;
  onEnd: () => void;
  onMinimize?: () => void;
}) {
  return (
    <View style={styles.fallbackCard}>
      {onMinimize ? (
        <Pressable style={styles.fallbackMinimizeButton} onPress={onMinimize}>
          <ChevronDown size={20} color="#7A5563" />
        </Pressable>
      ) : null}
      <AvatarCircle uri={partnerAvatarUrl} label={partnerName} size={96} />
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackName}>{partnerName}</Text>
      <View style={styles.fallbackStatusRow}>
        {!errorMessage ? <ActivityIndicator color="#E797AF" /> : null}
        <Text style={styles.fallbackStatus}>{statusText}</Text>
      </View>
      <Pressable style={styles.fallbackEndButton} onPress={onEnd}>
        <PhoneOff size={20} color="#FFFFFF" />
        <Text style={styles.fallbackEndButtonText}>Finalizar</Text>
      </Pressable>
    </View>
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active = false,
  danger = false,
  dark = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  dark?: boolean;
}) {
  const backgroundColor = danger
    ? '#F06F8F'
    : dark
      ? active
        ? 'rgba(255,255,255,0.2)'
        : 'rgba(255,255,255,0.12)'
      : active
        ? '#FDE4EC'
        : '#FFFFFF';

  const borderColor = danger
    ? '#F06F8F'
    : dark
      ? 'rgba(255,255,255,0.18)'
      : '#F1D2DC';

  const labelColor = danger ? '#FFFFFF' : dark ? '#FFFFFF' : '#7A5563';

  return (
    <Pressable style={[styles.controlButton, { backgroundColor, borderColor }]} onPress={onPress}>
      <View style={styles.controlButtonIcon}>{icon}</View>
      <Text style={[styles.controlButtonLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

function AvatarCircle({ uri, label, size }: { uri?: string | null; label: string; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  const initial = (label || 'U').trim().charAt(0).toUpperCase();
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  overlayBase: {
    flex: 1,
  },
  audioOverlay: {
    backgroundColor: '#FFF7FA',
  },
  videoOverlay: {
    backgroundColor: '#0F0C12',
  },
  fallbackCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
    backgroundColor: '#FFF7FA',
  },
  fallbackTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '900',
    color: '#2E1F28',
  },
  fallbackName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#241D22',
  },
  fallbackStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fallbackMinimizeButton: {
    position: 'absolute',
    top: 22,
    right: 22,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1D2DC',
  },
  fallbackStatus: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E7A83',
    textAlign: 'center',
  },
  fallbackEndButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F06F8F',
  },
  fallbackEndButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  audioCallShell: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 68,
    paddingBottom: 42,
    justifyContent: 'space-between',
    backgroundColor: '#FFF7FA',
  },
  audioCallTop: {
    alignItems: 'center',
    gap: 8,
  },
  audioCallTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioCallTopSpacer: {
    width: 38,
    height: 38,
  },
  audioCallTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2C2027',
  },
  audioCallStatus: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8F7A83',
  },
  audioCallCenter: {
    alignItems: 'center',
    gap: 14,
    paddingBottom: 40,
  },
  audioPartnerName: {
    fontSize: 34,
    fontWeight: '900',
    color: '#241D22',
  },
  audioPartnerHint: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9C8A92',
  },
  audioControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  controlButton: {
    flex: 1,
    minHeight: 86,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  controlButtonIcon: {
    marginBottom: 8,
  },
  controlButtonLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  minimizeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1D2DC',
  },
  videoCallShell: {
    flex: 1,
    backgroundColor: '#0F0C12',
  },
  videoStage: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#111',
  },
  videoStageFill: {
    width: '100%',
    height: '100%',
  },
  videoWaitingState: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: 'rgba(15,12,18,0.42)',
  },
  videoWaitingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  videoWaitingText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
  },
  videoFallbackStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111',
  },
  videoFallbackTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  videoFallbackSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '700',
  },
  videoTopInfo: {
    position: 'absolute',
    top: 62,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 6,
  },
  videoMinimizeButton: {
    position: 'absolute',
    right: 0,
    top: -2,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  videoStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  localPreviewCard: {
    position: 'absolute',
    right: 18,
    top: 118,
    width: 112,
    height: 164,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  localPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  localPreviewFallbackText: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  videoBottomInfo: {
    paddingHorizontal: 24,
    paddingTop: 14,
    alignItems: 'center',
  },
  videoPartnerName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  videoControlsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 10,
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
