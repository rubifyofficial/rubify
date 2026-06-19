import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  CallingState,
  ParticipantView,
  callManager,
  hasVideo,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-native-sdk';
import { hasPausedTrack } from '@stream-io/video-client';
import { RTCView, type MediaStream } from '@stream-io/react-native-webrtc';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, RefreshCw, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ActiveMessagesVideoCallProps = {
  partnerName: string;
  partnerAvatarUrl?: string | null;
  onEnd: (reason?: 'user' | 'reject') => Promise<void>;
};

type VideoSlotParticipant = React.ComponentProps<typeof ParticipantView>['participant'];
type ParticipantCameraState = 'missing' | 'on' | 'off' | 'loading';
type VideoStageSlot = {
  participant: VideoSlotParticipant | null;
  isLocal: boolean;
  label: string;
  slot: 'main' | 'pip';
  cameraState: ParticipantCameraState;
  rendererKey: string;
};

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

function getParticipantCameraState({
  participant,
  isLocal,
  localCameraMuted,
  localStreamUrl,
  remoteIncomingVideoEnabled,
}: {
  participant: VideoSlotParticipant | null;
  isLocal: boolean;
  localCameraMuted: boolean;
  localStreamUrl: string | null;
  remoteIncomingVideoEnabled: boolean;
}): ParticipantCameraState {
  if (!participant) return 'missing';

  if (isLocal) {
    if (localCameraMuted) return 'off';
    if (localStreamUrl) return 'on';
    return 'loading';
  }

  const remoteHasPublishedVideo = hasVideo(participant);
  const remoteHasVideoStream = Boolean(participant.videoStream);
  const remoteHasPausedVideo = hasPausedTrack(participant, 'videoTrack');

  if (!remoteHasPublishedVideo) return 'off';
  if (remoteHasPublishedVideo && remoteHasVideoStream && remoteIncomingVideoEnabled && !remoteHasPausedVideo) return 'on';
  return 'loading';
}

function buildRendererKey({
  participant,
  slot,
  isLocal,
  mainViewMode,
  cameraState,
}: {
  participant: VideoSlotParticipant | null;
  slot: 'main' | 'pip';
  isLocal: boolean;
  mainViewMode: 'remote' | 'local';
  cameraState: ParticipantCameraState;
}) {
  return [participant?.userId ?? 'empty', slot, isLocal ? 'local' : 'remote', mainViewMode, cameraState].join('-');
}

function VideoSlot({
  participant,
  isLocal,
  label,
  slot,
  cameraState,
  rendererKey,
  streamURL,
  partnerAvatarUrl,
  onPress,
  overlayStyle,
  pipStyle,
}: {
  participant: VideoSlotParticipant | null;
  isLocal: boolean;
  label: string;
  slot: 'main' | 'pip';
  cameraState: ParticipantCameraState;
  rendererKey: string;
  streamURL?: string | null;
  partnerAvatarUrl?: string | null;
  onPress?: () => void;
  overlayStyle?: object;
  pipStyle?: StyleProp<ViewStyle>;
}) {
  const isPip = slot === 'pip';

  console.log('[VideoSlot] state', {
    slot,
    participantId: participant?.userId ?? null,
    isLocal,
    cameraState,
  });

  const remoteFallback = React.useMemo(() => {
    if (isLocal) return null;

    return function RemoteFallback() {
      if (isPip) {
        if (cameraState === 'missing') {
          return <View style={styles.pipEmptyState} />;
        }

        return (
          <View style={styles.pipPlaceholder}>
            {cameraState === 'off' ? <Avatar uri={partnerAvatarUrl} label={label} size={40} /> : <ActivityIndicator color="#FFFFFF" />}
          </View>
        );
      }

      if (cameraState === 'missing') {
        return (
          <View style={styles.mainPlaceholder}>
            <UserRound size={52} color="#FFFFFF" />
            <Text style={styles.mainPlaceholderTitle}>Esperando a tu pareja</Text>
          </View>
        );
      }

      if (cameraState === 'off') {
        return (
          <View style={styles.mainPlaceholder}>
            <Avatar uri={partnerAvatarUrl} label={label} size={94} />
            <Text style={styles.mainPlaceholderSubtitle}>La cámara de tu pareja está apagada</Text>
          </View>
        );
      }

      return (
        <View style={styles.mainPlaceholder}>
          <ActivityIndicator color="#FFFFFF" />
          <Text style={styles.mainPlaceholderSubtitle}>Conectando cámara...</Text>
        </View>
      );
    };
  }, [cameraState, isLocal, isPip, label, partnerAvatarUrl]);

  let content: React.ReactNode;

  if (participant && isLocal && cameraState === 'on' && streamURL) {
    content = <RTCView streamURL={streamURL} mirror objectFit="cover" zOrder={0} style={isPip ? styles.pipRtcView : styles.mainRtcView} />;
  } else if (participant && !isLocal) {
    content = (
      <ParticipantView
        participant={participant}
        style={isPip ? styles.pipParticipantView : styles.mainParticipantView}
        objectFit="cover"
        mirror={false}
        videoZOrder={0}
        ParticipantLabel={null}
        ParticipantNetworkQualityIndicator={null}
        ParticipantReaction={null}
        ParticipantVideoFallback={remoteFallback}
      />
    );
  } else if (isPip) {
    content = <View style={styles.pipEmptyState} />;
  } else {
    content = (
      <View style={styles.mainPlaceholder}>
        {isLocal ? <CameraOff size={44} color="#FFFFFF" /> : <UserRound size={52} color="#FFFFFF" />}
        <Text style={styles.mainPlaceholderTitle}>{isLocal ? 'Tu cámara está apagada' : 'Esperando a tu pareja'}</Text>
      </View>
    );
  }

  if (!participant && isLocal && cameraState === 'loading') {
    content = (
      <View style={isPip ? styles.pipPlaceholder : styles.mainPlaceholder}>
        <ActivityIndicator color="#FFFFFF" />
        {!isPip ? <Text style={styles.mainPlaceholderSubtitle}>Conectando cámara...</Text> : null}
      </View>
    );
  }

  if (participant && isLocal && cameraState === 'off') {
    content = (
      <View style={isPip ? styles.pipPlaceholder : styles.mainPlaceholder}>
        <CameraOff size={isPip ? 24 : 44} color="#FFFFFF" />
        {!isPip ? <Text style={styles.mainPlaceholderTitle}>Tu cámara está apagada</Text> : null}
      </View>
    );
  }

  if (participant && isLocal && cameraState === 'loading') {
    content = (
      <View style={isPip ? styles.pipPlaceholder : styles.mainPlaceholder}>
        <ActivityIndicator color="#FFFFFF" />
        {!isPip ? <Text style={styles.mainPlaceholderSubtitle}>Conectando cámara...</Text> : null}
      </View>
    );
  }

  if (isPip) {
    return (
      <Pressable style={[styles.pipPosition, pipStyle]} onPress={onPress}>
        <View style={styles.pipCard}>
          <View key={rendererKey} collapsable={false} style={styles.pipVideoHost}>
            {content}
          </View>
          <Animated.View pointerEvents="none" style={[styles.pipLabelLayer, overlayStyle]}>
            <View style={styles.pipLabelChip}>
              <Text style={styles.pipLabelText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    );
  }

  return (
    <View key={rendererKey} collapsable={false} style={styles.mainSlot}>
      {content}
    </View>
  );
}

function VideoControlButton({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
  danger = false,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.videoControlButton,
        danger ? styles.videoControlButtonDanger : active ? styles.videoControlButtonActive : styles.videoControlButtonNeutral,
      ]}
      onPress={onPress}
    >
      {icon}
    </Pressable>
  );
}

export function ActiveMessagesVideoCall({ partnerName, partnerAvatarUrl, onEnd }: ActiveMessagesVideoCallProps) {
  const call = useCall();
  const {
    useCallCallingState,
    useMicrophoneState,
    useCameraState,
    useIncomingVideoSettings,
    useLocalParticipant,
    useRemoteParticipants,
  } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, optimisticIsMute: microphoneMuted } = useMicrophoneState();
  const { camera, optimisticIsMute: cameraMuted, isMute: cameraIsMute, mediaStream } = useCameraState();
  const { isParticipantVideoEnabled } = useIncomingVideoSettings();
  const localParticipant = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const remoteParticipant =
    remoteParticipants.find((participant) => participant.userId !== localParticipant?.userId) ?? remoteParticipants[0] ?? null;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [connectedAt, setConnectedAt] = React.useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [chromeVisible, setChromeVisible] = React.useState(true);
  const [mainViewMode, setMainViewMode] = React.useState<'remote' | 'local'>('remote');
  const chromeOpacity = React.useRef(new Animated.Value(1)).current;
  const chromeTranslateY = React.useRef(new Animated.Value(0)).current;
  const cameraEnabledForCallRef = React.useRef<Set<string>>(new Set());
  const cameraEnableInFlightRef = React.useRef<Set<string>>(new Set());
  const manualCameraDisabledForCallRef = React.useRef<Set<string>>(new Set());

  const callId = call?.cid ?? null;
  const localParticipantId = localParticipant?.userId ?? null;
  const localStreamUrl = (mediaStream as unknown as MediaStream | undefined)?.toURL() ?? null;
  const hasLocalPublishedVideo = localParticipant ? hasVideo(localParticipant) : false;
  const pipWidth = Math.min(Math.max(screenWidth * 0.3, 112), 132);
  const pipHeight = Math.round(pipWidth * 1.46);
  const controlsBottom = Math.max(insets.bottom + 16, 24);

  React.useEffect(() => {
    callManager.start({
      audioRole: 'communicator',
      deviceEndpointType: 'speaker',
    });
    callManager.speaker.setForceSpeakerphoneOn(true);

    return () => {
      callManager.stop();
    };
  }, []);

  React.useEffect(() => {
    setMainViewMode('remote');
  }, [callId]);

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

  React.useEffect(() => {
    if (!callId || callingState !== CallingState.JOINED || !localParticipantId) {
      return;
    }

    if (cameraEnabledForCallRef.current.has(callId)) return;
    if (manualCameraDisabledForCallRef.current.has(callId)) return;
    if (cameraEnableInFlightRef.current.has(callId)) return;
    if (hasLocalPublishedVideo) {
      cameraEnabledForCallRef.current.add(callId);
      return;
    }

    cameraEnableInFlightRef.current.add(callId);
    void (async () => {
      try {
        await camera.enable();
        cameraEnabledForCallRef.current.add(callId);
      } catch (error) {
        console.log('[ActiveVideoStage] camera enable error', {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        cameraEnableInFlightRef.current.delete(callId);
      }
    })();
  }, [callId, callingState, camera, hasLocalPublishedVideo, localParticipantId]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(chromeOpacity, {
        toValue: chromeVisible ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(chromeTranslateY, {
        toValue: chromeVisible ? 0 : 12,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [chromeOpacity, chromeTranslateY, chromeVisible]);

  const localCameraState = getParticipantCameraState({
    participant: localParticipant ?? null,
    isLocal: true,
    localCameraMuted: cameraIsMute,
    localStreamUrl,
    remoteIncomingVideoEnabled: false,
  });

  const remoteCameraState = getParticipantCameraState({
    participant: remoteParticipant,
    isLocal: false,
    localCameraMuted: false,
    localStreamUrl: null,
    remoteIncomingVideoEnabled: remoteParticipant ? isParticipantVideoEnabled(remoteParticipant.sessionId) : false,
  });

  const mainSlot: VideoStageSlot =
    mainViewMode === 'remote'
      ? {
          participant: remoteParticipant,
          isLocal: false,
          label: partnerName,
          slot: 'main',
          cameraState: remoteCameraState,
          rendererKey: buildRendererKey({
            participant: remoteParticipant,
            slot: 'main',
            isLocal: false,
            mainViewMode,
            cameraState: remoteCameraState,
          }),
        }
      : {
          participant: localParticipant ?? null,
          isLocal: true,
          label: 'Tú',
          slot: 'main',
          cameraState: localCameraState,
          rendererKey: buildRendererKey({
            participant: localParticipant ?? null,
            slot: 'main',
            isLocal: true,
            mainViewMode,
            cameraState: localCameraState,
          }),
        };

  const pipSlot: VideoStageSlot =
    mainViewMode === 'remote'
      ? {
          participant: localParticipant ?? null,
          isLocal: true,
          label: 'Tú',
          slot: 'pip',
          cameraState: localCameraState,
          rendererKey: buildRendererKey({
            participant: localParticipant ?? null,
            slot: 'pip',
            isLocal: true,
            mainViewMode,
            cameraState: localCameraState,
          }),
        }
      : {
          participant: remoteParticipant,
          isLocal: false,
          label: partnerName,
          slot: 'pip',
          cameraState: remoteCameraState,
          rendererKey: buildRendererKey({
            participant: remoteParticipant,
            slot: 'pip',
            isLocal: false,
            mainViewMode,
            cameraState: remoteCameraState,
          }),
        };

  console.log('[ActiveVideoStage] slots', {
    mainViewMode,
    localParticipantId: localParticipant?.userId ?? null,
    remoteParticipantId: remoteParticipant?.userId ?? null,
    mainIsLocal: mainSlot.isLocal,
    pipIsLocal: pipSlot.isLocal,
  });

  const statusText =
    callingState === CallingState.JOINED ? (elapsedSeconds > 0 ? formatElapsed(elapsedSeconds) : 'En llamada') : 'Conectando...';

  const toggleMicrophone = React.useCallback(async () => {
    try {
      await microphone.toggle();
    } catch (error) {
      console.log('[ActiveVideoStage] microphone toggle error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [microphone]);

  const toggleCamera = React.useCallback(async () => {
    try {
      if (callId) {
        if (cameraIsMute) {
          manualCameraDisabledForCallRef.current.delete(callId);
        } else {
          manualCameraDisabledForCallRef.current.add(callId);
        }
      }

      await camera.toggle();
      if (callId && cameraIsMute) {
        cameraEnabledForCallRef.current.add(callId);
      }
    } catch (error) {
      console.log('[ActiveVideoStage] camera toggle error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [callId, camera, cameraIsMute]);

  const flipCamera = React.useCallback(async () => {
    try {
      await camera.flip();
    } catch (error) {
      console.log('[ActiveVideoStage] camera flip error', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [camera]);

  const swapVideoViews = React.useCallback(() => {
    setMainViewMode((previous) => (previous === 'remote' ? 'local' : 'remote'));
  }, []);

  return (
    <View style={styles.videoCallShell}>
      <View style={styles.videoStage}>
        <VideoSlot
          participant={mainSlot.participant}
          isLocal={mainSlot.isLocal}
          label={mainSlot.label}
          slot={mainSlot.slot}
          cameraState={mainSlot.cameraState}
          rendererKey={mainSlot.rendererKey}
          streamURL={mainSlot.isLocal ? localStreamUrl : null}
          partnerAvatarUrl={partnerAvatarUrl}
        />

        <Pressable style={StyleSheet.absoluteFill} onPress={() => setChromeVisible((previous) => !previous)} />

        <VideoSlot
          participant={pipSlot.participant}
          isLocal={pipSlot.isLocal}
          label={pipSlot.label}
          slot={pipSlot.slot}
          cameraState={pipSlot.cameraState}
          rendererKey={pipSlot.rendererKey}
          streamURL={pipSlot.isLocal ? localStreamUrl : null}
          partnerAvatarUrl={partnerAvatarUrl}
          onPress={swapVideoViews}
          pipStyle={{
            top: insets.top + 60,
            right: 18,
            width: pipWidth,
            height: pipHeight,
          }}
          overlayStyle={{
            opacity: chromeOpacity,
            transform: [{ translateY: chromeTranslateY.interpolate({ inputRange: [0, 12], outputRange: [0, -6] }) }],
          }}
        />

        <Animated.View
          pointerEvents={chromeVisible ? 'auto' : 'none'}
          style={[
            styles.videoTopInfo,
            {
              top: insets.top + 16,
              opacity: chromeOpacity,
              transform: [{ translateY: chromeTranslateY.interpolate({ inputRange: [0, 12], outputRange: [0, -12] }) }],
            },
          ]}
        >
          <Text style={styles.videoTitle}>Videollamada</Text>
          <Text style={styles.videoStatus}>{statusText}</Text>
        </Animated.View>

        <Animated.View
          pointerEvents={chromeVisible ? 'auto' : 'none'}
          style={[
            styles.videoPartnerInfo,
            {
              bottom: controlsBottom + 92,
              opacity: chromeOpacity,
              transform: [{ translateY: chromeTranslateY.interpolate({ inputRange: [0, 12], outputRange: [0, 10] }) }],
            },
          ]}
        >
          <Text style={styles.videoPartnerName}>{mainSlot.label}</Text>
        </Animated.View>

        <Animated.View
          pointerEvents={chromeVisible ? 'auto' : 'none'}
          style={[
            styles.videoControlsDock,
            {
              bottom: controlsBottom,
              opacity: chromeOpacity,
              transform: [{ translateY: chromeTranslateY }],
            },
          ]}
        >
          <VideoControlButton
            icon={microphoneMuted ? <MicOff size={20} color="#FFFFFF" /> : <Mic size={20} color="#FFFFFF" />}
            accessibilityLabel={microphoneMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            active={!microphoneMuted}
            onPress={() => {
              void toggleMicrophone();
            }}
          />
          <VideoControlButton
            icon={cameraMuted ? <CameraOff size={20} color="#FFFFFF" /> : <Camera size={20} color="#FFFFFF" />}
            accessibilityLabel={cameraMuted ? 'Activar cámara' : 'Desactivar cámara'}
            active={!cameraMuted}
            onPress={() => {
              void toggleCamera();
            }}
          />
          <VideoControlButton
            icon={<RefreshCw size={18} color="#FFFFFF" />}
            accessibilityLabel="Cambiar cámara"
            onPress={() => {
              void flipCamera();
            }}
          />
          <VideoControlButton
            icon={<PhoneOff size={20} color="#FFFFFF" />}
            accessibilityLabel="Finalizar llamada"
            danger
            onPress={() => {
              void onEnd('user');
            }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoCallShell: {
    flex: 1,
    backgroundColor: '#0F0C12',
  },
  videoStage: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#111111',
  },
  mainSlot: {
    flex: 1,
    backgroundColor: '#111111',
  },
  mainRtcView: {
    width: '100%',
    height: '100%',
  },
  mainParticipantView: {
    width: '100%',
    height: '100%',
  },
  mainPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#111111',
  },
  mainPlaceholderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  mainPlaceholderSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  pipPosition: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 132,
    height: 193,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    zIndex: 100,
    elevation: 100,
  },
  pipCard: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,16,24,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pipVideoHost: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: 'hidden',
  },
  pipRtcView: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  pipParticipantView: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  pipPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,16,24,0.84)',
  },
  pipEmptyState: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,16,24,0.84)',
  },
  pipLabelLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: 10,
    paddingBottom: 10,
    zIndex: 5,
    elevation: 5,
  },
  pipLabelChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15,12,18,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pipLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  videoTopInfo: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 6,
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
  videoPartnerInfo: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  videoPartnerName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  videoControlsDock: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 12, 20, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  videoControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  videoControlButtonNeutral: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  videoControlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  videoControlButtonDanger: {
    backgroundColor: 'rgba(240,111,143,0.96)',
    borderColor: 'rgba(255,255,255,0.08)',
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
