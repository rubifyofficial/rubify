import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
  Dimensions, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Clapperboard, Play, CheckCircle2, Plus, 
  ArrowLeft, Film, Tv, MonitorPlay,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfileAndCouple } from '../lib/useProfileAndCouple';

const { width: SW } = Dimensions.get('window');

const COLORS = {
  bg: '#FFFFFF',
  card: '#F7F7F5',
  ink: '#222222',
  white: '#FFFFFF',
  muted: '#9CA3AF',
  red: '#F4A6A6',
  border: '#F1DCDC',
  chip: '#FFF7F7',
  gray: '#6B6B6B',
};

type WatchItem = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  item_type: 'movie' | 'series' | 'other';
  status: 'to_watch' | 'watched';
  watched_at: string | null;
  created_at: string;
};

export default function VerJuntosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, couple, loading: dataLoading } = useProfileAndCouple();

  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const partnerName = couple?.partner_name || 'Pareja';

  useEffect(() => {
    if (couple?.couple_id) {
      fetchItems(couple.couple_id);
    }
  }, [couple]);

  const fetchItems = async (cid: string) => {
    const { data, error } = await supabase
      .from('watch_items')
      .select('*')
      .eq('couple_id', cid)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('[Ver Juntos] fetch error:', error.message);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  };

  const handleAddItem = async () => {
    if (!couple?.couple_id || !profile?.id || actionLoading) return;
    setActionLoading('add');
    try {
      const { error } = await supabase.from('watch_items').insert({
        couple_id: couple.couple_id,
        created_by: profile.id,
        title: "Película para ver juntos",
        description: "Agregado a la lista de deseos.",
        item_type: "movie",
        status: "to_watch"
      });

      if (error) throw error;
      Alert.alert('¡Listo!', 'Agregado a la lista');
      fetchItems(couple.couple_id);
    } catch (e) {
      Alert.alert('Error', 'No se pudo agregar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsWatched = async (itemId: string) => {
    if (!couple?.couple_id || actionLoading) return;
    setActionLoading(itemId);
    try {
      const { error } = await supabase
        .from('watch_items')
        .update({
          status: 'watched',
          watched_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;
      Alert.alert('¡Genial!', 'Marcado como visto');
      fetchItems(couple.couple_id);
    } catch (e) {
      Alert.alert('Error', 'No se pudo marcar como visto');
    } finally {
      setActionLoading(null);
    }
  };

  const toWatch = items.filter(x => x.status === 'to_watch');
  const watched = items.filter(x => x.status === 'watched');
  const mainSuggestion = toWatch.length > 0 ? toWatch[0] : null;

  if (dataLoading || loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.red} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={24} color={COLORS.ink} />
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Ver Juntos</Text>
          <Text style={s.headerSub}>Lista de películas y series</Text>
        </View>
        <Pressable 
          style={[s.addIconBtn, actionLoading === 'add' && { opacity: 0.6 }]} 
          onPress={handleAddItem}
          disabled={actionLoading === 'add'}
        >
          {actionLoading === 'add' ? <ActivityIndicator size="small" color={COLORS.white} /> : <Plus size={22} color={COLORS.white} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.suggestionCard}>
          <View style={s.suggLabelRow}>
            <MonitorPlay size={14} color={COLORS.red} />
            <Text style={s.suggLabelText}>Sugerencia de hoy</Text>
          </View>
          {mainSuggestion ? (
            <>
              <Text style={s.suggTitle}>{mainSuggestion.title}</Text>
              <Text style={s.suggDesc}>{mainSuggestion.description}</Text>
              <Pressable 
                style={[s.suggBtn, actionLoading === mainSuggestion.id && { opacity: 0.7 }]}
                onPress={() => handleMarkAsWatched(mainSuggestion.id)}
                disabled={!!actionLoading}
              >
                <CheckCircle2 size={18} color={COLORS.white} />
                <Text style={s.suggBtnText}>Marcar como visto</Text>
              </Pressable>
            </>
          ) : (
            <View style={s.emptySugg}>
              <Text style={s.emptySuggTxt}>Elijan algo para ver juntos</Text>
              <Pressable style={s.emptySuggBtn} onPress={handleAddItem}>
                <Text style={s.emptySuggBtnTxt}>Elegir algo</Text>
              </Pressable>
            </View>
          )}
        </View>

        {toWatch.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Lista para ver</Text>
            {toWatch.map(item => (
              <View key={item.id} style={s.itemRow}>
                <View style={s.itemIconWrap}>
                  {item.item_type === 'movie' ? <Film size={20} color={COLORS.red} /> : <Tv size={20} color={COLORS.red} />}
                </View>
                <View style={s.itemMain}>
                  <Text style={s.itemTitle}>{item.title}</Text>
                  <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text>
                  <Text style={s.itemAuthor}>{item.created_by === profile?.id ? 'Añadido por ti' : `Añadido por ${partnerName}`}</Text>
                </View>
                <Pressable onPress={() => handleMarkAsWatched(item.id)} disabled={!!actionLoading}>
                  <CheckCircle2 size={24} color={COLORS.border} />
                </Pressable>
              </View>
            ))}
          </>
        )}

        {watched.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Visto juntos</Text>
            {watched.map(item => (
              <View key={item.id} style={[s.itemRow, { opacity: 0.5 }]}>
                <View style={[s.itemIconWrap, { backgroundColor: '#F1F1F1' }]}>
                  <CheckCircle2 size={20} color={COLORS.muted} />
                </View>
                <View style={s.itemMain}>
                  <Text style={[s.itemTitle, { textDecorationLine: 'line-through' }]}>{item.title}</Text>
                  <Text style={s.itemDesc}>Visto el {new Date(item.watched_at!).toLocaleDateString('es')}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 60, marginBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center' },
  headerTitleWrap: { flex: 1, marginLeft: 16 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
  headerSub: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  addIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center' },
  suggestionCard: { backgroundColor: COLORS.card, borderRadius: 28, padding: 22, marginBottom: 28, borderWidth: 1, borderColor: COLORS.border },
  suggLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  suggLabelText: { fontSize: 12, fontWeight: '800', color: COLORS.red, textTransform: 'uppercase' },
  suggTitle: { fontSize: 22, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  suggDesc: { fontSize: 14, color: COLORS.gray, lineHeight: 20, marginBottom: 20 },
  suggBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.ink, paddingVertical: 14, borderRadius: 16 },
  suggBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  emptySugg: { alignItems: 'center', paddingVertical: 10 },
  emptySuggTxt: { fontSize: 16, color: COLORS.gray, marginBottom: 16 },
  emptySuggBtn: { backgroundColor: COLORS.red, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptySuggBtnTxt: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 14, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  itemIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.chip, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  itemMain: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 2 },
  itemDesc: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  itemAuthor: { fontSize: 10, fontWeight: '700', color: COLORS.red, textTransform: 'uppercase' },
  emptyState: { paddingVertical: 80, alignItems: 'center', gap: 16 },
  emptyStateTxt: { color: COLORS.muted, fontSize: 14, fontStyle: 'italic' },
});
