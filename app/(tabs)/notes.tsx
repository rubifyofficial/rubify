import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
  Dimensions, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  PenTool, Image as ImageIcon, Camera, Palette, Eraser,
  Save, Type, Heart, Clock, ImagePlus, Send,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

const { width: SW } = Dimensions.get('window');
const BG = '#0C0C0C';
const CARD_BG = '#F7F7F5';
const INK = '#111111';
const W = '#FFFFFF';
const MUTED = '#A1A1AA';
const RED = '#EF233C';
const BDR = '#2E2E2E';
const GRAY = '#6B6B6B';

type DbNote = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  content: string | null;
  note_type: string;
  image_url: string | null;
  drawing_data: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH}h`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

function noteTypeLabel(type: string): string {
  if (type === 'drawing') return 'Dibujo';
  if (type === 'photo') return 'Foto';
  if (type === 'mixed') return 'Foto + texto';
  return 'Texto';
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTool, setActiveTool] = useState('Texto');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [noteText, setNoteText] = useState('');

  // Supabase state
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // ── 1. Load current user and couple_id ──────────────────────
  const initialize = useCallback(async () => {
    setLoading(true);
    setInitError(null);
    try {
      // Load current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        console.log('userError', userError);
        Alert.alert('Error', 'Usuario no encontrado');
        router.replace('/(auth)/login');
        return;
      }
      setUserId(userData.user.id);

      // Load couple_id correctly
      const { data: coupleData, error: coupleError } = await supabase.rpc('get_my_couple');
      console.log('get_my_couple data', coupleData);
      console.log('get_my_couple error', coupleError);

      if (coupleError) {
        setInitError('No se pudo cargar la pareja');
        Alert.alert('Error', coupleError.message || 'No se pudo cargar la pareja');
        setLoading(false);
        return;
      }

      const coupleResult = Array.isArray(coupleData) ? coupleData[0] : coupleData;
      const cid = coupleResult?.couple_id;

      if (!cid) {
        setInitError('No se encontró la pareja');
        Alert.alert('Aviso', 'No se encontró la pareja');
        router.replace('/partner-setup');
        return;
      }
      setCoupleId(cid);
      
      // Fetch notes after getting coupleId
      await fetchNotes(cid);
    } catch (e: any) {
      console.log('initialize exception', e);
      setInitError('Error de inicialización');
    } finally {
      setLoading(false);
    }
  }, [router, fetchNotes]);

  useEffect(() => {
    initialize();
  }, []);

  // ── 2. Fetch notes correctly ───────────────────────────────
  const fetchNotes = useCallback(async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('couple_id', cid)
        .order('created_at', { ascending: false });

      console.log('fetched notes', data);
      console.log('fetch notes error', error);

      if (error) {
        Alert.alert('Error', 'No se pudieron cargar las notas');
        return;
      }
      setNotes(data ?? []);
    } catch (e: any) {
      console.log('fetchNotes exception', e);
    }
  }, []);

  // ── 3. Realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    const channel = supabase
      .channel(`notes:${coupleId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notes',
        filter: `couple_id=eq.${coupleId}`,
      }, (payload) => {
        console.log('realtime notes event:', payload.eventType);
        if (payload.eventType === 'INSERT') {
          const n = payload.new as DbNote;
          setNotes(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const n = payload.new as DbNote;
          setNotes(prev => prev.map(x => x.id === n.id ? n : x));
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as { id: string };
          setNotes(prev => prev.filter(x => x.id !== old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [coupleId]);

  // ── 4. Insert note exactly as requested ─────────────────────
  const saveNote = async () => {
    if (!noteText.trim()) {
      Alert.alert('Aviso', 'Escribe una nota primero');
      return;
    }
    if (!coupleId) {
      Alert.alert('Error', 'No se encontró la pareja');
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'Usuario no encontrado');
      return;
    }

    const payload = {
      couple_id: coupleId,
      created_by: userId,
      title: 'Nota para Sofia',
      content: noteText.trim(),
      note_type: activeTool === 'Dibujar' ? 'drawing' : 'text',
      is_shared: true,
      drawing_data: null,
      image_url: null,
    };

    console.log('saving note payload', payload);
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert(payload)
        .select()
        .single();

      console.log('save note data', data);
      console.log('save note error', error);

      if (error) {
        Alert.alert('Error', error.message || 'No se pudo guardar la nota');
        return;
      }

      Alert.alert('Listo', 'Nota guardada');
      setNoteText('');
      // Refetch notes immediately
      await fetchNotes(coupleId);
    } catch (e: any) {
      console.log('saveNote exception', e);
      Alert.alert('Error', 'Ocurrió un error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const go = (msg: string) => Alert.alert(msg);

  const tools = [
    { id: 'Texto',    icon: <Type size={18} color={activeTool === 'Texto' ? W : INK} />,    action: () => setActiveTool('Texto') },
    { id: 'Dibujar', icon: <PenTool size={18} color={activeTool === 'Dibujar' ? W : INK} />, action: () => setActiveTool('Dibujar') },
    { id: 'Foto',    icon: <ImageIcon size={18} color={INK} />,  action: () => go('Subir foto disponible pronto') },
    { id: 'Cámara',  icon: <Camera size={18} color={INK} />,    action: () => go('Cámara disponible pronto') },
    { id: 'Color',   icon: <Palette size={18} color={INK} />,   action: () => go('Selector de color disponible pronto') },
    { id: 'Borrador',icon: <Eraser size={18} color={INK} />,    action: () => go('Borrador activado') },
  ];

  // ── 5. Partner preview logic ────────────────────────────────
  const partnerNote = userId ? notes.find(n => n.created_by !== userId) ?? null : null;

  const filteredNotes = notes.filter(n => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Dibujos') return n.note_type === 'drawing';
    if (activeFilter === 'Texto') return n.note_type === 'text';
    if (activeFilter === 'Fotos') return n.note_type === 'photo';
    if (activeFilter === 'Foto + texto') return n.note_type === 'mixed';
    return true;
  });

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════ HEADER ══════ */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Notas privadas</Text>
          <Text style={s.headerSub}>Dibuja, escribe o comparte un recuerdo</Text>
        </View>

        {initError && <Text style={s.errorTxt}>{initError}</Text>}

        {/* ══════ PARTNER NOTE PREVIEW ══════ */}
        <View style={s.partnerCard}>
          <View style={s.partnerTop}>
            <Text style={s.partnerTitle}>De tu pareja para ti</Text>
            {partnerNote && (
              <View style={s.newBadge}><Text style={s.newBadgeTxt}>Nuevo</Text></View>
            )}
          </View>
          {partnerNote ? (
            <View style={s.partnerRow}>
              <View style={s.partnerMiniCanvas}>
                <Heart size={20} color={RED} strokeWidth={1.5} opacity={0.6} />
                <Text style={s.partnerMiniTxt}>{noteTypeLabel(partnerNote.note_type)}</Text>
              </View>
              <View style={s.partnerInfo}>
                <Text style={s.partnerDesc} numberOfLines={2}>
                  {partnerNote.content || partnerNote.title}
                </Text>
                <View style={s.partnerTimeWrap}>
                  <Clock size={10} color={'#9CA3AF'} />
                  <Text style={s.partnerTime}>{fmtDate(partnerNote.created_at)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={s.partnerEmpty}>Sofia todavía no dejó una nota.</Text>
          )}
        </View>

        {/* ══════ CANVAS / EDITOR ══════ */}
        <View style={s.canvasSection}>
          <Text style={s.sectionTitle}>Tu lienzo</Text>
          <Text style={s.sectionSub}>Dibuja, escribe o agrega una foto para tu pareja</Text>

          <View style={s.largeCanvas}>
            {/* Paper lines */}
            <View style={s.paperGrid}>
              {[1,2,3,4,5,6,7].map(i => (
                <View key={i} style={[s.paperLine, { top: i * 48 }]} />
              ))}
            </View>
            <View style={s.badgeTL}><Text style={s.badgeTxt}>Lienzo</Text></View>
            <View style={s.badgeTR}><Text style={s.badgeTxt}>{activeTool}</Text></View>

            {/* Real TextInput connected to noteText */}
            <TextInput
              style={s.canvasInput}
              placeholder="Toca para escribir..."
              placeholderTextColor="#C9C9C9"
              value={noteText}
              onChangeText={setNoteText}
              multiline
              maxLength={800}
              editable={!saving}
              textAlignVertical="top"
            />

            {/* Mini tool icons */}
            <View style={s.miniToolsGroup}>
              <View style={s.miniTool}><PenTool size={14} color={GRAY} /></View>
              <View style={s.miniTool}><Type size={14} color={GRAY} /></View>
              <View style={s.miniTool}><Camera size={14} color={GRAY} /></View>
            </View>
          </View>

          {/* Toolbar */}
          <View style={s.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbarScroll}>
              {tools.map(t => {
                const isActive = activeTool === t.id;
                return (
                  <Pressable
                    key={t.id}
                    style={[s.toolPill, isActive && s.toolPillActive]}
                    onPress={t.action}
                  >
                    {t.icon}
                    <Text style={[s.toolLbl, isActive && s.toolLblActive]}>{t.id}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Save / Send actions */}
          <View style={s.actionRow}>
            <Pressable
              style={[s.btnPrimary, saving && { opacity: 0.6 }]}
              onPress={saveNote}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color={W} />
                : <Save size={16} color={W} />}
              <Text style={s.btnPrimaryTxt}>Guardar</Text>
            </Pressable>
            <Pressable style={s.btnSecondary} onPress={() => go('Enviado a tu pareja')}>
              <Send size={16} color={INK} />
              <Text style={s.btnSecondaryTxt}>Enviar</Text>
            </Pressable>
          </View>
        </View>

        {/* ══════ PHOTO + TEXT PREVIEW (Feature Card) ══════ */}
        <View style={s.featureCard}>
          <View style={s.featureContent}>
            <Text style={s.featureTitle}>Foto con texto</Text>
            <Text style={s.featureDesc}>Agrega una foto y escribe encima.</Text>
          </View>
          <View style={s.featurePreview}>
            <ImageIcon size={20} color={'rgba(255,255,255,0.4)'} />
            <Text style={s.featurePreviewTxt}>Nuestro momento</Text>
          </View>
        </View>

        {/* ══════ SAVED NOTES LIBRARY ══════ */}
        <Text style={[s.sectionTitle, { marginTop: 28 }]}>Notas guardadas</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {['Todos', 'Dibujos', 'Texto', 'Fotos', 'Foto + texto'].map(chip => {
            const isActive = activeFilter === chip;
            return (
              <Pressable
                key={chip}
                style={[s.chip, isActive ? s.chipActive : s.chipInactive]}
                onPress={() => setActiveFilter(chip)}
              >
                <Text style={[s.chipTxt, isActive ? s.chipTxtActive : s.chipTxtInactive]}>{chip}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.savedGrid}>
          {filteredNotes.length === 0 ? (
            <Text style={s.emptyTxt}>No hay notas todavía.</Text>
          ) : (
            filteredNotes.map(note => {
              const isMine = note.created_by === userId;
              return (
                <Pressable key={note.id} style={s.savedItem} onPress={() => go('Nota abierta')}>
                  <View style={s.savedVisual}>
                    {note.note_type === 'drawing'
                      ? <Heart size={32} color={RED} opacity={0.5} />
                      : note.note_type === 'photo' || note.note_type === 'mixed'
                        ? <ImageIcon size={28} color={'#D1D5DB'} />
                        : <Text style={s.savedMockTxt} numberOfLines={4}>{note.content || note.title}</Text>
                    }
                    <View style={s.savedTypeBadge}>
                      <Text style={s.savedTypeBadgeTxt}>{noteTypeLabel(note.note_type)}</Text>
                    </View>
                  </View>
                  <Text style={s.savedTitle} numberOfLines={1}>{note.title}</Text>
                  <Text style={s.savedDate}>{isMine ? 'De mí' : 'De tu pareja'} · {fmtDate(note.created_at)}</Text>
                </Pressable>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  errorTxt: { color: RED, fontSize: 13, marginBottom: 12 },
  emptyTxt: { color: MUTED, fontSize: 14, fontStyle: 'italic', paddingVertical: 20, width: '100%', textAlign: 'center' },

  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: W, letterSpacing: 0 },
  headerSub: { fontSize: 13, color: MUTED, marginTop: 4, letterSpacing: 0 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: W, letterSpacing: 0 },
  sectionSub: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 12, letterSpacing: 0 },

  partnerCard: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: BDR },
  partnerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  partnerTitle: { fontSize: 14, fontWeight: '700', color: W },
  newBadge: { backgroundColor: 'rgba(239,35,60,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newBadgeTxt: { color: RED, fontSize: 10, fontWeight: '800' },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerMiniCanvas: { width: 80, height: 60, backgroundColor: CARD_BG, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  partnerMiniTxt: { fontSize: 10, fontStyle: 'italic', color: INK, marginTop: 4, fontWeight: '600' },
  partnerInfo: { flex: 1 },
  partnerDesc: { fontSize: 12, color: MUTED, marginBottom: 6 },
  partnerTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  partnerTime: { fontSize: 10, color: '#9CA3AF' },
  partnerEmpty: { fontSize: 13, color: MUTED, fontStyle: 'italic' },

  canvasSection: { marginBottom: 28 },
  largeCanvas: { height: SW, backgroundColor: CARD_BG, borderRadius: 20, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  paperGrid: { ...StyleSheet.absoluteFillObject },
  paperLine: { position: 'absolute', left: 20, right: 20, height: 1, backgroundColor: 'rgba(0,0,0,0.035)' },
  badgeTL: { position: 'absolute', top: 12, left: 12, backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTR: { position: 'absolute', top: 12, right: 12, backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: GRAY, textTransform: 'uppercase' },
  canvasInput: { position: 'absolute', top: 44, left: 16, right: 16, bottom: 60, fontSize: 16, color: INK, lineHeight: 26 },
  miniToolsGroup: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', gap: 8 },
  miniTool: { width: 36, height: 36, backgroundColor: W, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },

  toolbar: { marginTop: 16 },
  toolbarScroll: { gap: 8 },
  toolPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 8 },
  toolPillActive: { backgroundColor: RED },
  toolLbl: { fontSize: 13, fontWeight: '600', color: INK },
  toolLblActive: { color: W },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnPrimary: { flex: 1, flexDirection: 'row', backgroundColor: RED, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnPrimaryTxt: { color: W, fontSize: 14, fontWeight: '700' },
  btnSecondary: { flex: 1, flexDirection: 'row', backgroundColor: CARD_BG, paddingVertical: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnSecondaryTxt: { color: INK, fontSize: 14, fontWeight: '700' },

  // Feature Card
  featureCard: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: BDR },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: W, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: MUTED, lineHeight: 16 },
  featurePreview: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#27272A', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  featurePreviewTxt: { position: 'absolute', bottom: 8, color: W, fontSize: 8, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  chipRow: { gap: 10, marginBottom: 16, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: RED, borderColor: RED },
  chipInactive: { backgroundColor: '#1C1C1E', borderColor: BDR },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: W },
  chipTxtInactive: { color: MUTED },

  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  savedItem: { width: (SW - 52) / 2, marginBottom: 8 },
  savedVisual: { height: 120, backgroundColor: CARD_BG, borderRadius: 16, marginBottom: 8, position: 'relative', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  savedTypeBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  savedTypeBadgeTxt: { fontSize: 9, color: W, fontWeight: '700' },
  savedMockTxt: { fontSize: 11, color: GRAY, padding: 12, textAlign: 'center' },
  savedTitle: { fontSize: 13, fontWeight: '700', color: W, marginBottom: 2 },
  savedDate: { fontSize: 11, color: MUTED },
});
