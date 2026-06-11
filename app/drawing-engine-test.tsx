import Slider from '@react-native-community/slider';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  DrawingBrushPreview,
  DrawingBrushType,
  DrawingPoint,
  DrawingStroke,
  DrawingStrokeLayer,
  buildGrainDotsForSegment,
  buildStrokePaths,
  clampNumber,
  fnv1aHash,
  getBrushMinDistance,
  getBrushOpacityMultiplier,
  getBrushWidthMultiplier,
  getMinVisibleOpacity,
  shouldAddPoint,
  toRenderableStroke,
} from '../lib/drawing-engine';

const BG = '#FFFFFF';
const TEXT = '#4C2A3D';
const TEXT_SOFT = '#8E6D7D';
const BORDER = '#F1D7E2';
const PINK_STRONG = '#E88CAF';

const COLORS = [
  '#E88CAF',
  '#D94B8A',
  '#4C2A3D',
  '#5A3A2E',
  '#9B6EF3',
  '#3B82F6',
  '#34D399',
  '#F39C4A',
  '#E53935',
  '#1E1B1D',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CommittedStrokesLayer = React.memo(function CommittedStrokesLayer({ strokes }: { strokes: DrawingStroke[] }) {
  return (
    <>
      {strokes.map((st) => (
        <DrawingStrokeLayer key={st.id} stroke={st} keySuffix="s" backgroundColor="#FFF7FB" />
      ))}
    </>
  );
});

const CurrentStrokeLayer = React.memo(function CurrentStrokeLayer({ stroke }: { stroke: DrawingStroke | null }) {
  if (!stroke) return null;
  return <DrawingStrokeLayer stroke={stroke} keySuffix="c" backgroundColor="#FFF7FB" />;
});

export default function DrawingEngineTestScreen() {
  const router = useRouter();
  const [brush, setBrush] = useState<DrawingBrushType>('pencil');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(8);
  const [opacity, setOpacity] = useState<number>(0.9);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);

  const frameRef = useRef<number | null>(null);
  const strokeRef = useRef<DrawingStroke | null>(null);

  const schedule = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const st = strokeRef.current;
      if (st) {
        const nextPaths = buildStrokePaths(st.points, st.brush, st.width);
        st.d = nextPaths.d;
        st.fillD = nextPaths.fillD;
      }
      setCurrentStroke(toRenderableStroke(st));
    });
  };

  const panResponder = useMemo(() => {
    const start = (x: number, y: number) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const width = clampNumber(size * getBrushWidthMultiplier(brush), 1, 34);
      const p: DrawingPoint = { x, y, t: Date.now(), pressure: 0.5 };
      const { d, fillD } = buildStrokePaths([p], brush, width);
      const minVisible = getMinVisibleOpacity(brush, color);
      const op = clampNumber(Math.max(minVisible, opacity * getBrushOpacityMultiplier(brush)), 0.04, 1);
      const stroke: DrawingStroke = {
        id,
        brush,
        color,
        width,
        opacity: op,
        points: [p],
        d,
        fillD,
        grain: brush === 'pencil' ? [] : undefined,
      };
      strokeRef.current = stroke;
      setCurrentStroke(toRenderableStroke(stroke));
    };

    const move = (x: number, y: number) => {
      const st = strokeRef.current;
      if (!st) return;
      const now = Date.now();
      const last = st.points[st.points.length - 1] ?? null;
      const dt = Math.max(16, now - (last?.t ?? now));
      const dist = last ? Math.hypot(x - last.x, y - last.y) : 0;
      const speed = dist / dt;
      const nextPressure = clampNumber(1 - speed * 2.2, 0.14, 1);
      const next: DrawingPoint = { x, y, t: now, pressure: st.brush === 'pen' ? nextPressure : 0.5 };
      const prev = st.points[st.points.length - 1] ?? null;
      const minDistance = getBrushMinDistance(st.brush, st.width);
      if (!shouldAddPoint(prev, next, minDistance)) return;

      st.points.push(next);

      if (st.brush === 'pencil') {
        const grain = st.grain ?? [];
        const seed = fnv1aHash(st.id);
        const max = 220;
        const newDots = buildGrainDotsForSegment(prev ?? next, next, st.width, st.opacity, seed, grain.length, max);
        if (newDots.length > 0) grain.push(...newDots);
        st.grain = grain;
      }

      schedule();
    };

    const end = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      const st = strokeRef.current;
      strokeRef.current = null;
      setCurrentStroke(null);
      if (!st || st.points.length < 2) return;
      const nextPaths = buildStrokePaths(st.points, st.brush, st.width);
      st.d = nextPaths.d;
      st.fillD = nextPaths.fillD;
      const finalized = toRenderableStroke(st);
      if (!finalized) return;
      setStrokes((prev) => [finalized, ...prev]);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => start(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderMove: (evt) => move(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  }, [brush, color, opacity, size]);

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.headerButton} onPress={() => router.back()}>
            <Text style={s.headerButtonText}>Volver</Text>
          </Pressable>
          <View style={s.headerTitleWrap}>
            <Text style={s.title}>Drawing Engine Test</Text>
            <Text style={s.subtitle}>Pantalla aislada • sin Notas • sin Supabase</Text>
          </View>
          <Pressable
            style={[s.headerButton, s.headerButtonRight]}
            onPress={() => {
              if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
              }
              strokeRef.current = null;
              setCurrentStroke(null);
              setStrokes([]);
            }}
          >
            <Text style={s.headerButtonText}>Limpiar</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.canvasWrap} {...panResponder.panHandlers}>
        <Canvas style={StyleSheet.absoluteFill}>
          <CommittedStrokesLayer strokes={strokes} />
          <CurrentStrokeLayer stroke={currentStroke} />
        </Canvas>
      </View>

      <View style={s.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.brushRow}>
          {[
            { key: 'pencil', label: 'Lápiz' },
            { key: 'marker', label: 'Marcador' },
            { key: 'pen', label: 'Pluma' },
            { key: 'spray', label: 'Spray suave' },
            { key: 'highlighter', label: 'Resaltador' },
            { key: 'watercolor', label: 'Acuarela' },
          ].map((b) => {
            const active = brush === (b.key as DrawingBrushType);
            return (
              <Pressable key={b.key} style={[s.chip, active && s.chipActive]} onPress={() => setBrush(b.key as DrawingBrushType)}>
                <View style={s.chipRow}>
                  <DrawingBrushPreview brush={b.key as Exclude<DrawingBrushType, 'eraser'>} style={s.previewWrap} canvasStyle={s.previewCanvas} backgroundColor="#FFF7FB" />
                  <Text style={[s.chipText, active && s.chipTextActive]}>{b.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.sliderRow}>
          <Text style={s.sliderLabel}>Grosor</Text>
          <Slider
            style={s.slider}
            minimumValue={2}
            maximumValue={22}
            value={size}
            onValueChange={(v) => setSize(clampNumber(Number(v), 2, 22))}
            minimumTrackTintColor={PINK_STRONG}
            maximumTrackTintColor="#F3D2E0"
            thumbTintColor="#B2547C"
          />
        </View>

        <View style={s.sliderRow}>
          <Text style={s.sliderLabel}>Opacidad</Text>
          <Slider
            style={s.slider}
            minimumValue={0.12}
            maximumValue={1}
            value={opacity}
            onValueChange={(v) => setOpacity(clampNumber(Number(v), 0.12, 1))}
            minimumTrackTintColor={PINK_STRONG}
            maximumTrackTintColor="#F3D2E0"
            thumbTintColor={PINK_STRONG}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colorRow}>
          {COLORS.map((c) => {
            const active = color === c;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[s.colorDot, { backgroundColor: c }, active && s.colorDotActive]}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingTop: 14 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitleWrap: { flex: 1 },
  headerButton: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonRight: { minWidth: 72 },
  headerButtonText: { color: '#B2547C', fontSize: 12, fontWeight: '900' },
  title: { color: TEXT, fontSize: 18, fontWeight: '900' },
  subtitle: { marginTop: 2, color: TEXT_SOFT, fontSize: 12, fontWeight: '700' },
  canvasWrap: {
    height: Math.min(520, Math.max(320, SCREEN_WIDTH * 0.92)),
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFF7FB',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  panel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, gap: 10 },
  brushRow: { gap: 8, paddingVertical: 2 },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewWrap: { width: 44, height: 16, justifyContent: 'center', alignItems: 'center' },
  previewCanvas: { width: 44, height: 16 },
  chipActive: { backgroundColor: '#FFF0F6', borderColor: '#E2A8C1' },
  chipText: { color: TEXT_SOFT, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#B2547C' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderLabel: { width: 72, color: TEXT, fontSize: 12, fontWeight: '800' },
  slider: { flex: 1, height: 34 },
  colorRow: { gap: 10, paddingVertical: 2 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 42, 61, 0.12)',
  },
  colorDotActive: { borderColor: '#D77FA5', borderWidth: 2.5 },
});
