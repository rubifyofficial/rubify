import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import {
  MapPin, BookHeart, Heart,
  MessageCircle, Image as ImageIcon,
  Calendar, Clapperboard, Sparkles, Clock, Eye,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

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
  { emoji: '🥰', label: 'Enamorado' },
  { emoji: '💭', label: 'Extrañando' },
  { emoji: '😕', label: 'Ansioso' },
  { emoji: 'Γ£¿', label: 'Motivado' },
];

const AVATAR_SIZE = 42;
const AVATAR_INNER = 38;
const AVATAR_PADDING = 10;

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
  const [myMood, setMyMood] = useState<{ emoji: string; label: string } | null>({ emoji: '≡ƒÿè', label: 'Feliz' });
  const [partnerMood, setPartnerMood] = useState<{ emoji: string; label: string } | null>({ emoji: '≡ƒÆ¡', label: 'Extra├▒ando' });
  const [myAnswer, setMyAnswer] = useState<string>('');
  const [challengeCompleted, setChallengeCompleted] = useState<boolean>(false);

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
          style={[s.memoryLinkButton, { alignSelf: 'flex-start', marginTop: 6, marginBottom: 6 }]}
          onPress={() => router.push('/drawing-engine-test')}
        >
          <Text style={s.memoryLinkButtonText}>Abrir test de dibujo</Text>
        </Pressable>

        {/* --- 5. Mood check-in section --- */}
        <Text style={s.sectionTitle}>¿Cómo se sienten hoy?</Text>
        <Text style={s.sectionSubtitle}>Elige cómo te sientes y comparte tu ánimo con tu pareja.</Text>
        
        <View style={s.moodCard}>
          <View style={s.moodHeaderRow}>
            {/* My Side */}
            <View style={s.moodHalf}>
              <Text style={s.moodHalfLabel}>Tú</Text>
              <View style={s.moodStatusRow}>
                <AvatarSource uri={myAvatar} initial={getInitial(myName)} size={32} />
                <View style={s.moodStatusTextContainer}>
                  <Text style={s.moodEmojiText}>{myMood ? myMood.emoji : '❓'}</Text>
                  <Text style={s.moodLabelText}>{myMood ? myMood.label : 'Sin responder'}</Text>
                </View>
              </View>
            </View>

            {/* Divider line */}
            <View style={s.moodDivider} />

            {/* Partner Side */}
            <View style={s.moodHalf}>
              <Text style={s.moodHalfLabel}>{partnerName}</Text>
              <View style={s.moodStatusRow}>
                <AvatarSource uri={partnerAvatar} initial={getInitial(partnerName)} size={32} />
                <View style={s.moodStatusTextContainer}>
                  <Text style={s.moodEmojiText}>{partnerMood ? partnerMood.emoji : '💭'}</Text>
                  <Text style={s.moodLabelText}>{partnerMood ? partnerMood.label : 'Aún no respondió'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Selector Title */}
          <Text style={s.moodSelectTitle}>¿Cómo te sientes en este momento?</Text>
          
          {/* Selector list */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.moodSelectorRow}>
            {MOODS.map((m) => {
              const isSelected = myMood?.label === m.label;
              return (
                <Pressable 
                  key={m.label} 
                  style={[s.moodOptionButton, isSelected && s.moodOptionButtonActive]}
                  onPress={() => setMyMood(m)}
                >
                  <Text style={s.moodOptionEmoji}>{m.emoji}</Text>
                  <Text style={s.moodOptionLabel}>{m.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={s.moodFooterText}>Un pequeño check-in para sentirse más cerca.</Text>
        </View>

        {/* --- 6. Pensamiento del día section --- */}
        <Text style={s.sectionTitle}>Pensamiento del día</Text>
        <Text style={s.sectionSubtitle}>Una pequeña pregunta para sentirse más cerca.</Text>
        
        <View style={s.thoughtCard}>
          <Text style={s.thoughtQuestion}>“¿Qué fue lo más bonito que pensaste de nosotros hoy?”</Text>
          
          {/* My Answer area */}
          <View style={s.answerSection}>
            <View style={s.answerHeader}>
              <AvatarSource uri={myAvatar} initial={getInitial(myName)} size={24} />
              <Text style={s.answerLabel}>Tu respuesta</Text>
            </View>
            <TextInput
              style={s.answerInput}
              placeholder="Escribe algo bonito..."
              placeholderTextColor={TEXT_MUTED}
              value={myAnswer}
              onChangeText={setMyAnswer}
              multiline
            />
          </View>

          {/* Partner Answer area */}
          <View style={s.answerSection}>
            <View style={s.answerHeader}>
              <AvatarSource uri={partnerAvatar} initial={getInitial(partnerName)} size={24} />
              <Text style={s.answerLabel}>Respuesta de {partnerName}</Text>
            </View>
            <View style={s.partnerAnswerBox}>
              <Text style={s.partnerAnswerText}>Aún no respondió</Text>
            </View>
          </View>
        </View>

        {/* --- 7. Reto de hoy section --- */}
        <Text style={s.sectionTitle}>Reto de hoy</Text>
        <Text style={s.sectionSubtitle}>Un pequeño gesto para hacer sonreír a tu pareja.</Text>
        
        <View style={s.challengeCard}>
          {challengeCompleted ? (
            <View style={s.completedContainer}>
              <Text style={s.completedEmoji}>✨</Text>
              <Text style={s.completedTitle}>Reto completado</Text>
              <Text style={s.completedSubtitle}>¡Qué lindo detalle de tu parte!</Text>
            </View>
          ) : (
            <>
              <Text style={s.challengeText}>“Envíale un mensaje bonito sin avisar 💌”</Text>
              
              <Pressable 
                style={s.challengeButton}
                onPress={() => setChallengeCompleted(true)}
              >
                <Text style={s.challengeButtonText}>Lo hice</Text>
              </Pressable>

              <Text style={s.challengeFooterText}>
                Cuando lo completes, tu pareja sabrá que pensaste en ella.
              </Text>
            </>
          )}
        </View>

        {/* --- 8. Próxima fecha especial section --- */}
        <Text style={s.sectionTitle}>Próxima fecha especial</Text>
        <Text style={s.sectionSubtitle}>No olviden los momentos importantes.</Text>
        
        <View style={s.specialDateCard}>
          <View style={s.dateLeftContainer}>
            <Text style={s.dateTitle}>Nuestro aniversario</Text>
            <Text style={s.dateSubtitle}>12 de junio</Text>
            <View style={s.daysCountdownBadge}>
              <Text style={s.daysCountdownText}>Faltan 25 días</Text>
            </View>
          </View>

          <Pressable 
            style={s.calendarLinkButton}
            onPress={() => router.push('/(tabs)/calendario')}
          >
            <Text style={s.calendarLinkButtonText}>Ver calendario</Text>
          </Pressable>
        </View>

        {/* --- 9. Recuerdo bonito section --- */}
        <Text style={s.sectionTitle}>Recuerdo bonito</Text>
        <Text style={s.sectionSubtitle}>Un momento para volver a sonreír.</Text>
        
        <View style={s.memoryCard}>
          <View style={s.memoryImagePlaceholder}>
            <ImageIcon size={24} color={ACCENT_RED} />
          </View>
          <View style={s.memoryRightContainer}>
            <View style={s.memoryDaysBadge}>
              <Text style={s.memoryDaysText}>Hace 3 días</Text>
            </View>
            <Text style={s.memoryTitle}>Guardaron un momento especial juntos</Text>
            <Text style={s.memoryQuote}>“Ese día fue muy bonito ✨”</Text>
            
            <Pressable 
              style={s.memoryLinkButton}
              onPress={() => router.push('/(tabs)/moments')}
            >
              <Text style={s.memoryLinkButtonText}>Ver momentos</Text>
            </Pressable>
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

        {/* --- 11. Última actividad section --- */}
        <Text style={s.sectionTitle}>Última actividad</Text>
        <Text style={s.sectionSubtitle}>Lo último que pasó entre ustedes.</Text>
        
        <View style={s.activityCard}>
          <View style={s.activityItemRow}>
            <View style={[s.activityIconWrapper, { backgroundColor: SOFT_PINK }]}>
              <Eye size={16} color={ACCENT_RED} />
            </View>
            <View style={s.activityTextWrapper}>
              <Text style={s.activityText}>{partnerName} vio tu nota hace poco</Text>
              <Text style={s.activityTime}>Hace unos momentos</Text>
            </View>
          </View>

          <View style={s.activityDivider} />

          <View style={s.activityItemRow}>
            <View style={[s.activityIconWrapper, { backgroundColor: '#F0FDF4' }]}>
              <ImageIcon size={16} color="#4ADE80" />
            </View>
            <View style={s.activityTextWrapper}>
              <Text style={s.activityText}>{myName} agregó un recuerdo bonito</Text>
              <Text style={s.activityTime}>Hace 3 horas</Text>
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
  moodHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  moodHalf: {
    flex: 1,
    alignItems: 'center',
  },
  moodHalfLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  moodStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodStatusTextContainer: {
    alignItems: 'flex-start',
  },
  moodEmojiText: {
    fontSize: 22,
    marginBottom: 2,
  },
  moodLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  moodDivider: {
    width: 1,
    height: 50,
    backgroundColor: BORDER,
  },
  moodSelectTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  moodSelectorRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  moodOptionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
    backgroundColor: '#FAFAFA',
    minWidth: 80,
  },
  moodOptionButtonActive: {
    backgroundColor: SOFT_PINK,
    borderColor: ACCENT_RED,
  },
  moodOptionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  moodOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  moodFooterText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },

  // Thought styles
  thoughtCard: {
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
  thoughtQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  answerSection: {
    marginBottom: 16,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  answerInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  partnerAnswerBox: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  partnerAnswerText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: TEXT_SECONDARY,
  },

  // Challenge styles
  challengeCard: {
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
    alignItems: 'center',
  },
  challengeText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  challengeButton: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 12,
  },
  challengeButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: ACCENT_RED,
  },
  challengeFooterText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  completedContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  completedEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ACCENT_RED,
    marginBottom: 4,
  },
  completedSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
  },

  // Special Date styles
  specialDateCard: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateLeftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  dateSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  daysCountdownBadge: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysCountdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT_RED,
  },
  calendarLinkButton: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  calendarLinkButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: ACCENT_RED,
  },

  // Memory styles
  memoryCard: {
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  memoryImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryRightContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  memoryDaysBadge: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  memoryDaysText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memoryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  memoryQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  memoryLinkButton: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: ACCENT_RED,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  memoryLinkButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT_RED,
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

  // Activity styles
  activityCard: {
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
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  activityTextWrapper: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  activityTime: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  activityDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },
});
