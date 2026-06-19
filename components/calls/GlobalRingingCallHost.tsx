import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import {
  CallingState,
  ParticipantView,
  RingingCallContent,
  StreamCall,
  callManager,
  useCall,
  useCalls,
  useCallStateHooks,
  type Call,
} from '@stream-io/video-react-native-sdk';
import { ChevronDown, Mic, MicOff, Phone, PhoneOff, Video, Camera, CameraOff, RefreshCw, Volume2, VolumeX, UserRound } from 'lucide-react-native';

export type MessagesCallKind = 'audio' | 'video';
export type MessagesCallRole = 'caller' | 'recipient';
export type CoupleCallStatus = 'ringing' | 'accepted' | 'rejected' | 'cancelled' | 'ended';

export type CoupleCallRecord = {
  id: string;
  couple_id: string;
  caller_id: string;
  recipient_id: string;
  stream_call_id: string;
  call_type: MessagesCallKind;
  status: CoupleCallStatus;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  updated_at: string;
};

type GlobalRingingCallHostProps = {
  currentUserId: string | null;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  preferredStreamCallId?: string | null;
  resolveCallRecord: (streamCallId: string) => Promise<CoupleCallRecord | null>;
  bindActiveCall: (call: Call | null) => void;
  syncCallRecord: (record: CoupleCallRecord, role: MessagesCallRole) => void;
  persistAccepted: (record: CoupleCallRecord) => Promise<void>;
  endCall: (reason?: 'user' | 'reject') => Promise<void>;
  onCallingStateChanged: (state: CallingState, role: MessagesCallRole, record: CoupleCallRecord | null) => void;
  clearState: () => void;
};

type HostContextValue = {
  currentUserId: string | null;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  callKind: MessagesCallKind;
  callRecord: CoupleCallRecord | null;
  onAccept: () => Promise<void>;
  onEnd: (reason?: 'user' | 'reject') => Promise<void>;
};

const HostContext = React.createContext<HostContextValue | null>(null);

function useHostContext() {
  const context = React.useContext(HostContext);
  if (!context) {
    throw new Error('GlobalRingingCallHost context is missing');
  }
  return context;
}

const TEXT_DARK = '#241D22';
const TEXT_MUTED = '#8D6675';
const BORDER = '#F3D9E2';

function getCallKind(call: Call): MessagesCallKind | null {
  const custom = (call.state.custom ?? {}) as Record<string, unknown>;
  return custom.call_kind === 'audio' || custom.call_kind === 'video' ? custom.call_kind : null;
}

function isMessagesCall(call: Call) {
  const custom = (call.state.custom ?? {}) as Record<string, unknown>;
  return custom.app_context === 'messages' && getCallKind(call) !== null;
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

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function CallStateObserver({
  callRecord,
  role,
  onCallingStateChanged,
  onRecordReady,
}: {
  callRecord: CoupleCallRecord | null;
  role: MessagesCallRole;
  onCallingStateChanged: (state: CallingState, role: MessagesCallRole, record: CoupleCallRecord | null) => void;
  onRecordReady: (call: Call) => void;
}) {
  const call = useCall();
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();

  React.useEffect(() => {
    if (!call) return;

    const acceptedBy = call.state.session?.accepted_by;
    console.log('[StreamRinging] call state', {
      callId: call.cid,
      isCreatedByMe: call.isCreatedByMe,
      ringing: call.ringing,
      callingState,
      partnerAccepted: Boolean(acceptedBy),
    });
  }, [call, callingState]);

  React.useEffect(() => {
    if (call) {
      onRecordReady(call);
    }
  }, [call, onRecordReady]);

  React.useEffect(() => {
    onCallingStateChanged(callingState, role, callRecord);
  }, [callRecord, callingState, onCallingStateChanged, role]);

  return null;
}

export function GlobalRingingCallHost({
  currentUserId,
  partnerName,
  partnerAvatarUrl,
  preferredStreamCallId = null,
  resolveCallRecord,
  bindActiveCall,
  syncCallRecord,
  persistAccepted,
  endCall,
  onCallingStateChanged,
  clearState,
}: GlobalRingingCallHostProps) {
  const calls = useCalls().filter((call) => isMessagesCall(call as Call));
  const ringingCalls = calls.filter((call) => call.ringing);
  const [activeCallCid, setActiveCallCid] = React.useState<string | null>(null);
  const [callRecord, setCallRecord] = React.useState<CoupleCallRecord | null>(null);

  const selectedCall = React.useMemo(() => {
    const preferredCall =
      (preferredStreamCallId && calls.find((call) => call.id === preferredStreamCallId)) ||
      (activeCallCid && calls.find((call) => call.cid === activeCallCid));

    if (preferredCall) {
      return preferredCall as Call;
    }

    const nonLeftCall = calls.find((call) => call.state.callingState !== CallingState.LEFT);
    return (nonLeftCall as Call | undefined) ?? null;
  }, [activeCallCid, calls, preferredStreamCallId]);

  const selectedCallKind = selectedCall ? getCallKind(selectedCall) : null;
  const selectedRole: MessagesCallRole | null = selectedCall
    ? selectedCall.isCreatedByMe
      ? 'caller'
      : 'recipient'
    : null;

  React.useEffect(() => {
    console.log('[StreamRinging] SDK calls', {
      ringingCallCount: ringingCalls.length,
      activeCallId: selectedCall?.cid ?? null,
    });
  }, [ringingCalls.length, selectedCall]);

  React.useEffect(() => {
    let cancelled = false;

    if (!selectedCall) {
      setCallRecord(null);
      bindActiveCall(null);
      setActiveCallCid(null);
      return;
    }

    bindActiveCall(selectedCall);
    setActiveCallCid(selectedCall.cid);

    void resolveCallRecord(selectedCall.id).then((record) => {
      if (cancelled) return;
      setCallRecord(record);
      if (record && selectedRole) {
        syncCallRecord(record, selectedRole);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bindActiveCall, resolveCallRecord, selectedCall, selectedRole, syncCallRecord]);

  if (!selectedCall || !selectedCallKind || !selectedRole) {
    return null;
  }

  const contextValue: HostContextValue = {
    currentUserId,
    partnerName,
    partnerAvatarUrl,
    callKind: selectedCallKind,
    callRecord,
    onAccept: async () => {
      if (!callRecord) return;
      await selectedCall.join();
      await persistAccepted(callRecord);
    },
    onEnd: endCall,
  };

  return (
    <HostContext.Provider value={contextValue}>
      <Modal visible transparent animationType="fade">
        <StreamCall call={selectedCall}>
          <CallStateObserver
            callRecord={callRecord}
            role={selectedRole}
            onCallingStateChanged={onCallingStateChanged}
            onRecordReady={bindActiveCall}
          />
          <RingingCallContent
            IncomingCall={UsfullyIncomingCall}
            OutgoingCall={UsfullyOutgoingCall}
            CallContent={UsfullyActiveCallContent}
            onBackPress={clearState}
          />
        </StreamCall>
      </Modal>
    </HostContext.Provider>
  );
}

function UsfullyOutgoingCall() {
  const { partnerName, partnerAvatarUrl, callKind, onEnd } = useHostContext();

  return (
    <View style={styles.fullScreenCallCard}>
      <View style={styles.fullScreenCallTop}>
        <CallTypePill
          icon={callKind === 'audio' ? <Phone size={16} color="#7A5563" /> : <Video size={16} color="#7A5563" />}
          label={callKind === 'audio' ? 'Llamada' : 'Videollamada'}
        />
      </View>

      <View style={styles.fullScreenCallCenter}>
        <Avatar size={126} uri={partnerAvatarUrl} label={partnerName} />
        <Text style={styles.fullScreenPartnerName}>{partnerName}</Text>
        <Text style={styles.fullScreenSubtitle}>
          {callKind === 'audio' ? `Llamando a ${partnerName}...` : `Iniciando videollamada con ${partnerName}...`}
        </Text>
      </View>

      <View style={styles.fullScreenActionsRow}>
        <Pressable style={[styles.fullScreenActionButton, styles.fullScreenRejectButton]} onPress={() => void onEnd('user')}>
          <PhoneOff size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UsfullyIncomingCall() {
  const { partnerName, partnerAvatarUrl, callKind, onAccept, onEnd } = useHostContext();
  const [expanded, setExpanded] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);

  const handleAccept = React.useCallback(async () => {
    setIsBusy(true);
    try {
      await onAccept();
    } finally {
      setIsBusy(false);
    }
  }, [onAccept]);

  const handleReject = React.useCallback(async () => {
    setIsBusy(true);
    try {
      await onEnd('reject');
    } finally {
      setIsBusy(false);
    }
  }, [onEnd]);

  if (!expanded) {
    return (
      <View style={styles.bannerViewport}>
        <Pressable style={styles.bannerCard} onPress={() => setExpanded(true)}>
          <Avatar size={46} uri={partnerAvatarUrl} label={partnerName} />
          <View style={styles.bannerTextBox}>
            <View style={styles.bannerTag}>
              {callKind === 'audio' ? <Phone size={13} color="#7A5563" /> : <Video size={13} color="#7A5563" />}
              <Text style={styles.bannerTagText}>{callKind === 'audio' ? 'Llamada entrante' : 'Videollamada entrante'}</Text>
            </View>
            <Text style={styles.bannerTitle}>{partnerName}</Text>
            <Text style={styles.bannerSubtitle}>Toca para responder</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenCallCard}>
      <View style={styles.fullScreenCallTop}>
        <CallTypePill
          icon={callKind === 'audio' ? <Phone size={16} color="#7A5563" /> : <Video size={16} color="#7A5563" />}
          label={callKind === 'audio' ? 'Llamada entrante' : 'Videollamada entrante'}
        />
      </View>

      <View style={styles.fullScreenCallCenter}>
        <Avatar size={126} uri={partnerAvatarUrl} label={partnerName} />
        <Text style={styles.fullScreenPartnerName}>{partnerName}</Text>
        <Text style={styles.fullScreenSubtitle}>
          {callKind === 'audio' ? 'Quiere hablar contigo' : 'Quiere iniciar una videollamada'}
        </Text>
      </View>

      <View style={styles.fullScreenActionsRow}>
        <Pressable
          style={[styles.fullScreenActionButton, styles.fullScreenRejectButton, isBusy && styles.disabledAction]}
          onPress={() => void handleReject()}
          disabled={isBusy}
        >
          <PhoneOff size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Rechazar</Text>
        </Pressable>
        <Pressable
          style={[styles.fullScreenActionButton, styles.fullScreenAcceptButton, isBusy && styles.disabledAction]}
          onPress={() => void handleAccept()}
          disabled={isBusy}
        >
          <Phone size={20} color="#FFFFFF" />
          <Text style={styles.fullScreenActionText}>Aceptar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function UsfullyActiveCallContent() {
  const call = useCall();
  const { currentUserId, partnerName, partnerAvatarUrl, callKind, onEnd } = useHostContext();
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
    participants.find((participant) => String((participant as any)?.userId || (participant as any)?.user?.id || '') === String(currentUserId ?? '')) ||
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
    if (callingState === CallingState.JOINED) {
      return elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : 'En llamada';
    }
    if (callingState === CallingState.JOINING || callingState === CallingState.RECONNECTING) {
      return 'Conectando...';
    }
    if (callingState === CallingState.RINGING) {
      return callKind === 'audio' ? `Llamando a ${partnerName}...` : `Iniciando videollamada con ${partnerName}...`;
    }
    return 'Conectando...';
  }, [callKind, callingState, elapsedSeconds, partnerName]);

  const toggleSpeaker = React.useCallback(() => {
    const next = !speakerOn;
    setSpeakerOn(next);
    callManager.speaker.setForceSpeakerphoneOn(next);
  }, [speakerOn]);

  const toggleMicrophone = React.useCallback(async () => {
    try {
      await microphone.toggle();
    } catch (error) {
      console.log('[GlobalRinging] microphone toggle error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [microphone]);

  const toggleCamera = React.useCallback(async () => {
    try {
      await camera.toggle();
    } catch (error) {
      console.log('[GlobalRinging] camera toggle error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [camera]);

  const flipCamera = React.useCallback(async () => {
    try {
      await camera.flip();
    } catch (error) {
      console.log('[GlobalRinging] camera flip error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [camera]);

  if (!call || callingState !== CallingState.JOINED) {
    return (
      <View style={styles.fallbackCard}>
        <Avatar size={96} uri={partnerAvatarUrl} label={partnerName} />
        <Text style={styles.fallbackTitle}>{callKind === 'audio' ? 'Llamada' : 'Videollamada'}</Text>
        <Text style={styles.fallbackName}>{partnerName}</Text>
        <View style={styles.fallbackStatusRow}>
          <ActivityIndicator color="#E797AF" />
          <Text style={styles.fallbackStatus}>Conectando...</Text>
        </View>
        <Pressable style={styles.fallbackEndButton} onPress={() => void onEnd('user')}>
          <PhoneOff size={20} color="#FFFFFF" />
          <Text style={styles.fallbackEndButtonText}>Finalizar</Text>
        </Pressable>
      </View>
    );
  }

  if (callKind === 'audio') {
    return (
      <View style={styles.audioCallShell}>
        <View style={styles.audioCallTop}>
          <View style={styles.audioCallTopRow}>
            <View style={styles.audioCallTopSpacer} />
            <Text style={styles.audioCallTitle}>Llamada</Text>
            <Pressable style={styles.minimizeButton}>
              <ChevronDown size={20} color="#7A5563" />
            </Pressable>
          </View>
          <Text style={styles.audioCallStatus}>{statusText}</Text>
        </View>

        <View style={styles.audioCallCenter}>
          <Avatar size={132} uri={partnerAvatarUrl} label={partnerName} />
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
            onPress={() => {
              void onEnd('user');
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.videoCallShell}>
      <View style={styles.videoStage}>
        {remoteParticipant ? (
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
            <Avatar uri={partnerAvatarUrl} label={partnerName} size={84} />
            <Text style={styles.videoWaitingTitle}>{partnerName}</Text>
            <Text style={styles.videoWaitingText}>{statusText}</Text>
          </View>
        ) : null}

        <View style={styles.videoTopInfo}>
          <Pressable style={styles.videoMinimizeButton}>
            <ChevronDown size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.videoTitle}>Videollamada</Text>
          <Text style={styles.videoStatus}>{statusText}</Text>
        </View>

        <View style={styles.localPreviewCard}>
          {localParticipant && !cameraMuted ? (
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
          onPress={() => {
            void onEnd('user');
          }}
        />
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

const styles = StyleSheet.create({
  bannerViewport: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 54,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(28, 18, 24, 0.12)',
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
  fullScreenCallCard: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 54,
    paddingBottom: 28,
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
  disabledAction: {
    opacity: 0.55,
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
