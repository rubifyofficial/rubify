import React, { useState, useEffect, useCallback } from 'react';
import { 
  ScrollView, StyleSheet, Text, View, TouchableOpacity, 
  Dimensions, ImageBackground, Alert, Image, ActivityIndicator 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, MessageCircle, Bookmark, Plus, Video, Image as ImageIcon } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

const { width, height } = Dimensions.get('window');

// Colors matching the spec
const BG_COLOR = '#0F0F0F'; // premium near black
const TEXT_CREAM = '#FFFFFF'; // pure white
const TEXT_MUTED = '#A1A1AA'; // zinc 400 neutral gray
const ACCENT_RED = '#EF233C'; // romantic red

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

function fmtMomentDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [moments, setMoments] = useState<DbMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ACCENT_RED} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: BG_COLOR }]}>
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: 160 + insets.bottom, paddingTop: Math.max(insets.top, 10) }]}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
      >
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Momentos</Text>
          <Text style={styles.headerSubtitle}>Recuerdos en movimiento</Text>
          
          <TouchableOpacity 
            style={[styles.addButton, saving && { opacity: 0.6 }]}
            onPress={handleCreateMoment}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Plus size={16} color="#FFFFFF" />}
            <Text style={styles.addButtonText}>Agregar recuerdo</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Empty State */}
        {!error && moments.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay recuerdos todavía.</Text>
          </View>
        )}

        {/* Reels Feed */}
        {moments.map(moment => (
          <ReelCard 
            key={moment.id}
            title={moment.title}
            date={fmtMomentDate(moment.memory_date)}
            description={moment.description}
            type={moment.media_type === 'video' ? 'Video' : 'Foto'}
            imageUrl={moment.media_url || 'https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=800'}
            createdByMe={moment.created_by === userId}
            onHeart={() => handleAlert("Favorito", "Has guardado este recuerdo en tus favoritos.")}
            onComment={() => handleAlert("Comentarios", "La función de comentarios se habilitará próximamente.")}
            onSave={() => handleAlert("Guardado", "Recuerdo guardado en tu colección privada.")}
          />
        ))}

      </ScrollView>
    </View>
  );
}

function ReelCard({ title, date, description, type, imageUrl, createdByMe, onHeart, onComment, onSave }: any) {
  return (
    <View style={styles.reelCard}>
      <ImageBackground 
        source={{ uri: imageUrl }} 
        style={styles.reelImage}
        imageStyle={{ borderRadius: 24 }}
      >
        <View style={styles.darkOverlay}>
          
          {/* Top Badges */}
          <View style={styles.topBadgesRow}>
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>{createdByMe ? 'De mí' : 'De Sofia'}</Text>
            </View>
            <View style={styles.typeBadge}>
              {type === 'Video' ? <Video size={12} color="#FFFFFF" /> : <ImageIcon size={12} color="#FFFFFF" />}
              <Text style={styles.typeBadgeText}>{type}</Text>
            </View>
          </View>

          {/* Right Actions */}
          <View style={styles.actionsColumn}>
            <TouchableOpacity style={styles.actionButton} onPress={onHeart}>
              <Heart size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onComment}>
              <MessageCircle size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onSave}>
              <Bookmark size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Bottom Caption Area */}
          <View style={styles.captionArea}>
            <View style={styles.captionHeader}>
              <View style={styles.avatarMiniContainer}>
                <Image source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100' }} style={styles.avatarMini} />
                <Image source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }} style={[styles.avatarMini, { marginLeft: -10, borderWidth: 1, borderColor: '#1A050A' }]} />
              </View>
              <View style={styles.dateBadge}>
                <Text style={styles.dateText}>{date}</Text>
              </View>
            </View>
            <Text style={styles.reelTitle}>{title}</Text>
            <Text style={styles.reelDesc}>{description}</Text>
          </View>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_CREAM,
    marginBottom: 4,
    letterSpacing: 0,
  },
  headerSubtitle: {
    fontSize: 16,
    color: TEXT_MUTED,
    marginBottom: 16,
    letterSpacing: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272A',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EF233C50',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#1A050A',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ACCENT_RED,
  },
  errorText: {
    color: ACCENT_RED,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontStyle: 'italic',
  },
  reelCard: {
    width: '100%',
    height: height * 0.75, // 75% of screen height
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: ACCENT_RED,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  reelImage: {
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 5, 10, 0.4)', // Dark romantic overlay
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privateBadge: {
    backgroundColor: 'rgba(45, 10, 17, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 35, 60, 0.3)',
  },
  privateBadgeText: {
    color: TEXT_CREAM,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0,
  },
  actionsColumn: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  captionArea: {
    width: '85%',
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarMiniContainer: {
    flexDirection: 'row',
    marginRight: 12,
  },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dateBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dateText: {
    color: TEXT_CREAM,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },
  reelTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0,
  },
  reelDesc: {
    color: TEXT_CREAM,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
    letterSpacing: 0,
  },
});
