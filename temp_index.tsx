import React from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapPin, Home, BookHeart, Heart,
  MessageCircle, Image as ImageIcon,
  Calendar, Clapperboard, Flame, Sparkles,
} from 'lucide-react-native';

// ΓöÇΓöÇΓöÇ colour palette ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const PAGE_BG  = '#080808';
const CARD_BG  = '#F7F7F5';
const CHIP_BG  = '#1C1C1E';
const WHITE    = '#FFFFFF';
const INK      = '#111111';
const GRAY     = '#6B6B6B';
const MUTED    = '#A1A1AA';
const BORDER   = '#27272A';
const RED      = '#EF233C';

// ΓöÇΓöÇΓöÇ HomeScreen ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export default function HomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  return (
    <SafeAreaView style={[st.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[
          st.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ HEADER ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <View style={st.header}>
          <View>
            <Text style={st.headerTitle}>Inicio</Text>
            <Text style={st.headerSub}>Tu espacio de hoy</Text>
          </View>
          <Pressable
            style={st.avatarCircle}
            onPress={() => router.push('/profile')}
          >
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' }}
              style={st.avatarImg}
            />
          </Pressable>
        </View>

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ LOCATION CARD ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <Pressable
          style={({ pressed }) => [st.card, st.locationCard, pressed && st.pressed]}
          onPress={() => router.push('/ubicacion')}
        >
          {/* label row */}
          <View style={st.cardTopRow}>
            <View style={st.labelRow}>
              <MapPin size={13} color={RED} />
              <Text style={st.cardLabelText}>Ubicacion</Text>
            </View>
            <View style={st.greenPill}>
              <View style={st.greenDot} />
              <Text style={st.greenPillText}>Compartiendo</Text>
            </View>
          </View>

          {/* titles */}
          <Text style={st.cardMainTitle}>Sofia esta en camino</Text>
          <Text style={st.cardRedStatus}>A 12 min de casa</Text>
          <Text style={st.cardBodyText}>Te avisaremos cuando llegue a casa.</Text>

          {/* map preview */}
          <View style={st.mapPreview}>
            {/* grid */}
            <View style={[st.mapGridH, { top: '33%' }]} />
            <View style={[st.mapGridH, { top: '66%' }]} />
            <View style={[st.mapGridV, { left: '33%' }]} />
            <View style={[st.mapGridV, { left: '66%' }]} />
            {/* arc */}
            <View style={st.mapArc} />
            {/* T├║ marker */}
            <View style={[st.markerGroup, { left: 20, bottom: 22 }]}>
              <View style={st.markerDot} />
              <Text style={st.markerName}>Tu</Text>
            </View>
            {/* Sofia marker */}
            <View style={[st.markerGroup, { left: '38%', top: 18 }]}>
              <MapPin size={20} color={RED} />
              <Text style={[st.markerName, { color: RED }]}>Sofia</Text>
            </View>
            {/* Casa marker */}
            <View style={[st.markerGroup, { right: 16, bottom: 18 }]}>
              <View style={st.markerHome}>
                <Home size={12} color={WHITE} />
              </View>
              <Text style={st.markerName}>Casa</Text>
            </View>
          </View>

          {/* info row */}
          <View style={st.infoRow}>
            <Text style={st.infoItem}>Tu: Casa</Text>
            <View style={st.infoBullet} />
            <Text style={st.infoItem}>Sofia: En camino</Text>
            <View style={st.infoBullet} />
            <Text style={st.infoItem}>Hace 5 min</Text>
          </View>
        </Pressable>

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ COUNTER DIVIDER ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <View style={st.dividerWrap}>
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <Text style={st.dividerText}>
              <Text style={st.dividerAccent}>{'Γê₧'} </Text>
              {'124 dias juntos'}
              <Text style={st.dividerAccent}> {'Γê₧'}</Text>
            </Text>
            <View style={st.dividerLine} />
          </View>
          <Text style={st.dividerSub}>Desde el 10 de enero</Text>
        </View>

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ NOTES CARD ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <Pressable
          style={({ pressed }) => [st.card, st.notesCard, pressed && st.pressed]}
          onPress={() => router.push('/notes')}
        >
          {/* label row */}
          <View style={st.cardTopRow}>
            <View style={st.labelRow}>
              <BookHeart size={13} color={RED} />
              <Text style={st.cardLabelText}>Notas privadas</Text>
            </View>
            <View style={st.redPill}>
              <Text style={st.redPillText}>Nuevo</Text>
            </View>
          </View>

          {/* titles */}
          <Text style={st.cardMainTitle}>Sofia dejo algo para ti</Text>
          <Text style={st.cardBodyText}>Mira su dibujo, responde o guarda un recuerdo.</Text>

          {/* canvas preview */}
          <View style={st.canvasPreview}>
            {/* paper lines */}
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[st.paperLine, { top: 30 + i * 38 }]} />
            ))}
            {/* drawing */}
            <Text style={st.heartGlyph}>{'ΓÖÑ'}</Text>
            <Text style={st.paraText}>Para ti</Text>
            {/* corner badge */}
            <View style={st.cornerBadge}>
              <Text style={st.cornerBadgeText}>Hoy</Text>
            </View>
            {/* author badge */}
            <View style={st.authorBadge}>
              <Text style={st.authorBadgeText}>Dibujo de Sofia</Text>
            </View>
          </View>

          {/* info row */}
          <View style={st.infoRow}>
            <Text style={st.infoItem}>Dibujo</Text>
            <View style={st.infoBullet} />
            <Text style={st.infoItem}>De Sofia</Text>
            <View style={st.infoBullet} />
            <Text style={st.infoItem}>Hace 10 min</Text>
          </View>
        </Pressable>

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ SHORTCUT CARDS ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <View style={st.shortcutRow}>
          <Pressable
            style={({ pressed }) => [st.shortcut, pressed && st.pressed]}
            onPress={() => router.push('/messages')}
          >
            <View style={[st.shortcutIcon, { backgroundColor: '#EF233C18' }]}>
              <MessageCircle size={18} color={RED} />
            </View>
            <Text style={st.shortcutTitle} numberOfLines={1}>Ultimo mensaje</Text>
            <Text style={st.shortcutSub} numberOfLines={2}>Te amo mucho...</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [st.shortcut, pressed && st.pressed]}
            onPress={() => router.push('/moments')}
          >
            <View style={[st.shortcutIcon, { backgroundColor: '#EF233C18' }]}>
              <ImageIcon size={18} color={RED} />
            </View>
            <Text style={st.shortcutTitle} numberOfLines={1}>Un recuerdo</Text>
            <Text style={st.shortcutSub} numberOfLines={2}>Viaje a la playa</Text>
          </Pressable>
        </View>

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ PARA HOY ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <Text style={st.sectionLabel}>Para Hoy</Text>
        <Widget icon={<Heart size={17} color={RED} />}     bg="#EF233C18" title="Como te sientes hoy"        sub="Registra tu estado de animo" />
        <Widget icon={<Sparkles size={17} color={WHITE} />} bg={BORDER}   title="Mensaje romantico para hoy" sub="Sugerencia de IA para sorprender" />
        <Widget icon={<Heart size={17} color={RED} />}     bg="#EF233C18" title="Haz algo bonito hoy"        sub="Pequena tarea del dia" />
        <Widget icon={<Calendar size={17} color={WHITE} />} bg={BORDER}   title="Proximo dia especial"       sub="Aniversario en 15 dias" />

        {/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ MAS PARA USTEDES ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */}
        <Text style={[st.sectionLabel, { marginTop: 12 }]}>Mas para ustedes</Text>
                <Pressable onPress={() => Alert.alert('Funci├│n disponible pronto')}><Widget icon={<Calendar size={17} color={WHITE} />}     bg={BORDER}    title="Calendario"  sub="Fechas importantes" /></Pressable>
        <Pressable onPress={() => Alert.alert('Funci├│n disponible pronto')}><Widget icon={<Clapperboard size={17} color={WHITE} />} bg={BORDER}    title="Ver juntos"  sub="Peliculas y videos" /></Pressable>
        <Pressable onPress={() => Alert.alert('Funci├│n disponible pronto')}><Widget icon={<Flame size={17} color={WHITE} />}        bg={BORDER}    title="Actividades" sub="Ideas para hacer juntos" /></Pressable>
        <Link href="/ai-assistant" asChild><Pressable><Widget icon={<MessageCircle size={17} color={WHITE} />} bg={BORDER}   title="AI Amor"     sub="Ayuda para escribir" /></Pressable></Link>
        <Link href="/ubicacion"    asChild><Pressable><Widget icon={<MapPin size={17} color={RED} />}         bg="#EF233C18" title="Ubicacion"    sub="Saber si llego bien" /></Pressable></Link>
      </ScrollView>
    </SafeAreaView>
  );
}

// ΓöÇΓöÇΓöÇ Widget row component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function Widget({
  icon, bg, title, sub,
}: {
  icon: React.ReactNode; bg: string; title: string; sub: string;
}) {
  return (
    <View style={wg.row}>
      <View style={[wg.icon, { backgroundColor: bg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={wg.title} numberOfLines={1}>{title}</Text>
        <Text style={wg.sub}   numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Styles ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: PAGE_BG },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20 },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginBottom: 22 },
  headerTitle: { fontSize: 27, fontWeight: '800', color: WHITE, letterSpacing: 0 },
  headerSub:   { fontSize: 13, color: MUTED, marginTop: 2, letterSpacing: 0 },
  avatarCircle:{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', borderWidth: 1.5, borderColor: BORDER },
  avatarImg:   { width: '100%', height: '100%' },

  // Card base
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 16,
  },
  locationCard: { marginTop: 0, marginBottom: 0 },
  notesCard:    { marginTop: 0, marginBottom: 0 },
  pressed:      { opacity: 0.92 },

  // Card top row
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabelText: { fontSize: 13, fontWeight: '700', color: INK, letterSpacing: 0 },

  // Badges / pills
  greenPill:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  greenDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginRight: 5 },
  greenPillText: { fontSize: 11, fontWeight: '700', color: '#15803D', letterSpacing: 0 },
  redPill:       { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  redPillText:   { fontSize: 11, fontWeight: '700', color: RED, letterSpacing: 0 },

  // Card text (on white card)
  cardMainTitle: { fontSize: 20, fontWeight: '800', color: INK, marginBottom: 4, letterSpacing: 0 },
  cardRedStatus: { fontSize: 14, fontWeight: '700', color: RED, marginBottom: 4, letterSpacing: 0 },
  cardBodyText:  { fontSize: 13, color: GRAY, lineHeight: 19, marginBottom: 0, letterSpacing: 0 },

  // Map preview
  mapPreview: {
    height: 145,
    backgroundColor: '#E9ECEF',
    borderRadius: 18,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  mapGridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  mapGridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  mapArc: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: RED, borderStyle: 'dashed', opacity: 0.18,
    left: '27%', top: '6%',
  },
  markerGroup: { position: 'absolute', alignItems: 'center' },
  markerDot:   { width: 14, height: 14, borderRadius: 7, backgroundColor: '#111', borderWidth: 2.5, borderColor: WHITE },
  markerHome:  { width: 24, height: 24, borderRadius: 12, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center' },
  markerName:  { fontSize: 10, fontWeight: '700', color: '#333', marginTop: 3, letterSpacing: 0 },

  // Canvas preview
  canvasPreview: {
    height: 145,
    backgroundColor: WHITE,
    borderRadius: 18,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paperLine:       { position: 'absolute', left: 16, right: 16, height: 1, backgroundColor: 'rgba(0,0,0,0.04)' },
  heartGlyph:      { fontSize: 54, color: RED, opacity: 0.45 },
  paraText:        { fontSize: 17, fontStyle: 'italic', color: '#444', fontWeight: '600', marginTop: 4, letterSpacing: 0 },
  cornerBadge:     { position: 'absolute', top: 10, right: 10, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  cornerBadgeText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0 },
  authorBadge:     { position: 'absolute', bottom: 9, backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
  authorBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 0 },

  // Shared info row (bottom of both cards)
  infoRow:    { flexDirection: 'row', alignItems: 'center' },
  infoItem:   { fontSize: 12, fontWeight: '600', color: GRAY, letterSpacing: 0 },
  infoBullet: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB', marginHorizontal: 7 },

  // Counter thin divider
  dividerWrap:   { alignItems: 'center', marginVertical: 10 },
  dividerRow:    { flexDirection: 'row', alignItems: 'center', width: '100%' },
  dividerLine:   { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  dividerText:   { fontSize: 12, fontWeight: '600', color: '#71717A', paddingHorizontal: 12, letterSpacing: 0 },
  dividerAccent: { color: RED },
  dividerSub:    { fontSize: 10, color: '#52525B', marginTop: 4, letterSpacing: 0 },

  // Shortcut cards
  shortcutRow:  { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 22 },
  shortcut:     { flex: 1, backgroundColor: CHIP_BG, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: BORDER },
  shortcutIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  shortcutTitle:{ color: WHITE, fontSize: 13, fontWeight: '700', letterSpacing: 0, marginBottom: 3 },
  shortcutSub:  { color: MUTED, fontSize: 12, lineHeight: 16 },

  sectionLabel: { fontSize: 16, fontWeight: '700', color: WHITE, marginBottom: 9, letterSpacing: 0 },
});

const wg = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', backgroundColor: CHIP_BG, borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  icon:  { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { color: WHITE, fontSize: 14, fontWeight: '700', letterSpacing: 0, marginBottom: 2 },
  sub:   { color: MUTED, fontSize: 12 },
});
