import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, 
  Image, Dimensions, Alert, ActivityIndicator, Modal, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Heart, Camera, Plus, ChevronRight, 
  Lock, Share2, Sparkles, X, Save, Image as ImageIcon
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

const { width } = Dimensions.get('window');

// --- Light / Pastel Theme ---
const BG = '#FFFFFF';
const SOFT_PINK = '#FFF1F2';
const ACCENT_RED = '#F4A6A6';
const TEXT_DARK = '#222222';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#F1DCDC';

export default function MomentosScreen() {
  const insets = useSafeAreaInsets();
  const { profile, couple } = useProfileAndCouple();
  
  const [moments, setMoments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dynamic names
  const partnerName = couple?.partner_name || 'Pareja';
  const partnerAvatar = couple?.partner_avatar_url;
  const myAvatar = profile?.avatar_url;

  useEffect(() => {
    if (couple?.couple_id) {
      fetchMoments();
    }
  }, [couple]);

  const fetchMoments = async () => {
    try {
      const { data, error } = await supabase
        .from('moments')
        .select('*')
        .eq('couple_id', couple?.couple_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMoments(data || []);
    } catch (e) {
      console.log('[Moments] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Momentos</Text>
          <Text style={styles.headerSubtitle}>Nuestro álbum de recuerdos privados</Text>
        </View>
        <Pressable style={styles.addBtn}>
          <Camera size={24} color="#FFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* --- Featured Story / Memory --- */}
        <View style={styles.featuredBox}>
          <Image 
            source={{ uri: moments[0]?.media_url || 'https://images.unsplash.com/photo-1518599904199-0ca897819ddb?w=800' }} 
            style={styles.featuredImg} 
          />
          <View style={styles.featuredOverlay}>
            <View style={styles.badge}>
              <Sparkles size={14} color="#FFF" />
              <Text style={styles.badgeText}>Recuerdo destacado</Text>
            </View>
            <Text style={styles.featuredTitle}>{moments[0]?.title || 'Nuestra aventura'}</Text>
          </View>
        </View>

        {/* --- Timeline --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Línea del tiempo</Text>
          <View style={styles.avatarsGroup}>
            <AvatarSource uri={myAvatar} initial={profile?.name?.charAt(0) || 'Y'} size={32} />
            <View style={{ marginLeft: -10 }}>
              <AvatarSource uri={partnerAvatar} initial={partnerName.charAt(0)} size={32} border />
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={ACCENT_RED} style={{ marginTop: 20 }} />
        ) : moments.length === 0 ? (
          <View style={styles.emptyBox}>
            <ImageIcon size={48} color={BORDER} />
            <Text style={styles.emptyTxt}>Aún no han guardado momentos juntos.</Text>
          </View>
        ) : (
          moments.map((m, idx) => (
            <MomentCard 
              key={m.id || idx} 
              moment={m} 
              isMe={m.created_by === profile?.id}
              partnerName={partnerName}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MomentCard({ moment, isMe, partnerName }: any) {
  return (
    <View style={styles.momentCard}>
      <Image source={{ uri: moment.media_url }} style={styles.momentImg} />
      <View style={styles.momentInfo}>
        <View style={styles.momentHdr}>
          <Text style={styles.momentDate}>{new Date(moment.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</Text>
          <View style={styles.privateBadge}>
            <Lock size={12} color={TEXT_MUTED} />
            <Text style={styles.privateText}>Solo ustedes</Text>
          </View>
        </View>
        <Text style={styles.momentTitle}>{moment.title}</Text>
        <Text style={styles.momentDesc}>{moment.description}</Text>
        <View style={styles.authorRow}>
          <Heart size={14} color={ACCENT_RED} fill={ACCENT_RED} />
          <Text style={styles.authorTxt}>{isMe ? 'Guardado por ti' : `Guardado por ${partnerName}`}</Text>
        </View>
      </View>
    </View>
  );
}

function AvatarSource({ uri, initial, size, border }: any) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: border ? 2 : 0, borderColor: '#FFF' }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SOFT_PINK, justifyContent: 'center', alignItems: 'center', borderWidth: border ? 2 : 1, borderColor: border ? '#FFF' : BORDER }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: ACCENT_RED }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: TEXT_DARK },
  headerSubtitle: { fontSize: 14, color: TEXT_MUTED },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT_RED, justifyContent: 'center', alignItems: 'center', shadowColor: ACCENT_RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  
  scrollContent: { paddingBottom: 40 },
  featuredBox: { margin: 20, height: 240, borderRadius: 32, overflow: 'hidden', position: 'relative' },
  featuredImg: { width: '100%', height: '100%' },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(0,0,0,0.3)' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: ACCENT_RED, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6, marginBottom: 8 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  featuredTitle: { color: '#FFF', fontSize: 24, fontWeight: '900' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT_DARK },
  avatarsGroup: { flexDirection: 'row', alignItems: 'center' },

  emptyBox: { padding: 40, alignItems: 'center', gap: 12 },
  emptyTxt: { color: TEXT_MUTED, textAlign: 'center', fontStyle: 'italic' },

  momentCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: '#FFF', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  momentImg: { width: '100%', height: 200 },
  momentInfo: { padding: 20 },
  momentHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  momentDate: { fontSize: 13, fontWeight: '800', color: ACCENT_RED, textTransform: 'uppercase' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  privateText: { fontSize: 11, color: TEXT_MUTED, fontWeight: '600' },
  momentTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK, marginBottom: 6 },
  momentDesc: { fontSize: 14, color: TEXT_MUTED, lineHeight: 20, marginBottom: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorTxt: { fontSize: 12, color: TEXT_DARK, fontWeight: '700' }
});
