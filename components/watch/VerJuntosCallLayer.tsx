import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraOff, UserRound } from 'lucide-react-native';
import {
  CallingState,
  ParticipantView,
  StreamCall,
  StreamVideo,
  useCallStateHooks,
  type Call,
  type StreamVideoClient,
} from '@stream-io/video-react-native-sdk';

type VerJuntosCallProviderProps = {
  client: StreamVideoClient;
  call: Call;
  children: React.ReactNode;
};

type VerJuntosParticipantsViewProps = {
  currentUserId?: string;
};

type VerJuntosLocalParticipantViewProps = {
  currentUserId?: string;
  isCameraOn: boolean;
  label?: string;
};

const getParticipantUserId = (participant: any) =>
  participant?.userId || participant?.user_id || participant?.user?.id || null;

type VerJuntosTileVideoProps = {
  currentUserId?: string;
  participantUserId?: string;
  style?: any;
};

export function VerJuntosCallProvider({ client, call, children }: VerJuntosCallProviderProps) {
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>{children}</StreamCall>
    </StreamVideo>
  );
}

export function VerJuntosLocalTileVideo({ currentUserId, style }: VerJuntosTileVideoProps) {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  const localParticipant =
    participants.find((participant) => String(getParticipantUserId(participant)) === String(currentUserId ?? '')) ||
    participants.find((participant) => participant?.isLocalParticipant);

  if (callingState !== CallingState.JOINED || !localParticipant) return null;

  return <ParticipantView participant={localParticipant} style={style} />;
}

export function VerJuntosRemoteTileVideo({ currentUserId, participantUserId, style }: VerJuntosTileVideoProps) {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  const remoteParticipants = participants.filter(
    (participant) => String(getParticipantUserId(participant)) !== String(currentUserId ?? '')
  );

  const target =
    (participantUserId
      ? remoteParticipants.find((p) => String(getParticipantUserId(p)) === String(participantUserId))
      : null) || remoteParticipants[0];

  if (callingState !== CallingState.JOINED || !target) return null;

  return <ParticipantView participant={target} style={style} />;
}

export function VerJuntosParticipantsView({ currentUserId }: VerJuntosParticipantsViewProps) {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  React.useEffect(() => {
    const hasUnknownUserId = participants.some((participant) => !getParticipantUserId(participant));
    if (hasUnknownUserId) {
      console.log('stream participants:', participants);
    }
  }, [participants]);

  const remoteParticipants = participants.filter(
    (participant) => String(getParticipantUserId(participant)) !== String(currentUserId ?? '')
  );

  const partnerParticipant = remoteParticipants[0];

  if (callingState !== CallingState.JOINED) {
    return (
      <View style={styles.callConnectingState}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.callConnectingText}>Conectando llamada...</Text>
      </View>
    );
  }

  return (
    <View style={styles.callParticipantsLayer}>
      <View style={styles.partnerMainVideo}>
        {partnerParticipant ? (
          <ParticipantView participant={partnerParticipant} style={styles.partnerMainVideoFill} />
        ) : (
          <View style={styles.partnerWaitingState}>
            <UserRound size={54} color="#fff" />
            <Text style={styles.partnerWaitingTitle}>Esperando a tu pareja</Text>
            <Text style={styles.partnerWaitingSubtitle}>Cuando se una, aparecera aqui.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function VerJuntosLocalParticipantView({
  currentUserId,
  isCameraOn,
  label = 'Tu',
}: VerJuntosLocalParticipantViewProps) {
  const { useCallCallingState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participants = useParticipants();

  const localParticipant =
    participants.find((participant) => String(getParticipantUserId(participant)) === String(currentUserId ?? '')) ||
    participants.find((participant) => participant?.isLocalParticipant);

  if (callingState !== CallingState.JOINED || !localParticipant || !isCameraOn) {
    return (
      <View style={styles.localCameraOffState}>
        <CameraOff size={24} color="#fff" />
        <Text style={styles.localCameraOffText}>{label}</Text>
      </View>
    );
  }

  return <ParticipantView participant={localParticipant} style={styles.localFloatingVideoFill} />;
}

const styles = StyleSheet.create({
  callParticipantsLayer: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  partnerMainVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
  },
  partnerMainVideoFill: {
    width: '100%',
    height: '100%',
  },
  partnerWaitingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  partnerWaitingTitle: {
    marginTop: 10,
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  partnerWaitingSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  localFloatingVideoFill: {
    width: '100%',
    height: '100%',
  },
  localCameraOffState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,166,181,0.35)',
  },
  localCameraOffText: {
    marginTop: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  callConnectingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  callConnectingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
