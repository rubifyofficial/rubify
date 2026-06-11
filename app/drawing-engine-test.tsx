import Slider from '@react-native-community/slider';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import getStroke from 'perfect-freehand';

type Point = { x: number; y: number; t: number; pressure?: number };
type BrushDot = { x: number; y: number; r: number; a: number };

type BrushType = 'pencil' | 'marker' | 'pen' | 'spray' | 'highlighter' | 'watercolor';

type Stroke = {
  id: string;
  brush: BrushType;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  d: string;
  fillD?: string;
  dots?: BrushDot[];
  grain?: BrushDot[];
};

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
] as const;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function smoothPoints(points: Point[], strength: number): Point[] {
  if (points.length < 3) return points;
  const t = clampNumber(strength, 0, 1);
  if (t <= 0) return points;

  const nextPoints: Point[] = [];
  nextPoints.push(points[0]);
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const sx = (prev.x + cur.x * 2 + next.x) / 4;
    const sy = (prev.y + cur.y * 2 + next.y) / 4;
    nextPoints.push({
      x: cur.x + (sx - cur.x) * t,
      y: cur.y + (sy - cur.y) * t,
      t: cur.t,
    });
  }
  nextPoints.push(points[points.length - 1]);
  return nextPoints;
}

function buildSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const parts: string[] = [];
  parts.push(`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
  if (points.length === 1) return parts.join(' ');

  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const next = points[i + 1];
    const midX = (p.x + next.x) / 2;
    const midY = (p.y + next.y) / 2;
    parts.push(`Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`);
  }
  const last = points[points.length - 1];
  parts.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return parts.join(' ');
}

function fnv1aHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function getSvgPathFromStroke(outline: number[][]) {
  if (!outline.length) return '';

  const d = outline.reduce<any[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...outline[0], 'Q'] as any[]
  );

  d.push('Z');
  return d.join(' ');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

function mixHex(base: string, other: string, amount: number): string {
  const a = clampNumber(amount, 0, 1);
  const c0 = hexToRgb(base);
  const c1 = hexToRgb(other);
  if (!c0 || !c1) return base;
  const r = Math.round(c0.r * (1 - a) + c1.r * a);
  const g = Math.round(c0.g * (1 - a) + c1.g * a);
  const b = Math.round(c0.b * (1 - a) + c1.b * a);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getFreehandOptions(brushType: BrushType, width: number) {
  switch (brushType) {
    case 'marker':
      return {
        size: width * 1.05,
        thinning: 0.02,
        smoothing: 0.72,
        streamline: 0.55,
        simulatePressure: false,
      };
    case 'highlighter':
      return {
        size: width * 1.35,
        thinning: 0,
        smoothing: 0.8,
        streamline: 0.62,
        simulatePressure: false,
      };
    case 'pen':
      return {
        size: Math.max(2.2, width * 0.9),
        thinning: 0.78,
        smoothing: 0.82,
        streamline: 0.62,
        simulatePressure: true,
        start: { taper: width * 1.2 },
        end: { taper: width * 1.5 },
      };
    case 'pencil':
    default:
      return {
        size: width,
        thinning: 0.28,
        smoothing: 0.6,
        streamline: 0.35,
        simulatePressure: true,
      };
  }
}

function buildFreehandFillPath(points: Point[], brushType: BrushType, width: number): string {
  if (points.length < 2) return '';
  const input = points.map((p) => [p.x, p.y, clampNumber(p.pressure ?? 0.5, 0.1, 1)]);
  const outline = getStroke(input as any, getFreehandOptions(brushType, width) as any) as number[][];
  return getSvgPathFromStroke(outline);
}

function buildGrainDotsForSegment(
  a: Point,
  b: Point,
  width: number,
  opacity: number,
  seed: number,
  currentCount: number,
  maxDots: number
): BrushDot[] {
  if (currentCount >= maxDots) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 0) return [];

  const spacing = clampNumber(width * 1.3, 7, 14);
  const radius = clampNumber(width * 0.55, 3.5, 9);
  const steps = clampNumber(Math.ceil(dist / spacing), 1, 6);
  const rand = mulberry32((seed ^ 0x243f6a88) + currentCount * 911);
  const dots: BrushDot[] = [];
  const maxAllowed = Math.min(18, maxDots - currentCount);

  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const baseX = a.x + dx * t;
    const baseY = a.y + dy * t;
    for (let k = 0; k < 1; k += 1) {
      if (dots.length >= maxAllowed) return dots;
      const angle = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * radius;
      const x = baseX + Math.cos(angle) * rr;
      const y = baseY + Math.sin(angle) * rr;
      const r = clampNumber(width * (0.06 + rand() * 0.12), 0.55, width * 0.22);
      const a0 = clampNumber(opacity * (0.03 + rand() * 0.06), 0.01, 0.14);
      dots.push({ x, y, r, a: a0 });
    }
  }

  return dots;
}

function getColorLuma(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getMinVisibleOpacity(brush: BrushType, color: string): number {
  const luma = getColorLuma(color);
  const boost = luma > 0.86 ? 0.06 : luma > 0.78 ? 0.04 : 0;
  switch (brush) {
    case 'spray':
      return 0.2 + boost;
    case 'highlighter':
      return 0.18 + boost;
    case 'watercolor':
      return 0.2 + boost;
    default:
      return 0.08 + boost;
  }
}

function getBrushMinDistance(brush: BrushType, width: number): number {
  switch (brush) {
    case 'pencil':
      return clampNumber(3 + width * 0.12, 3, 4.2);
    case 'pen':
      return clampNumber(2.6 + width * 0.1, 2.6, 4.1);
    case 'marker':
      return clampNumber(5.2 + width * 0.18, 5.2, 7.2);
    case 'highlighter':
      return clampNumber(6.2 + width * 0.22, 6.2, 9.8);
    case 'spray':
      return clampNumber(8.6 + width * 0.3, 8.6, 12);
    case 'watercolor':
      return clampNumber(8.6 + width * 0.28, 8.6, 12);
    default:
      return 4;
  }
}

function shouldAddPoint(prev: Point | null, next: Point, minDistance: number, maxDistance = 85): boolean {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < minDistance * minDistance) return false;
  if (distSq > maxDistance * maxDistance) return false;
  return true;
}

function sampleCenteredOffset(rand: () => number, sigma: number): number {
  // Fast gaussian-like distribution without expensive Box-Muller math.
  return ((rand() + rand() + rand() + rand()) - 2) * sigma;
}

const MAX_SPRAY_PARTICLES_PER_STROKE = 220;
const MAX_SPRAY_PARTICLES_PER_SEGMENT = 16;

function buildSprayDotsForSegment(
  a: Point,
  b: Point,
  width: number,
  opacity: number,
  seed: number,
  currentCount: number
): BrushDot[] {
  if (currentCount >= MAX_SPRAY_PARTICLES_PER_STROKE) return [];

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 0) return [];

  const brushRadius = clampNumber(width * 0.74, 4.2, 10.5);
  const spacing = clampNumber(brushRadius * 1.65, 10, 16);
  const steps = clampNumber(Math.ceil(dist / spacing), 1, 4);
  const rand = mulberry32(seed + currentCount * 977);
  const dots: BrushDot[] = [];
  const maxAllowed = Math.min(MAX_SPRAY_PARTICLES_PER_SEGMENT, MAX_SPRAY_PARTICLES_PER_STROKE - currentCount);

  for (let s = 0; s <= steps; s += 1) {
    const t = steps === 0 ? 0 : s / steps;
    const baseX = a.x + dx * t;
    const baseY = a.y + dy * t;
    const particlesThisStep = clampNumber(4 + Math.round(rand() * 2), 4, 6);

    for (let k = 0; k < particlesThisStep; k += 1) {
      if (dots.length >= maxAllowed) return dots;
      const offsetX = sampleCenteredOffset(rand, brushRadius * 0.46);
      const offsetY = sampleCenteredOffset(rand, brushRadius * 0.46);
      const edgeWeight = clampNumber(Math.hypot(offsetX, offsetY) / brushRadius, 0, 1.25);
      const centerWeight = clampNumber(1 - edgeWeight, 0, 1);
      if (edgeWeight > 1 && rand() > 0.22) continue;

      const x = baseX + offsetX;
      const y = baseY + offsetY;
      const r = clampNumber(brushRadius * (0.09 + rand() * 0.18), 0.45, 1.65);
      const a0 = clampNumber(opacity * (0.028 + centerWeight * 0.1 + rand() * 0.02), 0.014, 0.14);
      dots.push({ x, y, r, a: a0 });
    }
  }

  return dots;
}

function getBrushSmoothing(brush: BrushType): number {
  switch (brush) {
    case 'pen':
      return 0.66;
    case 'pencil':
      return 0.42;
    case 'marker':
      return 0.28;
    case 'highlighter':
      return 0.46;
    case 'spray':
      return 0.55;
    case 'watercolor':
      return 0.52;
    default:
      return 0.4;
  }
}

function getBrushWidthMultiplier(brush: BrushType): number {
  switch (brush) {
    case 'pencil':
      return 0.95;
    case 'pen':
      return 0.65;
    case 'marker':
      return 1.95;
    case 'highlighter':
      return 3.1;
    case 'spray':
      return 1.7;
    case 'watercolor':
      return 2.2;
    default:
      return 1;
  }
}

function getBrushOpacityMultiplier(brush: BrushType): number {
  switch (brush) {
    case 'marker':
      return 1;
    case 'pencil':
      return 0.9;
    case 'pen':
      return 0.86;
    case 'spray':
      return 0.6;
    case 'highlighter':
      return 0.26;
    case 'watercolor':
      return 0.34;
    default:
      return 1;
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function StrokeLayer({ stroke, keySuffix }: { stroke: Stroke; keySuffix: string }) {
  const brush = stroke.brush;
  const skPath = useMemo(() => {
    const p = Skia.Path.MakeFromSVGString(stroke.d);
    return p ?? Skia.Path.Make();
  }, [stroke.d]);
  const skFillPath = useMemo(() => {
    if (!stroke.fillD) return null;
    const p = Skia.Path.MakeFromSVGString(stroke.fillD);
    return p ?? null;
  }, [stroke.fillD]);

  if (brush === 'spray') {
    const dots = stroke.dots ?? [];
    return (
      <Group>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 1.05} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.07}>
          <BlurMask blur={stroke.width * 0.16} style="normal" />
        </Path>
        {dots.map((d, i) => (
          <Circle key={`${stroke.id}-${keySuffix}-d-${i}`} cx={d.x} cy={d.y} r={d.r} color={stroke.color} opacity={d.a} />
        ))}
      </Group>
    );
  }

  if (brush === 'highlighter') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity * 0.22} blendMode="multiply">
          <BlurMask blur={stroke.width * 0.22} style="normal" />
        </Path>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity * 0.12} blendMode="multiply" />
      </Group>
    );
  }

  if (brush === 'marker') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  if (brush === 'watercolor') {
    return (
      <Group>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 1.35} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.18}>
          <BlurMask blur={stroke.width * 0.65} style="normal" />
        </Path>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.34}>
          <BlurMask blur={stroke.width * 0.28} style="normal" />
        </Path>
      </Group>
    );
  }

  if (brush === 'pencil') {
    const fill = skFillPath ?? skPath;
    const grain = stroke.grain ?? [];
    const pencilColor = mixHex(stroke.color, '#8E6D7D', 0.22);
    return (
      <Group>
        <Path path={fill} color={pencilColor} style="fill" opacity={stroke.opacity * 0.62} />
        {grain.map((d, i) => (
          <Circle key={`${stroke.id}-${keySuffix}-g-${i}`} cx={d.x} cy={d.y} r={d.r} color={pencilColor} opacity={d.a} />
        ))}
      </Group>
    );
  }

  if (brush === 'pen') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  return <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" opacity={stroke.opacity} />;
}

const CommittedStrokesLayer = React.memo(function CommittedStrokesLayer({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((st) => (
        <StrokeLayer key={st.id} stroke={st} keySuffix="s" />
      ))}
    </>
  );
});

const CurrentStrokeLayer = React.memo(function CurrentStrokeLayer({ stroke }: { stroke: Stroke | null }) {
  if (!stroke) return null;
  return <StrokeLayer stroke={stroke} keySuffix="c" />;
});

const BrushPreview = React.memo(function BrushPreview({ brush }: { brush: BrushType }) {
  const previewStroke = useMemo<Stroke>(() => {
    const previewColor = '#B2547C';
    const previewSize = 8;
    const baseOpacity = 0.85;
    const width = clampNumber(previewSize * getBrushWidthMultiplier(brush), 1, 22);
    const op = clampNumber(Math.max(getMinVisibleOpacity(brush, previewColor), baseOpacity * getBrushOpacityMultiplier(brush)), 0.04, 1);
    const id = `preview-${brush}`;
    const points: Point[] = [
      { x: 4, y: 14, t: 0, pressure: 0.6 },
      { x: 16, y: 6, t: 16, pressure: 0.4 },
      { x: 28, y: 12, t: 32, pressure: 0.7 },
      { x: 40, y: 6, t: 48, pressure: 0.45 },
    ];
    const smoothed = smoothPoints(points, getBrushSmoothing(brush));
    const d = buildSmoothSvgPath(smoothed);
    const fillD = brush === 'spray' || brush === 'watercolor' ? undefined : buildFreehandFillPath(points, brush, width);
    const seed = fnv1aHash(id);

    if (brush === 'spray') {
      const dots: BrushDot[] = [];
      for (let i = 1; i < points.length; i += 1) {
        const seg = buildSprayDotsForSegment(points[i - 1], points[i], width, op, seed, dots.length);
        if (seg.length > 0) dots.push(...seg);
      }
      return { id, brush, color: previewColor, width, opacity: op, points: [], d, dots };
    }

    if (brush === 'pencil') {
      const grain: BrushDot[] = [];
      const max = 34;
      for (let i = 1; i < points.length; i += 1) {
        const seg = buildGrainDotsForSegment(points[i - 1], points[i], width, op, seed, grain.length, max);
        if (seg.length > 0) grain.push(...seg);
      }
      return { id, brush, color: previewColor, width, opacity: op, points: [], d, fillD, grain };
    }

    return { id, brush, color: previewColor, width, opacity: op, points: [], d, fillD };
  }, [brush]);

  return (
    <View style={s.previewWrap}>
      <Canvas style={s.previewCanvas}>
        <StrokeLayer stroke={previewStroke} keySuffix="p" />
      </Canvas>
    </View>
  );
});

export default function DrawingEngineTestScreen() {
  const router = useRouter();
  const [brush, setBrush] = useState<BrushType>('pencil');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [size, setSize] = useState<number>(8);
  const [opacity, setOpacity] = useState<number>(0.9);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  const frameRef = useRef<number | null>(null);
  const strokeRef = useRef<Stroke | null>(null);

  const toRenderStroke = (st: Stroke | null): Stroke | null => {
    if (!st) return null;
    return {
      id: st.id,
      brush: st.brush,
      color: st.color,
      width: st.width,
      opacity: st.opacity,
      points: [],
      d: st.d,
      fillD: st.fillD,
      dots: st.dots ? [...st.dots] : undefined,
      grain: st.grain ? [...st.grain] : undefined,
    };
  };

  const schedule = () => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const st = strokeRef.current;
      if (st) {
        const smoothed = smoothPoints(st.points, getBrushSmoothing(st.brush));
        st.d = buildSmoothSvgPath(smoothed);
        if (st.brush !== 'spray' && st.brush !== 'watercolor') {
          st.fillD = buildFreehandFillPath(st.points, st.brush, st.width);
        }
      }
      setCurrentStroke(toRenderStroke(st));
    });
  };

  const panResponder = useMemo(() => {
    const start = (x: number, y: number) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const width = clampNumber(size * getBrushWidthMultiplier(brush), 1, 34);
      const p: Point = { x, y, t: Date.now(), pressure: 0.5 };
      const smoothed = smoothPoints([p], getBrushSmoothing(brush));
      const d = buildSmoothSvgPath(smoothed);
      const fillD =
        brush === 'spray' || brush === 'watercolor'
          ? undefined
          : buildFreehandFillPath([p], brush, width);
      const minVisible = getMinVisibleOpacity(brush, color);
      const op = clampNumber(Math.max(minVisible, opacity * getBrushOpacityMultiplier(brush)), 0.04, 1);
      const stroke: Stroke = {
        id,
        brush,
        color,
        width,
        opacity: op,
        points: [p],
        d,
        fillD,
        dots: brush === 'spray' ? [] : undefined,
        grain: brush === 'pencil' ? [] : undefined,
      };
      strokeRef.current = stroke;
      setCurrentStroke(toRenderStroke(stroke));
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
      const next: Point = { x, y, t: now, pressure: st.brush === 'pen' ? nextPressure : 0.5 };
      const prev = st.points[st.points.length - 1] ?? null;
      const minDistance = getBrushMinDistance(st.brush, st.width);
      if (!shouldAddPoint(prev, next, minDistance)) return;

      st.points.push(next);

      if (st.brush === 'spray') {
        const dots = st.dots ?? [];
        const seed = fnv1aHash(st.id);
        const newDots = buildSprayDotsForSegment(prev ?? next, next, st.width, st.opacity, seed, dots.length);
        if (newDots.length > 0) dots.push(...newDots);
        st.dots = dots;
      } else if (st.brush === 'pencil') {
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
      const finalized = toRenderStroke(st);
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
            const active = brush === (b.key as BrushType);
            return (
              <Pressable key={b.key} style={[s.chip, active && s.chipActive]} onPress={() => setBrush(b.key as BrushType)}>
                <View style={s.chipRow}>
                  <BrushPreview brush={b.key as BrushType} />
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
