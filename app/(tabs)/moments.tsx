import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { Bookmark, Camera, ChevronUp, Heart, Image as ImageIcon, LayoutGrid, MessageCircle, MoreVertical, RefreshCw, Send, Video, X, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

const { width, height } = Dimensions.get('window');

const PAGE_BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const CARD_SOFT = '#FFF7FA';
const ACCENT_PINK = '#F49CAF';
const BORDER = '#F3DDE5';
const TEXT_PRIMARY = '#241D22';
const TEXT_MUTED = '#9D8F98';
const SOFT_PINK = '#FFF1F5';
const GRID_GAP = 12;
const GRID_CARD_WIDTH = (width - 40 - GRID_GAP) / 2;
const REEL_CARD_HEIGHT = Math.max(height - 310, 430);
const REEL_CARD_SPACING = 18;
const MEMORY_SHARE_PREFIX = 'USFULLY_MEMORY_SHARE::';
const REEL_SNAP_INTERVAL = REEL_CARD_HEIGHT + REEL_CARD_SPACING;
const MOMENTS_UPLOAD_BUCKET = 'notes';
const GALLERY_TRAY_COLLAPSED_HEIGHT = 72;
const GALLERY_TRAY_EXPANDED_HEIGHT = 296;
const GALLERY_TRAY_CLOSED_TRANSLATE = GALLERY_TRAY_EXPANDED_HEIGHT - GALLERY_TRAY_COLLAPSED_HEIGHT;
const PAGE_HORIZONTAL_PADDING = 20;
const SWEET_SECTION_HORIZONTAL_PADDING = 18;
const SWEET_MEMORY_CARD_WIDTH =
  width - PAGE_HORIZONTAL_PADDING * 2 - SWEET_SECTION_HORIZONTAL_PADDING * 2;
const GALLERY_GRID_WIDTH = width - PAGE_HORIZONTAL_PADDING * 2;

type DbMoment = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  media_url: string | null;
  media_type: string;
  memory_date: string;
  created_at: string;
};

type MomentFilter = 'Todos' | 'Fotos' | 'Videos' | 'Favoritos';
type MomentosViewMode = 'reels' | 'gallery';
type GalleryColumns = 1 | 2 | 3;

type MemoryCardItem = {
  id: string;
  title: string;
  subtitle: string;
  dateLabel: string;
  type: 'photo' | 'video';
  mediaUrl: string | null;
  isFavorite: boolean;
  createdByLabel: string;
};

const MOMENT_FILTERS: MomentFilter[] = ['Todos', 'Fotos', 'Videos', 'Favoritos'];

const PLACEHOLDER_MEMORIES: MemoryCardItem[] = [
  {
    id: 'placeholder-1',
    title: 'Primer recuerdo',
    subtitle: 'Una foto especial para empezar su galería juntos.',
    dateLabel: '7 de junio',
    type: 'photo',
    mediaUrl: null,
    isFavorite: true,
    createdByLabel: 'Ustedes',
  },
  {
    id: 'placeholder-2',
    title: 'Nuevo video',
    subtitle: 'Guarden una sonrisa, una mirada o una canción compartida.',
    dateLabel: 'Hoy',
    type: 'video',
    mediaUrl: null,
    isFavorite: false,
    createdByLabel: 'Ustedes',
  },
  {
    id: 'placeholder-3',
    title: 'Momento bonito',
    subtitle: 'Los recuerdos más tiernos también merecen un lugar aquí.',
    dateLabel: 'Hace 3 días',
    type: 'photo',
    mediaUrl: null,
    isFavorite: false,
    createdByLabel: 'Ustedes',
  },
];

function fmtMomentDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function getInitial(name?: string | null): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'U';
}

function hashSeed(value: string): number {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const nextItems = [...items];
  let state = hashSeed(seed) || 1;

  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let i = nextItems.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [nextItems[i], nextItems[j]] = [nextItems[j], nextItems[i]];
  }

  return nextItems;
}

export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, couple } = useProfileAndCouple();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView | null>(null);
  const galleryTrayTranslateY = React.useRef(new Animated.Value(GALLERY_TRAY_CLOSED_TRANSLATE)).current;
  const galleryTrayStartRef = React.useRef(GALLERY_TRAY_CLOSED_TRANSLATE);
  const galleryTrayOpenRef = React.useRef(false);
  const isLoadingRecentPhotosRef = React.useRef(false);

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [moments, setMoments] = useState<DbMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MomentFilter>('Todos');
  const [viewMode, setViewMode] = useState<MomentosViewMode>('reels');
  const [likedMemoryIds, setLikedMemoryIds] = useState<Record<string, boolean>>({});
  const [savedMemoryIds, setSavedMemoryIds] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState('');
  const [shareCommentError, setShareCommentError] = useState('');
  const [isSendingMemoryComment, setIsSendingMemoryComment] = useState(false);
  const [selectedMemoryForComments, setSelectedMemoryForComments] = useState<MemoryCardItem | null>(null);
  const [selectedMemoryForOptions, setSelectedMemoryForOptions] = useState<MemoryCardItem | null>(null);
  const [selectedMemoryForDetail, setSelectedMemoryForDetail] = useState<MemoryCardItem | null>(null);
  const [hiddenMemoryIds, setHiddenMemoryIds] = useState<Record<string, boolean>>({});
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [cameraFlash, setCameraFlash] = useState<'off' | 'on'>('off');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mediaPermissionGranted, setMediaPermissionGranted] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [isLoadingRecentPhotos, setIsLoadingRecentPhotos] = useState(false);
  const [isGalleryTrayOpen, setIsGalleryTrayOpen] = useState(false);
  const [activeSweetMemoryIndex, setActiveSweetMemoryIndex] = useState(0);
  const [galleryColumns, setGalleryColumns] = useState<GalleryColumns>(2);

  // 1. Load user + couple_id
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          router.replace('/(auth)/login');
          return;
        }
        if (!mounted) return;
        setUserId(user.id);

        const { data: coupleData, error: coupleErr } = await supabase.rpc('get_my_couple');
        if (coupleErr) {
          console.log('[Momentos] couple error:', coupleErr.message);
          setError('No se encontró la pareja');
          setLoading(false);
          return;
        }
        const row = Array.isArray(coupleData) ? coupleData[0] : coupleData;
        const cid = row?.couple_id;
        if (!cid) {
          router.replace('/partner-setup');
          return;
        }
        if (!mounted) return;
        setCoupleId(cid);
      } catch (e: any) {
        console.log('[Momentos] init error:', e);
        if (mounted) setError('No se pudieron cargar los recuerdos');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 2. Fetch moments
  const fetchMoments = useCallback(async (cid: string) => {
    const { data, error: fetchErr } = await supabase
      .from('moments')
      .select('*')
      .eq('couple_id', cid)
      .order('created_at', { ascending: false });
    
    if (fetchErr) {
      console.log('[Momentos] fetch error:', fetchErr.message);
      setError('No se pudieron cargar los recuerdos');
      return;
    }
    setMoments(data ?? []);
  }, []);

  useEffect(() => {
    if (coupleId) fetchMoments(coupleId);
  }, [coupleId, fetchMoments]);

  // 3. Realtime subscription
  useEffect(() => {
    if (!coupleId) return;
    const channel = supabase
      .channel(`moments:${coupleId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'moments',
        filter: `couple_id=eq.${coupleId}`,
      }, (payload) => {
        const n = payload.new as DbMoment;
        setMoments(prev => prev.some(m => m.id === n.id) ? prev : [n, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coupleId]);

  const uploadMomentPhoto = useCallback(async (localUri: string, cid: string, uid: string) => {
    const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
    const normalizedExt = ext.toLowerCase() === 'png' ? 'png' : 'jpg';
    const contentType = normalizedExt === 'png' ? 'image/png' : 'image/jpeg';
    const path = `${uid}/${cid}/moment-photo-${Date.now()}.${normalizedExt}`;

    const response = await fetch(localUri);
    const arrayBuffer = await response.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(MOMENTS_UPLOAD_BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(MOMENTS_UPLOAD_BUCKET)
      .getPublicUrl(path);

    return publicData?.publicUrl || null;
  }, []);

  const animateGalleryTray = useCallback((open: boolean) => {
    galleryTrayOpenRef.current = open;
    setIsGalleryTrayOpen(open);
    Animated.spring(galleryTrayTranslateY, {
      toValue: open ? 0 : GALLERY_TRAY_CLOSED_TRANSLATE,
      useNativeDriver: true,
      speed: 18,
      bounciness: 5,
    }).start();
  }, [galleryTrayTranslateY]);

  const resetGalleryTray = useCallback(() => {
    galleryTrayOpenRef.current = false;
    setIsGalleryTrayOpen(false);
    galleryTrayTranslateY.stopAnimation();
    galleryTrayTranslateY.setValue(GALLERY_TRAY_CLOSED_TRANSLATE);
  }, [galleryTrayTranslateY]);

  const saveMomentFromUri = useCallback(async (uri: string) => {
    if (!coupleId || !userId || saving) return;
    setSaving(true);
    try {
      const uploadedUrl = await uploadMomentPhoto(uri, coupleId, userId);
      const { error: insertErr } = await supabase.from('moments').insert({
        couple_id: coupleId,
        created_by: userId,
        title: 'Nuevo recuerdo',
        description: 'Un momento especial para guardar.',
        media_type: 'photo',
        media_url: uploadedUrl,
        memory_date: new Date().toISOString().slice(0, 10)
      });

      if (insertErr) {
        console.log('[Momentos] insert error:', insertErr.message);
        setCameraError('No se pudo guardar. Inténtalo de nuevo.');
      } else {
        setCameraVisible(false);
        setCameraError('');
        setIsCameraReady(false);
        resetGalleryTray();
        await fetchMoments(coupleId);
      }
    } catch (e: any) {
      console.log('[Momentos] insert exception:', e);
      setCameraError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [coupleId, fetchMoments, resetGalleryTray, saving, uploadMomentPhoto, userId]);

  const handleAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  const loadRecentPhotos = useCallback(async (force = false, requestPermission = true) => {
    if (isLoadingRecentPhotosRef.current) {
      return;
    }

    try {
      if (!force && recentPhotos.length > 0) {
        return;
      }

      isLoadingRecentPhotosRef.current = true;
      setIsLoadingRecentPhotos(true);
      let permission = await MediaLibrary.getPermissionsAsync();
      let granted = permission.status === 'granted';

      if (!granted && requestPermission) {
        permission = await MediaLibrary.requestPermissionsAsync();
        granted = permission.status === 'granted';
      }

      setMediaPermissionGranted(granted);
      if (!granted) return;

      const { assets } = await MediaLibrary.getAssetsAsync({
        first: 30,
        mediaType: [MediaLibrary.MediaType.photo],
      });
      setRecentPhotos(assets);
    } catch (mediaError) {
      console.log('[Momentos] recent photos error:', mediaError);
    } finally {
      isLoadingRecentPhotosRef.current = false;
      setIsLoadingRecentPhotos(false);
    }
  }, [recentPhotos.length]);

  const handleOpenAddMemory = useCallback(async () => {
    setCameraError('');
    setIsCameraReady(false);
    setCameraFacing('back');
    setCameraFlash('off');
    resetGalleryTray();

    let granted = cameraPermission?.granted ?? false;
    if (!granted) {
      const result = await requestCameraPermission();
      granted = result.granted;
    }

    setCameraVisible(true);
    if (!granted) return;
  }, [cameraPermission?.granted, requestCameraPermission, resetGalleryTray]);

  const handleCloseCamera = useCallback(() => {
    if (saving) return;
    setCameraVisible(false);
    setCameraError('');
    setIsCameraReady(false);
    setCameraFlash('off');
    resetGalleryTray();
  }, [resetGalleryTray, saving]);

  const handleRequestMediaPermission = useCallback(async () => {
    await loadRecentPhotos(true, true);
  }, [loadRecentPhotos]);

  const handleToggleGalleryTray = useCallback(() => {
    const nextOpen = !galleryTrayOpenRef.current;
    animateGalleryTray(nextOpen);
    if (nextOpen) {
      void loadRecentPhotos(false, true);
    }
  }, [animateGalleryTray, loadRecentPhotos]);

  const handleCapturePhoto = useCallback(async () => {
    if (!cameraPermission?.granted || !isCameraReady || saving) return;
    try {
      setCameraError('');
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      await saveMomentFromUri(photo.uri);
    } catch (cameraError) {
      console.log('[Momentos] capture error:', cameraError);
      setCameraError('No se pudo guardar. Inténtalo de nuevo.');
    }
  }, [cameraPermission?.granted, isCameraReady, saveMomentFromUri, saving]);

  const handlePickRecentPhoto = useCallback(async (asset: MediaLibrary.Asset) => {
    if (!asset.uri || saving) return;
    setCameraError('');
    await saveMomentFromUri(asset.uri);
  }, [saveMomentFromUri, saving]);

  const handleFlipCamera = useCallback(() => {
    setCameraFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const handleToggleFlash = useCallback(() => {
    setCameraFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  }, []);

  const handleToggleGalleryColumns = useCallback(() => {
    setGalleryColumns((prev) => {
      if (prev === 2) return 3;
      if (prev === 3) return 1;
      return 2;
    });
  }, []);

  const galleryTrayPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          galleryTrayTranslateY.stopAnimation((value) => {
            galleryTrayStartRef.current = typeof value === 'number' ? value : GALLERY_TRAY_CLOSED_TRANSLATE;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.min(
            GALLERY_TRAY_CLOSED_TRANSLATE,
            Math.max(0, galleryTrayStartRef.current + gestureState.dy)
          );
          galleryTrayTranslateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          galleryTrayTranslateY.stopAnimation((value) => {
            const currentValue = typeof value === 'number' ? value : GALLERY_TRAY_CLOSED_TRANSLATE;
            const shouldOpen =
              gestureState.vy < -0.25 ||
              gestureState.dy < -36 ||
              currentValue < GALLERY_TRAY_CLOSED_TRANSLATE * 0.55;
            animateGalleryTray(shouldOpen);
            if (shouldOpen) {
              void loadRecentPhotos(false, true);
            }
          });
        },
        onPanResponderTerminate: () => {
          animateGalleryTray(galleryTrayOpenRef.current);
        },
      }),
    [animateGalleryTray, galleryTrayTranslateY, loadRecentPhotos]
  );

  const handleToggleLike = useCallback((memoryId: string) => {
    setLikedMemoryIds((prev) => ({
      ...prev,
      [memoryId]: !prev[memoryId],
    }));
  }, []);

  const handleToggleSave = useCallback((memoryId: string) => {
    setSavedMemoryIds((prev) => ({
      ...prev,
      [memoryId]: !(prev[memoryId] ?? false),
    }));
  }, []);

  const handleOpenComments = useCallback((memory: MemoryCardItem) => {
    setSelectedMemoryForComments(memory);
    setCommentText('');
    setShareCommentError('');
  }, []);

  const handleCloseComments = useCallback(() => {
    if (isSendingMemoryComment) return;
    setSelectedMemoryForComments(null);
    setCommentText('');
    setShareCommentError('');
  }, [isSendingMemoryComment]);

  const handleSendMemoryCommentToChat = useCallback(async () => {
    const nextComment = commentText.trim();
    const selectedMemory = selectedMemoryForComments;
    const activeCoupleId = couple?.couple_id || coupleId;
    const senderId = profile?.id || userId;

    if (!selectedMemory) return;

    if (!nextComment) {
      setShareCommentError('Escribe un comentario primero.');
      return;
    }

    if (!activeCoupleId || !senderId) {
      setShareCommentError('No se pudo enviar. Inténtalo de nuevo.');
      return;
    }

    setIsSendingMemoryComment(true);
    setShareCommentError('');

    try {
      const memorySharePayload = {
        kind: 'memory_share',
        memoryId: selectedMemory.id,
        title: selectedMemory.title || 'Nuevo recuerdo',
        dateLabel: selectedMemory.dateLabel || '',
        type: selectedMemory.type || 'photo',
        mediaUrl: selectedMemory.mediaUrl || null,
        comment: nextComment,
      };
      const messageContent = `${MEMORY_SHARE_PREFIX}${JSON.stringify(memorySharePayload)}`;

      const { error: insertError } = await supabase.from('messages').insert({
        couple_id: activeCoupleId,
        sender_id: senderId,
        content: messageContent,
      });

      if (insertError) {
        throw insertError;
      }

      setSelectedMemoryForComments(null);
      setCommentText('');
      setShareCommentError('');
      router.push('/(tabs)/messages');
    } catch (sendError) {
      console.log('[Momentos] send memory comment error:', sendError);
      setShareCommentError('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setIsSendingMemoryComment(false);
    }
  }, [commentText, couple?.couple_id, coupleId, profile?.id, router, selectedMemoryForComments, userId]);

  const handleOpenOptions = useCallback((memory: MemoryCardItem) => {
    setSelectedMemoryForOptions(memory);
  }, []);

  const handleCloseOptions = useCallback(() => {
    setSelectedMemoryForOptions(null);
  }, []);

  const handleOpenDetail = useCallback((memory: MemoryCardItem) => {
    setSelectedMemoryForOptions(null);
    setSelectedMemoryForDetail(memory);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedMemoryForDetail(null);
  }, []);

  const handleShareMemory = useCallback(async (memory: MemoryCardItem) => {
    try {
      await Share.share({
        message: memory.mediaUrl
          ? `${memory.title}\n${memory.mediaUrl}`
          : `${memory.title}\n${memory.subtitle}`,
        title: memory.title,
      });
    } catch (shareError) {
      console.log('[Momentos] share error:', shareError);
      handleAlert('Compartir', 'No se pudo compartir este recuerdo.');
    }
  }, []);

  const handleEditMemory = useCallback(() => {
    setSelectedMemoryForOptions(null);
    handleAlert('Editar recuerdo', 'Muy pronto podrás editar este recuerdo.');
  }, []);

  const handleDeleteMemory = useCallback((memory: MemoryCardItem) => {
    Alert.alert(
      'Eliminar recuerdo',
      '¿Seguro que quieres eliminar este recuerdo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setHiddenMemoryIds((prev) => ({ ...prev, [memory.id]: true }));
            setSelectedMemoryForOptions(null);
            setSelectedMemoryForComments((prev) => (prev?.id === memory.id ? null : prev));
            setSelectedMemoryForDetail((prev) => (prev?.id === memory.id ? null : prev));
          },
        },
      ]
    );
  }, []);

  const isMemoryLiked = useCallback(
    (memory: MemoryCardItem) => Boolean(likedMemoryIds[memory.id]),
    [likedMemoryIds]
  );

  const isMemorySaved = useCallback(
    (memory: MemoryCardItem) => savedMemoryIds[memory.id] ?? memory.isFavorite,
    [savedMemoryIds]
  );

  const mappedMoments = useMemo<MemoryCardItem[]>(() => {
    return moments.map((moment, index) => ({
      id: moment.id,
      title: moment.title?.trim() || 'Nuevo recuerdo',
      subtitle: moment.description?.trim() || 'Un momento especial para guardar juntos.',
      dateLabel: fmtMomentDate(moment.memory_date || moment.created_at) || 'Hoy',
      type: moment.media_type === 'video' ? 'video' : 'photo',
      mediaUrl: moment.media_type === 'video' ? null : moment.media_url,
      isFavorite: savedMemoryIds[moment.id] ?? (index === 0),
      createdByLabel: moment.created_by === userId ? 'Tú' : (couple?.partner_name || 'Su pareja'),
    }));
  }, [moments, savedMemoryIds, userId, couple?.partner_name]);

  const placeholderMoments = useMemo(
    () =>
      PLACEHOLDER_MEMORIES
        .filter((item) => !hiddenMemoryIds[item.id])
        .map((item) => ({
          ...item,
          isFavorite: savedMemoryIds[item.id] ?? item.isFavorite,
        })),
    [hiddenMemoryIds, savedMemoryIds]
  );

  const activeMappedMoments = useMemo(
    () => mappedMoments.filter((item) => !hiddenMemoryIds[item.id]),
    [mappedMoments, hiddenMemoryIds]
  );

  const visibleMoments = useMemo(() => {
    const source = activeMappedMoments.length > 0 ? activeMappedMoments : placeholderMoments;
    switch (selectedFilter) {
      case 'Fotos':
        return source.filter((item) => item.type === 'photo');
      case 'Videos':
        return source.filter((item) => item.type === 'video');
      case 'Favoritos':
        return source.filter((item) => item.isFavorite);
      case 'Todos':
      default:
        return source;
    }
  }, [activeMappedMoments, placeholderMoments, selectedFilter]);

  const reelsMoments = activeMappedMoments.length > 0 ? activeMappedMoments : placeholderMoments;
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailySweetMemories = useMemo(() => {
    const source = activeMappedMoments.filter((item) => item.type === 'photo' && Boolean(item.mediaUrl));
    const seed = `${todayKey}:${coupleId ?? 'solo'}`;
    return seededShuffle(source, seed).slice(0, 10);
  }, [activeMappedMoments, coupleId, todayKey]);

  useEffect(() => {
    setActiveSweetMemoryIndex(0);
  }, [todayKey, dailySweetMemories.length]);

  const galleryCardWidth = useMemo(
    () => (GALLERY_GRID_WIDTH - GRID_GAP * (galleryColumns - 1)) / galleryColumns,
    [galleryColumns]
  );

  const galleryPreviewHeight = useMemo(() => {
    if (galleryColumns === 1) return 220;
    if (galleryColumns === 3) return 94;
    return 118;
  }, [galleryColumns]);

  const isCompactGallery = galleryColumns === 3;
  const isSingleColumnGallery = galleryColumns === 1;

  const renderCameraModal = () => (
    <Modal visible={cameraVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleCloseCamera}>
      <View style={styles.cameraScreen}>
        {cameraPermission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing={cameraFacing}
            flash={cameraFlash}
            onCameraReady={() => setIsCameraReady(true)}
          />
        ) : (
          <View style={styles.cameraPermissionCard}>
            <Text style={styles.cameraPermissionText}>No tenemos permiso para usar la cámara.</Text>
            <TouchableOpacity style={styles.cameraPermissionButton} onPress={requestCameraPermission}>
              <Text style={styles.cameraPermissionButtonText}>Permitir cámara</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.cameraTopScrim} />
        <View style={styles.cameraBottomScrim} />

        <View style={[styles.cameraTopBar, { paddingTop: Math.max(insets.top, 18) }]}>
          <TouchableOpacity style={styles.cameraTopButton} onPress={handleCloseCamera}>
            <X size={20} color="#FFFFFF" />
            <Text style={styles.cameraTopButtonText}>Cerrar</Text>
          </TouchableOpacity>
          <View style={styles.cameraTopActions}>
            <TouchableOpacity style={styles.cameraCircleButton} onPress={handleToggleFlash}>
              <Zap size={18} color="#FFFFFF" fill={cameraFlash === 'on' ? '#FFFFFF' : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraCircleButton} onPress={handleFlipCamera}>
              <RefreshCw size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {cameraError ? (
          <View style={[styles.cameraErrorBanner, { top: Math.max(insets.top, 18) + 62 }]}>
            <Text style={styles.cameraErrorBannerText}>{cameraError}</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.cameraBottomControlsRow,
            { bottom: Math.max(insets.bottom, 20) + GALLERY_TRAY_COLLAPSED_HEIGHT + 18 },
          ]}
        >
          <View style={styles.cameraBottomSpacer} />

          <View style={styles.captureButtonWrap}>
            <TouchableOpacity
              style={[styles.captureButtonOuter, (!cameraPermission?.granted || !isCameraReady || saving) && styles.captureButtonOuterDisabled]}
              onPress={handleCapturePhoto}
              disabled={!cameraPermission?.granted || !isCameraReady || saving}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <Text style={styles.captureButtonLabel}>{saving ? 'Guardando...' : 'Capturar'}</Text>
          </View>

          <View style={styles.cameraBottomSpacer} />
        </View>

        <Animated.View
          style={[
            styles.galleryTray,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY: galleryTrayTranslateY }],
            },
          ]}
        >
          <View {...galleryTrayPanResponder.panHandlers}>
            <TouchableOpacity style={styles.galleryTrayHandle} onPress={handleToggleGalleryTray} activeOpacity={0.85}>
              <View style={styles.galleryTrayHandleBar} />
              <View style={styles.galleryTrayHandleRow}>
                <Text style={styles.galleryTrayHandleText}>Fotos</Text>
                <ChevronUp
                  size={18}
                  color={TEXT_MUTED}
                  style={isGalleryTrayOpen ? styles.galleryChevronOpen : styles.galleryChevronClosed}
                />
              </View>
            </TouchableOpacity>
          </View>

          {isGalleryTrayOpen ? (
            isLoadingRecentPhotos ? (
              <View style={styles.galleryTrayLoading}>
                <ActivityIndicator size="small" color={ACCENT_PINK} />
                <Text style={styles.galleryTrayLoadingText}>Cargando fotos...</Text>
              </View>
            ) : mediaPermissionGranted ? (
              <>
                <Text style={styles.galleryTrayTitle}>Recientes</Text>
                {recentPhotos.length > 0 ? (
                  <FlatList
                    data={recentPhotos}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    columnWrapperStyle={styles.galleryTrayGridRow}
                    contentContainerStyle={styles.galleryTrayGrid}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.galleryThumbButton}
                        onPress={() => handlePickRecentPhoto(item)}
                        disabled={saving}
                      >
                        <Image source={{ uri: item.uri }} style={styles.galleryThumbImage} />
                        {saving ? (
                          <View style={styles.galleryThumbOverlay}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    )}
                    showsVerticalScrollIndicator={false}
                  />
                ) : (
                  <View style={styles.galleryPermissionCard}>
                    <Text style={styles.galleryPermissionText}>No hay fotos recientes.</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.galleryPermissionCard}>
                <Text style={styles.galleryPermissionText}>No tenemos permiso para ver tus fotos.</Text>
                <TouchableOpacity style={styles.galleryPermissionButton} onPress={handleRequestMediaPermission}>
                  <Text style={styles.galleryPermissionButtonText}>Permitir fotos</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
  const renderHeaderBlock = () => (
    <>
      <View style={styles.momentosTopControlsRow}>
        <View style={styles.compactSegmentedControl}>
          <TouchableOpacity
            style={[styles.compactSegmentButton, viewMode === 'reels' ? styles.compactSegmentButtonActive : null]}
            onPress={() => setViewMode('reels')}
          >
            <Text
              style={[
                styles.compactSegmentButtonText,
                viewMode === 'reels' ? styles.compactSegmentButtonTextActive : null,
              ]}
            >
              Reels
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.compactSegmentButton, viewMode === 'gallery' ? styles.compactSegmentButtonActive : null]}
            onPress={() => setViewMode('gallery')}
          >
            <Text
              style={[
                styles.compactSegmentButtonText,
                viewMode === 'gallery' ? styles.compactSegmentButtonTextActive : null,
              ]}
            >
              Galería
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.cameraActionButton, saving && { opacity: 0.6 }]}
          onPress={handleOpenAddMemory}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color={CARD_BG} /> : <Camera size={18} color={CARD_BG} />}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </>
  );

  const renderGalleryView = () => (
    <>
      <View style={styles.sweetMemoriesSection}>
        <Text style={styles.sectionTitle}>Dulces recuerdos</Text>
        <Text style={styles.sectionSubtitle}>10 momentos para volver a sonreír hoy.</Text>

        {dailySweetMemories.length > 0 ? (
          <>
            <FlatList
              data={dailySweetMemories}
              horizontal
              pagingEnabled
              snapToInterval={SWEET_MEMORY_CARD_WIDTH}
              decelerationRate="fast"
              disableIntervalMomentum
              overScrollMode="never"
              bounces={false}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              scrollEventThrottle={16}
              style={styles.sweetMemoriesList}
              getItemLayout={(_, index) => ({
                length: SWEET_MEMORY_CARD_WIDTH,
                offset: SWEET_MEMORY_CARD_WIDTH * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SWEET_MEMORY_CARD_WIDTH);
                setActiveSweetMemoryIndex(Math.max(0, Math.min(nextIndex, dailySweetMemories.length - 1)));
              }}
              renderItem={({ item }) => (
                <View style={styles.sweetMemorySlide}>
                  <View style={styles.sweetMemoryCard}>
                    <Image source={{ uri: item.mediaUrl || undefined }} style={styles.sweetMemoryImage} resizeMode="cover" />
                    <View style={styles.sweetMemoryTopRow}>
                      <View style={styles.sweetMemoryDateBadge}>
                        <Text style={styles.sweetMemoryDateText}>{item.dateLabel}</Text>
                      </View>
                      {item.isFavorite ? (
                        <View style={styles.sweetMemoryFavoriteBadge}>
                          <Heart size={12} color={ACCENT_PINK} fill={ACCENT_PINK} />
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.sweetMemoryBottomInfo}>
                      <Text style={styles.sweetMemoryTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.sweetMemorySubtitle} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            />
            <Text style={styles.sweetMemoryCounter}>
              {Math.min(activeSweetMemoryIndex + 1, dailySweetMemories.length)} / {dailySweetMemories.length}
            </Text>
          </>
        ) : (
          <View style={styles.sweetMemoriesEmptyCard}>
            <Text style={styles.emptyTitle}>Aún no hay dulces recuerdos</Text>
            <Text style={styles.emptySubtitle}>
              Agreguen fotos para ver aquí sus momentos favoritos.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleOpenAddMemory} disabled={saving}>
              <Text style={styles.emptyButtonText}>Agregar recuerdo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.galleryFiltersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {MOMENT_FILTERS.map((filter) => {
            const selected = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, selected ? styles.filterChipActive : null]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterChipText, selected ? styles.filterChipTextActive : null]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.galleryHeaderRow}>
          <Text style={styles.sectionTitle}>Sus recuerdos</Text>
          <Pressable style={styles.galleryLayoutButton} onPress={handleToggleGalleryColumns}>
            <LayoutGrid size={18} color={ACCENT_PINK} />
            <Text style={styles.galleryLayoutButtonText}>{galleryColumns}</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionSubtitle}>Su galería para volver a sentir cada momento.</Text>
      </View>

      {visibleMoments.length > 0 ? (
        <View style={styles.memoriesGrid}>
          {visibleMoments.map((moment) => (
            <View key={moment.id} style={[styles.memoryCard, { width: galleryCardWidth }]}>
              <MemoryPreview
                title={moment.title}
                type={moment.type}
                mediaUrl={moment.mediaUrl}
                height={galleryPreviewHeight}
                compact={isCompactGallery}
              />
              <View
                style={[
                  styles.memoryCardBody,
                  isSingleColumnGallery ? styles.memoryCardBodySingle : null,
                  isCompactGallery ? styles.memoryCardBodyCompact : null,
                ]}
              >
                <View style={styles.memoryMetaRow}>
                  <View style={[styles.memoryTypeBadge, isCompactGallery ? styles.memoryTypeBadgeCompact : null]}>
                    {moment.type === 'video' ? (
                      <Video size={isCompactGallery ? 10 : 12} color={ACCENT_PINK} />
                    ) : (
                      <ImageIcon size={isCompactGallery ? 10 : 12} color={ACCENT_PINK} />
                    )}
                    <Text style={[styles.memoryTypeBadgeText, isCompactGallery ? styles.memoryTypeBadgeTextCompact : null]}>
                      {moment.type === 'video' ? 'Video' : 'Foto'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleToggleSave(moment.id)}
                    style={[styles.favoriteIconButton, isCompactGallery ? styles.favoriteIconButtonCompact : null]}
                  >
                    <Heart
                      size={isCompactGallery ? 14 : 16}
                      color={isMemorySaved(moment) ? ACCENT_PINK : TEXT_MUTED}
                      fill={isMemorySaved(moment) ? ACCENT_PINK : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[
                    styles.memoryTitle,
                    isSingleColumnGallery ? styles.memoryTitleSingle : null,
                    isCompactGallery ? styles.memoryTitleCompact : null,
                  ]}
                  numberOfLines={isCompactGallery ? 1 : 2}
                >
                  {moment.title}
                </Text>
                <Text
                  style={[
                    styles.memoryDate,
                    isSingleColumnGallery ? styles.memoryDateSingle : null,
                    isCompactGallery ? styles.memoryDateCompact : null,
                  ]}
                >
                  {moment.dateLabel}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aún no hay recuerdos</Text>
          <Text style={styles.emptySubtitle}>
            Agreguen una foto o video para guardar este momento juntos.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleOpenAddMemory} disabled={saving}>
            <Text style={styles.emptyButtonText}>Agregar recuerdo</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ACCENT_PINK} />
      </View>
    );
  }

  if (viewMode === 'reels') {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.content,
            styles.reelsHeaderWrap,
            { paddingTop: Math.max(insets.top, 14) },
          ]}
        >
          {renderHeaderBlock()}
        </View>

        <View style={styles.reelsFeedWrap}>
          <FlatList
            data={reelsMoments}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ReelMemoryCard
                moment={item}
                isLiked={isMemoryLiked(item)}
                isSaved={isMemorySaved(item)}
                onHeart={() => handleToggleLike(item.id)}
                onComment={() => handleOpenComments(item)}
                onSave={() => handleToggleSave(item.id)}
                onMore={() => handleOpenOptions(item)}
                isLast={index === reelsMoments.length - 1}
              />
            )}
            pagingEnabled
            snapToInterval={REEL_SNAP_INTERVAL}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            disableIntervalMomentum
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={[
              styles.reelsListContent,
              { paddingBottom: 120 + insets.bottom },
            ]}
            getItemLayout={(_, index) => ({
              length: REEL_SNAP_INTERVAL,
              offset: REEL_SNAP_INTERVAL * index,
              index,
            })}
          />
        </View>
        {renderMomentosModals({
          saving,
          bottomInset: insets.bottom,
          selectedMemoryForComments,
          commentText,
          shareCommentError,
          isSendingMemoryComment,
          onChangeCommentText: setCommentText,
          onSendComment: handleSendMemoryCommentToChat,
          onCloseComments: handleCloseComments,
          selectedMemoryForOptions,
          onCloseOptions: handleCloseOptions,
          onOpenDetail: handleOpenDetail,
          onShareMemory: handleShareMemory,
          onEditMemory: handleEditMemory,
          onDeleteMemory: handleDeleteMemory,
          selectedMemoryForDetail,
          onCloseDetail: handleCloseDetail,
        })}
        {renderCameraModal()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 150 + insets.bottom, paddingTop: Math.max(insets.top, 14) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderHeaderBlock()}
        {renderGalleryView()}
      </ScrollView>
      {renderMomentosModals({
        saving,
        bottomInset: insets.bottom,
        selectedMemoryForComments,
        commentText,
        shareCommentError,
        isSendingMemoryComment,
        onChangeCommentText: setCommentText,
        onSendComment: handleSendMemoryCommentToChat,
        onCloseComments: handleCloseComments,
        selectedMemoryForOptions,
        onCloseOptions: handleCloseOptions,
        onOpenDetail: handleOpenDetail,
        onShareMemory: handleShareMemory,
        onEditMemory: handleEditMemory,
        onDeleteMemory: handleDeleteMemory,
        selectedMemoryForDetail,
        onCloseDetail: handleCloseDetail,
      })}
      {renderCameraModal()}
    </View>
  );
}

function AvatarBubble({
  uri,
  fallback,
  style,
}: {
  uri: string | null;
  fallback: string;
  style?: object;
}) {
  return (
    <View style={[styles.avatarBubble, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarBubbleImage} />
      ) : (
        <Text style={styles.avatarBubbleText}>{fallback}</Text>
      )}
    </View>
  );
}

function MemoryPreview({
  title,
  type,
  mediaUrl,
  large = false,
  height,
  compact = false,
}: {
  title: string;
  type: 'photo' | 'video';
  mediaUrl: string | null;
  large?: boolean;
  height?: number;
  compact?: boolean;
}) {
  const containerStyle = large ? styles.featuredMedia : [styles.memoryPreview, height ? { height } : null];
  const overlayStyle = large ? styles.featuredMediaOverlay : styles.memoryPreviewOverlay;

  if (type === 'photo' && mediaUrl) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri: mediaUrl }} style={styles.previewImage} />
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.previewFallback]}>
      <View style={overlayStyle}>
        {type === 'video' ? (
          <Video size={large ? 28 : compact ? 16 : 20} color={ACCENT_PINK} />
        ) : (
          <ImageIcon size={large ? 28 : compact ? 16 : 20} color={ACCENT_PINK} />
        )}
        <Text style={large ? styles.featuredMediaLabel : [styles.memoryPreviewLabel, compact ? styles.memoryPreviewLabelCompact : null]}>
          {type === 'video' ? 'Video' : 'Foto'}
        </Text>
      </View>
      <Text
        style={large ? styles.featuredMediaTitle : [styles.memoryPreviewTitle, compact ? styles.memoryPreviewTitleCompact : null]}
        numberOfLines={compact ? 1 : 2}
      >
        {title}
      </Text>
    </View>
  );
}

function ReelMemoryCard({
  moment,
  isLiked,
  isSaved,
  onHeart,
  onComment,
  onSave,
  onMore,
  isLast = false,
}: {
  moment: MemoryCardItem;
  isLiked: boolean;
  isSaved: boolean;
  onHeart: () => void;
  onComment: () => void;
  onSave: () => void;
  onMore: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.reelCard, isLast ? styles.reelCardLast : null]}>
      <View style={styles.reelMediaWrap}>
        <ReelMediaPreview title={moment.title} type={moment.type} mediaUrl={moment.mediaUrl} />
        <View style={styles.reelActionsColumn}>
          <TouchableOpacity style={[styles.reelActionButton, isLiked ? styles.reelActionButtonActive : null]} onPress={onHeart}>
            <Heart size={18} color={ACCENT_PINK} fill={isLiked ? ACCENT_PINK : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.reelActionButton} onPress={onComment}>
            <MessageCircle size={18} color={ACCENT_PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.reelActionButton, isSaved ? styles.reelActionButtonActive : null]} onPress={onSave}>
            <Bookmark size={18} color={ACCENT_PINK} fill={isSaved ? ACCENT_PINK : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.reelActionButton} onPress={onMore}>
            <MoreVertical size={18} color={ACCENT_PINK} />
          </TouchableOpacity>
        </View>
        <View style={styles.reelDateBadgeOverlay}>
          <Text style={styles.reelDateText}>{moment.dateLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function renderMomentosModals({
  saving,
  bottomInset,
  selectedMemoryForComments,
  commentText,
  shareCommentError,
  isSendingMemoryComment,
  onChangeCommentText,
  onSendComment,
  onCloseComments,
  selectedMemoryForOptions,
  onCloseOptions,
  onOpenDetail,
  onShareMemory,
  onEditMemory,
  onDeleteMemory,
  selectedMemoryForDetail,
  onCloseDetail,
}: {
  saving: boolean;
  bottomInset: number;
  selectedMemoryForComments: MemoryCardItem | null;
  commentText: string;
  shareCommentError: string;
  isSendingMemoryComment: boolean;
  onChangeCommentText: (value: string) => void;
  onSendComment: () => void;
  onCloseComments: () => void;
  selectedMemoryForOptions: MemoryCardItem | null;
  onCloseOptions: () => void;
  onOpenDetail: (memory: MemoryCardItem) => void;
  onShareMemory: (memory: MemoryCardItem) => void;
  onEditMemory: () => void;
  onDeleteMemory: (memory: MemoryCardItem) => void;
  selectedMemoryForDetail: MemoryCardItem | null;
  onCloseDetail: () => void;
}) {
  return (
    <>
      <Modal visible={Boolean(selectedMemoryForComments)} transparent animationType="fade" onRequestClose={onCloseComments}>
        <Pressable style={styles.commentComposerBackdrop} onPress={onCloseComments}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.commentComposerKeyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <Pressable
              style={[styles.commentComposerWrap, { paddingBottom: 18 + bottomInset }]}
              onPress={() => {}}
            >
              <View style={styles.commentComposerContainer}>
                <TextInput
                  value={commentText}
                  onChangeText={onChangeCommentText}
                  placeholder="Escribe un comentario..."
                  placeholderTextColor="#B8ADB4"
                  style={styles.commentComposerInput}
                  editable={!isSendingMemoryComment}
                  multiline
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.commentComposerSendButton,
                    (!commentText.trim() || isSendingMemoryComment) ? styles.commentComposerSendButtonDisabled : null,
                  ]}
                  onPress={onSendComment}
                  disabled={!commentText.trim() || isSendingMemoryComment}
                >
                  <Send size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {shareCommentError ? <Text style={styles.commentComposerError}>{shareCommentError}</Text> : null}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(selectedMemoryForOptions)} transparent animationType="fade" onRequestClose={onCloseOptions}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetModalCard}>
            <Text style={styles.modalTitle}>Opciones</Text>
            <TouchableOpacity
              style={styles.modalSecondaryOption}
              onPress={() => selectedMemoryForOptions && onOpenDetail(selectedMemoryForOptions)}
            >
              <Text style={styles.modalSecondaryOptionText}>Ver detalle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryOption}
              onPress={() => {
                if (selectedMemoryForOptions) {
                  onCloseOptions();
                  onShareMemory(selectedMemoryForOptions);
                }
              }}
            >
              <Text style={styles.modalSecondaryOptionText}>Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondaryOption} onPress={onEditMemory}>
              <Text style={styles.modalSecondaryOptionText}>Editar recuerdo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSecondaryOption, styles.modalDangerOption]}
              onPress={() => selectedMemoryForOptions && onDeleteMemory(selectedMemoryForOptions)}
            >
              <Text style={styles.modalDangerOptionText}>Eliminar recuerdo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGhostOption} onPress={onCloseOptions}>
              <Text style={styles.modalGhostOptionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedMemoryForDetail)} transparent animationType="fade" onRequestClose={onCloseDetail}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalCard}>
            <Text style={styles.modalTitle}>Detalle del recuerdo</Text>
            {selectedMemoryForDetail ? (
              <>
                <View style={styles.detailPreviewWrap}>
                  <ReelMediaPreview
                    title={selectedMemoryForDetail.title}
                    type={selectedMemoryForDetail.type}
                    mediaUrl={selectedMemoryForDetail.mediaUrl}
                  />
                </View>
                <View style={styles.detailMetaRow}>
                  <View style={styles.detailMetaBadge}>
                    <Text style={styles.detailMetaBadgeText}>{selectedMemoryForDetail.dateLabel}</Text>
                  </View>
                  <View style={styles.detailMetaBadge}>
                    <Text style={styles.detailMetaBadgeText}>
                      {selectedMemoryForDetail.type === 'video' ? 'Video' : 'Foto'}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
            <TouchableOpacity style={styles.modalGhostOption} onPress={onCloseDetail}>
              <Text style={styles.modalGhostOptionText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ReelMediaPreview({
  title,
  type,
  mediaUrl,
}: {
  title: string;
  type: 'photo' | 'video';
  mediaUrl: string | null;
}) {
  if (type === 'photo' && mediaUrl) {
    return (
      <View style={styles.reelMedia}>
        <Image source={{ uri: mediaUrl }} style={styles.reelMediaFill} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={styles.reelPlaceholderFull}>
      <View style={styles.reelMediaOverlay}>
        {type === 'video' ? (
          <Video size={34} color={ACCENT_PINK} />
        ) : (
          <ImageIcon size={34} color={ACCENT_PINK} />
        )}
        <Text style={styles.reelMediaOverlayLabel}>{type === 'video' ? 'Video' : 'Foto'}</Text>
      </View>
      <Text style={styles.reelMediaTitle} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  cameraActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT_PINK,
    borderWidth: 1,
    borderColor: '#F2B8C2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#0F0B0D',
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 168,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  cameraBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  cameraPermissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#140F12',
  },
  cameraPermissionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  cameraPermissionButton: {
    backgroundColor: ACCENT_PINK,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cameraPermissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cameraTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cameraTopButton: {
    minWidth: 52,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cameraTopButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cameraErrorBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(255,244,246,0.96)',
    borderWidth: 1,
    borderColor: '#F6CAD4',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cameraErrorBannerText: {
    color: '#C55A73',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraBottomControlsRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  captureButtonWrap: {
    alignItems: 'center',
  },
  cameraBottomSpacer: {
    width: 68,
  },
  captureButtonOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  captureButtonOuterDisabled: {
    opacity: 0.55,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 6,
    borderColor: '#F6CAD4',
  },
  captureButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  galleryTray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: GALLERY_TRAY_EXPANDED_HEIGHT,
    backgroundColor: '#FFF9FB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  galleryTrayHandle: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: 12,
  },
  galleryTrayHandleBar: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E9D3DA',
    alignSelf: 'center',
    marginBottom: 10,
  },
  galleryTrayHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  galleryTrayHandleText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '800',
  },
  galleryChevronClosed: {
    transform: [{ rotate: '180deg' }],
  },
  galleryChevronOpen: {
    transform: [{ rotate: '0deg' }],
  },
  galleryTrayLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 18,
  },
  galleryTrayLoadingText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  galleryTrayTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  galleryTrayGrid: {
    paddingBottom: 18,
    gap: 10,
  },
  galleryTrayGridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  galleryThumbButton: {
    width: (width - 60) / 3,
    aspectRatio: 0.78,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD_SOFT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  galleryThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPermissionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },
  galleryPermissionText: {
    color: TEXT_MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  galleryPermissionButton: {
    backgroundColor: SOFT_PINK,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  galleryPermissionButtonText: {
    color: ACCENT_PINK,
    fontSize: 14,
    fontWeight: '800',
  },
  momentosTopControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20,
  },
  reelsHeaderWrap: {
    paddingBottom: 14,
  },
  compactSegmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7FA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    padding: 4,
  },
  compactSegmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
  },
  compactSegmentButtonActive: {
    backgroundColor: ACCENT_PINK,
  },
  compactSegmentButtonText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '800',
  },
  compactSegmentButtonTextActive: {
    color: CARD_BG,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FFF4F6',
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F7CCD6',
  },
  errorText: {
    color: '#C55A73',
    fontSize: 14,
    textAlign: 'center',
  },
  sweetMemoriesSection: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  sweetMemoriesList: {
    marginTop: 14,
    width: SWEET_MEMORY_CARD_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
  },
  sweetMemorySlide: {
    width: SWEET_MEMORY_CARD_WIDTH,
    alignItems: 'center',
  },
  sweetMemoryCard: {
    width: '100%',
    height: 284,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF9FB',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  sweetMemoryImage: {
    width: '100%',
    height: '100%',
  },
  sweetMemoryTopRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sweetMemoryDateBadge: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(243,221,229,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  sweetMemoryDateText: {
    color: ACCENT_PINK,
    fontSize: 12,
    fontWeight: '800',
  },
  sweetMemoryFavoriteBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(243,221,229,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweetMemoryBottomInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(243,221,229,0.95)',
  },
  sweetMemoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  sweetMemorySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
  },
  sweetMemoryCounter: {
    marginTop: 14,
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  sweetMemoriesEmptyCard: {
    marginTop: 14,
    backgroundColor: CARD_SOFT,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    alignItems: 'center',
  },
  featuredMedia: {
    height: 208,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: CARD_SOFT,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredMediaOverlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFFD9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featuredMediaLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT_PINK,
    marginTop: 4,
  },
  featuredMediaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    maxWidth: '78%',
  },
  featuredAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  avatarBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBubbleImage: {
    width: '100%',
    height: '100%',
  },
  avatarBubbleText: {
    color: ACCENT_PINK,
    fontSize: 13,
    fontWeight: '800',
  },
  avatarOverlap: {
    marginLeft: -10,
  },
  featuredAvatarLabel: {
    marginLeft: 10,
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  chipsRow: {
    gap: 10,
    paddingBottom: 8,
    paddingRight: 10,
  },
  galleryFiltersSection: {
    marginBottom: 6,
  },
  filterChip: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: SOFT_PINK,
    borderColor: '#F0C7D3',
  },
  filterChipText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: ACCENT_PINK,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  galleryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: TEXT_MUTED,
  },
  reelsFeedWrap: {
    flex: 1,
  },
  reelsListContent: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  reelCard: {
    height: REEL_CARD_HEIGHT,
    backgroundColor: 'transparent',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
    marginBottom: REEL_CARD_SPACING,
  },
  reelCardLast: {
    marginBottom: 0,
  },
  reelMediaWrap: {
    position: 'relative',
    flex: 1,
  },
  reelMedia: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelMediaFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  reelPlaceholderFull: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#1A1217',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelMediaOverlay: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFFE6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  reelMediaOverlayLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT_PINK,
    marginTop: 4,
  },
  reelMediaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    maxWidth: '76%',
  },
  reelActionsColumn: {
    position: 'absolute',
    right: 10,
    bottom: 18,
    gap: 10,
    alignItems: 'center',
  },
  reelActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFFE6',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelActionButtonActive: {
    backgroundColor: SOFT_PINK,
    borderColor: '#F0C7D3',
  },
  reelDateBadgeOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 18,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(243,221,229,0.95)',
  },
  reelDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D88EA1',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36, 29, 34, 0.26)',
    justifyContent: 'flex-end',
    padding: 20,
  },
  sheetModalCard: {
    backgroundColor: '#FFF9FB',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    gap: 12,
  },
  detailModalCard: {
    marginTop: 'auto',
    marginBottom: 'auto',
    backgroundColor: '#FFF9FB',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalPrimaryOption: {
    backgroundColor: ACCENT_PINK,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryOptionText: {
    color: CARD_BG,
    fontSize: 15,
    fontWeight: '800',
  },
  modalSecondaryOption: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalSecondaryOptionText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
  },
  modalGhostOption: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGhostOptionText: {
    color: TEXT_MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
  modalDangerOption: {
    backgroundColor: '#FFF3F5',
    borderColor: '#F6C6D2',
  },
  modalDangerOptionText: {
    color: '#C85B74',
    fontSize: 15,
    fontWeight: '800',
  },
  commentComposerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  commentComposerKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentComposerWrap: {
    paddingHorizontal: 20,
  },
  commentComposerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F3DDE5',
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  commentComposerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    fontSize: 16,
    color: '#241D22',
    paddingVertical: 10,
    paddingRight: 10,
    textAlignVertical: 'top',
  },
  commentComposerSendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F49CAF',
  },
  commentComposerSendButtonDisabled: {
    opacity: 0.45,
  },
  commentComposerError: {
    marginTop: 8,
    marginLeft: 12,
    color: '#D88EA1',
    fontSize: 13,
    fontWeight: '600',
  },
  detailPreviewWrap: {
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
  },
  detailMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailMetaBadge: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailMetaBadgeText: {
    color: ACCENT_PINK,
    fontSize: 13,
    fontWeight: '700',
  },
  memoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
  },
  galleryLayoutButton: {
    minWidth: 52,
    height: 42,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8FB',
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  galleryLayoutButtonText: {
    color: ACCENT_PINK,
    fontSize: 13,
    fontWeight: '800',
  },
  memoryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  memoryPreview: {
    height: 118,
    backgroundColor: CARD_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    paddingHorizontal: 14,
  },
  memoryPreviewOverlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFFCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  memoryPreviewLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT_PINK,
  },
  memoryPreviewLabelCompact: {
    fontSize: 10,
  },
  memoryPreviewTitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '700',
    textAlign: 'center',
  },
  memoryPreviewTitleCompact: {
    fontSize: 11,
  },
  memoryCardBody: {
    padding: 14,
  },
  memoryCardBodySingle: {
    padding: 16,
  },
  memoryCardBodyCompact: {
    padding: 10,
  },
  memoryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  memoryTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SOFT_PINK,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  memoryTypeBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  memoryTypeBadgeText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT_PINK,
  },
  memoryTypeBadgeTextCompact: {
    fontSize: 10,
    marginLeft: 3,
  },
  favoriteIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8FB',
  },
  favoriteIconButtonCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  memoryTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  memoryTitleSingle: {
    fontSize: 16,
    lineHeight: 22,
  },
  memoryTitleCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  memoryDate: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '700',
  },
  memoryDateSingle: {
    fontSize: 13,
  },
  memoryDateCompact: {
    fontSize: 10,
  },
  emptyCard: {
    backgroundColor: CARD_SOFT,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: ACCENT_PINK,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: CARD_BG,
    fontSize: 14,
    fontWeight: '800',
  },
});
