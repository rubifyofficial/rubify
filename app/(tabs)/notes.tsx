import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, 
  TextInput, Alert, ActivityIndicator, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Plus, Send, Heart, BookHeart, User, 
  Trash2, MessageSquareHeart 
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfileAndCouple } from '../../lib/useProfileAndCouple';

// --- Light / Pastel Theme ---
const BG = '#FFFFFF';
const SOFT_PINK = '#FFF1F2';
const ACCENT_RED = '#F4A6A6';
const TEXT_DARK = '#222222';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#F1DCDC';

export default function NotasScreen() {
  const insets = useSafeAreaInsets();
  const { profile, couple } = useProfileAndCouple();
  
  const [myNotes, setMyNotes] = useState<any[]>([]);
  const [partnerNotes, setPartnerNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  const partnerName = couple?.partner_name || 'Pareja';

  useEffect(() => {
    if (couple?.couple_id) {
      fetchNotes();
    }
  }, [couple]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('couple_id', couple?.couple_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const mine = data?.filter(n => n.created_by === profile?.id) || [];
      const theirs = data?.filter(n => n.created_by !== profile?.id) || [];
      
      setMyNotes(mine);
      setPartnerNotes(theirs);
    } catch (e) {
      console.log('[Notes] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const postNote = async () => {
    if (!newNote.trim() || !couple?.couple_id || !profile?.id) return;
    const text = newNote.trim();
    setNewNote('');
    
    try {
      const { error } = await supabase.from('notes').insert({
        couple_id: couple.couple_id,
        created_by: profile.id,
        content: text
      });
      if (error) throw error;
      Alert.alert('¡Listo!', `Nota enviada a ${partnerName}`);
      fetchNotes();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la nota');
      setNewNote(text);
    }
  };

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <View style={s.header}>
        <Text style={s.title}>Notas de Amor</Text>
        <Text style={s.subtitle}>Pequeños mensajes que quedan guardados</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* --- Post a Note --- */}
        <View style={s.postBox}>
          <Text style={s.sectionTitle}>Escribir algo tierno</Text>
          <TextInput
            style={s.input}
            placeholder={`¿Qué quieres decirle a ${partnerName} hoy?`}
            placeholderTextColor={TEXT_MUTED}
            value={newNote}
            onChangeText={setNewNote}
            multiline
          />
          <Pressable style={[s.btnSend, !newNote.trim() && { opacity: 0.5 }]} onPress={postNote}>
            <Send size={18} color="#FFF" />
            <Text style={s.btnSendTxt}>Enviar a {partnerName}</Text>
          </Pressable>
        </View>

        {/* --- Partner's Notes --- */}
        <View style={s.sectionHeader}>
          <MessageSquareHeart size={20} color={ACCENT_RED} />
          <Text style={s.sectionTitle}>Notas de {partnerName}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={ACCENT_RED} />
        ) : partnerNotes.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTxt}>{partnerName} todavía no ha dejado notas.</Text>
          </View>
        ) : (
          partnerNotes.map(n => (
            <View key={n.id} style={s.noteCardPartner}>
              <Text style={s.noteTxt}>{n.content}</Text>
              <Text style={s.noteDate}>{new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</Text>
            </View>
          ))
        )}

        {/* --- My Notes --- */}
        <View style={[s.sectionHeader, { marginTop: 20 }]}>
          <BookHeart size={20} color={ACCENT_RED} />
          <Text style={s.sectionTitle}>Mis Notas</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={ACCENT_RED} />
        ) : myNotes.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTxt}>No has escrito notas aún.</Text>
          </View>
        ) : (
          myNotes.map(n => (
            <View key={n.id} style={s.noteCardMe}>
              <Text style={s.noteTxt}>{n.content}</Text>
              <View style={s.noteBtm}>
                <Text style={s.noteDate}>{new Date(n.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</Text>
                <Trash2 size={16} color={TEXT_MUTED} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { padding: 20 },
  title: { fontSize: 28, fontWeight: '900', color: TEXT_DARK },
  subtitle: { fontSize: 14, color: TEXT_MUTED, marginTop: 4 },
  scroll: { flex: 1 },
  
  postBox: { margin: 20, padding: 20, backgroundColor: SOFT_PINK, borderRadius: 24, borderWidth: 1, borderColor: BORDER },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK, marginBottom: 12 },
  input: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, minHeight: 100, fontSize: 15, color: TEXT_DARK, textAlignVertical: 'top', borderWidth: 1, borderColor: BORDER },
  btnSend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT_RED, marginTop: 12, padding: 14, borderRadius: 16, gap: 8 },
  btnSendTxt: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10, marginBottom: 10 },
  emptyBox: { marginHorizontal: 20, padding: 20, backgroundColor: '#FAFAFA', borderRadius: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: BORDER },
  emptyTxt: { color: TEXT_MUTED, fontStyle: 'italic' },

  noteCardPartner: { marginHorizontal: 20, marginBottom: 12, padding: 20, backgroundColor: '#FFF', borderRadius: 24, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  noteCardMe: { marginHorizontal: 20, marginBottom: 12, padding: 20, backgroundColor: '#FAFAFA', borderRadius: 24, borderWidth: 1, borderColor: BORDER },
  noteTxt: { fontSize: 15, color: TEXT_DARK, lineHeight: 22 },
  noteDate: { fontSize: 12, color: TEXT_MUTED, marginTop: 10, fontWeight: '600' },
  noteBtm: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});
