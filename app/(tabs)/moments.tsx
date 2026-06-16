import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, Video, Image as ImageIcon, MessageCircle, Bookmark, Camera } from 'lucide-react-native';
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
const REEL_SNAP_INTERVAL = REEL_CARD_HEIGHT + REEL_CARD_SPACING;

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

export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, couple } = useProfileAndCouple();

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [moments, setMoments] = useState<DbMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MomentFilter>('Todos');
  const [viewMode, setViewMode] = useState<MomentosViewMode>('reels');

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

  // 4. Create moment (mock insert)
  const handleCreateMoment = async () => {
    if (!coupleId || !userId || saving) return;
    setSaving(true);
    try {
      const { error: insertErr } = await supabase.from('moments').insert({
        couple_id: coupleId,
        created_by: userId,
        title: "Nuevo recuerdo",
        description: "Un momento especial para guardar.",
        media_type: "photo",
        media_url: null,
        memory_date: new Date().toISOString().slice(0, 10)
      });

      if (insertErr) {
        console.log('[Momentos] insert error:', insertErr.message);
        Alert.alert('Error', 'No se pudo guardar el recuerdo');
      } else {
        Alert.alert('Listo', 'Recuerdo guardado');
        await fetchMoments(coupleId);
      }
    } catch (e: any) {
      console.log('[Momentos] insert exception:', e);
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleAlert = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  const mappedMoments = useMemo<MemoryCardItem[]>(() => {
    return moments.map((moment, index) => ({
      id: moment.id,
      title: moment.title?.trim() || 'Nuevo recuerdo',
      subtitle: moment.description?.trim() || 'Un momento especial para guardar juntos.',
      dateLabel: fmtMomentDate(moment.memory_date || moment.created_at) || 'Hoy',
      type: moment.media_type === 'video' ? 'video' : 'photo',
      mediaUrl: moment.media_type === 'video' ? null : moment.media_url,
      isFavorite: index === 0,
      createdByLabel: moment.created_by === userId ? 'Tú' : (couple?.partner_name || 'Su pareja'),
    }));
  }, [moments, userId, couple?.partner_name]);

  const featuredMoment = mappedMoments[0] ?? {
    id: 'featured-placeholder',
    title: 'Nuestro último momento',
    subtitle: 'Una foto, un video o un recuerdo especial juntos.',
    dateLabel: 'Hoy',
    type: 'photo' as const,
    mediaUrl: null,
    isFavorite: true,
    createdByLabel: 'Ustedes',
  };

  const visibleMoments = useMemo(() => {
    const source = mappedMoments.length > 0 ? mappedMoments : PLACEHOLDER_MEMORIES;
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
  }, [mappedMoments, selectedFilter]);

  const showAvatarRow = Boolean(profile?.avatar_url || couple?.partner_avatar_url);
  const reelsMoments = mappedMoments.length > 0 ? mappedMoments : PLACEHOLDER_MEMORIES;

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
          onPress={handleCreateMoment}
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
      <View style={styles.featuredCard}>
        <View style={styles.featuredTopRow}>
          <Text style={styles.featuredSectionTitle}>Recuerdo destacado</Text>
          <View style={styles.featuredDateBadge}>
            <Text style={styles.featuredDateBadgeText}>{featuredMoment.dateLabel}</Text>
          </View>
        </View>

        <View style={styles.featuredMediaWrap}>
          <MemoryPreview
            title={featuredMoment.title}
            type={featuredMoment.type}
            mediaUrl={featuredMoment.mediaUrl}
            large
          />
        </View>

        <View style={styles.featuredBadgeRow}>
          <View style={styles.favoriteBadge}>
            <Heart size={12} color={ACCENT_PINK} fill={ACCENT_PINK} />
            <Text style={styles.favoriteBadgeText}>FAVORITO</Text>
          </View>
        </View>

        <Text style={styles.featuredTitle}>{featuredMoment.title}</Text>
        <Text style={styles.featuredSubtitle}>
          {featuredMoment.subtitle || 'Una foto, un video o un recuerdo especial juntos.'}
        </Text>

        {showAvatarRow && (
          <View style={styles.featuredAvatarRow}>
            <AvatarBubble uri={profile?.avatar_url ?? null} fallback={getInitial(profile?.name)} />
            <AvatarBubble
              uri={couple?.partner_avatar_url ?? null}
              fallback={getInitial(couple?.partner_name)}
              style={styles.avatarOverlap}
            />
            <Text style={styles.featuredAvatarLabel}>Ustedes</Text>
          </View>
        )}
      </View>

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sus recuerdos</Text>
        <Text style={styles.sectionSubtitle}>Su galería para volver a sentir cada momento.</Text>
      </View>

      {visibleMoments.length > 0 ? (
        <View style={styles.memoriesGrid}>
          {visibleMoments.map((moment) => (
            <View key={moment.id} style={styles.memoryCard}>
              <MemoryPreview title={moment.title} type={moment.type} mediaUrl={moment.mediaUrl} />
              <View style={styles.memoryCardBody}>
                <View style={styles.memoryMetaRow}>
                  <View style={styles.memoryTypeBadge}>
                    {moment.type === 'video' ? (
                      <Video size={12} color={ACCENT_PINK} />
                    ) : (
                      <ImageIcon size={12} color={ACCENT_PINK} />
                    )}
                    <Text style={styles.memoryTypeBadgeText}>
                      {moment.type === 'video' ? 'Video' : 'Foto'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleAlert('Favorito', 'Has guardado este recuerdo en tus favoritos.')}
                    style={styles.favoriteIconButton}
                  >
                    <Heart
                      size={16}
                      color={moment.isFavorite ? ACCENT_PINK : TEXT_MUTED}
                      fill={moment.isFavorite ? ACCENT_PINK : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.memoryTitle} numberOfLines={2}>
                  {moment.title}
                </Text>
                <Text style={styles.memoryDate}>{moment.dateLabel}</Text>
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
          <TouchableOpacity style={styles.emptyButton} onPress={handleCreateMoment} disabled={saving}>
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
                showAvatarRow={showAvatarRow}
                myAvatar={profile?.avatar_url ?? null}
                myFallback={getInitial(profile?.name)}
                partnerAvatar={couple?.partner_avatar_url ?? null}
                partnerFallback={getInitial(couple?.partner_name)}
                onHeart={() => handleAlert('Favorito', 'Has guardado este recuerdo en tus favoritos.')}
                onComment={() => handleAlert('Comentarios', 'La función de comentarios se habilitará próximamente.')}
                onSave={() => handleAlert('Guardado', 'Recuerdo guardado en tu colección privada.')}
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
}: {
  title: string;
  type: 'photo' | 'video';
  mediaUrl: string | null;
  large?: boolean;
}) {
  const containerStyle = large ? styles.featuredMedia : styles.memoryPreview;
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
          <Video size={large ? 28 : 20} color={ACCENT_PINK} />
        ) : (
          <ImageIcon size={large ? 28 : 20} color={ACCENT_PINK} />
        )}
        <Text style={large ? styles.featuredMediaLabel : styles.memoryPreviewLabel}>
          {type === 'video' ? 'Video' : 'Foto'}
        </Text>
      </View>
      <Text style={large ? styles.featuredMediaTitle : styles.memoryPreviewTitle} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

function ReelMemoryCard({
  moment,
  showAvatarRow,
  myAvatar,
  myFallback,
  partnerAvatar,
  partnerFallback,
  onHeart,
  onComment,
  onSave,
  isLast = false,
}: {
  moment: MemoryCardItem;
  showAvatarRow: boolean;
  myAvatar: string | null;
  myFallback: string;
  partnerAvatar: string | null;
  partnerFallback: string;
  onHeart: () => void;
  onComment: () => void;
  onSave: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.reelCard, isLast ? styles.reelCardLast : null]}>
      <View style={styles.reelMediaWrap}>
        <ReelMediaPreview title={moment.title} type={moment.type} mediaUrl={moment.mediaUrl} />
        <View style={styles.reelTopBadgeRow}>
          <View style={styles.reelBadge}>
            <Text style={styles.reelBadgeText}>Recuerdo</Text>
          </View>
          <View style={styles.reelTypeBadge}>
            {moment.type === 'video' ? (
              <Video size={12} color={ACCENT_PINK} />
            ) : (
              <ImageIcon size={12} color={ACCENT_PINK} />
            )}
            <Text style={styles.reelTypeBadgeText}>{moment.type === 'video' ? 'Video' : 'Foto'}</Text>
          </View>
        </View>
        <View style={styles.reelActionsColumn}>
          <TouchableOpacity style={styles.reelActionButton} onPress={onHeart}>
            <Heart size={18} color={ACCENT_PINK} fill={moment.isFavorite ? ACCENT_PINK : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.reelActionButton} onPress={onComment}>
            <MessageCircle size={18} color={ACCENT_PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.reelActionButton} onPress={onSave}>
            <Bookmark size={18} color={ACCENT_PINK} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reelBody}>
        <View style={styles.reelMetaRow}>
          {showAvatarRow ? (
            <View style={styles.reelAvatarRow}>
              <AvatarBubble uri={myAvatar} fallback={myFallback} />
              <AvatarBubble uri={partnerAvatar} fallback={partnerFallback} style={styles.avatarOverlap} />
            </View>
          ) : (
            <View style={styles.reelBadge}>
              <Text style={styles.reelBadgeText}>Ustedes</Text>
            </View>
          )}
          <View style={styles.reelDateBadge}>
            <Text style={styles.reelDateBadgeText}>{moment.dateLabel}</Text>
          </View>
        </View>
        <Text style={styles.reelTitle}>{moment.title}</Text>
        <Text style={styles.reelDescription}>
          {moment.subtitle || 'Un recuerdo bonito para volver a vivir juntos.'}
        </Text>
      </View>
    </View>
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
        <Image source={{ uri: mediaUrl }} style={styles.previewImage} />
      </View>
    );
  }

  return (
    <View style={[styles.reelMedia, styles.previewFallback]}>
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
  featuredCard: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  featuredTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  featuredSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  featuredDateBadge: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  featuredDateBadgeText: {
    color: ACCENT_PINK,
    fontSize: 12,
    fontWeight: '800',
  },
  featuredMediaWrap: {
    marginBottom: 14,
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
  featuredBadgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  favoriteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: SOFT_PINK,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
  },
  favoriteBadgeText: {
    color: ACCENT_PINK,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  featuredSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
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
    marginBottom: 14,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  sectionSubtitle: {
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
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
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
    padding: 18,
    paddingBottom: 0,
    flex: 1,
  },
  reelMedia: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: CARD_SOFT,
    borderWidth: 1,
    borderColor: BORDER,
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
  reelTopBadgeRow: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reelBadge: {
    backgroundColor: '#FFFFFFD9',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reelBadgeText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '800',
  },
  reelTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFD9',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reelTypeBadgeText: {
    color: ACCENT_PINK,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  reelActionsColumn: {
    position: 'absolute',
    right: 30,
    bottom: 28,
    gap: 10,
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
  reelBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    minHeight: 124,
  },
  reelMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reelAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reelDateBadge: {
    backgroundColor: SOFT_PINK,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reelDateBadgeText: {
    color: ACCENT_PINK,
    fontSize: 12,
    fontWeight: '800',
  },
  reelTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  reelDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
  },
  memoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
  },
  memoryCard: {
    width: GRID_CARD_WIDTH,
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
  memoryPreviewTitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '700',
    textAlign: 'center',
  },
  memoryCardBody: {
    padding: 14,
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
  memoryTypeBadgeText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT_PINK,
  },
  favoriteIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF8FB',
  },
  memoryTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  memoryDate: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '700',
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
