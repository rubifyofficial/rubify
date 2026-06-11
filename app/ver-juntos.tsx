import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera as ExpoCamera } from 'expo-camera';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  MessageCircle,
  PhoneOff,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { useProfileAndCouple } from '../lib/useProfileAndCouple';
import { getSafeUser, supabase } from '../lib/supabase';
import { getStreamVideoClient } from '../lib/streamVideo';
import type { Call, StreamVideoClient } from '@stream-io/video-react-native-sdk';
import {
  VerJuntosCallProvider,
  VerJuntosLocalTileVideo,
  VerJuntosParticipantsView,
  VerJuntosRemoteTileVideo,
} from '../components/watch/VerJuntosCallLayer';

const COLORS = {
  bg: '#FFFFFF',
  primaryPink: '#F7A6B5',
  softPink: '#FDECEF',
  darkText: '#222222',
  mutedText: '#9A9AA3',
  cardBorder: '#F4D8DE',
  white: '#FFFFFF',
  roomDark: '#18181B',
  roomDark2: '#222228',
  roomStroke: 'rgba(255,255,255,0.14)',
};

type WatchItem = {
  id: string;
  couple_id?: string;
  created_by?: string;
  title: string;
  type: 'Película' | 'Serie';
  status: string;
  created_at?: string;
  updated_at?: string;
};

type WatchRoom = {
  id: string;
  couple_id: string;
  started_by: string | null;
  active: boolean | null;
  selected_item_id: string | null;
  participant_ids?: string[] | null;
  invited_user_id?: string | null;
  last_joined_by?: string | null;
  last_joined_at?: string | null;
  last_left_by?: string | null;
  room_participants?: any[] | null;
  participant_status?: Record<string, { mic?: boolean; camera?: boolean; screen?: boolean; updated_at?: string }>;
  invite_status?: string | null;
  room_title?: string | null;
  room_status?: 'idle' | 'waiting' | 'active' | 'ended' | string | null;
  is_screen_sharing: boolean | null;
  is_mic_on: boolean | null;
  is_camera_on: boolean | null;
  room_chat_open: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string | null;
};

type WatchRoomMessage = {
  id: string;
  room_id?: string | null;
  couple_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type PartnerProfile = {
  id: string;
  name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  photo_url?: string | null;
} | null;

export default function VerJuntosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ autoCall?: string; source?: string; callKind?: string }>();
  const { height } = useWindowDimensions();
  const { profile, couple, loading: profileLoading } = useProfileAndCouple();
  const coupleId = couple?.couple_id || (profile as any)?.couple_id || null;
  const currentUserId = profile?.id ?? null;
  const isSmallScreen = height < 760;
  const shouldReturnOnHangup = params?.source === 'messages';

  const partnerName = couple?.partner_name || 'Tu pareja';

  const [isRoomActive, setIsRoomActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRoomChatOpen, setIsRoomChatOpen] = useState(false);
  const [selectedWatchItem, setSelectedWatchItem] = useState<WatchItem | null>(null);

  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftType, setDraftType] = useState<WatchItem['type']>('Película');
  const [roomMessageText, setRoomMessageText] = useState('');
  const [roomMessages, setRoomMessages] = useState<WatchRoomMessage[]>([]);
  const [watchItems, setWatchItems] = useState<WatchItem[]>([]);
  const [loadingWatchItems, setLoadingWatchItems] = useState(true);
  const [watchRoom, setWatchRoom] = useState<WatchRoom | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile>(null);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(null);
  const [streamCall, setStreamCall] = useState<Call | null>(null);
  const [isJoiningCall, setIsJoiningCall] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [myRoomStatus, setMyRoomStatus] = useState({ mic: true, camera: true, screen: false });
  const [partnerRoomStatus, setPartnerRoomStatus] = useState({ mic: false, camera: false, screen: false });
  const streamCallRef = useRef<Call | null>(null);
  const fetchingRef = useRef({ items: false, room: false, messages: false });
  const screenShareFallbackShownRef = useRef(false);
  const autoCallHandledRef = useRef(false);

  const suggestion = useMemo(() => watchItems.find((x) => x.status === 'Pendiente') ?? null, [watchItems]);
  const toWatch = useMemo(() => watchItems.filter((x) => x.status === 'Pendiente'), [watchItems]);
  const watched = useMemo(() => watchItems.filter((x) => x.status === 'Visto'), [watchItems]);

  const applyRoomToState = useCallback(
    (room: WatchRoom | null) => {
      if (!room) return;
      setWatchRoom(room);

      const isCurrentUserParticipant = currentUserId
        ? (room.participant_ids ?? []).some((id) => String(id) === String(currentUserId))
        : false;

      setIsRoomActive(!!room.active && isCurrentUserParticipant);
      setIsScreenSharing(!!room.is_screen_sharing);
      setIsMicOn(room.is_mic_on ?? true);
      setIsCameraOn(room.is_camera_on ?? true);
      setIsRoomChatOpen(!!room.room_chat_open);
    },
    [currentUserId]
  );

  useEffect(() => {
    if (!watchRoom?.selected_item_id) return;
    const selected = watchItems.find((item) => String(item.id) === String(watchRoom.selected_item_id));
    setSelectedWatchItem(selected || null);
  }, [watchRoom?.selected_item_id, watchItems]);

  useEffect(() => {
    if (!watchRoom || !currentUserId) return;

    const statusMap = watchRoom.participant_status || {};
    const myStatus = statusMap[currentUserId] || {
      mic: watchRoom.is_mic_on ?? true,
      camera: watchRoom.is_camera_on ?? true,
      screen: watchRoom.is_screen_sharing ?? false,
    };

    const partnerEntry = Object.entries(statusMap).find(([userId]) => String(userId) !== String(currentUserId));
    const partnerStatus = (partnerEntry?.[1] as any) || {
      mic: false,
      camera: false,
      screen: false,
    };

    setMyRoomStatus({
      mic: myStatus.mic ?? true,
      camera: myStatus.camera ?? true,
      screen: myStatus.screen ?? false,
    });
    setPartnerRoomStatus({
      mic: partnerStatus.mic ?? false,
      camera: partnerStatus.camera ?? false,
      screen: partnerStatus.screen ?? false,
    });
  }, [watchRoom, currentUserId]);

  useEffect(() => {
    if (!coupleId || !currentUserId) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar_url, photo_url')
        .eq('couple_id', coupleId)
        .neq('id', currentUserId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.log('fetch partner profile error:', error);
        return;
      }
      setPartnerProfile((data as any) ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [coupleId, currentUserId]);

  useEffect(() => {
    if (!watchRoom?.active) {
      setInviteDismissed(false);
      setIsFullscreen(false);
    }
  }, [watchRoom?.active]);

  useEffect(() => {
    if (!isRoomActive) {
      setIsFullscreen(false);
    }
  }, [isRoomActive]);

  const fetchWatchItems = useCallback(async () => {
    if (!coupleId) return;
    if (fetchingRef.current.items) return;
    fetchingRef.current.items = true;

    setLoadingWatchItems(true);
    try {
      const { data, error } = await supabase
        .from('watch_together_items')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false });

      setLoadingWatchItems(false);

      if (error) {
        console.log('fetch watch items error:', error);
        return;
      }

      setWatchItems((data as any[]) ?? []);
    } finally {
      fetchingRef.current.items = false;
    }
  }, [coupleId]);

  const fetchWatchRoom = useCallback(async () => {
    if (!coupleId) return;
    if (fetchingRef.current.room) return;
    fetchingRef.current.room = true;

    try {
      const { data, error } = await supabase
        .from('watch_together_rooms')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log('fetch watch room error:', error);
        return;
      }

      if (!data) {
        const { data: createdRoom, error: createError } = await supabase
          .from('watch_together_rooms')
          .insert({
            couple_id: coupleId,
            active: false,
          })
          .select()
          .single();

        if (createError) {
          console.log('create watch room error:', createError);
          const { data: retryRoom, error: retryError } = await supabase
            .from('watch_together_rooms')
            .select('*')
            .eq('couple_id', coupleId)
            .maybeSingle();
          if (retryError) console.log('fetch watch room retry error:', retryError);
          if (retryRoom) {
            setWatchRoom(retryRoom as any);
            applyRoomToState(retryRoom as any);
          }
          return;
        }

        setWatchRoom(createdRoom as any);
        applyRoomToState(createdRoom as any);
        return;
      }

      setWatchRoom(data as any);
      applyRoomToState(data as any);
    } finally {
      fetchingRef.current.room = false;
    }
  }, [applyRoomToState, coupleId]);

  const fetchRoomMessages = useCallback(async (roomId?: string | null) => {
    if (!coupleId || !roomId) return;
    if (fetchingRef.current.messages) return;
    fetchingRef.current.messages = true;

    try {
      const { data, error } = await supabase
        .from('watch_room_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.log('fetch room messages error:', error);
        return;
      }

      setRoomMessages((data as any[]) ?? []);
    } finally {
      fetchingRef.current.messages = false;
    }
  }, [coupleId]);

  const findActiveWatchRoom = useCallback(async () => {
    if (!coupleId) return null;

    const { data, error } = await supabase
      .from('watch_together_rooms')
      .select('*')
      .eq('couple_id', coupleId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('find active watch room error:', error);
      return null;
    }

    return (data as any) ?? null;
  }, [coupleId]);

  const ensureCallPermissions = useCallback(
    async (options?: { needCamera?: boolean; needMicrophone?: boolean }) => {
      const needCamera = options?.needCamera ?? true;
      const needMicrophone = options?.needMicrophone ?? true;

      try {
        if (needCamera) {
          const currentCamera = await ExpoCamera.getCameraPermissionsAsync();
          const cameraResult =
            currentCamera.granted || currentCamera.status === 'granted'
              ? currentCamera
              : await ExpoCamera.requestCameraPermissionsAsync();

          if (!cameraResult.granted && cameraResult.status !== 'granted') {
            Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para iniciar la videollamada.');
            return false;
          }
        }

        if (needMicrophone && Platform.OS === 'android') {
          const micResult = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (micResult !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono para hablar en la sala.');
            return false;
          }
        }

        return true;
      } catch (error) {
        console.log('ensure call permissions error:', error);
        Alert.alert('Error', 'No se pudieron solicitar los permisos de llamada.');
        return false;
      }
    },
    []
  );

  const updateWatchRoom = useCallback(
    async (patch: Partial<WatchRoom>, roomId?: string | null) => {
      const targetRoomId = roomId || watchRoom?.id || (await findActiveWatchRoom())?.id;
      if (!targetRoomId) return null;

      setWatchRoom((prev) => ({ ...(prev || ({} as any)), ...(patch as any), id: targetRoomId } as any));

      const { data, error } = await supabase
        .from('watch_together_rooms')
        .update({
          ...(patch as any),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetRoomId)
        .select()
        .single();

      if (error) {
        console.log('update watch room error:', error);
        fetchWatchRoom();
        return null;
      }

      setWatchRoom(data as any);
      applyRoomToState(data as any);
      return data as any;
    },
    [applyRoomToState, fetchWatchRoom, findActiveWatchRoom, watchRoom?.id]
  );

  const updateMyParticipantStatus = useCallback(
    async (nextStatus: Partial<{ mic: boolean; camera: boolean; screen: boolean }>) => {
      try {
        const user = await getSafeUser();
        if (!watchRoom?.id || !user?.id) return;

        const currentMap = watchRoom.participant_status || {};
        const currentMyStatus = currentMap[user.id] || {
          mic: myRoomStatus.mic,
          camera: myRoomStatus.camera,
          screen: myRoomStatus.screen,
        };

        const updatedMyStatus = {
          ...currentMyStatus,
          ...nextStatus,
          updated_at: new Date().toISOString(),
        };

        const updatedMap = {
          ...currentMap,
          [user.id]: updatedMyStatus,
        };

        setMyRoomStatus({
          mic: updatedMyStatus.mic ?? true,
          camera: updatedMyStatus.camera ?? true,
          screen: updatedMyStatus.screen ?? false,
        });
        setWatchRoom((prev) =>
          prev
            ? ({
                ...prev,
                participant_status: updatedMap,
                is_mic_on: updatedMyStatus.mic,
                is_camera_on: updatedMyStatus.camera,
                is_screen_sharing: updatedMyStatus.screen,
                updated_at: new Date().toISOString(),
              } as any)
            : prev
        );

        const { error } = await supabase
          .from('watch_together_rooms')
          .update({
            participant_status: updatedMap,
            is_mic_on: updatedMyStatus.mic,
            is_camera_on: updatedMyStatus.camera,
            is_screen_sharing: updatedMyStatus.screen,
            updated_at: new Date().toISOString(),
          })
          .eq('id', watchRoom.id);

        if (error) {
          console.log('update participant status error:', error);
          Alert.alert('Error', error.message || 'No se pudo actualizar el estado.');
        }
      } catch (error) {
        console.log('updateMyParticipantStatus catch:', error);
      }
    },
    [myRoomStatus.camera, myRoomStatus.mic, myRoomStatus.screen, watchRoom]
  );

  const leaveWatchCall = useCallback(async () => {
    try {
      const activeCall = streamCallRef.current;
      if (activeCall) {
        try {
          const anyCall = activeCall as any;
          await anyCall?.screenShare?.disable?.();
          await anyCall?.screenSharing?.disable?.();
          await anyCall?.microphone?.disable?.();
          await anyCall?.camera?.disable?.();
        } catch (error) {
          console.log('pre-leave devices cleanup ignored:', error);
        }
        await activeCall.leave();
      }
    } catch (error) {
      console.log('leaveWatchCall ignored:', error);
    } finally {
      streamCallRef.current = null;
      setStreamCall(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      leaveWatchCall().catch((error) => {
        console.log('watch call cleanup ignored:', error);
      });
    };
  }, [leaveWatchCall]);

  const joinWatchCall = useCallback(async () => {
    try {
      const partnerIdForFallback = (couple as any)?.partner_id ?? partnerProfile?.id ?? null;
      const computedCallId = coupleId
        ? `couple-${coupleId}`
        : currentUserId && partnerIdForFallback
          ? `direct-${[String(currentUserId), String(partnerIdForFallback)].sort().join('-')}`
          : currentUserId
            ? `user-${currentUserId}`
            : null;
      if (!computedCallId) return;

      setIsJoiningCall(true);
      setCallError(null);

      const hasPermissions = await ensureCallPermissions({
        needCamera: myRoomStatus.camera,
        needMicrophone: myRoomStatus.mic,
      });
      if (!hasPermissions) {
        setCallError('No se pudo iniciar la llamada sin permisos de cámara o micrófono.');
        return;
      }

      const client = await getStreamVideoClient();

      if (!client) {
        setCallError('No se pudo iniciar la llamada.');
        return;
      }

      const currentCall = streamCallRef.current;
      if ((currentCall as any)?.id === computedCallId) {
        setStreamClient(client);
        setStreamCall(currentCall);
        return;
      }

      if (currentCall) {
        try {
          await currentCall.leave();
        } catch (error) {
          console.log('replace existing watch call ignored:', error);
        }
      }

      const call = client.call('default', computedCallId);
      await call.join({ create: true });

      try {
        if (myRoomStatus.mic) {
          await (call as any)?.microphone?.enable?.();
        } else {
          await (call as any)?.microphone?.disable?.();
        }
        if (myRoomStatus.camera) {
          await (call as any)?.camera?.enable?.();
        } else {
          await (call as any)?.camera?.disable?.();
        }
        if (myRoomStatus.screen) {
          await (call as any)?.screenShare?.enable?.();
          await (call as any)?.screenSharing?.enable?.();
        } else {
          await (call as any)?.screenShare?.disable?.();
          await (call as any)?.screenSharing?.disable?.();
        }
      } catch (error) {
        console.log('sync devices after join ignored:', error);
      }

      streamCallRef.current = call;
      setStreamClient(client);
      setStreamCall(call);

      console.log('joined watch call:', computedCallId);
    } catch (error: any) {
      console.log('joinWatchCall error:', error);
      setCallError(error?.message || 'No se pudo iniciar la llamada.');
    } finally {
      setIsJoiningCall(false);
    }
  }, [
    couple,
    coupleId,
    currentUserId,
    ensureCallPermissions,
    myRoomStatus.camera,
    myRoomStatus.mic,
    myRoomStatus.screen,
    partnerProfile?.id,
  ]);

  const startRoom = useCallback(async () => {
    try {
      const user = await getSafeUser();
      if (!user || !coupleId) {
        Alert.alert('Error', 'No se pudo encontrar la pareja.');
        return;
      }

      const existingRoom = await findActiveWatchRoom();

      if (existingRoom) {
        const participantIds = Array.isArray(existingRoom.participant_ids) ? existingRoom.participant_ids : [];
        const nextParticipantIds = participantIds.includes(user.id) ? participantIds : [...participantIds, user.id];
        const currentParticipantStatus = existingRoom.participant_status || {};

        const { data: updatedRoom, error: updateError } = await supabase
          .from('watch_together_rooms')
          .update({
            last_joined_by: user.id,
            last_joined_at: new Date().toISOString(),
            participant_ids: nextParticipantIds,
            room_status: 'active',
            participant_status: {
              ...currentParticipantStatus,
              [user.id]: {
                mic: true,
                camera: true,
                screen: false,
                updated_at: new Date().toISOString(),
              },
            },
            is_mic_on: true,
            is_camera_on: true,
            is_screen_sharing: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRoom.id)
          .select()
          .single();

        if (updateError) {
          console.log('update watch room error:', updateError);
          Alert.alert('Error', updateError.message || 'No se pudo entrar a la sala.');
          return;
        }

        setWatchRoom(updatedRoom as any);
        applyRoomToState(updatedRoom as any);
        setInviteDismissed(false);
        await joinWatchCall();
        return;
      }

      const now = new Date().toISOString();
      const insertPayload = {
        couple_id: coupleId,
        started_by: user.id,
        last_joined_by: user.id,
        last_joined_at: now,
        participant_ids: [user.id],
        room_participants: [
          {
            user_id: user.id,
            joined_at: now,
          },
        ],
        participant_status: {
          [user.id]: {
            mic: true,
            camera: true,
            screen: false,
            updated_at: now,
          },
        },
        active: true,
        room_status: 'active',
        invite_status: 'idle',
        room_chat_open: false,
        is_screen_sharing: false,
        is_mic_on: true,
        is_camera_on: true,
        started_at: now,
        created_at: now,
        updated_at: now,
      };

      const { data: newRoom, error: insertError } = await supabase
        .from('watch_together_rooms')
        .insert(insertPayload as any)
        .select()
        .single();

      if (insertError) {
        console.log('insert watch room error:', insertError);
        Alert.alert('Error', insertError.message || 'No se pudo crear la sala.');
        return;
      }

      setWatchRoom(newRoom as any);
      applyRoomToState(newRoom as any);
      setInviteDismissed(false);
      await joinWatchCall();
    } catch (error: any) {
      console.log('createOrJoinWatchRoom catch:', error);
      Alert.alert('Error', error?.message || 'No se pudo crear la sala.');
    }
  }, [applyRoomToState, coupleId, findActiveWatchRoom, joinWatchCall]);

  const joinRoom = useCallback(async () => {
    const user = await getSafeUser();
    if (!watchRoom || !coupleId || !user?.id) {
      console.log('joinRoom missing:', {
        watchRoom,
        coupleId,
        userId: user?.id ?? null,
      });
      return;
    }

    const existingParticipants = Array.isArray(watchRoom.participant_ids) ? watchRoom.participant_ids : [];
    const nextParticipants = Array.from(new Set([...existingParticipants.map(String), String(user.id)]));
    const currentParticipantStatus = watchRoom.participant_status || {};

    setIsRoomActive(true);

    const patch = {
      participant_ids: nextParticipants,
      last_joined_by: user.id,
      last_joined_at: new Date().toISOString(),
      room_status: nextParticipants.length >= 2 ? 'active' : 'waiting',
      participant_status: {
        ...currentParticipantStatus,
        [user.id]: {
          mic: true,
          camera: true,
          screen: false,
          updated_at: new Date().toISOString(),
        },
      },
      is_mic_on: true,
      is_camera_on: true,
      is_screen_sharing: false,
      active: true,
      updated_at: new Date().toISOString(),
    };

    console.log('join room patch:', patch);

    const { data, error } = await supabase
      .from('watch_together_rooms')
      .update(patch as any)
      .eq('id', watchRoom.id)
      .select()
      .single();

    console.log('join room data:', data);
    console.log('join room error:', error);

    if (error) {
      Alert.alert('Error', error.message || 'No se pudo unir a la sala.');
      return;
    }

    setWatchRoom(data as any);
    applyRoomToState(data as any);
    setInviteDismissed(false);

    await joinWatchCall();
  }, [applyRoomToState, coupleId, joinWatchCall, watchRoom]);

  const declineRoomInvite = useCallback(async () => {
    setInviteDismissed(true);

    if (!watchRoom?.id) return;

    await updateWatchRoom(
      {
        invite_status: 'declined',
        last_left_by: currentUserId,
      } as any,
      watchRoom.id
    );
  }, [currentUserId, updateWatchRoom, watchRoom?.id]);

  const leaveRoom = useCallback(async () => {
    if (!watchRoom) return;
    const user = await getSafeUser();
    const currentId = user?.id ?? currentUserId;
    if (!currentId) return;

    const nextParticipants = (watchRoom.participant_ids ?? []).filter((id) => String(id) !== String(currentId));

    setIsRoomActive(false);
    setIsFullscreen(false);

    await updateWatchRoom({
      participant_ids: nextParticipants,
      last_left_by: currentId,
      room_status: nextParticipants.length > 0 ? 'waiting' : 'idle',
      active: nextParticipants.length > 0,
    } as any);

    await leaveWatchCall();

    if (shouldReturnOnHangup && router.canGoBack()) {
      router.back();
    }
  }, [currentUserId, leaveWatchCall, router, shouldReturnOnHangup, updateWatchRoom, watchRoom]);

  const endRoom = useCallback(async () => {
    setIsRoomActive(false);
    setIsScreenSharing(false);
    setIsRoomChatOpen(false);
    setIsFullscreen(false);
    setIsMicOn(true);
    setIsCameraOn(true);
    setCallError(null);

    const updatedRoom = await updateWatchRoom({
      active: false,
      room_status: 'ended',
      participant_ids: [],
      invited_user_id: null,
      selected_item_id: null,
      is_screen_sharing: false,
      room_chat_open: false,
      ended_at: new Date().toISOString(),
    } as any, watchRoom?.id);

    if (!updatedRoom) {
      Alert.alert('Error', 'No se pudo cerrar la sala.');
      return;
    }

    await leaveWatchCall();
    setWatchRoom(null);
    setIsRoomActive(false);
    if (shouldReturnOnHangup && router.canGoBack()) {
      router.back();
    }
  }, [leaveWatchCall, router, shouldReturnOnHangup, updateWatchRoom, watchRoom?.id]);

  const toggleMic = useCallback(async () => {
    const next = !myRoomStatus.mic;

    if (next) {
      const hasPermissions = await ensureCallPermissions({ needCamera: false, needMicrophone: true });
      if (!hasPermissions) return;
    }

    setIsMicOn(next);
    await updateMyParticipantStatus({ mic: next });

    try {
      if (streamCallRef.current) {
        if (next) {
          await streamCallRef.current.microphone.enable();
        } else {
          await streamCallRef.current.microphone.disable();
        }
      }
    } catch (error) {
      console.log('toggle mic call error:', error);
    }
  }, [ensureCallPermissions, myRoomStatus.mic, updateMyParticipantStatus]);

  const toggleCamera = useCallback(async () => {
    const next = !myRoomStatus.camera;

    if (next) {
      const hasPermissions = await ensureCallPermissions({ needCamera: true, needMicrophone: false });
      if (!hasPermissions) return;
    }

    setIsCameraOn(next);
    await updateMyParticipantStatus({ camera: next });

    try {
      if (streamCallRef.current) {
        if (next) {
          await streamCallRef.current.camera.enable();
        } else {
          await streamCallRef.current.camera.disable();
        }
      }
    } catch (error) {
      console.log('toggle camera call error:', error);
    }
  }, [ensureCallPermissions, myRoomStatus.camera, updateMyParticipantStatus]);

  const toggleScreenSharing = useCallback(async () => {
    const next = !myRoomStatus.screen;
    setIsScreenSharing(next);
    await updateMyParticipantStatus({ screen: next });

    try {
      const call = streamCallRef.current as any;
      if (call) {
        if (next) {
          const hasScreenShareApi = !!call?.screenShare?.enable || !!call?.screenSharing?.enable;
          if (!hasScreenShareApi) {
            if (!screenShareFallbackShownRef.current) {
              screenShareFallbackShownRef.current = true;
              Alert.alert(
                'Pantalla',
                'La compartición de pantalla todavía depende del soporte nativo del dispositivo. Dejamos el botón listo sin bloquear la sala.'
              );
            }
          } else {
            await call?.screenShare?.enable?.();
            await call?.screenSharing?.enable?.();
          }
        } else {
          await call?.screenShare?.disable?.();
          await call?.screenSharing?.disable?.();
        }
      }
    } catch (error) {
      console.log('toggle screen share call error:', error);
    }
  }, [myRoomStatus.screen, updateMyParticipantStatus]);

  const toggleRoomChat = useCallback(async () => {
    const next = !isRoomChatOpen;
    setIsRoomChatOpen(next);
    await updateWatchRoom({ room_chat_open: next } as any);
  }, [isRoomChatOpen, updateWatchRoom]);

  const selectWatchItem = useCallback(
    async (item: WatchItem) => {
      setSelectedWatchItem(item);
      await updateWatchRoom({ selected_item_id: item.id } as any);
    },
    [updateWatchRoom]
  );

  const toggleFullscreen = () => {
    const isCurrentUserParticipant = currentUserId
      ? (watchRoom?.participant_ids ?? []).some((id) => String(id) === String(currentUserId))
      : false;

    if (!isCurrentUserParticipant && watchRoom?.active) {
      Alert.alert('Unirse', 'Únete a la sala para ver en pantalla completa.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Unirme', onPress: joinRoom },
      ]);
      return;
    }

    setIsFullscreen((prev) => !prev);
  };

  const handleExitPress = useCallback(() => {
    const participantsCount = (watchRoom?.participant_ids ?? []).length;

    Alert.alert('Salir', '¿Quieres salir solo tú o cerrar la sala para ambos?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir solo yo', onPress: leaveRoom },
      ...(participantsCount >= 2 ? [{ text: 'Cerrar para ambos', style: 'destructive' as const, onPress: endRoom }] : [{ text: 'Cerrar para ambos', style: 'destructive' as const, onPress: endRoom }]),
    ]);
  }, [endRoom, leaveRoom, watchRoom?.participant_ids]);

  const openAddModal = () => {
    setDraftTitle('');
    setDraftType('Película');
    setIsAddModalOpen(true);
  };

  const openSelectModal = () => {
    if (watchItems.length === 0) {
      openAddModal();
      return;
    }
    setIsSelectModalOpen(true);
  };

  const addWatchItem = async () => {
    const title = draftTitle.trim();
    if (!title || !coupleId) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('watch_together_items')
      .insert({
        couple_id: coupleId,
        created_by: user.id,
        title,
        type: draftType,
        status: 'Pendiente',
      })
      .select()
      .single();

    if (error) {
      console.log('add watch item error:', error);
      Alert.alert('Error', 'No se pudo agregar.');
      return;
    }

    if (data) setWatchItems((prev) => [data as any, ...prev]);
    setIsAddModalOpen(false);
  };

  const sendRoomMessage = async () => {
    const text = roomMessageText.trim();
    if (!text || !coupleId || !watchRoom?.id) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    if (!user?.id) return;

    setRoomMessageText('');

    const { error } = await supabase.from('watch_room_messages').insert({
      room_id: watchRoom.id,
      couple_id: coupleId,
      sender_id: user.id,
      content: text,
    });

    if (error) {
      console.log('send room message error:', error);
      Alert.alert('Error', 'No se pudo enviar.');
      return;
    }

    fetchRoomMessages(watchRoom.id);
  };

  const toggleItemStatus = useCallback(
    async (item: WatchItem) => {
      const current = item.status;
      const next = current === 'Pendiente' ? 'Viendo' : current === 'Viendo' ? 'Visto' : 'Pendiente';

      setWatchItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: next } : x)));

      const { error } = await supabase
        .from('watch_together_items')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) {
        console.log('update watch item status error:', error);
        fetchWatchItems();
      }
    },
    [fetchWatchItems]
  );

  useEffect(() => {
    if (!coupleId) return;

    fetchWatchItems();
    fetchWatchRoom();

    const channel = supabase
      .channel(`watch-together:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_together_items', filter: `couple_id=eq.${coupleId}` },
        () => {
          fetchWatchItems();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_together_rooms', filter: `couple_id=eq.${coupleId}` },
        () => {
          fetchWatchRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, fetchWatchItems, fetchWatchRoom]);

  useEffect(() => {
    if (autoCallHandledRef.current) return;
    const wantsAutoCall = params?.autoCall === '1' || params?.autoCall === 'true';
    if (!wantsAutoCall) return;
    if (profileLoading) return;
    if (!coupleId || !currentUserId) return;
    if (!watchRoom) return;

    autoCallHandledRef.current = true;

    (async () => {
      try {
        const kind = params?.callKind === 'voice' ? 'voice' : 'video';

        if (watchRoom.active) {
          const participants = Array.isArray(watchRoom.participant_ids) ? watchRoom.participant_ids : [];
          const isParticipant = participants.some((id) => String(id) === String(currentUserId));
          if (isParticipant) {
            await joinWatchCall();
          } else {
            await joinRoom();
          }
        } else {
          await startRoom();
        }

        if (kind === 'voice' && myRoomStatus.camera) {
          await toggleCamera();
        }
      } catch (error) {
        console.log('autoCall flow ignored:', error);
        Alert.alert('Error', 'No se pudo iniciar la llamada.');
      }
    })();
  }, [
    coupleId,
    currentUserId,
    joinRoom,
    joinWatchCall,
    myRoomStatus.camera,
    params?.autoCall,
    params?.callKind,
    profileLoading,
    startRoom,
    toggleCamera,
    watchRoom,
  ]);

  useEffect(() => {
    if (!coupleId || !watchRoom?.id) return;

    fetchRoomMessages(watchRoom.id);

    const channel = supabase
      .channel(`watch-room-messages:${watchRoom.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_room_messages', filter: `room_id=eq.${watchRoom.id}` },
        () => {
          fetchRoomMessages(watchRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, fetchRoomMessages, watchRoom?.id]);

  const WatchControls = () => {
    return (
      <View style={s.controlsRow}>
        <Pressable style={[s.controlBtn, myRoomStatus.mic ? s.controlBtnOn : s.controlBtnOff]} onPress={toggleMic}>
          {myRoomStatus.mic ? <Mic size={18} color="#fff" /> : <MicOff size={18} color="#fff" />}
          <Text style={s.controlBtnLabel}>Mic</Text>
        </Pressable>
        <Pressable style={[s.controlBtn, myRoomStatus.camera ? s.controlBtnOn : s.controlBtnOff]} onPress={toggleCamera}>
          {myRoomStatus.camera ? <Camera size={18} color="#fff" /> : <CameraOff size={18} color="#fff" />}
          <Text style={s.controlBtnLabel}>Cámara</Text>
        </Pressable>
        <Pressable style={[s.controlBtn, myRoomStatus.screen ? s.controlBtnOn : s.controlBtnOff]} onPress={toggleScreenSharing}>
          <MonitorUp size={18} color="#fff" />
          <Text style={s.controlBtnLabel}>Pantalla</Text>
        </Pressable>
        <Pressable style={[s.controlBtn, isRoomChatOpen ? s.controlBtnOn : s.controlBtnOff]} onPress={toggleRoomChat}>
          <MessageCircle size={18} color="#fff" />
          <Text style={s.controlBtnLabel}>Chat</Text>
        </Pressable>
        <Pressable style={[s.controlBtn, s.controlBtnEnd]} onPress={handleExitPress}>
          <PhoneOff size={18} color="#fff" />
          <Text style={[s.controlBtnLabel, { color: '#fff' }]}>Salir</Text>
        </Pressable>
      </View>
    );
  };

  const WatchRoomCard = ({ fullscreen }: { fullscreen?: boolean }) => {
    const roomParticipants = Array.isArray(watchRoom?.participant_ids) ? watchRoom?.participant_ids : [];
    const participantsCount = roomParticipants.length;
    const partnerId = couple?.partner_id ?? partnerProfile?.id ?? null;
    const isCurrentUserParticipant = roomParticipants.some((id) => String(id) === String(currentUserId));
    const isRoomStartedByMe = String(watchRoom?.started_by) === String(currentUserId);
    const hasActiveRoom = !!watchRoom?.active;
    const shouldShowRoomInvite = hasActiveRoom && !isCurrentUserParticipant && !isRoomStartedByMe;
    const showInvite = shouldShowRoomInvite && !inviteDismissed;
    const shouldShowActiveRoom = hasActiveRoom && isCurrentUserParticipant;
    const shouldRenderStreamCall = shouldShowActiveRoom && !!streamClient && !!streamCall;
    const isPartnerParticipant = partnerId
      ? roomParticipants.some((id) => String(id) === String(partnerId))
      : participantsCount >= 2;
    const showLiveBadge = shouldShowActiveRoom || shouldShowRoomInvite;
    const screenBoxStyle = [
      s.roomScreenPlaceholder,
      shouldShowActiveRoom ? (fullscreen ? s.roomScreenPlaceholderActiveFullscreen : s.roomScreenPlaceholderActive) : null,
      fullscreen ? s.roomScreenPlaceholderFullscreen : isSmallScreen ? s.roomScreenPlaceholderSmall : null,
    ];
    const participantsRowStyle = [
      s.participantsStatusRow,
      fullscreen ? s.participantsStatusRowFullscreen : isSmallScreen ? s.participantsStatusRowSmall : null,
    ];
    const controlsStyle = [
      s.controlsRow,
      fullscreen ? s.controlsRowFullscreen : isSmallScreen ? s.controlsRowSmall : null,
    ];
    const roomTitleStyle = [
      s.roomCenterTitle,
      fullscreen ? s.roomCenterTitleFullscreen : isSmallScreen ? s.roomCenterTitleSmall : null,
    ];

    const renderParticipantCornerStatus = (status: { mic: boolean; camera: boolean; screen: boolean }) => {
      const icons: Array<{ key: string; icon: string; isScreen?: boolean }> = [];

      if (!status.mic) icons.push({ key: 'mic', icon: 'mic-off' });
      if (!status.camera) icons.push({ key: 'camera', icon: 'videocam-off' });
      if (status.screen) icons.push({ key: 'screen', icon: 'desktop-outline', isScreen: true });

      if (icons.length === 0) return null;

      return (
        <View style={s.participantCornerStatus}>
          {icons.map((item) => (
            <View
              key={item.key}
              style={[s.participantCornerIcon, item.isScreen && s.participantCornerIconScreen]}
            >
              <Ionicons name={item.icon as any} size={14} color="#fff" />
            </View>
          ))}
        </View>
      );
    };

    const cardContent = (
      <View style={[s.roomCardActive, fullscreen && s.roomCardFullscreen]}>
        <View pointerEvents="none" style={s.roomGlow} />
        <View pointerEvents="none" style={s.roomGlow2} />
        <Pressable
          style={s.fullscreenBtn}
          onPress={toggleFullscreen}
          hitSlop={10}
        >
          {fullscreen ? <Minimize2 size={18} color="#fff" /> : <Maximize2 size={18} color="#fff" />}
        </Pressable>
        <View style={s.roomTopRow}>
          <View style={showLiveBadge ? s.liveBadge : s.privateBadge}>
            <Text style={s.liveBadgeText}>{showLiveBadge ? 'EN VIVO' : 'SALA PRIVADA'}</Text>
          </View>
          <Text style={s.roomTopTitle}>Ver juntos</Text>
        </View>

        <View style={[s.roomCenter, fullscreen && s.roomCenterFullscreen, shouldShowActiveRoom && s.roomCenterActive]}>
          {showInvite ? (
            <>
              <MessageCircle size={36} color="rgba(255,255,255,0.92)" />
              <Text style={roomTitleStyle} numberOfLines={1} adjustsFontSizeToFit>
                Tu pareja inició una sala
              </Text>
              <Text style={s.roomCenterSubtitle} numberOfLines={2}>
                Únete para ver juntos.
              </Text>
              <View style={s.roomCtaRow}>
                <Pressable style={s.roomPrimaryBtn} onPress={joinRoom}>
                  <Text style={s.roomPrimaryBtnText}>Unirme</Text>
                </Pressable>
                <Pressable style={s.roomSecondaryBtn} onPress={declineRoomInvite}>
                  <Text style={s.roomSecondaryBtnText}>Ahora no</Text>
                </Pressable>
              </View>
            </>
          ) : shouldShowActiveRoom ? (
            <>
              <View style={screenBoxStyle}>
                {shouldRenderStreamCall ? <VerJuntosParticipantsView currentUserId={currentUserId ?? undefined} /> : null}
              </View>
              {callError ? <Text style={s.callStatusText}>{callError}</Text> : null}
              <View style={participantsRowStyle}>
                <View style={[s.participantTile, fullscreen && s.participantTileFullscreen]}>
                  <Text style={s.participantTileName}>Tú</Text>
                  {myRoomStatus.camera && shouldRenderStreamCall ? (
                    <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
                      <VerJuntosLocalTileVideo
                        currentUserId={currentUserId ?? undefined}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  ) : (
                    <View style={[s.participantAvatarCircle, !myRoomStatus.camera && s.participantAvatarCircleOff]}>
                      <Text style={s.participantAvatarText}>T</Text>
                    </View>
                  )}
                  {renderParticipantCornerStatus(myRoomStatus)}
                </View>

                <View style={[s.participantTile, fullscreen && s.participantTileFullscreen]}>
                  <Text style={s.participantTileName} numberOfLines={1}>
                    {partnerName}
                  </Text>
                  {partnerRoomStatus.camera && shouldRenderStreamCall ? (
                    <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
                      <VerJuntosRemoteTileVideo
                        currentUserId={currentUserId ?? undefined}
                        participantUserId={partnerId ?? undefined}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  ) : (
                    <View style={[s.participantAvatarCircle, !partnerRoomStatus.camera && s.participantAvatarCircleOff]}>
                      <Text style={s.participantAvatarText}>
                        {(partnerName || 'T').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {renderParticipantCornerStatus(partnerRoomStatus)}
                </View>
              </View>
              <View style={controlsStyle}>
                <WatchControls />
              </View>
            </>
          ) : (
            <>
              <MonitorUp size={40} color="rgba(255,255,255,0.92)" />
              <Text style={roomTitleStyle} numberOfLines={1} adjustsFontSizeToFit>
                Creen su sala
              </Text>
              <Text style={s.roomCenterSubtitle} numberOfLines={2}>
                Compartan pantalla, hablen y vean algo juntos.
              </Text>
              <View style={s.roomCtaRow}>
                <Pressable style={s.roomPrimaryBtn} onPress={startRoom}>
                  <Text style={s.roomPrimaryBtnText}>Crear sala</Text>
                </Pressable>
                <Pressable style={s.roomSecondaryBtn} onPress={openSelectModal}>
                  <Text style={s.roomSecondaryBtnText}>Elegir</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

      </View>
    );

    return shouldRenderStreamCall && streamClient && streamCall ? (
      <VerJuntosCallProvider client={streamClient} call={streamCall}>
        {cardContent}
      </VerJuntosCallProvider>
    ) : (
      cardContent
    );
  };

  const WatchItemList = ({ title, items }: { title: string; items: WatchItem[] }) => {
    const isHorizontal = title === 'Lista para ver';
    if (!isHorizontal && items.length === 0) return null;
    return (
      <View>
        <Text style={s.sectionTitle}>{title}</Text>
        {loadingWatchItems && title === 'Lista para ver' ? (
          <View style={s.emptyListCard}>
            <ActivityIndicator color={COLORS.primaryPink} />
          </View>
        ) : items.length === 0 && title === 'Lista para ver' ? (
          <View style={s.emptyListCard}>
            <Text style={s.emptyListTitle}>Aún no agregaron nada</Text>
            <Text style={s.emptyListSub}>Agreguen una película o serie para verla juntos.</Text>
          </View>
        ) : null}
        {isHorizontal ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hListContent}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[s.hItemCard, selectedWatchItem?.id === item.id && s.hItemCardSelected]}
                onPress={() => {
                  selectWatchItem(item);
                }}
              >
                <View style={s.hPoster}>
                  <Text style={s.hPosterText}>{item.type === 'Película' ? 'FILM' : 'SERIE'}</Text>
                </View>
                <Text style={s.hItemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={s.hBadgesRow}>
                  <View style={s.hBadge}>
                    <Text style={s.hBadgeText}>{item.type}</Text>
                  </View>
                  <View style={[s.hBadge, item.status !== 'Pendiente' && s.hBadgeAlt]}>
                    <Text style={s.hBadgeText}>{item.status}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={[s.itemRowCompact, selectedWatchItem?.id === item.id && s.itemRowCompactSelected]}
              onPress={() => {
                selectWatchItem(item);
              }}
            >
              <View style={s.posterPlaceholderSmall}>
                <Text style={s.posterPlaceholderText}>{item.type === 'Película' ? 'FILM' : 'SERIE'}</Text>
              </View>
              <View style={s.itemMain}>
                <Text style={s.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={s.itemMetaRow}>
                  <View style={s.itemChipCompact}>
                    <Text style={s.itemChipText}>{item.type}</Text>
                  </View>
                  <View style={s.itemChipCompact}>
                    <Text style={s.itemChipText}>{item.status}</Text>
                  </View>
                </View>
              </View>
              <Pressable style={s.itemStatusBtnSmall} onPress={() => toggleItemStatus(item)}>
                <Check size={18} color={COLORS.mutedText} />
              </Pressable>
            </Pressable>
          ))
        )}
      </View>
    );
  };

  const MiniRoomChat = () => {
    if (!isRoomActive || !isRoomChatOpen) return null;
    return (
      <View style={s.miniChat}>
        <Text style={s.miniChatTitle}>Mensajes de la sala</Text>
        <View style={s.miniChatMessages}>
          {roomMessages.map((m) => (
            <View
              key={m.id}
              style={[
                s.miniChatBubble,
                String(m.sender_id) === String(profile?.id) ? s.miniChatBubbleMe : s.miniChatBubblePartner,
              ]}
            >
              <Text
                style={[
                  s.miniChatBubbleText,
                  String(m.sender_id) === String(profile?.id) ? s.miniChatBubbleTextMe : s.miniChatBubbleTextPartner,
                ]}
              >
                {m.content}
              </Text>
            </View>
          ))}
        </View>
        <View style={s.miniChatInputRow}>
          <TextInput
            value={roomMessageText}
            onChangeText={setRoomMessageText}
            placeholder="Escribe mientras ven juntos..."
            placeholderTextColor={COLORS.mutedText}
            style={s.miniChatInput}
          />
          <Pressable
            style={[s.miniChatSendBtn, !roomMessageText.trim() && { opacity: 0.6 }]}
            onPress={sendRoomMessage}
            disabled={!roomMessageText.trim()}
          >
            <Text style={s.miniChatSendText}>Enviar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (profileLoading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={COLORS.primaryPink} />
      </View>
    );
  }

  if (!coupleId || !profile?.id) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }]}>
        <Text style={{ fontWeight: '900', color: COLORS.darkText, fontSize: 16, textAlign: 'center' }}>
          Ver Juntos no está disponible todavía
        </Text>
        <Text style={{ marginTop: 8, fontWeight: '700', color: COLORS.mutedText, textAlign: 'center' }}>
          Completen la configuración de pareja para usar esta sala.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={COLORS.darkText} />
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Ver Juntos</Text>
          <Text style={s.headerSub}>Vean, hablen y compartan pantalla</Text>
        </View>
        <Pressable style={s.addIconBtn} onPress={openAddModal}>
          <Plus size={22} color={COLORS.white} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]} showsVerticalScrollIndicator={false}>
        {!isFullscreen ? <WatchRoomCard /> : null}
        <MiniRoomChat />

        <View style={s.suggestionCardCompact}>
          <View style={s.suggCompactLeft}>
            <View style={s.suggCompactIcon}>
              <Sparkles size={14} color={COLORS.primaryPink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.suggCompactTitle}>Para ver hoy</Text>
              <Text style={s.suggCompactValue} numberOfLines={1}>
                {suggestion?.title || 'Todavía no eligieron nada'}
              </Text>
            </View>
          </View>
          <Pressable style={s.suggCompactBtn} onPress={openSelectModal}>
            <Text style={s.suggCompactBtnText}>Elegir</Text>
          </Pressable>
        </View>

        <WatchItemList title="Lista para ver" items={toWatch} />
        <WatchItemList title="Visto juntos" items={watched} />
      </ScrollView>

      <Modal visible={isFullscreen} transparent animationType="fade" onRequestClose={() => setIsFullscreen(false)}>
        <View
          style={[
            s.fullscreenOverlay,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingHorizontal: 14,
            },
          ]}
        >
          <WatchRoomCard fullscreen />
        </View>
      </Modal>

      <Modal visible={isAddModalOpen} transparent animationType="fade" onRequestClose={() => setIsAddModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setIsAddModalOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <Text style={s.modalTitle}>Agregar a la lista</Text>

            <Text style={s.modalLabel}>Título</Text>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Ej: Nuestra serie favorita..."
              placeholderTextColor={COLORS.mutedText}
              style={s.modalInput}
            />

            <Text style={s.modalLabel}>Tipo</Text>
            <View style={s.typeRow}>
              <Pressable
                style={[s.typeChip, draftType === 'Película' && s.typeChipActive]}
                onPress={() => setDraftType('Película')}
              >
                <Text style={[s.typeChipText, draftType === 'Película' && s.typeChipTextActive]}>Película</Text>
              </Pressable>
              <Pressable style={[s.typeChip, draftType === 'Serie' && s.typeChipActive]} onPress={() => setDraftType('Serie')}>
                <Text style={[s.typeChipText, draftType === 'Serie' && s.typeChipTextActive]}>Serie</Text>
              </Pressable>
            </View>

            <Pressable style={[s.primaryBtn, !draftTitle.trim() && { opacity: 0.5 }]} onPress={addWatchItem} disabled={!draftTitle.trim()}>
              <Text style={s.primaryBtnText}>Guardar</Text>
            </Pressable>

            <Pressable style={s.secondaryBtn} onPress={() => setIsAddModalOpen(false)}>
              <Text style={s.secondaryBtnText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isSelectModalOpen} transparent animationType="fade" onRequestClose={() => setIsSelectModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setIsSelectModalOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <Text style={s.modalTitle}>Elegir para ver</Text>
            <ScrollView style={s.selectList} contentContainerStyle={s.selectListContent} showsVerticalScrollIndicator={false}>
              {watchItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[s.selectRow, selectedWatchItem?.id === item.id && s.selectRowSelected]}
                  onPress={() => {
                    selectWatchItem(item);
                    setIsSelectModalOpen(false);
                  }}
                >
                  <View style={s.selectRowLeft}>
                    <View style={s.selectPosterMini}>
                      <Text style={s.selectPosterMiniText}>{item.type === 'Película' ? 'FILM' : 'SERIE'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.selectTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={s.selectMeta}>
                        {item.type} • {item.status}
                      </Text>
                    </View>
                  </View>
                  {selectedWatchItem?.id === item.id ? <Check size={18} color={COLORS.primaryPink} /> : <View style={{ width: 18, height: 18 }} />}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={s.secondaryBtn} onPress={() => setIsSelectModalOpen(false)}>
              <Text style={s.secondaryBtnText}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 10 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60, marginBottom: 6 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  headerTitleWrap: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.darkText },
  headerSub: { fontSize: 13, color: COLORS.mutedText, marginTop: 2, fontWeight: '700' },
  addIconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryPink, justifyContent: 'center', alignItems: 'center' },

  roomCardActive: {
    borderRadius: 32,
    backgroundColor: COLORS.roomDark,
    borderWidth: 1,
    borderColor: COLORS.roomStroke,
    padding: 18,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  roomCardFullscreen: {
    flex: 1,
    marginBottom: 0,
  },
  roomGlow: {
    position: 'absolute',
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(247,166,181,0.18)',
  },
  roomGlow2: {
    position: 'absolute',
    bottom: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  roomTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: { backgroundColor: 'rgba(247,166,181,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  privateBadge: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  roomTopTitle: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '800' },
  roomCenter: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 6, paddingBottom: 10 },
  roomCenterFullscreen: { flex: 1, minHeight: 0, paddingBottom: 16 },
  roomCenterActive: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', gap: 12, paddingTop: 10, paddingBottom: 0 },
  roomCenterTitle: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', paddingHorizontal: 24, maxWidth: '72%', alignSelf: 'center' },
  roomCenterTitleFullscreen: { fontSize: 30, maxWidth: '76%' },
  roomCenterTitleSmall: { fontSize: 24, maxWidth: '78%' },
  roomCenterSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '700', textAlign: 'center', maxWidth: 280, alignSelf: 'center', paddingHorizontal: 24 },
  roomCtaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  roomPrimaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: COLORS.primaryPink },
  roomPrimaryBtnText: { color: '#fff', fontWeight: '900' },
  roomSecondaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  roomSecondaryBtnText: { color: '#fff', fontWeight: '900' },
  roomStage: {
    width: '100%',
    height: 260,
    marginTop: 6,
    position: 'relative',
    zIndex: 5,
  },
  roomStageSmall: {
    height: 232,
  },
  roomStageFullscreen: {
    flex: 1,
    minHeight: 420,
    marginTop: 12,
  },
  roomScreenPlaceholder: {
    width: '100%',
    height: 170,
    borderRadius: 24,
    marginTop: 8,
    backgroundColor: COLORS.roomDark2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roomScreenPlaceholderActive: {
    height: 260,
    marginTop: 2,
  },
  roomScreenPlaceholderActiveFullscreen: {
    flex: 1,
    minHeight: 420,
    height: undefined,
    marginTop: 6,
  },
  roomScreenPlaceholderStage: {
    height: '100%',
    marginTop: 0,
    zIndex: 5,
  },
  roomScreenPlaceholderFullscreen: { height: '100%' },
  roomScreenPlaceholderSmall: { height: '100%' },
  roomScreenPlaceholderText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  participantsStatusRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    marginTop: 14,
    paddingHorizontal: 0,
  },
  participantsStatusRowSmall: {
    gap: 12,
  },
  participantsStatusRowFullscreen: {
    marginTop: 10,
  },
  participantTile: {
    flex: 1,
    height: 112,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantTileFullscreen: {
    height: 150,
    borderRadius: 26,
  },
  participantTileName: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 44,
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    zIndex: 2,
  },
  participantAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  participantAvatarCircleOff: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  participantAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  participantCornerStatus: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 2,
  },
  participantCornerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  participantCornerIconScreen: {
    backgroundColor: 'rgba(247,166,181,0.9)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  participantStatusCard: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  participantStatusName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  participantStatusMeta: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  roomFloatingPartner: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 118,
    minHeight: 126,
    zIndex: 20,
  },
  roomFloatingPartnerSmall: { width: 104, minHeight: 118, top: 10, right: 10 },
  roomFloatingPartnerFullscreen: { top: 18, right: 18, width: 118, minHeight: 126 },
  roomFloatingMe: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 112,
    minHeight: 118,
    zIndex: 20,
  },
  roomFloatingMeSmall: { width: 102, minHeight: 108, left: 10, bottom: 10 },
  roomFloatingMeFullscreen: { left: 18, bottom: 18, width: 112, minHeight: 118 },
  videoTile: {
    width: '100%',
    minHeight: 118,
    borderRadius: 24,
    backgroundColor: 'rgba(35,35,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 10,
    overflow: 'visible',
  },
  videoTileSmall: { minHeight: 108, borderRadius: 22, paddingTop: 12, paddingBottom: 8 },
  videoTileFullscreen: { minHeight: 126, paddingTop: 14, paddingBottom: 12 },
  videoTileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  videoTileAvatarText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  videoTileLabel: { color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '800' },
  videoTileSubLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#36D399' },
  presenceText: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900' },
  partnerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
    minHeight: 24,
    width: '100%',
  },
  statusMiniPill: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusMiniPillActive: {
    backgroundColor: '#22C55E',
  },
  statusMiniPillOff: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statusMiniPillScreen: {
    backgroundColor: '#F7A6B5',
  },
  partnerSharingBadge: {
    marginTop: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(247,166,181,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247,166,181,0.45)',
  },
  partnerSharingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  roomNowRow: { marginTop: 4, marginBottom: 12 },
  roomNowBox: { minHeight: 50, justifyContent: 'center', marginTop: 14, marginBottom: 14, zIndex: 12 },
  roomNowBoxSmall: { marginTop: 12, marginBottom: 12 },
  roomNowBoxFullscreen: { marginTop: 18, marginBottom: 16 },
  roomParticipantsText: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', marginBottom: 6 },
  roomNowLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, fontWeight: '800' },
  roomNowValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 3 },
  callStatusText: { marginTop: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  fullscreenBottomArea: { marginTop: 'auto' },
  fullscreenBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },

  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, zIndex: 30, width: '100%', marginTop: 14 },
  controlsRowSmall: { gap: 8 },
  controlsRowFullscreen: { marginTop: 'auto', marginBottom: 6 },
  controlBtn: {
    flex: 1,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  controlBtnOn: { backgroundColor: 'rgba(247,166,181,0.22)', borderColor: 'rgba(247,166,181,0.35)' },
  controlBtnOff: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.16)' },
  controlBtnLabel: { color: '#fff', fontSize: 10, fontWeight: '900' },
  controlBtnEnd: { backgroundColor: '#FF3D63', borderColor: 'rgba(255,61,99,0.35)' },

  suggestionCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 18,
  },
  suggCompactLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  suggCompactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.softPink,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggCompactTitle: { fontSize: 12, fontWeight: '900', color: COLORS.mutedText, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  suggCompactValue: { fontSize: 14, fontWeight: '900', color: COLORS.darkText },
  suggCompactBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.primaryPink },
  suggCompactBtnText: { color: '#fff', fontWeight: '900' },

  sectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.darkText, marginBottom: 12, marginTop: 6 },
  hListContent: { paddingRight: 10, gap: 12 },
  hItemCard: {
    width: 170,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 12,
  },
  hItemCardSelected: { borderColor: COLORS.primaryPink, borderWidth: 2 },
  hPoster: {
    width: '100%',
    height: 92,
    borderRadius: 18,
    backgroundColor: COLORS.softPink,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  hPosterText: { fontSize: 11, fontWeight: '900', color: COLORS.primaryPink, letterSpacing: 0.8 },
  hItemTitle: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, marginBottom: 10 },
  hBadgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.softPink, borderWidth: 1, borderColor: COLORS.cardBorder },
  hBadgeAlt: { backgroundColor: '#fff' },
  hBadgeText: { fontSize: 11, fontWeight: '900', color: COLORS.darkText },

  itemRowCompact: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 22, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  itemRowCompactSelected: { borderColor: COLORS.primaryPink, borderWidth: 2 },
  posterPlaceholderSmall: { width: 46, height: 56, borderRadius: 16, backgroundColor: COLORS.softPink, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  posterPlaceholderText: { fontSize: 11, fontWeight: '900', color: COLORS.primaryPink, letterSpacing: 0.8 },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, marginBottom: 6 },
  itemMetaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemChipCompact: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  itemChipText: { fontSize: 11, fontWeight: '900', color: COLORS.darkText },
  itemStatusBtnSmall: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },

  miniChat: { marginTop: 16, backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  miniChatTitle: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, marginBottom: 10 },
  miniChatMessages: { maxHeight: 120, gap: 8, marginBottom: 12 },
  miniChatBubble: { maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  miniChatBubbleMe: { alignSelf: 'flex-end', backgroundColor: COLORS.primaryPink },
  miniChatBubblePartner: { alignSelf: 'flex-start', backgroundColor: COLORS.softPink, borderWidth: 1, borderColor: COLORS.cardBorder },
  miniChatBubbleText: { fontSize: 13, fontWeight: '800' },
  miniChatBubbleTextMe: { color: '#fff' },
  miniChatBubbleTextPartner: { color: COLORS.darkText },
  miniChatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniChatInput: { flex: 1, height: 44, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder, color: COLORS.darkText, fontWeight: '700' },
  miniChatSendBtn: { height: 44, paddingHorizontal: 16, borderRadius: 16, backgroundColor: COLORS.primaryPink, alignItems: 'center', justifyContent: 'center' },
  miniChatSendText: { color: '#fff', fontWeight: '900' },
  emptyListCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyListTitle: { fontSize: 14, fontWeight: '900', color: COLORS.darkText, textAlign: 'center' },
  emptyListSub: { marginTop: 6, fontSize: 12, fontWeight: '800', color: COLORS.mutedText, textAlign: 'center' },
  videoTileCameraOff: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryPink, paddingVertical: 12, borderRadius: 18 },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '900' },
  secondaryBtn: { marginTop: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: COLORS.cardBorder },
  secondaryBtnText: { color: COLORS.darkText, fontSize: 15, fontWeight: '900' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', padding: 20, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderRadius: 28, padding: 18, borderWidth: 1, borderColor: COLORS.cardBorder },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.darkText, marginBottom: 14 },
  modalLabel: { fontSize: 12, fontWeight: '900', color: COLORS.mutedText, textTransform: 'uppercase', marginBottom: 8 },
  modalInput: { height: 46, borderRadius: 16, paddingHorizontal: 14, backgroundColor: COLORS.softPink, borderWidth: 1, borderColor: COLORS.cardBorder, color: COLORS.darkText, fontWeight: '800', marginBottom: 14 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeChip: { flex: 1, height: 44, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center', justifyContent: 'center' },
  typeChipActive: { backgroundColor: COLORS.softPink, borderColor: COLORS.primaryPink },
  typeChipText: { color: COLORS.darkText, fontWeight: '900' },
  typeChipTextActive: { color: COLORS.darkText },

  selectList: { maxHeight: 360 },
  selectListContent: { paddingBottom: 10 },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  selectRowSelected: { borderColor: COLORS.primaryPink, borderWidth: 2, backgroundColor: COLORS.softPink },
  selectRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  selectPosterMini: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.softPink,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectPosterMiniText: { fontSize: 11, fontWeight: '900', color: COLORS.primaryPink, letterSpacing: 0.8 },
  selectTitle: { fontSize: 14, fontWeight: '900', color: COLORS.darkText },
  selectMeta: { fontSize: 12, fontWeight: '800', color: COLORS.mutedText, marginTop: 4 },
});
