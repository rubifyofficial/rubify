import { BlurMask, Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import getStroke from 'perfect-freehand';
import React, { useMemo } from 'react';
import { View } from 'react-native';

export type DrawingPoint = { x: number; y: number; t: number; pressure?: number };
export type DrawingBrushDot = { x: number; y: number; r: number; a: number };
export type DrawingBrushType = 'pencil' | 'marker' | 'pen' | 'spray' | 'highlighter' | 'watercolor' | 'eraser';
export type DrawingPreviewBrushType = Exclude<DrawingBrushType, 'eraser'>;

export type DrawingStroke = {
  id: string;
  brush: DrawingBrushType;
  color: string;
  width: number;
  opacity: number;
  points: DrawingPoint[];
  d: string;
  fillD?: string;
  grain?: DrawingBrushDot[];
};

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function smoothPoints(points: DrawingPoint[], strength: number): DrawingPoint[] {
  if (points.length < 3) return points;
  const t = clampNumber(strength, 0, 1);
  if (t <= 0) return points;

  const nextPoints: DrawingPoint[] = [];
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
      pressure: cur.pressure,
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

export function fnv1aHash(input: string): number {
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

function getColorLuma(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.2;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getFreehandOptions(brushType: DrawingBrushType, width: number) {
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
    case 'eraser':
      return {
        size: width,
        thinning: 0,
        smoothing: 0.72,
        streamline: 0.55,
        simulatePressure: false,
      };
    case 'pencil':
    case 'spray':
    case 'watercolor':
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

function buildFreehandFillPath(points: DrawingPoint[], brushType: DrawingBrushType, width: number): string {
  if (points.length < 2) return '';
  const input = points.map((p) => [p.x, p.y, clampNumber(p.pressure ?? 0.5, 0.1, 1)]);
  const outline = getStroke(input as any, getFreehandOptions(brushType, width) as any) as number[][];
  return getSvgPathFromStroke(outline);
}

export function buildGrainDotsForSegment(
  a: DrawingPoint,
  b: DrawingPoint,
  width: number,
  opacity: number,
  seed: number,
  currentCount: number,
  maxDots: number
): DrawingBrushDot[] {
  if (currentCount >= maxDots) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 0) return [];

  const spacing = clampNumber(width * 1.3, 7, 14);
  const radius = clampNumber(width * 0.55, 3.5, 9);
  const steps = clampNumber(Math.ceil(dist / spacing), 1, 6);
  const rand = mulberry32((seed ^ 0x243f6a88) + currentCount * 911);
  const dots: DrawingBrushDot[] = [];
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

export function getMinVisibleOpacity(brush: DrawingBrushType, color: string): number {
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

export function getBrushMinDistance(brush: DrawingBrushType, width: number): number {
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
      return clampNumber(5.4 + width * 0.18, 5.4, 8.6);
    case 'watercolor':
      return clampNumber(8.6 + width * 0.28, 8.6, 12);
    case 'eraser':
      return clampNumber(2.8 + width * 0.12, 2.8, 5.5);
    default:
      return 4;
  }
}

export function shouldAddPoint(prev: DrawingPoint | null, next: DrawingPoint, minDistance: number, maxDistance = 85): boolean {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < minDistance * minDistance) return false;
  if (distSq > maxDistance * maxDistance) return false;
  return true;
}

export function getBrushSmoothing(brush: DrawingBrushType): number {
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
    case 'eraser':
      return 0.28;
    default:
      return 0.4;
  }
}

export function getBrushWidthMultiplier(brush: DrawingBrushType): number {
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
    case 'eraser':
      return 1.7;
    default:
      return 1;
  }
}

export function getBrushOpacityMultiplier(brush: DrawingBrushType): number {
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

export function buildStrokePaths(points: DrawingPoint[], brush: DrawingBrushType, width: number): { d: string; fillD?: string } {
  const smoothed = smoothPoints(points, getBrushSmoothing(brush));
  const d = buildSmoothSvgPath(smoothed);
  const fillD =
    brush === 'spray' || brush === 'watercolor' ? undefined : buildFreehandFillPath(points, brush, width) || undefined;
  return { d, fillD };
}

export function createPreviewStroke(brush: DrawingPreviewBrushType): DrawingStroke {
  const previewColor = '#B2547C';
  const previewSize = 8;
  const baseOpacity = 0.85;
  const width = clampNumber(previewSize * getBrushWidthMultiplier(brush), 1, 22);
  const opacity = clampNumber(
    Math.max(getMinVisibleOpacity(brush, previewColor), baseOpacity * getBrushOpacityMultiplier(brush)),
    0.04,
    1
  );
  const id = `preview-${brush}`;
  const points: DrawingPoint[] = [
    { x: 4, y: 14, t: 0, pressure: 0.6 },
    { x: 16, y: 6, t: 16, pressure: 0.4 },
    { x: 28, y: 12, t: 32, pressure: 0.7 },
    { x: 40, y: 6, t: 48, pressure: 0.45 },
  ];
  const { d, fillD } = buildStrokePaths(points, brush, width);

  if (brush === 'pencil') {
    const grain: DrawingBrushDot[] = [];
    const max = 34;
    const seed = fnv1aHash(id);
    for (let i = 1; i < points.length; i += 1) {
      const seg = buildGrainDotsForSegment(points[i - 1], points[i], width, opacity, seed, grain.length, max);
      if (seg.length > 0) grain.push(...seg);
    }
    return { id, brush, color: previewColor, width, opacity, points: [], d, fillD, grain };
  }

  return { id, brush, color: previewColor, width, opacity, points: [], d, fillD };
}

export function toRenderableStroke(stroke: DrawingStroke | null): DrawingStroke | null {
  if (!stroke) return null;
  return {
    id: stroke.id,
    brush: stroke.brush,
    color: stroke.color,
    width: stroke.width,
    opacity: stroke.opacity,
    points: [],
    d: stroke.d,
    fillD: stroke.fillD,
    grain: stroke.grain ? [...stroke.grain] : undefined,
  };
}

export const DrawingStrokeLayer = React.memo(function DrawingStrokeLayer({
  stroke,
  keySuffix,
  backgroundColor,
}: {
  stroke: DrawingStroke;
  keySuffix: string;
  backgroundColor?: string;
}) {
  const skPath = useMemo(() => {
    const p = Skia.Path.MakeFromSVGString(stroke.d);
    return p ?? Skia.Path.Make();
  }, [stroke.d]);
  const skFillPath = useMemo(() => {
    if (!stroke.fillD) return null;
    const p = Skia.Path.MakeFromSVGString(stroke.fillD);
    return p ?? null;
  }, [stroke.fillD]);

  if (stroke.brush === 'spray') {
    return (
      <Group>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 3.1} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.1}>
          <BlurMask blur={stroke.width * 1.15} style="normal" />
        </Path>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 1.95} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.18}>
          <BlurMask blur={stroke.width * 0.42} style="normal" />
        </Path>
        <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 0.95} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.12}>
          <BlurMask blur={stroke.width * 0.12} style="normal" />
        </Path>
      </Group>
    );
  }

  if (stroke.brush === 'highlighter') {
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

  if (stroke.brush === 'marker') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  if (stroke.brush === 'watercolor') {
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

  if (stroke.brush === 'pencil') {
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

  if (stroke.brush === 'pen') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <Path path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  if (stroke.brush === 'eraser') {
    const fill = skFillPath ?? skPath;
    return <Path path={fill} color={backgroundColor ?? '#FFFFFF'} style="fill" opacity={1} />;
  }

  return <Path path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" opacity={stroke.opacity} />;
});

export const DrawingBrushPreview = React.memo(function DrawingBrushPreview({
  brush,
  style,
  canvasStyle,
  backgroundColor,
}: {
  brush: DrawingPreviewBrushType;
  style?: any;
  canvasStyle?: any;
  backgroundColor?: string;
}) {
  const previewStroke = useMemo(() => createPreviewStroke(brush), [brush]);

  return (
    <View style={style}>
      <Canvas style={canvasStyle} pointerEvents="none">
        <DrawingStrokeLayer stroke={previewStroke} keySuffix="p" backgroundColor={backgroundColor} />
      </Canvas>
    </View>
  );
});
