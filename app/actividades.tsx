import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Heart, HelpCircle, MessageCircle, Plus, RotateCw, Sparkles, X } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  bg: '#FFFDFE',
  card: '#FFF7FA',
  ink: '#241D22',
  muted: '#9D8F98',
  white: '#FFFFFF',
  pink: '#E88BA1',
  pinkSoft: '#F49CAF',
  border: 'rgba(232, 139, 161, 0.18)',
  chip: '#FFF5F9',
  chipActive: '#FCE1EA',
  shadow: 'rgba(232, 139, 161, 0.16)',
  overlay: 'rgba(24, 16, 20, 0.35)',
};

type ActivityCategory = 'game' | 'challenge' | 'date' | 'home';
type CategoryChip = 'all' | ActivityCategory;

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  tag: string;
  category: ActivityCategory;
  section: 'games' | 'challenges' | 'dates';
  icon: 'heart' | 'message' | 'sparkles' | 'rotate' | 'help';
};

function getIcon(name: ActivityItem['icon']) {
  switch (name) {
    case 'heart':
      return Heart;
    case 'message':
      return MessageCircle;
    case 'rotate':
      return RotateCw;
    case 'help':
      return HelpCircle;
    case 'sparkles':
    default:
      return Sparkles;
  }
}

export default function ActividadesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedChip, setSelectedChip] = useState<CategoryChip>('all');
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [completedIds, setCompletedIds] = useState<Record<string, true>>({});
  const addIndexRef = useRef(0);
  const [extraActivities, setExtraActivities] = useState<ActivityItem[]>([]);

  const baseActivities = useMemo<ActivityItem[]>(
    () => [
      {
        id: 'game-love-questions',
        title: 'Preguntas de amor',
        description: 'Respondan preguntas dulces para conocerse mejor.',
        tag: 'JUEGO',
        category: 'game',
        section: 'games',
        icon: 'message',
      },
      {
        id: 'game-plan-wheel',
        title: 'Ruleta de planes',
        description: 'Dejen que Usfully elija qué harán hoy.',
        tag: 'SORPRESA',
        category: 'game',
        section: 'games',
        icon: 'rotate',
      },
      {
        id: 'game-would-you-rather',
        title: '¿Qué prefieres?',
        description: 'Elijan entre dos opciones y descubran coincidencias.',
        tag: 'JUEGO',
        category: 'game',
        section: 'games',
        icon: 'help',
      },
      {
        id: 'challenge-20s-hug',
        title: 'Abrazo de 20 segundos',
        description: 'Un reto pequeño para sentirse más cerca.',
        tag: 'RETO',
        category: 'challenge',
        section: 'challenges',
        icon: 'heart',
      },
      {
        id: 'challenge-sweet-message',
        title: 'Mensaje bonito',
        description: 'Escriban algo que aman del otro.',
        tag: 'AMOR',
        category: 'challenge',
        section: 'challenges',
        icon: 'message',
      },
      {
        id: 'challenge-moment-photo',
        title: 'Foto del momento',
        description: 'Tomen una foto y guárdenla como recuerdo.',
        tag: 'RECUERDO',
        category: 'challenge',
        section: 'challenges',
        icon: 'sparkles',
      },
      {
        id: 'date-romantic-dinner',
        title: 'Cena romántica',
        description: 'Un momento especial para compartir sin prisas.',
        tag: 'CITA',
        category: 'date',
        section: 'dates',
        icon: 'heart',
      },
      {
        id: 'date-movie-night',
        title: 'Noche de película',
        description: 'Elijan una película y preparen algo rico.',
        tag: 'EN CASA',
        category: 'home',
        section: 'dates',
        icon: 'sparkles',
      },
      {
        id: 'date-walk-no-plan',
        title: 'Paseo sin plan',
        description: 'Salgan a caminar y descubran un lugar nuevo.',
        tag: 'CITA',
        category: 'date',
        section: 'dates',
        icon: 'rotate',
      },
      {
        id: 'date-cook-together',
        title: 'Cocinar juntos',
        description: 'Preparen una receta sencilla en pareja.',
        tag: 'PLAN',
        category: 'home',
        section: 'dates',
        icon: 'message',
      },
    ],
    []
  );

  const addPool = useMemo<ActivityItem[]>(
    () => [
      {
        id: 'add-01',
        title: 'Desayuno sorpresa',
        description: 'Pequeños detalles que cambian el día.',
        tag: 'AMOR',
        category: 'home',
        section: 'dates',
        icon: 'sparkles',
      },
      {
        id: 'add-02',
        title: 'Playlist juntos',
        description: 'Armen una lista con canciones de ustedes.',
        tag: 'EN CASA',
        category: 'home',
        section: 'dates',
        icon: 'message',
      },
      {
        id: 'add-03',
        title: 'Mini reto: cumplido',
        description: 'Digan un cumplido sincero ahora mismo.',
        tag: 'RETO',
        category: 'challenge',
        section: 'challenges',
        icon: 'heart',
      },
    ],
    []
  );

  const allActivities = useMemo(() => [...baseActivities, ...extraActivities], [baseActivities, extraActivities]);
  const isCompleted = useCallback((id: string) => !!completedIds[id], [completedIds]);

  const filteredActivities = useMemo(() => {
    const visible = allActivities.filter((item) => !isCompleted(item.id));
    if (selectedChip === 'all') return visible;
    return visible.filter((item) => item.category === selectedChip);
  }, [allActivities, isCompleted, selectedChip]);

  const completedActivities = useMemo(() => allActivities.filter((item) => isCompleted(item.id)), [allActivities, isCompleted]);

  const heroActivity = useMemo(() => {
    const preferred = filteredActivities.find((item) => item.id === 'date-romantic-dinner') ?? null;
    return preferred || filteredActivities[0] || null;
  }, [filteredActivities]);

  const handleAddQuickIdea = useCallback(() => {
    const idx = addIndexRef.current % addPool.length;
    addIndexRef.current += 1;
    const pick = addPool[idx];
    const next: ActivityItem = { ...pick, id: `${pick.id}-${Date.now()}` };
    setExtraActivities((prev) => [next, ...prev]);
  }, [addPool]);

  const handleOpenActivity = useCallback((activity: ActivityItem) => {
    setSelectedActivity(activity);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedActivity(null);
  }, []);

  const handleMarkAsDone = useCallback(() => {
    if (!selectedActivity) return;
    const id = selectedActivity.id;
    setCompletedIds((prev) => ({ ...prev, [id]: true }));
    setSelectedActivity(null);
  }, [selectedActivity]);

  const headerRightStyle: ViewStyle = useMemo(
    () => ({
      paddingRight: 18,
    }),
    []
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <ArrowLeft size={22} color={COLORS.ink} />
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>Actividades</Text>
          <Text style={s.headerSub}>Planes, juegos y retos para ustedes</Text>
        </View>
        <View style={headerRightStyle}>
          <Pressable style={s.addIconBtn} onPress={handleAddQuickIdea} accessibilityRole="button" accessibilityLabel="Agregar idea">
            <Plus size={22} color={COLORS.white} strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <View style={s.heroTopRow}>
            <View style={s.heroLabelPill}>
              <Sparkles size={14} color={COLORS.pink} />
              <Text style={s.heroLabelText}>Plan de hoy</Text>
            </View>
          </View>
          <Text style={s.heroTitle}>{heroActivity?.title ?? 'Plan de hoy'}</Text>
          <Text style={s.heroDesc}>{heroActivity?.description ?? 'Elijan algo bonito para compartir.'}</Text>
          <Pressable
            style={[s.heroButton, !heroActivity && { opacity: 0.6 }]}
            disabled={!heroActivity}
            onPress={() => {
              if (heroActivity) handleOpenActivity(heroActivity);
            }}
            accessibilityRole="button"
            accessibilityLabel="Empezar plan"
          >
            <Text style={s.heroButtonText}>Empezar plan</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'game', label: 'Juegos' },
              { key: 'challenge', label: 'Retos' },
              { key: 'date', label: 'Citas' },
              { key: 'home', label: 'En casa' },
            ] as const
          ).map((chip) => {
            const active = selectedChip === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setSelectedChip(chip.key)}
                style={[s.chip, active && s.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={s.sectionTitle}>Juegos para dos</Text>
        <View style={s.cardsGrid}>
          {filteredActivities
            .filter((a) => a.section === 'games')
            .map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Pressable key={item.id} style={s.activityCard} onPress={() => handleOpenActivity(item)} accessibilityRole="button">
                  <View style={s.cardTopRow}>
                    <View style={s.cardIcon}>
                      <Icon size={18} color={COLORS.pink} strokeWidth={2.2} />
                    </View>
                    <View style={s.cardTagPill}>
                      <Text style={s.cardTagText}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <Text style={[s.sectionTitle, { marginTop: 18 }]}>Retos dulces</Text>
        <View style={s.cardsGrid}>
          {filteredActivities
            .filter((a) => a.section === 'challenges')
            .map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Pressable key={item.id} style={s.activityCard} onPress={() => handleOpenActivity(item)} accessibilityRole="button">
                  <View style={s.cardTopRow}>
                    <View style={s.cardIcon}>
                      <Icon size={18} color={COLORS.pink} strokeWidth={2.2} />
                    </View>
                    <View style={s.cardTagPill}>
                      <Text style={s.cardTagText}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <Text style={[s.sectionTitle, { marginTop: 18 }]}>Ideas para cita</Text>
        <View style={s.cardsGrid}>
          {filteredActivities
            .filter((a) => a.section === 'dates')
            .map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Pressable key={item.id} style={s.activityCard} onPress={() => handleOpenActivity(item)} accessibilityRole="button">
                  <View style={s.cardTopRow}>
                    <View style={s.cardIcon}>
                      <Icon size={18} color={COLORS.pink} strokeWidth={2.2} />
                    </View>
                    <View style={s.cardTagPill}>
                      <Text style={s.cardTagText}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <Text style={[s.sectionTitle, { marginTop: 20 }]}>Recuerdos completados</Text>
        {completedActivities.length === 0 ? (
          <Text style={s.completedEmpty}>Cuando terminen una actividad, aparecerá aquí.</Text>
        ) : (
          <View style={s.completedRow}>
            {completedActivities.map((item) => (
              <View key={item.id} style={s.completedPill}>
                <Text style={s.completedTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={s.completedTag}>{item.tag}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedActivity} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={s.modalBackdrop}>
          <Pressable style={s.modalDismiss} onPress={handleCloseModal} />
          <View style={s.modalSheet}>
            <View style={s.modalHeaderRow}>
              <View style={s.modalTitleWrap}>
                <Text style={s.modalTitle}>{selectedActivity?.title ?? ''}</Text>
                <View style={s.modalTagPill}>
                  <Text style={s.modalTagText}>{selectedActivity?.tag ?? ''}</Text>
                </View>
              </View>
              <Pressable style={s.modalClose} onPress={handleCloseModal} accessibilityRole="button" accessibilityLabel="Cerrar">
                <X size={18} color={COLORS.muted} />
              </Pressable>
            </View>
            <Text style={s.modalDesc}>{selectedActivity?.description ?? ''}</Text>

            <Pressable style={s.modalPrimaryBtn} onPress={handleMarkAsDone} accessibilityRole="button" accessibilityLabel="Marcar como hecho">
              <Check size={18} color={COLORS.white} strokeWidth={2.6} />
              <Text style={s.modalPrimaryText}>Marcar como hecho</Text>
            </Pressable>

            <Pressable style={s.modalSecondaryBtn} onPress={handleCloseModal} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Text style={s.modalSecondaryText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 66, marginBottom: 8 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 5,
  },
  headerTitleWrap: { flex: 1, paddingHorizontal: 12, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
  headerSub: { fontSize: 12.5, color: COLORS.muted, marginTop: 3 },
  addIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.pink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  content: { paddingHorizontal: 18, paddingTop: 8 },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  heroLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroLabelText: { fontSize: 12, fontWeight: '800', color: COLORS.ink, letterSpacing: 0.3 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
  heroDesc: { fontSize: 13.5, lineHeight: 20, color: COLORS.muted, marginBottom: 14 },
  heroButton: { height: 44, borderRadius: 14, backgroundColor: COLORS.pink, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  chipsRow: { paddingTop: 14, paddingBottom: 6, gap: 10, paddingHorizontal: 2 },
  chip: { backgroundColor: COLORS.chip, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.chipActive, borderColor: 'rgba(232, 139, 161, 0.35)' },
  chipText: { color: COLORS.muted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: COLORS.ink },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 10, marginTop: 18 },
  cardsGrid: { gap: 12 },
  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTagPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  cardTagText: { fontSize: 11, fontWeight: '900', color: COLORS.pink, letterSpacing: 0.3 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink, marginBottom: 4 },
  cardDesc: { fontSize: 12.5, lineHeight: 18, color: COLORS.muted },
  completedEmpty: { color: COLORS.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 2 },
  completedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  completedPill: {
    width: (SCREEN_WIDTH - 18 * 2 - 10) / 2,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  completedTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  completedTag: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  modalTitleWrap: { flex: 1, paddingRight: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.ink, marginBottom: 8 },
  modalTagPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  modalTagText: { fontSize: 11, fontWeight: '900', color: COLORS.pink, letterSpacing: 0.3 },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF8FB',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDesc: { color: COLORS.muted, fontSize: 13.5, lineHeight: 20, marginBottom: 14 },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.pink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalPrimaryText: { color: COLORS.white, fontSize: 14, fontWeight: '900' },
  modalSecondaryBtn: { height: 46, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
});
