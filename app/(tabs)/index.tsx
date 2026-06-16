import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import {
  MapPin, BookHeart, Heart,
  MessageCircle, Image as ImageIcon,
  Calendar, Clapperboard, Sparkles, Clock,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 20;
const HIGHLIGHT_WIDTH = width - HORIZONTAL_PADDING * 2;
const HIGHLIGHT_SWIPE_DISTANCE_THRESHOLD = 35;
const HIGHLIGHT_SWIPE_VELOCITY_THRESHOLD = 0.25;

// --- Premium Light / Pastel Theme Palette ---
const PAGE_BG = '#FFFFFF';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#222222';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const ACCENT_RED = '#F4A6A6';
const BORDER = '#F1DCDC';
const SOFT_PINK = '#FFF1F2';

const ACCENT_GOLD = '#FFBA08';
const ACCENT_BLUE = '#64B5F6';

const MOODS = [
  { emoji: '😊', label: 'Feliz' },
  { emoji: '😌', label: 'Tranquilo' },
  { emoji: '😴', label: 'Cansado' },
  { emoji: '🤩', label: 'Emocionado' },
  { emoji: '🤍', label: 'Pensativo' },
  { emoji: '🥺', label: 'Extrañando' },
];

const AVATAR_SIZE = 42;
const AVATAR_INNER = 38;
const AVATAR_PADDING = 10;

type HomeHighlight = {
  id: string;
  sectionTitle: string;
  title: string;
  subtitle: string;
  badge: string;
  buttonLabel: string;
  onPress: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const projectPointToPreview = (
  latValue: any,
  lngValue: any,
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  },
  size: { width: number; height: number }
) => {
  const lat = Number(latValue);
  const lng = Number(lngValue);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!size.width || !size.height) return null;

  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLng = region.longitude + region.longitudeDelta / 2;

  if (maxLat <= minLat || maxLng <= minLng) return null;

  const rawCenterX = ((lng - minLng) / (maxLng - minLng)) * size.width;
  const rawCenterY = ((maxLat - lat) / (maxLat - minLat)) * size.height;

  return {
    x: clamp(rawCenterX - AVATAR_SIZE / 2, AVATAR_PADDING, size.width - AVATAR_SIZE - AVATAR_PADDING),
    y: clamp(rawCenterY - AVATAR_SIZE / 2, AVATAR_PADDING, size.height - AVATAR_SIZE - AVATAR_PADDING),
  };
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, couple, loading } = useProfileAndCouple();

  const myName = profile?.name || 'Furkan';
  const partnerName = couple?.partner_name || 'deneme2';
  
  const myAvatar = profile?.avatar_url;
  const partnerAvatar = couple?.partner_avatar_url;

  const coupleId = ((profile as any)?.couple_id as string | null) ?? (couple?.couple_id ?? null);
  const userId = profile?.id ?? null;

  const [myLocationRow, setMyLocationRow] = useState<any | null>(null);
  const [partnerLocationRow, setPartnerLocationRow] = useState<any | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any | null>(null);
  const [homeMapSize, setHomeMapSize] = useState({ width: 0, height: 0 });

  const fetchHomeMapLocations = useCallback(async () => {
    if (!userId || !coupleId) return;

    try {
      const { data: rows, error } = await supabase
        .from('couple_locations')
        .select('*')
        .eq('couple_id', coupleId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[Inicio] fetch locations error:', error);
        return;
      }

      const myRow = rows?.find((row: any) => row.user_id === userId) ?? null;
      const partnerRow = rows?.find((row: any) => row.user_id !== userId) ?? null;

      setMyLocationRow(myRow);
      setPartnerLocationRow(partnerRow);
    } catch (error) {
      console.warn('[Inicio] fetchHomeMapLocations failed:', error);
    }
  }, [coupleId, userId]);

  const fetchPartnerProfile = useCallback(async () => {
    if (!userId || !coupleId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('couple_id', coupleId)
        .neq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[Inicio] fetch partner profile error:', error);
        return;
      }

      setPartnerProfile(data ?? null);
    } catch (error) {
      console.warn('[Inicio] fetchPartnerProfile failed:', error);
    }
  }, [coupleId, userId]);

  useEffect(() => {
    fetchHomeMapLocations();
    fetchPartnerProfile();
  }, [fetchHomeMapLocations, fetchPartnerProfile]);

  useEffect(() => {
    if (!coupleId) return;

    const channel = supabase
      .channel(`home-map-locations-${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_locations',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          fetchHomeMapLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId, fetchHomeMapLocations]);

  const homePreviewRegion = useMemo(() => {
    const myLat = Number(myLocationRow?.latitude);
    const myLng = Number(myLocationRow?.longitude);
    const partnerLat = Number(partnerLocationRow?.latitude);
    const partnerLng = Number(partnerLocationRow?.longitude);

    const points = [
      Number.isFinite(myLat) && Number.isFinite(myLng) ? { latitude: myLat, longitude: myLng } : null,
      Number.isFinite(partnerLat) && Number.isFinite(partnerLng)
        ? { latitude: partnerLat, longitude: partnerLng }
        : null,
    ].filter(Boolean) as { latitude: number; longitude: number }[];

    if (points.length === 0) {
      return { latitude: 19.2826, longitude: -99.6557, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }

    if (points.length === 1) {
      return {
        latitude: points[0].latitude,
        longitude: points[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;

    const latitudeDelta = Math.max((maxLat - minLat) * 1.8, 0.01);
    const longitudeDelta = Math.max((maxLng - minLng) * 1.8, 0.01);

    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [
    myLocationRow?.latitude,
    myLocationRow?.longitude,
    partnerLocationRow?.latitude,
    partnerLocationRow?.longitude,
  ]);

  const myPreviewPoint = useMemo(() => {
    return projectPointToPreview(myLocationRow?.latitude, myLocationRow?.longitude, homePreviewRegion, homeMapSize);
  }, [myLocationRow?.latitude, myLocationRow?.longitude, homePreviewRegion, homeMapSize]);

  const partnerPreviewPoint = useMemo(() => {
    return projectPointToPreview(
      partnerLocationRow?.latitude,
      partnerLocationRow?.longitude,
      homePreviewRegion,
      homeMapSize
    );
  }, [partnerLocationRow?.latitude, partnerLocationRow?.longitude, homePreviewRegion, homeMapSize]);

  const partnerPreviewPointAdjusted = useMemo(() => {
    if (!myPreviewPoint || !partnerPreviewPoint) return partnerPreviewPoint;

    const dx = partnerPreviewPoint.x - myPreviewPoint.x;
    const dy = partnerPreviewPoint.y - myPreviewPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < AVATAR_SIZE - 4) {
      const nextX = clamp(
        partnerPreviewPoint.x + AVATAR_SIZE * 0.55,
        AVATAR_PADDING,
        homeMapSize.width - AVATAR_SIZE - AVATAR_PADDING
      );
      const nextY = clamp(
        partnerPreviewPoint.y - AVATAR_SIZE * 0.12,
        AVATAR_PADDING,
        homeMapSize.height - AVATAR_SIZE - AVATAR_PADDING
      );
      return { x: nextX, y: nextY };
    }

    return partnerPreviewPoint;
  }, [myPreviewPoint, partnerPreviewPoint, homeMapSize]);

  // Local UI states
  const [myMood, setMyMood] = useState<{ emoji: string; label: string } | null>(MOODS[0]);
  const [partnerMood] = useState<{ emoji: string; label: string } | null>(MOODS[5]);
  const handleCycleMood = useCallback(() => {
    setMyMood((prev) => {
      if (!prev) return MOODS[0];
      const currentIndex = MOODS.findIndex((item) => item.label === prev.label);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MOODS.length : 0;
      return MOODS[nextIndex];
    });
  }, []);

  const homeHighlights = useMemo<HomeHighlight[]>(
    () => [
      {
        id: 'date',
        sectionTitle: 'Próxima fecha especial',
        title: 'Nuestro aniversario',
        subtitle: '12 de junio',
        badge: 'Faltan 25 días',
        buttonLabel: 'Ver calendario',
        onPress: () => router.push('/(tabs)/calendario'),
      },
      {
        id: 'memory',
        sectionTitle: 'Recuerdo bonito',
        title: 'Guardaron un momento especial juntos',
        subtitle: '“Ese día fue muy bonito ✨”',
        badge: 'HACE 3 DÍAS',
        buttonLabel: 'Ver momentos',
        onPress: () => router.push('/(tabs)/moments'),
      },
    ],
    [router]
  );

  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const activeHighlightIndexRef = useRef(0);
  useEffect(() => {
    activeHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex]);

  const highlightTranslateX = useRef(new Animated.Value(0)).current;

  const snapToHighlight = useCallback(
    (nextIndex: number) => {
      const maxIndex = Math.max(homeHighlights.length - 1, 0);
      const safeIndex = Math.max(0, Math.min(nextIndex, maxIndex));
      activeHighlightIndexRef.current = safeIndex;
      setActiveHighlightIndex(safeIndex);
      Animated.spring(highlightTranslateX, {
        toValue: -safeIndex * HIGHLIGHT_WIDTH,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }).start();
    },
    [highlightTranslateX, homeHighlights.length]
  );

  const highlightPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderGrant: () => {
          highlightTranslateX.stopAnimation();
        },
        onPanResponderMove: (_evt, gestureState) => {
          const currentIndex = activeHighlightIndexRef.current;
          const baseOffset = -currentIndex * HIGHLIGHT_WIDTH;
          let nextTranslate = baseOffset + gestureState.dx;

          const minTranslate = -(homeHighlights.length - 1) * HIGHLIGHT_WIDTH;
          const maxTranslate = 0;

          if (nextTranslate > maxTranslate) {
            nextTranslate = maxTranslate + (nextTranslate - maxTranslate) * 0.25;
          }

          if (nextTranslate < minTranslate) {
            nextTranslate = minTranslate + (nextTranslate - minTranslate) * 0.25;
          }

          highlightTranslateX.setValue(nextTranslate);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const currentIndex = activeHighlightIndexRef.current;
          let nextIndex = currentIndex;

          if (gestureState.dx < -HIGHLIGHT_SWIPE_DISTANCE_THRESHOLD || gestureState.vx < -HIGHLIGHT_SWIPE_VELOCITY_THRESHOLD) {
            nextIndex = currentIndex + 1;
          } else if (
            gestureState.dx > HIGHLIGHT_SWIPE_DISTANCE_THRESHOLD ||
            gestureState.vx > HIGHLIGHT_SWIPE_VELOCITY_THRESHOLD
          ) {
            nextIndex = currentIndex - 1;
          }

          snapToHighlight(nextIndex);
        },
        onPanResponderTerminate: () => {
          snapToHighlight(activeHighlightIndexRef.current);
        },
      }),
    [highlightTranslateX, homeHighlights.length, snapToHighlight]
  );

  useEffect(() => {
    snapToHighlight(activeHighlightIndexRef.current);
  }, [snapToHighlight]);

  const renderHighlightSlideContent = useCallback(
    (item: HomeHighlight) => {
      return (
        <View style={s.highlightSlideContent}>
          <View style={s.highlightCardTopRow}>
            <View style={s.highlightTextContent}>
              <Text style={s.highlightSectionLabel}>{item.sectionTitle}</Text>
              {item.id === 'date' ? (
                <>
                  <Text style={s.highlightDateTitle}>{item.title}</Text>
                  <Text style={s.highlightDateSubtitle}>{item.subtitle}</Text>
                  <View style={s.highlightDateBadge}>
                    <Text style={s.highlightDateBadgeText}>{item.badge}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.highlightMemoryBadge}>
                    <Text style={s.highlightMemoryBadgeText}>{item.badge}</Text>
                  </View>
                  <Text style={s.highlightMemoryTitle}>{item.title}</Text>
                  <Text style={s.highlightMemoryQuote}>{item.subtitle}</Text>
                </>
              )}
            </View>

            <View style={item.id === 'date' ? s.highlightDateVisual : s.highlightMemoryVisual}>
              {item.id === 'date' ? (
                <Calendar size={24} color={ACCENT_RED} />
              ) : (
                <ImageIcon size={24} color={ACCENT_RED} />
              )}
            </View>
          </View>

          <Pressable style={s.highlightLinkButton} onPress={item.onPress}>
            <Text style={s.highlightLinkButtonText}>{item.buttonLabel}</Text>
          </Pressable>
        </View>
      );
    },
    []
  );

  const getDaysTogether = () => {
    if (!couple?.created_at) return 0;
    const start = new Date(couple.created_at);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const fmtStartDate = () => {
    if (!couple?.created_at) return '...';
    return new Date(couple.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long' });
  };

  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'P';
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: PAGE_BG }]}>
      <StatusBar style="dark" />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          { paddingBottom: 100 + insets.bottom, paddingTop: Math.max(insets.top, 20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* --- 1. Header --- */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Inicio</Text>
            <Text style={s.headerSubtitle}>Tu espacio de hoy</Text>
          </View>
          <Pressable
            style={s.avatarCircle}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <AvatarSource uri={myAvatar} initial={getInitial(myName)} size={42} />
          </Pressable>
        </View>

        {/* --- 2. Main Couple Greeting Card --- */}
        <View style={s.coupleCard}>
          <View style={s.avatarsWrapper}>
            <View style={s.avatarBox}>
              <AvatarSource uri={myAvatar} initial={getInitial(myName)} size={76} border />
              <Text style={s.avatarLabel}>{myName}</Text>
            </View>
            
            <View style={s.heartWrapper}>
              <View style={s.heartIcon}>
                <Heart size={18} color={ACCENT_RED} fill={ACCENT_RED} />
              </View>
            </View>

            <View style={s.avatarBox}>
              <AvatarSource uri={partnerAvatar} initial={getInitial(partnerName)} size={76} border />
              <Text style={s.avatarLabel}>{partnerName}</Text>
            </View>
          </View>

          <View style={s.badgePill}>
            <Text style={s.badgeText}>∞ {getDaysTogether() || 5} días juntos ∞</Text>
          </View>
          <Text style={s.sinceText}>Desde el {fmtStartDate()}</Text>
        </View>

        {/* --- 3. Wide Mini Navigation / Map Preview --- */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={s.homeMapCard}
          onPress={() => {
            router.push({
              pathname: '/(tabs)/ubicacion',
              params: { focus: 'partner' },
            });
          }}
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            setHomeMapSize({ width: w, height: h });
          }}
        >
          <MapView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            region={homePreviewRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            showsCompass={false}
            showsMyLocationButton={false}
            mapType="standard"
          />

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <HomePreviewAvatar
              point={myPreviewPoint}
              avatarUri={typeof myAvatar === 'string' ? myAvatar : null}
              fallbackText={myName}
              zIndex={3}
            />

            <HomePreviewAvatar
              point={partnerPreviewPointAdjusted}
              avatarUri={
                typeof partnerProfile?.avatar_url === 'string'
                  ? partnerProfile.avatar_url
                  : typeof partnerAvatar === 'string'
                    ? partnerAvatar
                    : null
              }
              fallbackText={partnerProfile?.name || partnerName}
              zIndex={4}
            />
          </View>
        </TouchableOpacity>

        {/* --- 4. Suggestions section --- */}
        <Text style={s.sectionTitle}>Sugerencias para hoy</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionRow}>
          <SuggestionCard 
            icon={<Sparkles size={20} color={ACCENT_GOLD} />} 
            title="Actividades" 
            onPress={() => router.push('/actividades')} 
          />
          <SuggestionCard 
            icon={<BookHeart size={20} color={ACCENT_RED} />} 
            title="Notas" 
            onPress={() => router.push('/(tabs)/notes')} 
          />
          <SuggestionCard 
            icon={<Clapperboard size={20} color={ACCENT_BLUE} />} 
            title="Ver Juntos" 
            onPress={() => router.push('/ver-juntos')} 
          />
        </ScrollView>
        <Pressable
          style={[s.highlightLinkButton, { marginTop: 6, marginBottom: 6 }]}
          onPress={() => router.push('/drawing-engine-test')}
        >
          <Text style={s.highlightLinkButtonText}>Abrir test de dibujo</Text>
        </Pressable>

        {/* --- 5. Mood check-in section --- */}
        <Text style={s.sectionTitle}>¿Cómo se sienten hoy?</Text>
        <Text style={s.sectionSubtitle}>Elige cómo te sientes y comparte tu ánimo con tu pareja.</Text>
        
        <View style={s.moodCard}>
          <View style={s.moodVisualRow}>
            <View style={s.moodSideColumn}>
              <View style={s.moodAvatarMeta}>
                <AvatarSource uri={myAvatar} initial={getInitial(myName)} size={34} />
                <Text style={s.moodAvatarMetaLabel}>Tú</Text>
              </View>
              <Pressable style={s.moodEmojiBubble} onPress={handleCycleMood} accessibilityRole="button" accessibilityLabel="Cambiar ánimo">
                <Text style={s.moodEmojiBubbleText}>{myMood ? myMood.emoji : '❓'}</Text>
              </Pressable>
              <Text style={s.moodBubbleLabel}>{myMood ? myMood.label : 'Sin responder'}</Text>
            </View>

            <View style={s.moodCenterBadgeWrap}>
              <View style={s.moodHeartBadge}>
                <Heart size={16} color={ACCENT_RED} fill={ACCENT_RED} />
              </View>
            </View>

            <View style={s.moodSideColumn}>
              <View style={s.moodAvatarMeta}>
                <AvatarSource uri={partnerAvatar} initial={getInitial(partnerName)} size={34} />
                <Text style={s.moodAvatarMetaLabel} numberOfLines={1}>{partnerName}</Text>
              </View>
              <View style={[s.moodEmojiBubble, s.moodEmojiBubblePartner]}>
                <Text style={s.moodEmojiBubbleText}>{partnerMood ? partnerMood.emoji : '💭'}</Text>
              </View>
              <Text style={s.moodBubbleLabel}>{partnerMood ? partnerMood.label : 'Aún no respondió'}</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Para ustedes</Text>
        <Text style={s.sectionSubtitle}>Detalles y recuerdos importantes.</Text>

        <View style={s.highlightsSection}>
          <View style={s.highlightCarouselShadow}>
            <View style={s.highlightCarouselClip}>
              <View {...highlightPanResponder.panHandlers}>
                <Animated.View
                  style={[
                    s.highlightTrack,
                    {
                      width: HIGHLIGHT_WIDTH * homeHighlights.length,
                      transform: [{ translateX: highlightTranslateX }],
                    },
                  ]}
                >
                  {homeHighlights.map((item) => (
                    <View key={item.id} style={s.highlightSlide}>
                      {renderHighlightSlideContent(item)}
                    </View>
                  ))}
                </Animated.View>
              </View>
            </View>
          </View>

          <View style={s.highlightsDotsRow}>
            {homeHighlights.map((item, index) => (
              <View
                key={item.id}
                style={[
                  s.highlightsDot,
                  index === activeHighlightIndex ? s.highlightsDotActive : s.highlightsDotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* --- 10. Su historia section --- */}
        <Text style={s.sectionTitle}>Su historia</Text>
        <Text style={s.sectionSubtitle}>Cada día suma algo bonito.</Text>
        
        <View style={s.historyCard}>
          <View style={s.historyGrid}>
            <View style={s.historyItem}>
              <View style={s.historyIconWrapper}>
                <Heart size={18} color={ACCENT_RED} fill={ACCENT_RED} />
              </View>
              <View style={s.historyTextWrapper}>
                <Text style={s.historyValue}>{getDaysTogether() || 5} días</Text>
                <Text style={s.historyLabel}>Juntos</Text>
              </View>
            </View>

            <View style={s.historyItem}>
              <View style={s.historyIconWrapper}>
                <Clock size={18} color={ACCENT_GOLD} />
              </View>
              <View style={s.historyTextWrapper}>
                <Text style={s.historyValue}>{(getDaysTogether() * 24) || 120} horas</Text>
                <Text style={s.historyLabel}>Compartidas</Text>
              </View>
            </View>

            <View style={s.historyItem}>
              <View style={s.historyIconWrapper}>
                <ImageIcon size={18} color={ACCENT_BLUE} />
              </View>
              <View style={s.historyTextWrapper}>
                <Text style={s.historyValue}>7 recuerdos</Text>
                <Text style={s.historyLabel}>Guardados</Text>
              </View>
            </View>

            <View style={s.historyItem}>
              <View style={s.historyIconWrapper}>
                <BookHeart size={18} color="#F48FB1" />
              </View>
              <View style={s.historyTextWrapper}>
                <Text style={s.historyValue}>3 notas</Text>
                <Text style={s.historyLabel}>De amor</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function AvatarSource({ uri, initial, size, border }: any) {
  if (uri) {
    return (
      <Image 
        source={{ uri }} 
        style={{ 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          borderWidth: border ? 3 : 0, 
          borderColor: BORDER 
        }} 
      />
    );
  }
  return (
    <View style={{ 
      width: size, 
      height: size, 
      borderRadius: size / 2, 
      backgroundColor: SOFT_PINK, 
      justifyContent: 'center', 
      alignItems: 'center',
      borderWidth: border ? 3 : 1,
      borderColor: border ? BORDER : BORDER
    }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: ACCENT_RED }}>{initial}</Text>
    </View>
  );
}

function HomePreviewAvatar({
  point,
  avatarUri,
  fallbackText,
  zIndex,
}: {
  point: { x: number; y: number } | null;
  avatarUri?: string | null;
  fallbackText?: string;
  zIndex?: number;
}) {
  if (!point) return null;

  const cleanUri = typeof avatarUri === 'string' && avatarUri.trim().length > 0 ? avatarUri.trim() : null;

  return (
    <View
      style={[
        s.homePreviewAvatar,
        {
          left: point.x,
          top: point.y,
          zIndex: zIndex ?? 3,
        },
      ]}
    >
      {cleanUri ? (
        <Image source={{ uri: cleanUri }} style={s.homePreviewAvatarImage} resizeMode="cover" fadeDuration={0} />
      ) : (
        <Text style={s.homePreviewAvatarFallback}>
          {(fallbackText || '?').trim().slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function SuggestionCard({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress: () => void }) {
  return (
    <Pressable style={s.suggestionCard} onPress={onPress}>
      <View style={s.suggestionIcon}>{icon}</View>
      <Text style={s.suggestionText} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: TEXT_PRIMARY, marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: TEXT_SECONDARY },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 1.5, borderColor: BORDER },

  coupleCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  avatarsWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarBox: { alignItems: 'center' },
  avatarLabel: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 8 },
  heartWrapper: { marginHorizontal: -12, zIndex: 10, marginTop: 10 },
  heartIcon: { 
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF', 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2
  },
  badgePill: { backgroundColor: SOFT_PINK, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 8 },
  badgeText: { color: ACCENT_RED, fontWeight: '800', fontSize: 14 },
  sinceText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '500' },

  homeMapCard: {
    height: 150,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#f8f4ef',
    borderWidth: 1,
    borderColor: '#f1dfe4',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  homePreviewAvatar: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#efb6c3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 8,
  },
  homePreviewAvatarImage: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
  },
  homePreviewAvatarFallback: {
    color: '#d96f86',
    fontWeight: '900',
    fontSize: 15,
    textAlign: 'center',
    includeFontPadding: false,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  notesCard: { marginTop: 0 },
  pressed: { opacity: 0.95 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabelText: { fontSize: 11, fontWeight: '800', color: TEXT_MUTED, letterSpacing: 1, textTransform: 'uppercase' },
  redPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  redPillText: { fontSize: 11, fontWeight: '700', color: ACCENT_RED, letterSpacing: 0 },
  cardMainTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 6 },
  cardBodyText: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20, marginBottom: 12 },

  canvasPreview: {
    height: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  paperLine: { position: 'absolute', left: 16, right: 16, height: 1, backgroundColor: 'rgba(0,0,0,0.03)' },
  heartGlyph: { fontSize: 54, color: ACCENT_RED, opacity: 0.3 },
  paraText: { fontSize: 17, fontStyle: 'italic', color: '#444', fontWeight: '600', marginTop: 4 },
  cornerBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  cornerBadgeText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  authorBadge: { position: 'absolute', bottom: 9, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
  authorBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 16 },
  suggestionRow: { flexDirection: 'row', marginBottom: 20 },
  suggestionCard: {
    width: 110,
    height: 96,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 12,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  suggestionText: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },

  // Mood styles
  sectionSubtitle: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 16, marginTop: -12 },
  moodCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  moodVisualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  moodSideColumn: {
    flex: 1,
    alignItems: 'center',
  },
  moodAvatarMeta: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  moodAvatarMetaLabel: {
    maxWidth: 88,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  moodCenterBadgeWrap: {
    width: 44,
    alignItems: 'center',
  },
  moodHeartBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  moodEmojiBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  moodEmojiBubblePartner: {
    backgroundColor: '#FFF7FA',
  },
  moodEmojiBubbleText: {
    fontSize: 42,
  },
  moodBubbleLabel: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  // Shared highlights carousel
  highlightsSection: {
    marginBottom: 24,
  },
  highlightCarouselShadow: {
    width: HIGHLIGHT_WIDTH,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  highlightCarouselClip: {
    width: HIGHLIGHT_WIDTH,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: '#F3DDE5',
  },
  highlightTrack: {
    flexDirection: 'row',
  },
  highlightSlide: {
    width: HIGHLIGHT_WIDTH,
    backgroundColor: CARD_BG,
  },
  highlightSlideContent: {
    padding: 22,
    minHeight: 190,
    justifyContent: 'space-between',
  },
  highlightCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  highlightTextContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  highlightSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  highlightDateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  highlightDateSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },
  highlightDateBadge: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  highlightDateBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT_RED,
  },
  highlightDateVisual: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightMemoryVisual: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightMemoryBadge: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  highlightMemoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightMemoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  highlightMemoryQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: TEXT_SECONDARY,
  },
  highlightLinkButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  highlightLinkButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT_RED,
  },
  highlightsDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  highlightsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  highlightsDotActive: {
    backgroundColor: ACCENT_RED,
  },
  highlightsDotInactive: {
    backgroundColor: '#E9D5D9',
  },

  // History styles
  historyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: 24,
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  historyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SOFT_PINK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTextWrapper: {
    flex: 1,
  },
  historyValue: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  historyLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },

});
