import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PenTool, Image as ImageIcon, Camera, Palette, Eraser,
  Save, Type, Reply, Heart, Clock, ImagePlus, Plus, Send
} from 'lucide-react-native';

const { width: SW } = Dimensions.get('window');

const BG = '#0C0C0C';
const CARD_BG = '#F7F7F5';
const INK = '#111111';
const W = '#FFFFFF';
const MUTED = '#A1A1AA';
const RED = '#EF233C';
const BDR = '#2E2E2E';
const GRAY = '#6B6B6B';

const MOCK_SAVED = [
  { id: '1', type: 'Dibujo', title: 'Corazón para Sofia', preview: 'heart', time: 'Hoy', icon: <PenTool size={12} color={W} /> },
  { id: '2', type: 'Texto', title: 'Cosas que le gustan', preview: 'text', time: 'Ayer', icon: <Type size={12} color={W} /> },
  { id: '3', type: 'Foto', title: 'Viaje a la playa', preview: 'photo', time: '12 de marzo', icon: <ImageIcon size={12} color={W} /> },
  { id: '4', type: 'Foto + texto', title: 'Nuestro momento', preview: 'mixed', time: '5 de mayo', icon: <ImagePlus size={12} color={W} /> },
];

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState('Dibujar');
  const [activeFilter, setActiveFilter] = useState('Todos');

  const go = (msg: string) => Alert.alert(msg);

  const tools = [
    { id: 'Texto', icon: <Type size={18} color={activeTool === 'Texto' ? W : INK} />, action: 'Modo texto' },
    { id: 'Dibujar', icon: <PenTool size={18} color={activeTool === 'Dibujar' ? W : INK} />, action: 'Modo dibujo' },
    { id: 'Foto', icon: <ImageIcon size={18} color={activeTool === 'Foto' ? W : INK} />, action: 'Subir foto disponible pronto' },
    { id: 'Cámara', icon: <Camera size={18} color={activeTool === 'Cámara' ? W : INK} />, action: 'Cámara disponible pronto' },
    { id: 'Color', icon: <Palette size={18} color={activeTool === 'Color' ? W : INK} />, action: 'Selector de color disponible pronto' },
    { id: 'Borrador', icon: <Eraser size={18} color={activeTool === 'Borrador' ? W : INK} />, action: 'Borrador activado' },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════ HEADER ══════ */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Notas privadas</Text>
            <Text style={s.headerSub}>Dibuja, escribe o comparte un recuerdo</Text>
          </View>
        </View>

        {/* ══════ PARTNER PREVIEW (Smaller) ══════ */}
        <View style={s.partnerCard}>
          <View style={s.partnerTop}>
            <Text style={s.partnerTitle}>De Sofia para ti</Text>
            <View style={s.newBadge}><Text style={s.newBadgeTxt}>Nuevo</Text></View>
          </View>
          <View style={s.partnerRow}>
            <View style={s.partnerMiniCanvas}>
              <Heart size={20} color={RED} strokeWidth={1.5} opacity={0.6} />
              <Text style={s.partnerMiniTxt}>Para ti...</Text>
            </View>
            <View style={s.partnerInfo}>
              <Text style={s.partnerDesc}>Un dibujo compartido contigo.</Text>
              <View style={s.partnerTimeWrap}>
                <Clock size={10} color={'#9CA3AF'} />
                <Text style={s.partnerTime}>Hace 10 min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ══════ MAIN CANVAS AREA (Dominant) ══════ */}
        <View style={s.canvasSection}>
          <Text style={s.sectionTitle}>Tu lienzo</Text>
          <Text style={s.sectionSub}>Dibuja, escribe o agrega una foto para Sofia</Text>
          
          <Pressable style={s.largeCanvas} onPress={() => go('Editor disponible pronto')}>
            
            {/* Paper grid/lines */}
            <View style={s.paperGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                <View key={i} style={[s.paperLine, { top: i * 40 }]} />
              ))}
            </View>

            {/* Corner Badges */}
            <View style={s.badgeTL}><Text style={s.badgeTxt}>Lienzo</Text></View>
            <View style={s.badgeTR}><Text style={s.badgeTxt}>Borrador</Text></View>

            {/* Content */}
            <Text style={s.canvasPlaceholder}>Toca para dibujar o escribir...</Text>
            
            {/* Mock drawing elements */}
            <View style={s.mockDrawingGroup}>
              <Heart size={44} color={RED} strokeWidth={1} opacity={0.4} style={{transform: [{rotate: '-10deg'}]}} />
              <View style={s.pencilStroke} />
              <Text style={s.mockText}>Para ti</Text>
            </View>

            {/* Floating Mini Buttons inside canvas */}
            <View style={s.miniToolsGroup}>
              <View style={s.miniTool}><PenTool size={14} color={GRAY} /></View>
              <View style={s.miniTool}><Type size={14} color={GRAY} /></View>
              <View style={s.miniTool}><Camera size={14} color={GRAY} /></View>
            </View>
          </Pressable>

          {/* ══════ TOOLBAR (Directly under canvas) ══════ */}
          <View style={s.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolbarScroll}>
              {tools.map(t => {
                const isActive = activeTool === t.id;
                return (
                  <Pressable 
                    key={t.id} 
                    style={[s.toolPill, isActive && s.toolPillActive]}
                    onPress={() => { setActiveTool(t.id); go(t.action); }}
                  >
                    {t.icon}
                    <Text style={[s.toolLbl, isActive && s.toolLblActive]}>{t.id}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ══════ SAVE / SEND ACTIONS ══════ */}
          <View style={s.actionRow}>
            <Pressable style={s.btnPrimary} onPress={() => go('Nota guardada')}>
              <Save size={16} color={W} />
              <Text style={s.btnPrimaryTxt}>Guardar</Text>
            </Pressable>
            <Pressable style={s.btnSecondary} onPress={() => go('Enviado a Sofia')}>
              <Send size={16} color={INK} />
              <Text style={s.btnSecondaryTxt}>Enviar a Sofia</Text>
            </Pressable>
          </View>
        </View>

        {/* ══════ PHOTO + TEXT PREVIEW ══════ */}
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
        
        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {['Todos', 'Dibujos', 'Texto', 'Fotos', 'Foto + texto'].map((chip) => {
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

        {/* Saved Grid */}
        <View style={s.savedGrid}>
          {MOCK_SAVED.map((item) => (
            <Pressable key={item.id} style={s.savedItem} onPress={() => go('Nota abierta')}>
              <View style={s.savedVisual}>
                {item.preview === 'heart' && <Heart size={32} color={RED} opacity={0.5} />}
                {item.preview === 'text' && <Text style={s.savedMockTxt}>Flores, cartas y detalles pequeños...</Text>}
                {item.preview === 'photo' && <ImageIcon size={28} color={'#D1D5DB'} />}
                {item.preview === 'mixed' && (
                  <>
                    <View style={s.savedMixedBg} />
                    <Text style={s.savedMixedTxt}>Nuestro momento</Text>
                  </>
                )}
                <View style={s.savedTypeBadge}>
                  {item.icon}
                  <Text style={s.savedTypeBadgeTxt}>{item.type}</Text>
                </View>
              </View>
              <Text style={s.savedTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.savedDate}>{item.time}</Text>
            </Pressable>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  // Header
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: W, letterSpacing: 0 },
  headerSub: { fontSize: 13, color: MUTED, marginTop: 4, letterSpacing: 0 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: W, letterSpacing: 0 },
  sectionSub: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 12, letterSpacing: 0 },

  // Partner Card (Smaller)
  partnerCard: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: BDR },
  partnerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  partnerTitle: { fontSize: 14, fontWeight: '700', color: W, letterSpacing: 0 },
  newBadge: { backgroundColor: 'rgba(239, 35, 60, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  newBadgeTxt: { color: RED, fontSize: 10, fontWeight: '800' },
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerMiniCanvas: { width: 80, height: 60, backgroundColor: CARD_BG, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  partnerMiniTxt: { fontSize: 10, fontStyle: 'italic', color: INK, marginTop: 4, fontWeight: '600' },
  partnerInfo: { flex: 1 },
  partnerDesc: { fontSize: 12, color: MUTED, marginBottom: 6 },
  partnerTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  partnerTime: { fontSize: 10, color: '#9CA3AF' },

  // Main Canvas Section
  canvasSection: { marginBottom: 28 },
  largeCanvas: { height: 500, backgroundColor: CARD_BG, borderRadius: 20, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  paperGrid: { ...StyleSheet.absoluteFillObject },
  paperLine: { position: 'absolute', left: 20, right: 20, height: 1, backgroundColor: 'rgba(0,0,0,0.03)' },
  
  badgeTL: { position: 'absolute', top: 12, left: 12, backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTR: { position: 'absolute', top: 12, right: 12, backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: GRAY, textTransform: 'uppercase' },

  canvasPlaceholder: { position: 'absolute', top: 44, left: 20, fontSize: 16, color: '#D1D5DB', fontWeight: '500' },
  
  mockDrawingGroup: { position: 'absolute', top: 120, left: 60, alignItems: 'center' },
  pencilStroke: { width: 60, height: 2, backgroundColor: INK, opacity: 0.2, marginTop: 8, borderRadius: 1, transform: [{rotate: '5deg'}] },
  mockText: { fontSize: 24, color: INK, fontStyle: 'italic', fontWeight: '600', marginTop: 12, transform: [{rotate: '-2deg'}] },

  miniToolsGroup: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', gap: 8 },
  miniTool: { width: 36, height: 36, backgroundColor: W, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },

  // Toolbar
  toolbar: { marginTop: 16 },
  toolbarScroll: { gap: 8 },
  toolPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 8 },
  toolPillActive: { backgroundColor: RED },
  toolLbl: { fontSize: 13, fontWeight: '600', color: INK },
  toolLblActive: { color: W },

  // Actions
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

  // Chips
  chipRow: { gap: 10, marginBottom: 16, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: RED, borderColor: RED },
  chipInactive: { backgroundColor: '#1C1C1E', borderColor: BDR },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: W },
  chipTxtInactive: { color: MUTED },

  // Saved Grid
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  savedItem: { width: (SW - 52) / 2, marginBottom: 8 },
  savedVisual: { height: 120, backgroundColor: CARD_BG, borderRadius: 16, marginBottom: 8, position: 'relative', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  savedTypeBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, gap: 4 },
  savedTypeBadgeTxt: { fontSize: 9, color: W, fontWeight: '700' },
  savedMockTxt: { fontSize: 10, color: GRAY, padding: 16, textAlign: 'center', fontStyle: 'italic' },
  savedMixedBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#D1D5DB' },
  savedMixedTxt: { color: W, fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  savedTitle: { fontSize: 13, fontWeight: '700', color: W, letterSpacing: 0, marginBottom: 2 },
  savedDate: { fontSize: 11, color: MUTED },
});
