import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes';
import { Montserrat_500Medium, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite';
import Slider from '@react-native-community/slider';
import { BlurMask, Canvas, Circle, Group, Skia, Path as SkiaPath } from '@shopify/react-native-skia';
import { useFonts } from 'expo-font';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
    Brush,
    Check,
    ChevronLeft,
    Eraser,
    Heart,
    Image as ImageIcon,
    PaintBucket,
    Palette,
    Plus,
    Sparkles,
    Trash2,
    Type,
    X
} from 'lucide-react-native';
import getStroke from 'perfect-freehand';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Keyboard,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    DrawingBrushPreview as SharedDrawingBrushPreview,
    DrawingBrushType as SharedDrawingBrushType,
    DrawingPoint as SharedDrawingPoint,
    DrawingStroke as SharedDrawingStroke,
    DrawingStrokeLayer as SharedDrawingStrokeLayer,
    buildGrainDotsForSegment as buildSharedGrainDotsForSegment,
    buildStrokePaths as buildSharedStrokePaths,
    getBrushMinDistance as getSharedBrushMinDistance,
    getBrushOpacityMultiplier as getSharedBrushOpacityMultiplier,
    getBrushWidthMultiplier as getSharedBrushWidthMultiplier,
    getMinVisibleOpacity as getSharedMinVisibleOpacity,
    fnv1aHash as sharedFnv1aHash,
    shouldAddPoint as shouldAddSharedPoint
} from '../../lib/drawing-engine';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BG = '#FFF7FB';
const TEXT = '#4C2A3D';
const TEXT_SOFT = '#8E6D7D';
const PINK = '#F8DCE8';
const PINK_STRONG = '#E88CAF';
const LILAC = '#E9E0FA';
const CREAM = '#FFF7EF';
const WHITE = '#FFFFFF';
const BORDER = '#F1D7E2';
const SHADOW = 'rgba(107, 57, 83, 0.12)';

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

type StoredDrawingData = {
  version?: number;
  backgroundColor?: string;
  photos?: Array<{ uri?: string | null }>;
  texts?: Array<{ text?: string | null }>;
  stickers?: Array<{ sticker?: string | null }>;
  strokes?: Array<unknown>;
};

type AlbumMemory = {
  id: string;
  authorLabel: string;
  isMine: boolean;
  dateLabel: string;
  imageUri: string | null;
  previewText: string;
  cardTone: 'pink' | 'cream' | 'lilac';
  backgroundColor: string;
  kindLabel: 'Texto' | 'Foto' | 'Dibujo' | 'Mixta';
};

type AlbumEntry = {
  id: string;
  createdAt: string;
  dateLabel: string;
  isMine: boolean;
  authorLabel: string;
  type: 'text' | 'photo' | 'drawing' | 'mixed';
  text: string | null;
  photoUrl: string | null;
  drawingUrl: string | null;
  previewImage: string | null;
  backgroundColor: string;
  kindLabel: AlbumMemory['kindLabel'];
};

type AlbumSpread = {
  id: string;
  left: AlbumEntry[];
  right: AlbumEntry[];
};

type DrawPoint = { x: number; y: number; t?: number; pressure?: number };
type EditorToolMode =
  | 'pencil'
  | 'marker'
  | 'pen'
  | 'spray'
  | 'highlighter'
  | 'watercolor'
  | 'eraser'
  | 'soft'
  | 'crayon';
type DrawStroke = SharedDrawingStroke;

type EditorPhotoElement = {
  id: string;
  uri: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
};

type EditorTextElement = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontVariant:
    | 'normal'
    | 'script'
    | 'maquina'
    | 'serif'
    | 'romantica'
    | 'fuerte'
    | 'elegante'
    | 'manuscrita'
    | 'divertida'
    | 'suave'
    | 'negrita';
  scale: number;
  rotation: number;
};

type EditorStickerElement = {
  id: string;
  sticker: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

type EditorCategory = 'pen' | 'text' | 'sticker' | 'bucket';
type EditorFontStyle = 'normal' | 'script' | 'maquina' | 'serif' | 'romantica' | 'fuerte';
const EDITOR_CANVAS_DEFAULT_BG = '#FFF7FB';
const EDITOR_BACKGROUND_COLORS = [
  '#FFF7FB',
  '#FFFFFF',
  '#FFFDF6',
  '#FFF6E5',
  '#F4E7D1',
  '#FFE1D6',
  '#FFE4EF',
  '#FADAE8',
  '#F1E8FF',
  '#EADCF8',
  '#E7F2FF',
  '#DDEEFF',
  '#E4F8EF',
  '#E8F1E4',
  '#FFF7C7',
  '#FFF0A8',
  '#FFD6C9',
  '#F3F4F6',
  '#EFEAE4',
] as const;

function fmtDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function parseStoredDrawingData(raw: string | null): StoredDrawingData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDrawingData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function getAlbumMemoryImageUri(note: DbNote, drawing: StoredDrawingData | null): string | null {
  if (typeof note.image_url === 'string' && note.image_url.trim().length > 0) return note.image_url.trim();
  const drawingPhoto = drawing?.photos?.find((item) => typeof item?.uri === 'string' && item.uri.trim().length > 0)?.uri?.trim();
  return drawingPhoto ?? null;
}

function getAlbumMemoryPreviewText(note: DbNote, drawing: StoredDrawingData | null): string {
  const content = note.content?.trim();
  if (content) return content;

  const drawingText = drawing?.texts?.map((item) => item?.text?.trim() ?? '').find((value) => value.length > 0);
  if (drawingText) return drawingText;

  const parts: string[] = [];
  if ((drawing?.strokes?.length ?? 0) > 0) parts.push('dibujo');
  if ((drawing?.photos?.length ?? 0) > 0) parts.push(drawing?.photos?.length === 1 ? 'foto' : 'fotos');
  if ((drawing?.stickers?.length ?? 0) > 0) parts.push(drawing?.stickers?.length === 1 ? 'sticker' : 'stickers');
  if ((drawing?.texts?.length ?? 0) > 0) parts.push('texto');
  if (parts.length > 0) return `Nota con ${parts.join(', ')}.`;

  return note.title?.trim() || 'Recuerdo guardado.';
}

function getAlbumMemoryKind(note: DbNote, drawing: StoredDrawingData | null, imageUri: string | null): AlbumMemory['kindLabel'] {
  if (note.note_type === 'photo' || (!!imageUri && !drawing?.strokes?.length && !drawing?.texts?.length && !drawing?.stickers?.length)) {
    return 'Foto';
  }
  if ((drawing?.strokes?.length ?? 0) > 0) return 'Dibujo';
  if ((drawing?.photos?.length ?? 0) > 0 || (drawing?.texts?.length ?? 0) > 0 || (drawing?.stickers?.length ?? 0) > 0) return 'Mixta';
  return 'Texto';
}

function buildAlbumMemories(notes: DbNote[], userId: string | null, partnerName: string): AlbumMemory[] {
  return notes.map((note, index) => {
    const drawing = parseStoredDrawingData(note.drawing_data);
    const imageUri = getAlbumMemoryImageUri(note, drawing);
    const kindLabel = getAlbumMemoryKind(note, drawing, imageUri);
    const isMine = !!userId && note.created_by === userId;

    return {
      id: note.id,
      authorLabel: isMine ? 'Tú' : partnerName,
      isMine,
      dateLabel: fmtDate(note.created_at),
      imageUri,
      previewText: getAlbumMemoryPreviewText(note, drawing),
      cardTone: (['pink', 'cream', 'lilac'] as const)[index % 3],
      backgroundColor: drawing?.backgroundColor || (index % 2 === 0 ? '#FFF2F7' : '#FFF8EE'),
      kindLabel,
    };
  });
}

function getAlbumEntryText(note: DbNote, drawing: StoredDrawingData | null): string | null {
  const content = note.content?.trim();
  if (content) return content;
  const textItems = drawing?.texts
    ?.map((item) => item?.text?.trim() ?? '')
    .filter((value) => value.length > 0);
  if (!textItems || textItems.length === 0) return null;
  return textItems.join('\n');
}

function normalizeAlbumEntry(note: DbNote, userId: string | null, partnerName: string, index: number): AlbumEntry {
  const drawing = parseStoredDrawingData(note.drawing_data);
  const photoUrl = getAlbumMemoryImageUri(note, drawing);
  const kindLabel = getAlbumMemoryKind(note, drawing, photoUrl);
  const isMine = !!userId && note.created_by === userId;
  const text = getAlbumEntryText(note, drawing);
  const inferredType: AlbumEntry['type'] =
    note.note_type === 'photo'
      ? 'photo'
      : note.note_type === 'drawing'
        ? 'drawing'
        : note.note_type === 'mixed'
          ? 'mixed'
          : note.note_type === 'text'
            ? 'text'
            : kindLabel === 'Foto'
              ? 'photo'
              : kindLabel === 'Dibujo'
                ? 'drawing'
                : kindLabel === 'Mixta'
                  ? 'mixed'
                  : 'text';

  const previewImage = photoUrl;
  return {
    id: note.id,
    createdAt: note.created_at,
    dateLabel: fmtDate(note.created_at),
    isMine,
    authorLabel: isMine ? 'Tú' : partnerName,
    type: inferredType,
    text,
    photoUrl,
    drawingUrl: null,
    previewImage,
    backgroundColor: drawing?.backgroundColor || (index % 2 === 0 ? '#FFF2F7' : '#FFF8EE'),
    kindLabel,
  };
}

function buildAlbumEntries(notes: DbNote[], userId: string | null, partnerName: string): AlbumEntry[] {
  return notes.map((note, index) => normalizeAlbumEntry(note, userId, partnerName, index));
}

function chunkIntoSpreads(items: AlbumEntry[], perSpread = 6): AlbumSpread[] {
  const spreads: AlbumSpread[] = [];
  for (let i = 0; i < items.length; i += perSpread) {
    const slice = items.slice(i, i + perSpread);
    spreads.push({
      id: `spread-${i}`,
      left: slice.slice(0, 3),
      right: slice.slice(3, 6),
    });
  }
  return spreads;
}

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars).trimEnd()}…`;
}

type MemoryPieceLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: string;
};

function clampMemoryPieceLayout(layout: MemoryPieceLayout, pageWidth: number, pageHeight: number): MemoryPieceLayout {
  const margin = 10;
  const maxWidth = Math.max(96, pageWidth - margin * 2);
  const maxHeight = Math.max(88, pageHeight - margin * 2);
  const width = clampNumber(layout.w, 96, maxWidth);
  const height = clampNumber(layout.h, 88, maxHeight);
  const x = clampNumber(layout.x, margin, Math.max(margin, pageWidth - width - margin));
  const y = clampNumber(layout.y, margin, Math.max(margin, pageHeight - height - margin));
  return {
    ...layout,
    x,
    y,
    w: Math.min(width, pageWidth - x - margin),
    h: Math.min(height, pageHeight - y - margin),
  };
}

function getSpreadPageLayouts(side: 'left' | 'right', pageWidth: number, pageHeight: number): MemoryPieceLayout[] {
  const leftLayouts: MemoryPieceLayout[] = [
    { x: pageWidth * 0.07, y: pageHeight * 0.1, w: 88, h: 84, rotate: '-5deg' },
    { x: pageWidth * 0.36, y: pageHeight * 0.11, w: 122, h: 156, rotate: '3deg' },
    { x: pageWidth * 0.08, y: pageHeight * 0.58, w: 126, h: 110, rotate: '-2.4deg' },
  ];
  const rightLayouts: MemoryPieceLayout[] = [
    { x: pageWidth * 0.34, y: pageHeight * 0.08, w: 120, h: 145, rotate: '3.2deg' },
    { x: pageWidth * 0.1, y: pageHeight * 0.34, w: 110, h: 132, rotate: '-2.6deg' },
    { x: pageWidth * 0.12, y: pageHeight * 0.67, w: 120, h: 92, rotate: '1.8deg' },
  ];
  const source = side === 'left' ? leftLayouts : rightLayouts;
  return source.map((layout) => clampMemoryPieceLayout(layout, pageWidth, pageHeight));
}

function getMemoryPreviewLabel(item: AlbumEntry): string {
  const text = item.text?.trim();
  if (text) return truncateText(text, 80);
  if (item.kindLabel === 'Dibujo') return 'Nota con dibujo';
  return 'Recuerdo';
}

function getMemoryCaption(item: AlbumEntry): string {
  if (item.createdAt) {
    const formatted = fmtDate(item.createdAt);
    if (formatted) return formatted;
  }
  return getMemoryPreviewLabel(item);
}

function getMemoryPaperTone(item: AlbumEntry): string {
  if (item.type === 'text') return item.isMine ? '#FFF7F1' : '#FFF2F7';
  if (item.type === 'drawing') return '#FFF9F1';
  return '#FFFDF8';
}

type MemoryAttachment = 'tape' | 'double_tape' | 'clip';

function getMemoryAttachment(item: AlbumEntry, seed: number): MemoryAttachment {
  if (item.type === 'photo') return seed % 2 === 0 ? 'double_tape' : 'tape';
  if (item.type === 'drawing') return seed % 3 === 0 ? 'tape' : 'clip';
  return seed % 4 === 0 ? 'clip' : 'tape';
}

function getSeededRotate(rotate: string, seed: number): string {
  const base = Number.parseFloat(rotate.replace('deg', ''));
  const jitter = ((seed % 9) - 4) * 0.35;
  return `${base + jitter}deg`;
}

function shouldAddDrawPoint(prev: DrawPoint | null, next: DrawPoint, minDistance: number, maxDistance = 75): boolean {
  if (!prev) return true;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < minDistance * minDistance) return false;
  if (distSq > maxDistance * maxDistance) return false;
  return true;
}

function smoothPoints(points: DrawPoint[], strength: number): DrawPoint[] {
  if (points.length < 3) return points;
  const t = clampNumber(strength, 0, 1);
  if (t <= 0) return points;

  const nextPoints: DrawPoint[] = [];
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
    });
  }
  nextPoints.push(points[points.length - 1]);
  return nextPoints;
}

function buildSmoothSvgPath(points: DrawPoint[]): string {
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

type BrushPreset = {
  widthMultiplier: number;
  opacityMultiplier: number;
  minPointDistance: number;
  smoothing: number;
};

const DRAW_BRUSH_PRESETS: Record<EditorToolMode, BrushPreset> = {
  pencil: { widthMultiplier: 0.95, opacityMultiplier: 0.9, minPointDistance: 3.2, smoothing: 0.38 },
  marker: { widthMultiplier: 1.95, opacityMultiplier: 1, minPointDistance: 5.2, smoothing: 0.26 },
  pen: { widthMultiplier: 0.65, opacityMultiplier: 0.86, minPointDistance: 3.1, smoothing: 0.62 },
  soft: { widthMultiplier: 0.78, opacityMultiplier: 0.9, minPointDistance: 2.2, smoothing: 0.55 },
  spray: { widthMultiplier: 1.55, opacityMultiplier: 0.55, minPointDistance: 6.8, smoothing: 0.62 },
  crayon: { widthMultiplier: 1.55, opacityMultiplier: 0.62, minPointDistance: 7.2, smoothing: 0.3 },
  highlighter: { widthMultiplier: 3.1, opacityMultiplier: 0.26, minPointDistance: 5.6, smoothing: 0.44 },
  watercolor: { widthMultiplier: 2.25, opacityMultiplier: 0.42, minPointDistance: 8.8, smoothing: 0.7 },
  eraser: { widthMultiplier: 1.7, opacityMultiplier: 1, minPointDistance: 2.8, smoothing: 0.28 },
};

function normalizeDrawBrush(brush: EditorToolMode): SharedDrawingBrushType {
  if (brush === 'soft') return 'pen';
  if (brush === 'crayon') return 'pencil';
  return brush;
}

function getBrushStrokeWidth(brush: EditorToolMode, baseWidth: number): number {
  return clampNumber(baseWidth * getSharedBrushWidthMultiplier(normalizeDrawBrush(brush)), 1, 34);
}

function getBrushOpacity(brush: EditorToolMode, baseOpacity: number): number {
  const normalized = normalizeDrawBrush(brush);
  if (normalized === 'eraser') return 1;
  return clampNumber(baseOpacity * getSharedBrushOpacityMultiplier(normalized), 0.04, 1);
}

function buildBrushPath(points: DrawPoint[], brush: EditorToolMode): string {
  const normalized = normalizeDrawBrush(brush);
  return buildSharedStrokePaths(points as SharedDrawingPoint[], normalized, 1).d;
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < stroke.length; i += 1) {
    const pt = stroke[i];
    const x = Number(pt[0] ?? 0);
    const y = Number(pt[1] ?? 0);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function getFreehandOptions(brush: Exclude<EditorToolMode, 'soft' | 'crayon'>, width: number) {
  const size = clampNumber(width, 1, 28);
  if (brush === 'marker') {
    return {
      size,
      thinning: 0,
      smoothing: 0.7,
      streamline: 0.6,
      easing: (t: number) => t,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    };
  }
  if (brush === 'highlighter') {
    return {
      size,
      thinning: 0,
      smoothing: 0.8,
      streamline: 0.7,
      easing: (t: number) => t,
      start: { cap: true, taper: 0 },
      end: { cap: true, taper: 0 },
    };
  }
  if (brush === 'pen') {
    return {
      size,
      thinning: 0.55,
      smoothing: 0.75,
      streamline: 0.65,
      easing: (t: number) => t,
      start: { cap: true, taper: size * 0.9 },
      end: { cap: true, taper: size * 1.05 },
    };
  }
  return {
    size,
    thinning: 0.25,
    smoothing: 0.7,
    streamline: 0.6,
    easing: (t: number) => t,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
  };
}

function buildFreehandFillPath(points: DrawPoint[], brush: Exclude<EditorToolMode, 'soft' | 'crayon'>, width: number): string | undefined {
  if (brush === 'spray' || brush === 'watercolor') return undefined;
  if (points.length < 2) return undefined;
  const stroke = getStroke(
    points.map((p) => [p.x, p.y]),
    getFreehandOptions(brush, width) as any
  ) as number[][];
  return getSvgPathFromStroke(stroke);
}

type BrushDot = { cx: number; cy: number; r: number; alpha: number };

type PreviewBrushType = 'pencil' | 'marker' | 'pen' | 'spray' | 'highlighter' | 'watercolor';
type PreviewBrushDot = { x: number; y: number; r: number; a: number };
type PreviewPoint = { x: number; y: number; t: number; pressure?: number };
type PreviewStroke = {
  id: string;
  brush: PreviewBrushType;
  color: string;
  width: number;
  opacity: number;
  d: string;
  fillD?: string;
  grain?: PreviewBrushDot[];
};

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

function getMinVisibleOpacityPreview(brush: PreviewBrushType, color: string): number {
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

function getBrushSmoothingPreview(brush: PreviewBrushType): number {
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

function getBrushWidthMultiplierPreview(brush: PreviewBrushType): number {
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

function getBrushOpacityMultiplierPreview(brush: PreviewBrushType): number {
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

function getSvgPathFromStrokePreview(outline: number[][]) {
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

function getFreehandOptionsPreview(brushType: PreviewBrushType, width: number) {
  switch (brushType) {
    case 'marker':
      return { size: width * 1.05, thinning: 0.02, smoothing: 0.72, streamline: 0.55, simulatePressure: false };
    case 'highlighter':
      return { size: width * 1.35, thinning: 0, smoothing: 0.8, streamline: 0.62, simulatePressure: false };
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
      return { size: width, thinning: 0.28, smoothing: 0.6, streamline: 0.35, simulatePressure: true };
  }
}

function buildFreehandFillPathPreview(points: PreviewPoint[], brushType: PreviewBrushType, width: number): string {
  if (points.length < 2) return '';
  const input = points.map((p) => [p.x, p.y, clampNumber(p.pressure ?? 0.5, 0.1, 1)]);
  const outline = getStroke(input as any, getFreehandOptionsPreview(brushType, width) as any) as number[][];
  return getSvgPathFromStrokePreview(outline);
}

function buildGrainDotsForSegmentPreview(
  a: PreviewPoint,
  b: PreviewPoint,
  width: number,
  opacity: number,
  seed: number,
  currentCount: number,
  maxDots: number
): PreviewBrushDot[] {
  if (currentCount >= maxDots) return [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist <= 0) return [];

  const spacing = clampNumber(width * 1.3, 7, 14);
  const radius = clampNumber(width * 0.55, 3.5, 9);
  const steps = clampNumber(Math.ceil(dist / spacing), 1, 6);
  const rand = mulberry32((seed ^ 0x243f6a88) + currentCount * 911);
  const dots: PreviewBrushDot[] = [];
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

const BrushPreviewStrokeLayer = React.memo(function BrushPreviewStrokeLayer({ stroke, keySuffix }: { stroke: PreviewStroke; keySuffix: string }) {
  const skPath = useMemo(() => Skia.Path.MakeFromSVGString(stroke.d) ?? Skia.Path.Make(), [stroke.d]);
  const skFillPath = useMemo(() => (stroke.fillD ? Skia.Path.MakeFromSVGString(stroke.fillD) ?? null : null), [stroke.fillD]);

  if (stroke.brush === 'spray') {
    return (
      <Group>
        <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 3.1} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.1}>
          <BlurMask blur={stroke.width * 1.15} style="normal" />
        </SkiaPath>
        <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 1.95} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.18}>
          <BlurMask blur={stroke.width * 0.42} style="normal" />
        </SkiaPath>
        <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 0.95} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.12}>
          <BlurMask blur={stroke.width * 0.12} style="normal" />
        </SkiaPath>
      </Group>
    );
  }

  if (stroke.brush === 'highlighter') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <SkiaPath path={fill} color={stroke.color} style="fill" opacity={stroke.opacity * 0.22} blendMode="multiply">
          <BlurMask blur={stroke.width * 0.22} style="normal" />
        </SkiaPath>
        <SkiaPath path={fill} color={stroke.color} style="fill" opacity={stroke.opacity * 0.12} blendMode="multiply" />
      </Group>
    );
  }

  if (stroke.brush === 'marker') {
    const fill = skFillPath ?? skPath;
    return (
      <Group>
        <SkiaPath path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  if (stroke.brush === 'watercolor') {
    return (
      <Group>
        <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width * 1.35} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.18}>
          <BlurMask blur={stroke.width * 0.65} style="normal" />
        </SkiaPath>
        <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" opacity={stroke.opacity * 0.34}>
          <BlurMask blur={stroke.width * 0.28} style="normal" />
        </SkiaPath>
      </Group>
    );
  }

  if (stroke.brush === 'pencil') {
    const fill = skFillPath ?? skPath;
    const grain = stroke.grain ?? [];
    const pencilColor = mixHex(stroke.color, '#8E6D7D', 0.22);
    return (
      <Group>
        <SkiaPath path={fill} color={pencilColor} style="fill" opacity={stroke.opacity * 0.62} />
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
        <SkiaPath path={fill} color={stroke.color} style="fill" opacity={stroke.opacity} />
      </Group>
    );
  }

  return <SkiaPath path={skPath} color={stroke.color} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" opacity={stroke.opacity} />;
});

const BrushPreview = React.memo(function BrushPreview({ brush }: { brush: PreviewBrushType }) {
  const previewStroke = useMemo<PreviewStroke>(() => {
    const previewColor = '#B2547C';
    const previewSize = 8;
    const baseOpacity = 0.85;
    const width = clampNumber(previewSize * getBrushWidthMultiplierPreview(brush), 1, 22);
    const op = clampNumber(Math.max(getMinVisibleOpacityPreview(brush, previewColor), baseOpacity * getBrushOpacityMultiplierPreview(brush)), 0.04, 1);
    const id = `preview-${brush}`;
    const points: PreviewPoint[] = [
      { x: 4, y: 14, t: 0, pressure: 0.6 },
      { x: 16, y: 6, t: 16, pressure: 0.4 },
      { x: 28, y: 12, t: 32, pressure: 0.7 },
      { x: 40, y: 6, t: 48, pressure: 0.45 },
    ];
    const smoothed = smoothPoints(
      points.map((p) => ({ x: p.x, y: p.y })),
      getBrushSmoothingPreview(brush)
    );
    const d = buildSmoothSvgPath(smoothed);
    const fillD = brush === 'spray' || brush === 'watercolor' ? undefined : buildFreehandFillPathPreview(points, brush, width);

    if (brush === 'pencil') {
      const grain: PreviewBrushDot[] = [];
      const max = 34;
      const seed = fnv1aHash(id);
      for (let i = 1; i < points.length; i += 1) {
        const seg = buildGrainDotsForSegmentPreview(points[i - 1], points[i], width, op, seed, grain.length, max);
        if (seg.length > 0) grain.push(...seg);
      }
      return { id, brush, color: previewColor, width, opacity: op, d, fillD, grain };
    }

    return { id, brush, color: previewColor, width, opacity: op, d, fillD };
  }, [brush]);

  return (
    <View style={s.brushPreviewWrap}>
      <Canvas style={s.brushPreviewCanvas} pointerEvents="none">
        <BrushPreviewStrokeLayer stroke={previewStroke} keySuffix="p" />
      </Canvas>
    </View>
  );
});

const DrawStrokeRenderer = React.memo(function DrawStrokeRenderer({
  stroke,
  backgroundColor,
}: {
  stroke: DrawStroke;
  backgroundColor: string;
}) {
  const brush = normalizeDrawBrush((stroke as unknown as { brush?: EditorToolMode }).brush ?? 'pencil');
  const nextStroke = useMemo<SharedDrawingStroke>(() => {
    const nextPaths = stroke.d ? { d: stroke.d, fillD: stroke.fillD } : buildSharedStrokePaths(stroke.points ?? [], brush, stroke.width);
    return {
      ...stroke,
      brush,
      d: nextPaths.d,
      fillD: nextPaths.fillD,
      grain: stroke.grain,
    };
  }, [brush, stroke]);

  return <SharedDrawingStrokeLayer stroke={nextStroke} keySuffix="n" backgroundColor={backgroundColor} />;
});

const CommittedDrawLayer = React.memo(function CommittedDrawLayer({
  strokes,
  backgroundColor,
}: {
  strokes: DrawStroke[];
  backgroundColor: string;
}) {
  return (
    <>
      {strokes.map((stroke) => (
        <DrawStrokeRenderer key={stroke.id} stroke={stroke} backgroundColor={backgroundColor} />
      ))}
    </>
  );
});

const CurrentDrawLayer = React.memo(function CurrentDrawLayer({
  stroke,
  backgroundColor,
}: {
  stroke: DrawStroke | null;
  backgroundColor: string;
}) {
  if (!stroke) return null;
  return <DrawStrokeRenderer stroke={stroke} backgroundColor={backgroundColor} />;
});

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampPhotoToCanvas(
  photo: Pick<EditorPhotoElement, 'x' | 'y' | 'width' | 'height' | 'scale' | 'rotation'>,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  if (!canvasWidth || !canvasHeight) return { x: photo.x, y: photo.y };
  const halfW = (photo.width * photo.scale) / 2;
  const halfH = (photo.height * photo.scale) / 2;
  const result = {
    x: clampNumber(photo.x, halfW, Math.max(halfW, canvasWidth - halfW)),
    y: clampNumber(photo.y, halfH, Math.max(halfH, canvasHeight - halfH)),
  };
  return result;
}

function estimateEditorTextSize(text: Pick<EditorTextElement, 'text' | 'fontSize'>): { width: number; height: number } {
  const content = text.text.trim() || 'Escribe...';
  const lines = content.split('\n');
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = clampNumber(longestLine * text.fontSize * 0.56 + 22, 92, 240);
  const height = Math.max(text.fontSize + 18, lines.length * (text.fontSize + 6) + 10);
  return { width, height };
}

function estimateEditorTextBounds(text: EditorTextElement): { left: number; right: number; top: number; bottom: number } {
  const { width, height } = estimateEditorTextSize(text);
  const scaledWidth = width * text.scale;
  const scaledHeight = height * text.scale;
  const rad = (text.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const bboxW = Math.abs(cos) * scaledWidth + Math.abs(sin) * scaledHeight;
  const bboxH = Math.abs(sin) * scaledWidth + Math.abs(cos) * scaledHeight;
  const centerX = text.x + width / 2;
  const centerY = text.y + height / 2;
  return {
    left: centerX - bboxW / 2,
    right: centerX + bboxW / 2,
    top: centerY - bboxH / 2,
    bottom: centerY + bboxH / 2,
  };
}

function findEditorTextAtPoint(point: DrawPoint, texts: EditorTextElement[]): EditorTextElement | null {
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const bounds = estimateEditorTextBounds(texts[i]);
    if (point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
      return texts[i];
    }
  }
  return null;
}

function isPointOnAnyTextElement(point: DrawPoint, texts: EditorTextElement[]): boolean {
  return findEditorTextAtPoint(point, texts) !== null;
}

function clampTextToCanvas(text: EditorTextElement, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  if (!canvasWidth || !canvasHeight) return { x: text.x, y: text.y };
  const { width, height } = estimateEditorTextSize(text);
  const bounds = estimateEditorTextBounds(text);
  const bboxW = bounds.right - bounds.left;
  const bboxH = bounds.bottom - bounds.top;
  const halfBaseW = width / 2;
  const halfBaseH = height / 2;
  return {
    x: clampNumber(text.x, 10 + bboxW / 2 - halfBaseW, Math.max(10, canvasWidth - 10 - bboxW / 2 - halfBaseW)),
    y: clampNumber(text.y, 10 + bboxH / 2 - halfBaseH, Math.max(10, canvasHeight - 10 - bboxH / 2 - halfBaseH)),
  };
}

function normalizeEditorFontVariant(variant: EditorTextElement['fontVariant']): EditorFontStyle {
  switch (variant) {
    case 'script':
      return 'script';
    case 'maquina':
      return 'maquina';
    case 'serif':
      return 'serif';
    case 'romantica':
      return 'romantica';
    case 'fuerte':
      return 'fuerte';
    case 'negrita':
      return 'fuerte';
    case 'elegante':
      return 'serif';
    case 'manuscrita':
      return 'romantica';
    case 'divertida':
      return 'maquina';
    case 'suave':
      return 'romantica';
    case 'normal':
    default:
      return 'normal';
  }
}

function getEditorTextVariantStyle(variant: EditorTextElement['fontVariant'], fontsLoaded: boolean) {
  const normalized = normalizeEditorFontVariant(variant);
  const loadedFamilyByVariant: Record<EditorFontStyle, string> = {
    normal: 'Montserrat_500Medium',
    fuerte: 'Montserrat_800ExtraBold',
    serif: 'PlayfairDisplay_600SemiBold',
    maquina: 'SpecialElite_400Regular',
    script: 'GreatVibes_400Regular',
    romantica: 'DancingScript_600SemiBold',
  };
  const fallbackFamilyByVariant: Record<EditorFontStyle, string | undefined> = {
    normal: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
    fuerte: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }),
    serif: Platform.select({ ios: 'Georgia', android: 'serif', default: undefined }),
    maquina: Platform.select({ ios: 'Courier New', android: 'monospace', default: undefined }),
    script: Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: undefined }),
    romantica: Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: undefined }),
  };

  const fontFamily = fontsLoaded ? loadedFamilyByVariant[normalized] : fallbackFamilyByVariant[normalized];

  if (!fontsLoaded) {
    switch (normalized) {
      case 'fuerte':
        return { fontFamily, fontWeight: '800' as const, letterSpacing: 0.1 };
      case 'serif':
        return { fontFamily, fontWeight: '600' as const, letterSpacing: 0.2 };
      case 'maquina':
        return { fontFamily, fontWeight: '700' as const, letterSpacing: 0.6 };
      case 'script':
        return { fontFamily, fontWeight: '600' as const, fontStyle: 'italic' as const, letterSpacing: 0.2 };
      case 'romantica':
        return { fontFamily, fontWeight: '600' as const, fontStyle: 'italic' as const, letterSpacing: 0.3 };
      case 'normal':
      default:
        return { fontFamily, fontWeight: '500' as const, letterSpacing: 0 };
    }
  }

  switch (normalized) {
    case 'fuerte':
      return { fontFamily, letterSpacing: 0.1 };
    case 'serif':
      return { fontFamily, letterSpacing: 0.2 };
    case 'maquina':
      return { fontFamily, letterSpacing: 0.55 };
    case 'script':
      return { fontFamily, letterSpacing: 0.15 };
    case 'romantica':
      return { fontFamily, letterSpacing: 0.25 };
    case 'normal':
    default:
      return { fontFamily, letterSpacing: 0 };
  }
}

function estimateEditorStickerSize(sticker: EditorStickerElement): { width: number; height: number } {
  const base = 44;
  return { width: base, height: base };
}

function estimateEditorStickerBounds(sticker: EditorStickerElement): { left: number; right: number; top: number; bottom: number } {
  const { width, height } = estimateEditorStickerSize(sticker);
  const scaledWidth = width * sticker.scale;
  const scaledHeight = height * sticker.scale;
  const rad = (sticker.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const bboxW = Math.abs(cos) * scaledWidth + Math.abs(sin) * scaledHeight;
  const bboxH = Math.abs(sin) * scaledWidth + Math.abs(cos) * scaledHeight;
  const centerX = sticker.x + width / 2;
  const centerY = sticker.y + height / 2;
  return {
    left: centerX - bboxW / 2,
    right: centerX + bboxW / 2,
    top: centerY - bboxH / 2,
    bottom: centerY + bboxH / 2,
  };
}

function findEditorStickerAtPoint(point: DrawPoint, stickers: EditorStickerElement[]): EditorStickerElement | null {
  for (let i = stickers.length - 1; i >= 0; i -= 1) {
    const bounds = estimateEditorStickerBounds(stickers[i]);
    if (point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
      return stickers[i];
    }
  }
  return null;
}

function isPointOnAnyPhoto(point: DrawPoint, photos: EditorPhotoElement[]): boolean {
  for (let i = photos.length - 1; i >= 0; i -= 1) {
    const p = photos[i];
    const rad = (p.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const w = p.width * p.scale;
    const h = p.height * p.scale;
    const bboxW = Math.abs(cos) * w + Math.abs(sin) * h;
    const bboxH = Math.abs(sin) * w + Math.abs(cos) * h;
    const left = p.x - bboxW / 2;
    const right = p.x + bboxW / 2;
    const top = p.y - bboxH / 2;
    const bottom = p.y + bboxH / 2;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return true;
  }
  return false;
}

function getStrokeWidth(baseWidth: number): number {
  return clampNumber(baseWidth, 1, 18);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function hexToRgba(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '').trim();
  const alpha = clamp01(opacity);
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

function applyOpacityToColor(color: string, opacity: number): string {
  const alpha = clamp01(opacity);
  if (alpha >= 0.999) return color;

  const c = color.trim();
  if (c.startsWith('#')) return hexToRgba(c, alpha);

  const rgbaMatch = c.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i
  );
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a0 = clamp01(Number(rgbaMatch[4]));
    return `rgba(${r}, ${g}, ${b}, ${clamp01(a0 * alpha)})`;
  }

  const rgbMatch = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

function getStrokeColor(tool: EditorToolMode, color: string, backgroundColor: string, opacity: number): string {
  if (tool === 'eraser') return backgroundColor;
  return applyOpacityToColor(color, opacity);
}

function buildTitle(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Nota';
  if (normalized.length <= 40) return normalized;
  return `${normalized.slice(0, 40).trim()}...`;
}

function shouldRetryWithMinimalPayload(message?: string): boolean {
  if (!message) return false;
  return ['note_type', 'image_url', 'drawing_data', 'is_shared'].some((field) => message.includes(field));
}

export default function NotesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    DancingScript_600SemiBold,
    GreatVibes_400Regular,
    Montserrat_500Medium,
    Montserrat_800ExtraBold,
    PlayfairDisplay_600SemiBold,
    SpecialElite_400Regular,
  });
  const [noteText, setNoteText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('Tu pareja');
  const [notes, setNotes] = useState<DbNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [hasCouple, setHasCouple] = useState(true);
  const [showAlbum, setShowAlbum] = useState(false);
  const [mainCardPhotoUri, setMainCardPhotoUri] = useState<string | null>(null);
  const [isMainPhotoSheetOpen, setIsMainPhotoSheetOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorCategory, setEditorCategory] = useState<EditorCategory>('pen');
  const [editorColor, setEditorColor] = useState(PINK_STRONG);
  const [isEditorColorPanelOpen, setIsEditorColorPanelOpen] = useState(false);
  const [editorCategoryBeforeColor, setEditorCategoryBeforeColor] = useState<EditorCategory>('pen');
  const [editorCanvasBackground, setEditorCanvasBackground] = useState(EDITOR_CANVAS_DEFAULT_BG);
  const [editorToolMode, setEditorToolMode] = useState<EditorToolMode>('pencil');
  const [editorStrokeWidth, setEditorStrokeWidth] = useState(5);
  const [editorOpacity, setEditorOpacity] = useState(1);
  const [editorStrokes, setEditorStrokes] = useState<DrawStroke[]>([]);
  const [editorCurrentStroke, setEditorCurrentStroke] = useState<DrawStroke | null>(null);
  const [editorPhotos, setEditorPhotos] = useState<EditorPhotoElement[]>([]);
  const [editorActivePhotoId, setEditorActivePhotoId] = useState<string | null>(null);
  const [editorTextElements, setEditorTextElements] = useState<EditorTextElement[]>([]);
  const [editorActiveTextId, setEditorActiveTextId] = useState<string | null>(null);
  const [editorEditingTextId, setEditorEditingTextId] = useState<string | null>(null);
  const [editorStickers, setEditorStickers] = useState<EditorStickerElement[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [editorActiveStickerId, setEditorActiveStickerId] = useState<string | null>(null);
  const [editorTextFontSize, setEditorTextFontSize] = useState(22);
  const [selectedFontStyle, setSelectedFontStyle] = useState<EditorFontStyle>('normal');
  const [editorCanvasSize, setEditorCanvasSize] = useState({ width: 0, height: 0 });
  const [isEditorPhotoSheetOpen, setIsEditorPhotoSheetOpen] = useState(false);
  const [editorDraggingTextId, setEditorDraggingTextId] = useState<string | null>(null);
  const [editorDraggingStickerId, setEditorDraggingStickerId] = useState<string | null>(null);
  const [isEditorTextOverTrash, setIsEditorTextOverTrash] = useState(false);
  const [editorTrashTargetLayout, setEditorTrashTargetLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const isTouchingPhotoRef = useRef(false);
  const isTouchingTextRef = useRef(false);
  const isTouchingStickerRef = useRef(false);
  const editorPhotoGestureCountRef = useRef(0);
  const canvasTouchStartedOnPhotoRef = useRef(false);
  const editorTextInputRefs = useRef<Record<string, TextInput | null>>({});
  const drawFrameRef = useRef<number | null>(null);
  const drawStrokeRef = useRef<DrawStroke | null>(null);

  useEffect(() => {
    if (fontError) {
      console.log('[Notas] font load error', fontError);
    }
  }, [fontError]);

  const fetchNotes = useCallback(async (cid: string, context: 'default' | 'album' = 'default') => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('couple_id', cid)
        .order('created_at', { ascending: false });

      if (error) {
        if (context === 'album') {
          setAlbumError('No se pudieron cargar los recuerdos.');
        } else {
          setInitError('No se pudieron cargar las notas.');
        }
        return false;
      }

      setNotes(data ?? []);
      if (context === 'album') {
        setAlbumError(null);
      }
      return true;
    } catch (error) {
      console.log('[Notas] fetchNotes error', error);
      if (context === 'album') {
        setAlbumError('No se pudieron cargar los recuerdos.');
      } else {
        setInitError('No se pudieron cargar las notas.');
      }
      return false;
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setInitError(null);
    setHasCouple(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        Alert.alert('Error', 'Usuario no encontrado');
        router.replace('/(auth)/login');
        return;
      }

      setUserId(userData.user.id);

      const { data: coupleData, error: coupleError } = await supabase.rpc('get_my_couple');
      if (coupleError) {
        setInitError(coupleError.message || 'No se pudo cargar la pareja.');
        return;
      }

      const coupleResult = Array.isArray(coupleData) ? coupleData[0] : coupleData;
      const cid = coupleResult?.couple_id ?? null;
      const nextPartnerName =
        typeof coupleResult?.partner_name === 'string' && coupleResult.partner_name.trim().length > 0
          ? coupleResult.partner_name.trim()
          : 'Tu pareja';

      setPartnerName(nextPartnerName);

      if (!cid) {
        setHasCouple(false);
        setCoupleId(null);
        setNotes([]);
        return;
      }

      setHasCouple(true);
      setCoupleId(cid);
      await fetchNotes(cid);
    } catch (error) {
      console.log('[Notas] initialize error', error);
      setInitError('No se pudo iniciar Notas.');
    } finally {
      setLoading(false);
    }
  }, [fetchNotes, router]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!coupleId) return;

    const channel = supabase
      .channel(`notes:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nextNote = payload.new as DbNote;
            setNotes((current) => (current.some((item) => item.id === nextNote.id) ? current : [nextNote, ...current]));
          } else if (payload.eventType === 'UPDATE') {
            const nextNote = payload.new as DbNote;
            setNotes((current) => current.map((item) => (item.id === nextNote.id ? nextNote : item)));
          } else if (payload.eventType === 'DELETE') {
            const oldNote = payload.old as { id: string };
            setNotes((current) => current.filter((item) => item.id !== oldNote.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coupleId]);

  const handleUnavailableTool = useCallback(() => {
    Alert.alert('Notas', 'Muy pronto podrás usar esta opción.');
  }, []);

  const handleOpenAlbum = useCallback(async () => {
    setShowAlbum(true);
    if (!coupleId) return;
    setAlbumLoading(true);
    await fetchNotes(coupleId, 'album');
    setAlbumLoading(false);
  }, [coupleId, fetchNotes]);

  const handleClearNote = useCallback(() => {
    setNoteText('');
    setMainCardPhotoUri(null);
  }, []);

  const handleMainNoteTextChange = useCallback((value: string) => {
    if (value.trim().length > 0) {
      setMainCardPhotoUri(null);
    }
    setNoteText(value);
  }, []);

  const uploadNotePhoto = useCallback(async (photo: EditorPhotoElement, cid: string, uid: string) => {
    const response = await fetch(photo.uri);
    const arrayBuffer = await response.arrayBuffer();
    const filePath = `${uid}/${cid}/note-photo-${Date.now()}-${photo.id}.jpg`;
    const bucketName = 'notes';

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = publicData?.publicUrl ?? null;

    if (!publicUrl) {
      throw new Error('No se pudo obtener la URL pública');
    }
    return publicUrl;
  }, []);

  const pickSingleImageFromLibrary = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Permiso necesario para elegir una foto de la galería.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) return null;
      const asset = result.assets?.[0] ?? null;
      const uri = asset?.uri ?? null;
      return uri;
    } catch (e) {
      console.log('[Notas] pick photo error', e);
      Alert.alert('Error', 'No se pudo abrir la galería.');
      return null;
    }
  }, []);

  const takeSinglePhotoWithCamera = useCallback(async (): Promise<string | null> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Permiso necesario para usar la cámara.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) return null;
      const asset = result.assets?.[0] ?? null;
      const uri = asset?.uri ?? null;
      return uri;
    } catch (e) {
      console.log('[Notas] camera photo error', e);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
      return null;
    }
  }, []);

  const handleSaveNote = useCallback(
    async ({
      text,
      drawing,
      noteType,
    }: {
      text: string;
      drawing:
        | {
            backgroundColor: string;
            strokes: {
              id: string;
              brush?: EditorToolMode;
              color: string;
              width: number;
              opacity?: number;
              points: DrawPoint[];
            }[];
            photos: EditorPhotoElement[];
            texts: EditorTextElement[];
            stickers: EditorStickerElement[];
          }
        | null;
      noteType: 'text' | 'drawing' | 'mixed';
    }) => {
      const normalizedText = text.trim();

      if (!normalizedText && !drawing) {
        Alert.alert('Notas', 'Escribe o dibuja algo primero.');
        return;
      }
      if (!userId) {
        Alert.alert('Error', 'Usuario no encontrado.');
        return;
      }
      if (!coupleId) {
        Alert.alert('Notas', 'Necesitas estar conectado con tu pareja para guardar notas.');
        return;
      }

      const basePayload = {
        couple_id: coupleId,
        created_by: userId,
        title: buildTitle(normalizedText || 'Mi nota'),
        content: normalizedText || null,
      };

      let photoUrlForDb: string | null = null;
      let drawingData: string | null = null;

      if (drawing) {
        const uploadedPhotos = await Promise.all(
          (drawing.photos ?? []).map(async (p) => {
            try {
              const url = await uploadNotePhoto(p, coupleId, userId);
              if (!photoUrlForDb) photoUrlForDb = url;
              return { ...p, uri: url };
            } catch (e) {
              console.log('[Notas] photo upload error', e);
              return p;
            }
          })
        );

        drawingData = JSON.stringify({
          version: 2,
          backgroundColor: drawing.backgroundColor,
          strokes: drawing.strokes,
          photos: uploadedPhotos.map((p) => ({
            uri: p.uri,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            scale: p.scale,
            rotation: p.rotation,
          })),
          texts: (drawing.texts ?? []).map((t) => ({
            id: t.id,
            text: t.text,
            x: t.x,
            y: t.y,
            color: t.color,
            fontSize: t.fontSize,
            fontVariant: t.fontVariant ?? (t as any).fontStyle ?? 'normal',
            scale: t.scale ?? 1,
            rotation: t.rotation ?? 0,
          })),
          stickers: (drawing.stickers ?? []).map((s) => ({
            id: s.id,
            sticker: s.sticker,
            x: s.x,
            y: s.y,
            scale: s.scale ?? 1,
            rotation: s.rotation ?? 0,
          })),
        });
      }

      const richPayload = {
        ...basePayload,
        note_type: noteType,
        is_shared: true,
        image_url: photoUrlForDb,
        drawing_data: drawingData,
      };

      setSaving(true);

      try {
        let insertError: any = null;

        const richAttempt = await supabase.from('notes').insert(richPayload).select().single();
        insertError = richAttempt.error;

        if (insertError && shouldRetryWithMinimalPayload(insertError.message)) {
          const fallbackAttempt = await supabase.from('notes').insert(basePayload).select().single();
          insertError = fallbackAttempt.error;
        }

        if (insertError) {
          Alert.alert('Error', insertError.message || 'No se pudo guardar la nota.');
          return;
        }

        setNoteText('');
        setEditorText('');
        setEditorCurrentStroke(null);
        setEditorStrokes([]);
        setEditorPhotos([]);
        setEditorActivePhotoId(null);
        setEditorTextElements([]);
        setEditorActiveTextId(null);
        setEditorEditingTextId(null);
        setEditorStickers([]);
        setSelectedSticker(null);
        setEditorActiveStickerId(null);
        setEditorCategory('pen');
        setIsEditorColorPanelOpen(false);
        setEditorCategoryBeforeColor('pen');
        setEditorCanvasBackground(EDITOR_CANVAS_DEFAULT_BG);
        setEditorToolMode('pencil');
        setEditorTextFontSize(22);
        setSelectedFontStyle('normal');
        setIsEditorOpen(false);
        await fetchNotes(coupleId);
        Alert.alert('Notas', 'Nota guardada.');
      } catch (error) {
        console.log('[Notas] handleSaveNote error', error);
        Alert.alert('Error', 'No se pudo guardar la nota.');
      } finally {
        setSaving(false);
      }
    },
    [coupleId, fetchNotes, uploadNotePhoto, userId]
  );

  const handleOpenEditor = useCallback(() => {
    setEditorText(noteText);
    setEditorCategory('pen');
    setIsEditorColorPanelOpen(false);
    setEditorCategoryBeforeColor('pen');
    setEditorPhotos([]);
    setEditorActivePhotoId(null);
    setEditorTextElements([]);
    setEditorActiveTextId(null);
    setEditorEditingTextId(null);
    setEditorStickers([]);
    setSelectedSticker(null);
    setEditorActiveStickerId(null);
    setEditorTextFontSize(22);
    setSelectedFontStyle('normal');
    setIsEditorOpen(true);
  }, [noteText]);

  const updateEditorTextElement = useCallback(
    (
      id: string,
      next: Partial<Pick<EditorTextElement, 'text' | 'x' | 'y' | 'color' | 'fontSize' | 'fontVariant' | 'scale' | 'rotation'>>
    ) => {
      setEditorTextElements((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return { ...item, ...next };
        })
      );
    },
    []
  );

  const updateEditorStickerElement = useCallback(
    (id: string, next: Partial<Pick<EditorStickerElement, 'x' | 'y' | 'scale' | 'rotation'>>) => {
      setEditorStickers((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return { ...item, ...next };
        })
      );
    },
    []
  );

  const finalizeEditorTextElement = useCallback((id: string) => {
    let removed = false;
    setEditorTextElements((prev) => {
      const target = prev.find((item) => item.id === id);
      removed = !target || target.text.trim().length === 0;
      if (removed) {
        return prev.filter((item) => item.id !== id);
      }
      return prev;
    });
    setEditorEditingTextId((current) => (current === id ? null : current));
    if (removed) {
      setEditorActiveTextId((current) => (current === id ? null : current));
    }
  }, []);

  const activateEditorTextElement = useCallback(
    (id: string, shouldEdit = false) => {
      if (editorEditingTextId && editorEditingTextId !== id) {
        finalizeEditorTextElement(editorEditingTextId);
      }
      setEditorActivePhotoId(null);
      setEditorActiveTextId(id);
      const target = editorTextElements.find((item) => item.id === id);
      if (target) {
        setSelectedFontStyle(normalizeEditorFontVariant(target.fontVariant));
        setEditorTextFontSize(target.fontSize);
      }
      setEditorEditingTextId(shouldEdit ? id : null);
      if (!shouldEdit) {
        Keyboard.dismiss();
      }
    },
    [editorEditingTextId, editorTextElements, finalizeEditorTextElement]
  );

  const addEditorTextAtPoint = useCallback(
    (point: DrawPoint) => {
      if (editorEditingTextId) {
        finalizeEditorTextElement(editorEditingTextId);
      }
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const initial: EditorTextElement = {
        id,
        text: '',
        x: point.x,
        y: point.y,
        color: editorColor || '#5A3A2E',
        fontSize: editorTextFontSize,
        fontVariant: selectedFontStyle,
        scale: 1,
        rotation: 0,
      };
      setEditorTextElements((prev) => [...prev, initial]);
      setEditorActivePhotoId(null);
      setEditorActiveTextId(id);
      setEditorEditingTextId(id);
    },
    [
      editorColor,
      editorEditingTextId,
      editorTextFontSize,
      finalizeEditorTextElement,
      selectedFontStyle,
    ]
  );

  const addEditorStickerAtPoint = useCallback(
    (point: DrawPoint) => {
      if (!selectedSticker || saving) return;
      if (editorEditingTextId) {
        finalizeEditorTextElement(editorEditingTextId);
      }
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const size = estimateEditorStickerSize({
        id,
        sticker: selectedSticker,
        x: point.x,
        y: point.y,
        scale: 1,
        rotation: 0,
      });
      const initial: EditorStickerElement = {
        id,
        sticker: selectedSticker,
        x: point.x - size.width / 2,
        y: point.y - size.height / 2,
        scale: 1,
        rotation: 0,
      };
      setEditorActivePhotoId(null);
      setEditorActiveTextId(null);
      setEditorEditingTextId(null);
      setEditorStickers((prev) => [...prev, initial]);
      setEditorActiveStickerId(id);
    },
    [editorEditingTextId, finalizeEditorTextElement, saving, selectedSticker]
  );

  useEffect(() => {
    if (!editorEditingTextId) return;
    const handle = setTimeout(() => {
      const input = editorTextInputRefs.current[editorEditingTextId];
      input?.focus();
    }, 40);
    return () => clearTimeout(handle);
  }, [editorEditingTextId]);

  useEffect(() => {
    if (editorCategory === 'text') return;
    if (editorEditingTextId) {
      finalizeEditorTextElement(editorEditingTextId);
      Keyboard.dismiss();
    }
  }, [editorCategory, editorEditingTextId, finalizeEditorTextElement]);

  useEffect(() => {
    if (!editorActiveTextId) return;
    setEditorTextElements((prev) =>
      prev.map((item) => (item.id === editorActiveTextId ? { ...item, color: editorColor } : item))
    );
  }, [editorActiveTextId, editorColor]);

  useEffect(() => {
    if (!editorActiveTextId) return;
    setEditorTextElements((prev) =>
      prev.map((item) =>
        item.id === editorActiveTextId ? { ...item, fontSize: editorTextFontSize } : item
      )
    );
  }, [editorActiveTextId, editorTextFontSize]);

  const editorPanResponder = useMemo(() => {
    const getPoint = (e: any): DrawPoint => ({
      x: Number(e.nativeEvent.locationX ?? 0),
      y: Number(e.nativeEvent.locationY ?? 0),
    });

    const scheduleStrokeUpdate = () => {
      if (drawFrameRef.current !== null) return;
      drawFrameRef.current = requestAnimationFrame(() => {
        drawFrameRef.current = null;
        const stroke = drawStrokeRef.current;
        if (!stroke) {
          setEditorCurrentStroke(null);
          return;
        }
        const brush = normalizeDrawBrush(stroke.brush);
        stroke.brush = brush;
        const nextPaths = buildSharedStrokePaths(stroke.points, brush, stroke.width);
        stroke.d = nextPaths.d;
        stroke.fillD = nextPaths.fillD;
        setEditorCurrentStroke({
          ...stroke,
          points: [...stroke.points],
          grain: stroke.grain ? [...stroke.grain] : undefined,
        });
      });
    };

    const startStroke = (p: DrawPoint) => {
      if (isTouchingPhotoRef.current) return;
      const startedAt = Date.now();
      const startPoint: SharedDrawingPoint = { x: p.x, y: p.y, t: startedAt, pressure: 0.5 };
      const points: SharedDrawingPoint[] = [startPoint];
      const brush = normalizeDrawBrush(editorToolMode);
      const opacity =
        brush === 'eraser'
          ? 1
          : clampNumber(
              Math.max(getSharedMinVisibleOpacity(brush, editorColor), editorOpacity * getSharedBrushOpacityMultiplier(brush)),
              0.04,
              1
            );
      const width = getBrushStrokeWidth(brush, editorStrokeWidth);
      const baseColor = brush === 'eraser' ? editorCanvasBackground : editorColor;
      const nextPaths = buildSharedStrokePaths(points, brush, width);
      const stroke: DrawStroke = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        color: baseColor,
        width,
        opacity,
        brush,
        points,
        d: nextPaths.d,
        fillD: nextPaths.fillD,
        grain: brush === 'pencil' ? [] : undefined,
      };
      drawStrokeRef.current = stroke;
      setEditorCurrentStroke(stroke);
    };

    const addPoint = (p: DrawPoint) => {
      if (isTouchingPhotoRef.current) return;
      const current = drawStrokeRef.current;
      if (!current) return;
      const prev = current.points[current.points.length - 1] ?? null;
      const brush = normalizeDrawBrush(current.brush);
      const now = Date.now();
      const dt = Math.max(16, now - (prev?.t ?? now));
      const dist = prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0;
      const speed = dist / dt;
      const nextPressure = clampNumber(1 - speed * 2.2, 0.14, 1);
      const nextPoint: SharedDrawingPoint = {
        x: p.x,
        y: p.y,
        t: now,
        pressure: brush === 'pen' ? nextPressure : 0.5,
      };
      const minDistance = getSharedBrushMinDistance(brush, current.width);
      if (!shouldAddSharedPoint(prev, nextPoint, minDistance)) return;

      current.points.push(nextPoint);
      if (brush === 'pencil') {
        const grain = current.grain ?? [];
        const newDots = buildSharedGrainDotsForSegment(
          prev ?? nextPoint,
          nextPoint,
          current.width,
          current.opacity,
          sharedFnv1aHash(current.id),
          grain.length,
          220
        );
        if (newDots.length > 0) grain.push(...newDots);
        current.grain = grain;
      }
      scheduleStrokeUpdate();
    };

    const endStroke = () => {
      if (drawFrameRef.current !== null) {
        cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
      const current = drawStrokeRef.current;
      drawStrokeRef.current = null;
      if (!current) {
        setEditorCurrentStroke(null);
        return;
      }
      if (current.points.length < 2) {
        setEditorCurrentStroke(null);
        return;
      }
      const brush = normalizeDrawBrush(current.brush);
      current.brush = brush;
      const nextPaths = buildSharedStrokePaths(current.points, brush, current.width);
      current.d = nextPaths.d;
      current.fillD = nextPaths.fillD;
      const finalized: DrawStroke = {
        ...current,
        points: [...current.points],
        grain: current.grain ? [...current.grain] : undefined,
      };
      setEditorStrokes((prev) => [...prev, finalized]);
      setEditorCurrentStroke(null);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (e) =>
        editorCategory === 'pen' &&
        !isTouchingPhotoRef.current &&
        editorActivePhotoId === null &&
        !editorPhotoGestureCountRef.current &&
        !canvasTouchStartedOnPhotoRef.current &&
        !isPointOnAnyPhoto(getPoint(e), editorPhotos) &&
        !isPointOnAnyTextElement(getPoint(e), editorTextElements) &&
        !findEditorStickerAtPoint(getPoint(e), editorStickers),
      onMoveShouldSetPanResponder: (e) =>
        editorCategory === 'pen' &&
        !isTouchingPhotoRef.current &&
        editorActivePhotoId === null &&
        !editorPhotoGestureCountRef.current &&
        !canvasTouchStartedOnPhotoRef.current &&
        !isPointOnAnyPhoto(getPoint(e), editorPhotos) &&
        !isPointOnAnyTextElement(getPoint(e), editorTextElements) &&
        !findEditorStickerAtPoint(getPoint(e), editorStickers),
      onPanResponderGrant: (e) => {
        setEditorActivePhotoId(null);
        startStroke(getPoint(e));
      },
      onPanResponderMove: (e) => addPoint(getPoint(e)),
      onPanResponderRelease: () => {
        canvasTouchStartedOnPhotoRef.current = false;
        endStroke();
      },
      onPanResponderTerminate: () => {
        canvasTouchStartedOnPhotoRef.current = false;
        endStroke();
      },
    });
  }, [
    drawFrameRef,
    drawStrokeRef,
    editorActivePhotoId,
    editorCanvasBackground,
    editorCategory,
    editorColor,
    editorOpacity,
    editorPhotos,
    editorStickers,
    editorStrokeWidth,
    editorTextElements,
    editorToolMode,
  ]);

  const addEditorPhoto = useCallback(
    (uri: string) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const rotation = Math.random() * 16 - 8;
      const width = 162;
      const height = 198;
      const scale = 1;
      const jitterX = Math.random() * 24 - 12;
      const jitterY = Math.random() * 28 - 14;
      const initial = {
        id,
        uri,
        x: (editorCanvasSize.width ? Math.floor(editorCanvasSize.width * 0.36) : 140) + jitterX,
        y: (editorCanvasSize.height ? Math.max(100, Math.floor(editorCanvasSize.height * 0.62)) : 220) + jitterY,
        width,
        height,
        scale,
        rotation,
      };
      const clamped = clampPhotoToCanvas(initial, editorCanvasSize.width, editorCanvasSize.height);
      setEditorPhotos((prev) => [...prev, { ...initial, ...clamped }]);
      setEditorActivePhotoId(id);
    },
    [editorCanvasSize.height, editorCanvasSize.width]
  );

  const pickEditorPhotoFromLibrary = useCallback(async () => {
    const uri = await pickSingleImageFromLibrary();
    if (!uri) return;
    addEditorPhoto(uri);
  }, [addEditorPhoto, pickSingleImageFromLibrary]);

  const takeEditorPhotoWithCamera = useCallback(async () => {
    const uri = await takeSinglePhotoWithCamera();
    if (!uri) return;
    addEditorPhoto(uri);
  }, [addEditorPhoto, takeSinglePhotoWithCamera]);

  const handleEditorFotoPress = useCallback(() => {
    setIsEditorPhotoSheetOpen(true);
  }, []);

  const handleEditorPhotoSheetTake = useCallback(async () => {
    await takeEditorPhotoWithCamera();
  }, [takeEditorPhotoWithCamera]);

  const handleEditorPhotoSheetPick = useCallback(async () => {
    await pickEditorPhotoFromLibrary();
  }, [pickEditorPhotoFromLibrary]);

  const handleSaveMainPhotoNote = useCallback(
    async (uri: string) => {
      if (!userId) {
        Alert.alert('Error', 'Usuario no encontrado.');
        return;
      }
      if (!coupleId) {
        Alert.alert('Notas', 'Necesitas estar conectado con tu pareja para guardar fotos.');
        return;
      }

      setSaving(true);
      setMainCardPhotoUri(uri);
      setNoteText('');

      try {
        const uploadedUrl = await uploadNotePhoto(
          {
            id: `main-photo-${Date.now()}`,
            uri,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scale: 1,
            rotation: 0,
          },
          coupleId,
          userId
        );

        const payload = {
          couple_id: coupleId,
          created_by: userId,
          title: 'Foto',
          content: null,
          note_type: 'photo',
          is_shared: true,
          image_url: uploadedUrl,
          drawing_data: null,
        };

        const { error: insertError } = await supabase.from('notes').insert(payload);

        if (insertError) {
          throw insertError;
        }

        setMainCardPhotoUri(uploadedUrl);
        await fetchNotes(coupleId);
      } catch (error) {
        console.log('[Notas] handleSaveMainPhotoNote error', error);
        setMainCardPhotoUri(null);
        Alert.alert('Notas', 'No se pudo guardar la foto. Inténtalo de nuevo.');
      } finally {
        setSaving(false);
      }
    },
    [coupleId, fetchNotes, uploadNotePhoto, userId]
  );

  const handleSaveMainTextNote = useCallback(async () => {
    const normalizedText = noteText.trim();
    if (!normalizedText) {
      handleOpenEditor();
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'Usuario no encontrado.');
      return;
    }
    if (!coupleId) {
      Alert.alert('Notas', 'Necesitas estar conectado con tu pareja para guardar notas.');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);

    try {
      const basePayload = {
        couple_id: coupleId,
        created_by: userId,
        title: buildTitle(normalizedText || 'Mi nota'),
        content: normalizedText,
      };

      const richPayload = {
        ...basePayload,
        note_type: 'text' as const,
        is_shared: true,
        image_url: null,
        drawing_data: null,
      };

      let insertError: any = null;
      const richAttempt = await supabase.from('notes').insert(richPayload).select().single();
      insertError = richAttempt.error;

      if (insertError && shouldRetryWithMinimalPayload(insertError.message)) {
        const fallbackAttempt = await supabase.from('notes').insert(basePayload).select().single();
        insertError = fallbackAttempt.error;
      }

      if (insertError) {
        Alert.alert('Notas', 'No se pudo guardar la nota. Intentalo de nuevo.');
        return;
      }

      setMainCardPhotoUri(null);
      setNoteText('');
      await fetchNotes(coupleId);
    } catch (error) {
      console.log('[Notas] handleSaveMainTextNote error', error);
      Alert.alert('Notas', 'No se pudo guardar la nota. Intentalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }, [coupleId, fetchNotes, handleOpenEditor, noteText, userId]);

  const handleMainFotoPress = useCallback(() => {
    setIsMainPhotoSheetOpen(true);
  }, []);

  const handleMainPhotoSheetPick = useCallback(async () => {
    const uri = await pickSingleImageFromLibrary();
    if (!uri) return;
    await handleSaveMainPhotoNote(uri);
  }, [handleSaveMainPhotoNote, pickSingleImageFromLibrary]);

  const handleMainPhotoSheetTake = useCallback(async () => {
    const uri = await takeSinglePhotoWithCamera();
    if (!uri) return;
    await handleSaveMainPhotoNote(uri);
  }, [handleSaveMainPhotoNote, takeSinglePhotoWithCamera]);

  const bringEditorTextToFront = useCallback((id: string) => {
    setEditorTextElements((prev) => {
      const idx = prev.findIndex((item) => item.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
    setEditorActiveTextId(id);
  }, []);

  const bringEditorStickerToFront = useCallback((id: string) => {
    setEditorStickers((prev) => {
      const idx = prev.findIndex((item) => item.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
    setEditorActiveStickerId(id);
  }, []);

  const handleEditorPhotoInteractionStart = useCallback((id: string) => {
    const nextCount = editorPhotoGestureCountRef.current + 1;
    editorPhotoGestureCountRef.current = nextCount;
    isTouchingPhotoRef.current = true;
    setEditorActivePhotoId(id);
  }, []);

  const handleEditorTextInteractionStart = useCallback(
    (id: string) => {
      const nextCount = editorPhotoGestureCountRef.current + 1;
      editorPhotoGestureCountRef.current = nextCount;
      isTouchingPhotoRef.current = true;
      isTouchingTextRef.current = true;
      if (editorEditingTextId) {
        finalizeEditorTextElement(editorEditingTextId);
      }
      setEditorActivePhotoId(null);
      setEditorActiveTextId(id);
      setEditorActiveStickerId(null);
      setEditorEditingTextId(null);
      Keyboard.dismiss();
    },
    [editorEditingTextId, finalizeEditorTextElement]
  );

  const handleEditorTextTouchStart = useCallback(
    (id: string) => {
      isTouchingTextRef.current = true;
      canvasTouchStartedOnPhotoRef.current = true;
      setEditorActivePhotoId(null);
      setEditorActiveStickerId(null);
      setEditorActiveTextId(id);
    },
    []
  );

  const handleEditorStickerInteractionStart = useCallback(
    (id: string) => {
      const nextCount = editorPhotoGestureCountRef.current + 1;
      editorPhotoGestureCountRef.current = nextCount;
      isTouchingPhotoRef.current = true;
      isTouchingStickerRef.current = true;
      if (editorEditingTextId) {
        finalizeEditorTextElement(editorEditingTextId);
      }
      setEditorActivePhotoId(null);
      setEditorActiveTextId(null);
      setEditorEditingTextId(null);
      setEditorActiveStickerId(id);
      Keyboard.dismiss();
    },
    [editorEditingTextId, finalizeEditorTextElement]
  );

  const handleEditorStickerTouchStart = useCallback((id: string) => {
    isTouchingStickerRef.current = true;
    canvasTouchStartedOnPhotoRef.current = true;
    setEditorActivePhotoId(null);
    setEditorActiveTextId(null);
    setEditorEditingTextId(null);
    setEditorActiveStickerId(id);
  }, []);

  const isEditorPointOverTrashTarget = useCallback(
    (x: number, y: number) => {
      if (!editorTrashTargetLayout) return false;
      return (
        x >= editorTrashTargetLayout.x &&
        x <= editorTrashTargetLayout.x + editorTrashTargetLayout.width &&
        y >= editorTrashTargetLayout.y &&
        y <= editorTrashTargetLayout.y + editorTrashTargetLayout.height
      );
    },
    [editorTrashTargetLayout]
  );

  const handleEditorTextDragStart = useCallback((id: string) => {
    setEditorDraggingTextId(id);
    setIsEditorTextOverTrash(false);
    setEditorActiveTextId(id);
    setEditorActivePhotoId(null);
  }, []);

  const handleEditorTextDragMove = useCallback(
    (centerX: number, centerY: number) => {
      const over = isEditorPointOverTrashTarget(centerX, centerY);
      setIsEditorTextOverTrash((prev) => (prev === over ? prev : over));
    },
    [isEditorPointOverTrashTarget]
  );

  const handleEditorTextDragEnd = useCallback(
    (id: string, nextX: number, nextY: number, centerX: number, centerY: number) => {
      const shouldDelete = isEditorPointOverTrashTarget(centerX, centerY);
      if (shouldDelete) {
        setEditorTextElements((prev) => prev.filter((item) => item.id !== id));
        delete editorTextInputRefs.current[id];
        setEditorActiveTextId((current) => (current === id ? null : current));
        setEditorEditingTextId((current) => (current === id ? null : current));
      } else {
        updateEditorTextElement(id, { x: nextX, y: nextY });
      }
      setEditorDraggingTextId(null);
      setIsEditorTextOverTrash(false);
      isTouchingTextRef.current = false;
    },
    [isEditorPointOverTrashTarget, updateEditorTextElement]
  );

  const handleEditorStickerDragStart = useCallback((id: string) => {
    setEditorDraggingStickerId(id);
    setIsEditorTextOverTrash(false);
    setEditorActiveStickerId(id);
    setEditorActivePhotoId(null);
    setEditorActiveTextId(null);
  }, []);

  const handleEditorStickerDragMove = useCallback(
    (centerX: number, centerY: number) => {
      const over = isEditorPointOverTrashTarget(centerX, centerY);
      setIsEditorTextOverTrash((prev) => (prev === over ? prev : over));
    },
    [isEditorPointOverTrashTarget]
  );

  const handleEditorStickerDragEnd = useCallback(
    (id: string, nextX: number, nextY: number, centerX: number, centerY: number) => {
      const shouldDelete = isEditorPointOverTrashTarget(centerX, centerY);
      if (shouldDelete) {
        setEditorStickers((prev) => prev.filter((item) => item.id !== id));
        setEditorActiveStickerId((current) => (current === id ? null : current));
      } else {
        updateEditorStickerElement(id, { x: nextX, y: nextY });
      }
      setEditorDraggingStickerId(null);
      setIsEditorTextOverTrash(false);
      isTouchingStickerRef.current = false;
    },
    [isEditorPointOverTrashTarget, updateEditorStickerElement]
  );

  const handleEditorPhotoInteractionEnd = useCallback(() => {
    const nextCount = Math.max(0, editorPhotoGestureCountRef.current - 1);
    editorPhotoGestureCountRef.current = nextCount;
    isTouchingPhotoRef.current = nextCount > 0;
    if (nextCount === 0) {
      isTouchingTextRef.current = false;
      isTouchingStickerRef.current = false;
    }
    canvasTouchStartedOnPhotoRef.current = false;
  }, []);

  const updateEditorPhotoPosition = useCallback(
    (
      id: string,
      next: Partial<Pick<EditorPhotoElement, 'x' | 'y' | 'scale' | 'rotation'>>,
      clampToBounds: boolean
    ) => {
      setEditorPhotos((prev) =>
        prev.map((photo) => {
          if (photo.id !== id) return photo;
          const updated = { ...photo, ...next };
          if (!clampToBounds) {
            return updated;
          }
          const clamped = clampPhotoToCanvas(updated, editorCanvasSize.width, editorCanvasSize.height);
          return { ...updated, ...clamped };
        })
      );
    },
    [editorCanvasSize.height, editorCanvasSize.width]
  );

  const bringEditorPhotoToFront = useCallback((id: string) => {
    setEditorPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
    setEditorActivePhotoId(id);
  }, []);

  const displayedMainPhotoUri = mainCardPhotoUri;
  const hasMainTextDraft = noteText.trim().length > 0;
  const shouldShowMainPhotoPreview = !noteText.trim() && !!displayedMainPhotoUri;
  const memories = useMemo(() => buildAlbumEntries(notes, userId, partnerName), [notes, partnerName, userId]);
  const bookWidth = Math.min(SCREEN_WIDTH * 0.92, 380);
  const bookHeight = Math.min(SCREEN_HEIGHT * 0.58, 500);
  const foldWidth = 8;
  const pageWidth = (bookWidth - foldWidth) / 2;
  const pageHeight = bookHeight;
  const spreadItems = useMemo(() => memories.slice(0, 6), [memories]);
  const leftItems = useMemo(() => spreadItems.slice(0, 3), [spreadItems]);
  const rightItems = useMemo(() => spreadItems.slice(3, 6), [spreadItems]);
  const leftLayouts = useMemo(() => getSpreadPageLayouts('left', pageWidth, pageHeight), [pageHeight, pageWidth]);
  const rightLayouts = useMemo(() => getSpreadPageLayouts('right', pageWidth, pageHeight), [pageHeight, pageWidth]);

  useEffect(() => {
    if (!showAlbum) return;
    console.log('[ALBUM_UI] render spread items', spreadItems.length);
  }, [showAlbum, spreadItems.length]);

  if (loading) {
    return (
      <View style={[s.root, s.loadingState]}>
        <ActivityIndicator size="large" color={PINK_STRONG} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.headerRow}>
          <Pressable style={s.headerCircleButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={TEXT} />
          </Pressable>

          <View style={s.headerCenter}>
            <View style={s.headerTitleRow}>
              <Text style={s.headerTitle}>Notas</Text>
              <Heart size={18} color={PINK_STRONG} />
            </View>
            <Text style={s.headerSubtitle}>Cartas · Recuerdos</Text>
          </View>

          <Pressable style={s.headerActionButton} onPress={handleUnavailableTool}>
            <Heart size={17} color={WHITE} strokeWidth={2} />
          </Pressable>
        </View>

        {initError ? <Text style={s.errorText}>{initError}</Text> : null}

        {!hasCouple ? (
          <View style={s.noCoupleCard}>
            <View style={s.noCoupleHeart}>
              <Heart size={28} color={PINK_STRONG} />
            </View>
            <Text style={s.noCoupleTitle}>Conecta con tu pareja</Text>
            <Text style={s.noCoupleText}>Necesitas estar conectado con tu pareja para usar Notas.</Text>
            <Pressable style={s.connectButton} onPress={() => router.push('/partner-setup')}>
              <Text style={s.connectButtonText}>Conectar pareja</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.canvasCard}>
              <Text style={s.cardTitle}>Mi nota ♡</Text>

              <View style={s.canvasPaper}>
                {shouldShowMainPhotoPreview && displayedMainPhotoUri ? (
                  <>
                    <Image source={{ uri: displayedMainPhotoUri }} style={s.mainCardPhotoPreview} resizeMode="cover" />
                    {saving ? (
                      <View style={s.mainCardPhotoLoading}>
                        <ActivityIndicator size="small" color={WHITE} />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <TextInput
                    style={s.noteInput}
                    placeholder="Escribe aquí..."
                    placeholderTextColor="#BEA5B1"
                    value={noteText}
                    onChangeText={handleMainNoteTextChange}
                    multiline
                    editable={!saving}
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                )}
              </View>
              <View style={s.cardToolRow}>
                <Pressable style={s.sideToolButton} onPress={handleClearNote}>
                  <Eraser size={16} color={TEXT} />
                  <Text style={s.sideToolText}>Borrar</Text>
                </Pressable>

                <Pressable
                  style={[s.plusButton, saving && s.plusButtonDisabled]}
                  onPress={hasMainTextDraft ? handleSaveMainTextNote : handleOpenEditor}
                  disabled={saving}
                >
                  {hasMainTextDraft ? (
                    <Check size={24} color={WHITE} strokeWidth={2.9} />
                  ) : (
                    <Plus size={28} color={WHITE} strokeWidth={2.4} />
                  )}
                </Pressable>

                <Pressable style={[s.sideToolButton, saving && s.sideToolButtonDisabled]} onPress={handleMainFotoPress} disabled={saving}>
                  <ImageIcon size={16} color={TEXT} />
                  <Text style={s.sideToolText}>Foto</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={s.albumHeroCard} onPress={handleOpenAlbum}>
              <View style={s.albumSpine} />
              <View style={s.albumSpineShadow} />
              <View style={s.albumSpineInner} />
              <View style={s.albumCoverMidTone} />
              <View style={s.albumCoverEdgeLight} />
              <View style={s.albumCoverGlowTop} />
              <View style={s.albumCoverGlowBottom} />
              <View style={s.albumSoftCircleLarge} />
              <View style={s.albumSoftCircleSmall} />
              <View style={s.albumSticker} />
              <View style={s.albumPaperDetail}>
                <View style={s.albumPaperTapeLeft} />
                <View style={s.albumPaperTapeRight} />
                <View style={s.albumPaperLine} />
                <View style={s.albumPaperLineShort} />
                <View style={s.albumPaperLineTiny} />
              </View>
              <View style={s.albumDecorHeart}>
                <Heart size={16} color="#C86E96" strokeWidth={1.8} />
              </View>
              <View style={s.albumDotsRow}>
                <View style={s.albumDot} />
                <View style={s.albumDot} />
                <View style={s.albumDot} />
              </View>
              <View style={s.albumHeroContent}>
                <View style={s.albumTextBlock}>
                  <Text style={s.albumHeroTitle}>Álbum</Text>
                  <Text style={s.albumHeroSubtitle}>Tus recuerdos juntos ♡</Text>
                </View>
                <Pressable style={s.albumCtaButton} onPress={handleOpenAlbum}>
                  <Text style={s.albumCtaText}>Abrir recuerdos  ›</Text>
                </Pressable>
              </View>
            </Pressable>
          </>
        )}
      </ScrollView>
      <Modal visible={isEditorOpen} animationType="fade" transparent onRequestClose={() => setIsEditorOpen(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={s.editorOverlayBackdrop}>
            <Pressable style={s.editorOverlayDismissArea} onPress={() => setIsEditorOpen(false)} />
            <View style={[s.editorOverlayCenter, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.editorCard}>
                <Pressable style={s.editorCloseButton} onPress={() => setIsEditorOpen(false)} disabled={saving}>
                  <X size={18} color={TEXT} />
                </Pressable>

                <View style={s.editorHeader}>
                  <Text style={s.editorTitle}>Mi nota</Text>
                  <Text style={s.editorSubtitle}>Dibuja o escribe algo para ustedes dos</Text>
                </View>

                <View
                  style={[s.editorCanvas, { backgroundColor: editorCanvasBackground }]}
                  onTouchStart={(e) => {
                    if (isTouchingTextRef.current) {
                      canvasTouchStartedOnPhotoRef.current = true;
                      return;
                    }
                    if (isTouchingStickerRef.current) {
                      canvasTouchStartedOnPhotoRef.current = true;
                      return;
                    }
                    const point = { x: Number(e.nativeEvent.locationX ?? 0), y: Number(e.nativeEvent.locationY ?? 0) };
                    const touchedPhoto = isPointOnAnyPhoto(point, editorPhotos);
                    const touchedText = findEditorTextAtPoint(point, editorTextElements);
                    const touchedSticker = findEditorStickerAtPoint(point, editorStickers);
                    canvasTouchStartedOnPhotoRef.current = touchedPhoto || !!touchedText || !!touchedSticker;
                    if (touchedPhoto) {
                      if (editorEditingTextId) {
                        finalizeEditorTextElement(editorEditingTextId);
                        Keyboard.dismiss();
                      }
                      setEditorActiveTextId(null);
                      setEditorActiveStickerId(null);
                      return;
                    }
                    if (touchedText) {
                      setEditorActivePhotoId(null);
                      setEditorActiveStickerId(null);
                      activateEditorTextElement(touchedText.id, false);
                      return;
                    }
                    if (touchedSticker) {
                      setEditorActivePhotoId(null);
                      setEditorActiveTextId(null);
                      setEditorEditingTextId(null);
                      setEditorActiveStickerId(touchedSticker.id);
                      return;
                    }
                    setEditorActivePhotoId(null);
                    if (editorEditingTextId) {
                      finalizeEditorTextElement(editorEditingTextId);
                      Keyboard.dismiss();
                    }
                    setEditorDraggingTextId(null);
                    setEditorDraggingStickerId(null);
                    setIsEditorTextOverTrash(false);
                    isTouchingTextRef.current = false;
                    isTouchingStickerRef.current = false;
                    if (editorCategory === 'text' && !saving) {
                      addEditorTextAtPoint(point);
                    } else if (editorCategory === 'sticker' && !saving && selectedSticker) {
                      addEditorStickerAtPoint(point);
                    } else {
                      setEditorActiveTextId(null);
                      setEditorActiveStickerId(null);
                    }
                  }}
                  onTouchEnd={() => {
                    canvasTouchStartedOnPhotoRef.current = false;
                    isTouchingTextRef.current = false;
                    isTouchingStickerRef.current = false;
                  }}
                  onTouchCancel={() => {
                    canvasTouchStartedOnPhotoRef.current = false;
                    isTouchingTextRef.current = false;
                    isTouchingStickerRef.current = false;
                  }}
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setEditorCanvasSize((prev) => {
                      if (prev.width === width && prev.height === height) return prev;
                      return { width, height };
                    });
                    if (isTouchingPhotoRef.current) return;
                    if (editorCanvasSize.width === width && editorCanvasSize.height === height) return;
                    setEditorPhotos((prev) =>
                      prev.map((p) => {
                        const clamped = clampPhotoToCanvas(p, width, height);
                        return { ...p, ...clamped };
                      })
                    );
                  }}
                >
                  <View style={s.editorCanvasDrawSurface} {...editorPanResponder.panHandlers} />
                  <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                    <CommittedDrawLayer strokes={editorStrokes} backgroundColor={editorCanvasBackground} />
                    <CurrentDrawLayer stroke={editorCurrentStroke} backgroundColor={editorCanvasBackground} />
                  </Canvas>
                  {editorStickers.map((item) => (
                    <EditorStickerItem
                      key={item.id}
                      stickerItem={item}
                      isActive={editorActiveStickerId === item.id}
                      onTouchStart={handleEditorStickerTouchStart}
                      onBringToFront={bringEditorStickerToFront}
                      onInteractionStart={handleEditorStickerInteractionStart}
                      onInteractionEnd={handleEditorPhotoInteractionEnd}
                      onMove={updateEditorStickerElement}
                      onDragStart={handleEditorStickerDragStart}
                      onDragMove={handleEditorStickerDragMove}
                      onDragEnd={handleEditorStickerDragEnd}
                      disabled={saving}
                    />
                  ))}
                  {editorTextElements.map((item) => (
                    <EditorTextItem
                      key={item.id}
                      textItem={item}
                      isActive={editorActiveTextId === item.id}
                      isEditing={editorEditingTextId === item.id}
                      fontsLoaded={fontsLoaded}
                      onTouchStart={handleEditorTextTouchStart}
                      onBringToFront={bringEditorTextToFront}
                      onInteractionStart={handleEditorTextInteractionStart}
                      onInteractionEnd={handleEditorPhotoInteractionEnd}
                      onMove={updateEditorTextElement}
                      onDragStart={handleEditorTextDragStart}
                      onDragMove={handleEditorTextDragMove}
                      onDragEnd={handleEditorTextDragEnd}
                      onChangeText={(value) => updateEditorTextElement(item.id, { text: value })}
                      onFinalizeEdit={finalizeEditorTextElement}
                      inputRef={(ref) => {
                        editorTextInputRefs.current[item.id] = ref;
                      }}
                      onRequestEdit={(id) => activateEditorTextElement(id, true)}
                      disabled={saving}
                    />
                  ))}
                  {((editorActiveTextId && !editorEditingTextId) || editorActiveStickerId) ? (
                    <View
                      pointerEvents="none"
                      onLayout={(e) => {
                        const { x, y, width, height } = e.nativeEvent.layout;
                        setEditorTrashTargetLayout({ x, y, width, height });
                      }}
                      style={[
                        s.editorTrashTarget,
                        isEditorTextOverTrash && s.editorTrashTargetActive,
                        (editorDraggingTextId || editorDraggingStickerId) && s.editorTrashTargetVisible,
                      ]}
                    >
                      <Trash2 size={18} color={isEditorTextOverTrash ? '#FFFFFF' : '#B2547C'} strokeWidth={2.2} />
                    </View>
                  ) : null}
                  {editorPhotos.map((p) => (
                    <EditorPhotoItem
                      key={p.id}
                      photo={p}
                      isActive={editorActivePhotoId === p.id}
                      canvasWidth={editorCanvasSize.width}
                      canvasHeight={editorCanvasSize.height}
                      onBringToFront={bringEditorPhotoToFront}
                      onInteractionStart={handleEditorPhotoInteractionStart}
                      onInteractionEnd={handleEditorPhotoInteractionEnd}
                      onMove={updateEditorPhotoPosition}
                      disabled={saving}
                    />
                  ))}
                </View>

                <View style={s.editorTextWrap}>
                  <TextInput
                    style={s.editorTextInput}
                    placeholder="Escribe aquí..."
                    placeholderTextColor="#BEA5B1"
                    value={editorText}
                    onChangeText={setEditorText}
                    multiline
                    editable={!saving}
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                </View>

                <View style={s.editorControlsPanel}>
                  {!isEditorColorPanelOpen ? (
                    <>
                      <View style={s.editorToolbarRow}>
                        <Pressable
                          style={[s.toolChip, editorCategory === 'pen' && s.toolChipActive]}
                          onPress={() => {
                            setEditorCategory('pen');
                          }}
                          disabled={saving}
                          accessibilityRole="button"
                          accessibilityLabel="Dibujo"
                          accessibilityState={{ selected: editorCategory === 'pen' }}
                        >
                          <Brush size={18} color={editorCategory === 'pen' ? '#B2547C' : TEXT_SOFT} />
                        </Pressable>
                      <Pressable
                        style={[s.toolChip, editorCategory === 'text' && s.toolChipActive]}
                        onPress={() => {
                          setEditorCategory('text');
                        }}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Texto"
                        accessibilityState={{ selected: editorCategory === 'text' }}
                      >
                        <Type size={18} color={editorCategory === 'text' ? '#B2547C' : TEXT_SOFT} />
                      </Pressable>
                      <Pressable
                        style={[s.toolChip, editorCategory === 'sticker' && s.toolChipActive]}
                        onPress={() => {
                          setEditorCategory('sticker');
                        }}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Stickers"
                        accessibilityState={{ selected: editorCategory === 'sticker' }}
                      >
                        <Sparkles size={18} color={editorCategory === 'sticker' ? '#B2547C' : TEXT_SOFT} />
                      </Pressable>
                      <Pressable
                        style={[s.toolChip, editorCategory === 'bucket' && s.toolChipActive]}
                        onPress={() => {
                          setEditorCategory('bucket');
                        }}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Fondo"
                        accessibilityState={{ selected: editorCategory === 'bucket' }}
                      >
                        <PaintBucket size={18} color={editorCategory === 'bucket' ? '#B2547C' : TEXT_SOFT} />
                      </Pressable>
                    </View>

                    {editorCategory === 'pen' ? (
                      <>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={s.brushRow}
                        >
                          {(
                            [
                              { key: 'pencil', label: 'Lápiz' },
                              { key: 'marker', label: 'Marcador' },
                              { key: 'pen', label: 'Pluma' },
                              { key: 'spray', label: 'Spray suave' },
                              { key: 'highlighter', label: 'Resaltador' },
                              { key: 'watercolor', label: 'Acuarela' },
                            ] as const
                          ).map((b) => {
                            const active = editorToolMode === b.key;
                            return (
                              <Pressable
                                key={b.key}
                                style={[s.brushChip, active && s.brushChipActive]}
                                onPress={() => {
                                  setEditorToolMode(b.key);
                                }}
                                disabled={saving}
                                accessibilityRole="button"
                                accessibilityLabel={b.label}
                                accessibilityState={{ selected: active }}
                              >
                                <View style={s.brushChipRow}>
                                  <SharedDrawingBrushPreview
                                    brush={b.key}
                                    style={s.brushPreviewWrap}
                                    canvasStyle={s.brushPreviewCanvas}
                                    backgroundColor={EDITOR_CANVAS_DEFAULT_BG}
                                  />
                                  <Text style={[s.brushChipText, active && s.brushChipTextActive]}>{b.label}</Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </ScrollView>

                        <View style={s.sliderRow}>
                          <Text style={s.sliderLabel}>Grosor</Text>
                          <Slider
                            style={s.sliderControl}
                            minimumValue={1}
                            maximumValue={18}
                            value={editorStrokeWidth}
                            onValueChange={(value) => setEditorStrokeWidth(clampNumber(Number(value), 1, 18))}
                            minimumTrackTintColor={PINK_STRONG}
                            maximumTrackTintColor="#F3D2E0"
                            thumbTintColor="#B2547C"
                            disabled={saving}
                            accessibilityLabel="Grosor"
                          />
                        </View>

                        <View style={s.sliderRow}>
                          <Text style={s.sliderLabel}>Opacidad</Text>
                          <Slider
                            style={s.sliderControl}
                            minimumValue={0.2}
                            maximumValue={1}
                            value={editorOpacity}
                            onValueChange={(value) => setEditorOpacity(clampNumber(Number(value), 0.2, 1))}
                            minimumTrackTintColor={PINK_STRONG}
                            maximumTrackTintColor="#F3D2E0"
                            thumbTintColor={PINK_STRONG}
                            disabled={saving || editorToolMode === 'eraser'}
                            accessibilityLabel="Opacidad"
                          />
                        </View>
                      </>
                    ) : null}

                    {editorCategory === 'text' ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.dynamicToolsScrollRow}
                      >
                        {[
                          { key: 'normal', label: 'Normal' },
                          { key: 'script', label: 'Script' },
                          { key: 'maquina', label: 'Máquina' },
                          { key: 'serif', label: 'Serif' },
                          { key: 'romantica', label: 'Romántica' },
                          { key: 'fuerte', label: 'Fuerte' },
                        ].map((option) => {
                          const isActive = selectedFontStyle === option.key;
                          return (
                            <Pressable
                              key={option.key}
                              style={[s.toolChip, s.placeholderChip, isActive && s.toolChipActive]}
                              onPress={() => {
                                const nextStyle = option.key as EditorFontStyle;
                                setSelectedFontStyle(nextStyle);
                                if (editorActiveTextId) {
                                  updateEditorTextElement(editorActiveTextId, { fontVariant: nextStyle });
                                }
                              }}
                              disabled={saving}
                            >
                              <Text style={[s.toolChipText, isActive && s.toolChipTextActive]}>{option.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}

                    {editorCategory === 'sticker' ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.dynamicToolsScrollRow}
                      >
                        {['♡', '💖', '✨', '⭐', '🌙', '☀️', '🌸', '🌹', '🦋', '💌', '🧸', '🎀', '🫶', '💫', '🔥', '😘', '🥰', '🐻', '🐱', '🍓'].map(
                          (item) => {
                            const isActive = selectedSticker === item;
                            return (
                              <Pressable
                                key={item}
                                style={[s.stickerChip, isActive && s.stickerChipActive]}
                                onPress={() => setSelectedSticker(item)}
                                disabled={saving}
                              >
                                <Text style={s.stickerChipText}>{item}</Text>
                              </Pressable>
                            );
                          }
                        )}
                      </ScrollView>
                    ) : null}

                    {editorCategory === 'bucket' ? (
                      <>
                        <View style={s.editorToolbarRow}>
                          <View style={s.bucketPreviewChip}>
                            <View style={[s.bucketPreviewSwatch, { backgroundColor: editorCanvasBackground }]} />
                            <Text style={s.bucketPreviewText}>Fondo</Text>
                          </View>
                          <Pressable
                            style={[s.toolChip, s.toolSubChip, s.resetBucketChip]}
                            onPress={() => setEditorCanvasBackground(EDITOR_CANVAS_DEFAULT_BG)}
                            disabled={saving}
                          >
                            <Text style={s.toolChipText}>Restablecer</Text>
                          </Pressable>
                        </View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={s.dynamicToolsScrollRow}
                        >
                          {EDITOR_BACKGROUND_COLORS.map((color) => {
                            const isActive = editorCanvasBackground === color;
                            return (
                              <Pressable
                                key={color}
                                style={[
                                  s.bucketColorSwatch,
                                  { backgroundColor: color },
                                  color === '#FFFFFF' && s.bucketColorSwatchWhite,
                                  isActive && s.bucketColorSwatchActive,
                                ]}
                                onPress={() => setEditorCanvasBackground(color)}
                                disabled={saving}
                                accessibilityRole="button"
                                accessibilityLabel={`Fondo ${color}`}
                                accessibilityState={{ selected: isActive }}
                              />
                            );
                          })}
                        </ScrollView>
                      </>
                    ) : null}
                  </>
                ) : (
                  <View style={s.colorPanelWrap}>
                    <View style={s.colorPanelGrid}>
                      {[
                        '#FFFFFF',
                        '#F2F2F5',
                        '#B8B0B6',
                        '#1E1B1D',
                        '#FAD1E8',
                        '#E88CAF',
                        '#D94B8A',
                        '#E53935',
                        '#4A1535',
                        '#E9D7FF',
                        '#9B6EF3',
                        '#4A2A7A',
                        '#F5D36B',
                        '#F39C4A',
                        '#FFC4A3',
                        '#F3E1D2',
                        '#D7B59C',
                        '#A8745A',
                        '#5A3A2E',
                        '#9ED7FF',
                        '#3B82F6',
                        '#1E3A8A',
                        '#7CC3A3',
                        '#34D399',
                        '#065F46',
                      ].map((c) => (
                        <Pressable
                          key={c}
                          style={[
                            s.colorPanelSwatch,
                            { backgroundColor: c },
                            c === '#FFFFFF' && s.colorPanelSwatchWhite,
                            editorColor === c && s.colorPanelSwatchSelected,
                          ]}
                          onPress={() => {
                            setEditorColor(c);
                            setIsEditorColorPanelOpen(false);
                            setEditorCategory(editorCategoryBeforeColor);
                          }}
                          disabled={saving}
                        />
                      ))}
                    </View>
                  </View>
                )}

                  <View style={s.editorActionsRow}>
                    <Pressable
                      style={s.editorActionButton}
                      onPress={() => {
                        setIsEditorColorPanelOpen((open) => {
                          const next = !open;
                          if (next) {
                            setEditorCategoryBeforeColor(editorCategory);
                          }
                          return next;
                        });
                      }}
                      disabled={saving}
                    >
                      <View style={s.colorButtonIconRow}>
                        <Palette size={16} color={TEXT} />
                        <View style={[s.activeColorDot, { backgroundColor: editorColor }]} />
                      </View>
                      <Text style={s.editorActionText}>Color</Text>
                    </Pressable>

                  <Pressable
                    style={s.editorActionButton}
                    onPress={handleEditorFotoPress}
                    disabled={saving}
                  >
                    <ImageIcon size={16} color={TEXT} />
                    <Text style={s.editorActionText}>Foto</Text>
                  </Pressable>

                  <Pressable
                    style={[s.editorSaveButton, saving && s.editorSaveButtonDisabled]}
                    disabled={saving}
                    onPress={() => {
                      if (editorEditingTextId) {
                        finalizeEditorTextElement(editorEditingTextId);
                        Keyboard.dismiss();
                      }
                      const canvasTextsForSave = editorTextElements.filter((item) => item.text.trim().length > 0);
                      const hasDrawing =
                        editorStrokes.length > 0 ||
                        (editorCurrentStroke?.points?.length ?? 0) > 1 ||
                        editorCanvasBackground !== EDITOR_CANVAS_DEFAULT_BG ||
                        editorPhotos.length > 0 ||
                        canvasTextsForSave.length > 0 ||
                        editorStickers.length > 0;
                      const strokesForSave = editorCurrentStroke ? [...editorStrokes, editorCurrentStroke] : editorStrokes;
                      const drawing = hasDrawing
                        ? {
                            backgroundColor: editorCanvasBackground,
                            strokes: strokesForSave.map((st) => ({
                              id: st.id,
                              brush: normalizeDrawBrush(st.brush),
                              color: st.color,
                              width: st.width,
                              opacity: st.opacity,
                              points: st.points,
                            })),
                            photos: editorPhotos,
                            texts: canvasTextsForSave,
                            stickers: editorStickers,
                          }
                        : null;
                      const text = editorText;
                      const noteType: 'text' | 'drawing' | 'mixed' =
                        drawing && text.trim() ? 'mixed' : drawing ? 'drawing' : 'text';
                      handleSaveNote({ text, drawing, noteType });
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={WHITE} />
                    ) : (
                      <Text style={s.editorSaveText}>Guardar</Text>
                    )}
                  </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </GestureHandlerRootView>
      </Modal>
      <EditorPhotoSourceSheet
        visible={isEditorPhotoSheetOpen && isEditorOpen}
        onClose={() => setIsEditorPhotoSheetOpen(false)}
        onTake={handleEditorPhotoSheetTake}
        onPick={handleEditorPhotoSheetPick}
      />
      <EditorPhotoSourceSheet
        visible={isMainPhotoSheetOpen && !isEditorOpen}
        onClose={() => setIsMainPhotoSheetOpen(false)}
        onTake={handleMainPhotoSheetTake}
        onPick={handleMainPhotoSheetPick}
      />
      <Modal visible={showAlbum} animationType="fade" transparent onRequestClose={() => setShowAlbum(false)}>
        <View style={s.albumOverlayBackdrop}>
          <Pressable style={s.albumOverlayDismissArea} onPress={() => setShowAlbum(false)} />
          <View style={[s.albumOverlayCenter, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
            <View style={s.albumStaticShellWrap}>
              <Pressable style={s.albumOverlayCloseButton} onPress={() => setShowAlbum(false)}>
                <X size={18} color={TEXT} />
              </Pressable>
              <View style={[s.albumStaticBook, { width: bookWidth, height: bookHeight }]}>
                <Text style={s.albumBookTitle}>Recuerdos juntos</Text>
                <View style={[s.albumStaticPageLeft, { width: pageWidth, height: bookHeight }]}>
                  <View style={s.albumStaticPageCanvas}>
                    <PageDecoration side="left" />
                    {leftItems.map((item, index) => (
                      <MemoryPiece
                        key={item.id}
                        item={item}
                        layout={leftLayouts[index] ?? leftLayouts[0]}
                        fontsLoaded={fontsLoaded}
                      />
                    ))}
                  </View>
                </View>
                <View style={[s.albumStaticFold, { width: foldWidth, height: bookHeight }]} />
                <View style={[s.albumStaticPageRight, { width: pageWidth, height: bookHeight }]}>
                  <View style={s.albumStaticPageCanvas}>
                    <PageDecoration side="right" />
                    {rightItems.map((item, index) => (
                      <MemoryPiece
                        key={item.id}
                        item={item}
                        layout={rightLayouts[index] ?? rightLayouts[0]}
                        fontsLoaded={fontsLoaded}
                      />
                    ))}
                  </View>
                </View>
                {memories.length === 0 ? (
                  <View style={s.albumEmptyOverlay} pointerEvents="none">
                    <View style={s.emptyBookState}>
                      <Text style={s.emptyBookTitle}>Aún no hay recuerdos aquí ♡</Text>
                      <Text style={s.emptyBookSubtitle}>Guarda una nota, una foto o un dibujo para empezar.</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const AlbumSpreadView = React.memo(function AlbumSpreadView({
  spread,
  fontsLoaded,
  onSelect,
}: {
  spread: AlbumSpread;
  fontsLoaded: boolean;
  onSelect: (entry: AlbumEntry) => void;
}) {
  return (
    <View style={s.albumSpread}>
      <View style={s.openBookPageLeft}>
        <View style={s.openBookPageGlow} pointerEvents="none" />
        <AlbumPageView side="left" items={spread.left} fontsLoaded={fontsLoaded} onSelect={onSelect} />
      </View>
      <View style={s.openBookBindingSoft} pointerEvents="none">
        <View style={s.openBookBindingLineSoft} />
      </View>
      <View style={s.openBookPageRight}>
        <View style={s.openBookPageGlowRight} pointerEvents="none" />
        <AlbumPageView side="right" items={spread.right} fontsLoaded={fontsLoaded} onSelect={onSelect} />
      </View>
    </View>
  );
});

function AlbumPageView({
  side,
  items,
  fontsLoaded,
  onSelect,
}: {
  side: 'left' | 'right';
  items: AlbumEntry[];
  fontsLoaded: boolean;
  onSelect: (entry: AlbumEntry) => void;
}) {
  const slots = useMemo(() => getAlbumPageSlots(items.length, side), [items.length, side]);
  return (
    <View style={s.albumPageCanvas}>
      {items.map((entry, index) => (
        <MemoryPiece
          key={entry.id}
          entry={entry}
          fontsLoaded={fontsLoaded}
          slot={slots[index] ?? slots[0]}
          onPress={() => onSelect(entry)}
        />
      ))}
    </View>
  );
}

type AlbumSlot = { left: number; top: number; width: number; rotate: number };

function getAlbumPageSlots(count: number, side: 'left' | 'right'): AlbumSlot[] {
  const left3: AlbumSlot[] = [
    { left: 14, top: 22, width: 124, rotate: -3.2 },
    { left: 150, top: 36, width: 112, rotate: 2.2 },
    { left: 48, top: 210, width: 148, rotate: -1.1 },
  ];
  const right3: AlbumSlot[] = [
    { left: 148, top: 28, width: 118, rotate: 2.8 },
    { left: 14, top: 44, width: 114, rotate: -2.2 },
    { left: 56, top: 218, width: 144, rotate: 1.2 },
  ];
  const left2: AlbumSlot[] = [
    { left: 20, top: 26, width: 138, rotate: -2.6 },
    { left: 96, top: 214, width: 148, rotate: 1.4 },
  ];
  const right2: AlbumSlot[] = [
    { left: 104, top: 26, width: 138, rotate: 2.4 },
    { left: 16, top: 206, width: 148, rotate: -1.2 },
  ];
  const left1: AlbumSlot[] = [{ left: 52, top: 74, width: 168, rotate: -1.4 }];
  const right1: AlbumSlot[] = [{ left: 52, top: 74, width: 168, rotate: 1.4 }];
  if (count <= 1) return side === 'left' ? left1 : right1;
  if (count === 2) return side === 'left' ? left2 : right2;
  return side === 'left' ? left3 : right3;
}

function getLegacyMemoryPieceLayout(item: AlbumEntry, slot: AlbumSlot): MemoryPieceLayout {
  const previewImage = item.previewImage || item.photoUrl || item.drawingUrl;
  const height = previewImage ? 150 : item.type === 'text' ? 110 : 124;
  return {
    x: slot.left,
    y: slot.top,
    w: slot.width,
    h: height,
    rotate: `${slot.rotate}deg`,
  };
}

function TapePiece({ seed, variant = 'single' }: { seed: number; variant?: 'single' | 'double' }) {
  if (variant === 'double') {
    return (
      <>
        <View
          pointerEvents="none"
          style={[
            s.tapePieceBase,
            s.tapePieceTopLeft,
            { transform: [{ rotate: seed % 2 === 0 ? '-12deg' : '-8deg' }] },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            s.tapePieceBase,
            s.tapePieceTopRight,
            { transform: [{ rotate: seed % 2 === 0 ? '9deg' : '12deg' }] },
          ]}
        />
      </>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        s.tapePieceBase,
        s.tapePieceTop,
        { transform: [{ translateX: -22 }, { rotate: seed % 2 === 0 ? '-7deg' : '5deg' }] },
      ]}
    />
  );
}

function PaperClip({ side = 'right' }: { side?: 'left' | 'right' }) {
  return (
    <View style={[s.paperClip, side === 'left' ? s.paperClipLeft : s.paperClipRight]} pointerEvents="none">
      <View style={s.paperClipInner} />
    </View>
  );
}

function PageDecoration({ side }: { side: 'left' | 'right' }) {
  return (
    <>
      <Text
        pointerEvents="none"
        style={[
          s.pageDecoration,
          side === 'left' ? s.pageDecorationLeftTop : s.pageDecorationRightTop,
        ]}
      >
        ♡
      </Text>
      <Text
        pointerEvents="none"
        style={[
          s.pageDecoration,
          s.pageDecorationTiny,
          side === 'left' ? s.pageDecorationLeftBottom : s.pageDecorationRightBottom,
        ]}
      >
        ✦
      </Text>
    </>
  );
}

function PolaroidPiece({
  item,
  seed,
  caption,
  fontsLoaded,
  attachment,
}: {
  item: AlbumEntry;
  seed: number;
  caption: string;
  fontsLoaded: boolean;
  attachment: MemoryAttachment;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri = item.previewImage || item.photoUrl || item.drawingUrl;

  return (
    <View style={s.polaroidWrap}>
      {attachment === 'clip' ? <PaperClip side={seed % 2 === 0 ? 'left' : 'right'} /> : <TapePiece seed={seed} variant={attachment === 'double_tape' ? 'double' : 'single'} />}
      <View style={s.polaroidShadow} pointerEvents="none" />
      <View style={s.polaroidFrame}>
        <View style={s.polaroidPhotoArea}>
          {imageUri && !imageFailed ? (
            <Image source={{ uri: imageUri }} style={s.polaroidImage} resizeMode="cover" onError={() => setImageFailed(true)} />
          ) : (
            <View style={s.polaroidPlaceholder}>
              <View style={s.polaroidPlaceholderInner}>
                <Text style={s.polaroidPlaceholderIcon}>✦</Text>
                <Text style={s.polaroidPlaceholderText}>Foto</Text>
              </View>
            </View>
          )}
        </View>
        <Text
          style={[s.polaroidCaption, fontsLoaded ? { fontFamily: 'DancingScript_600SemiBold' } : null]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

function NotePaperPiece({
  item,
  caption,
  fontsLoaded,
  seed,
  attachment,
}: {
  item: AlbumEntry;
  caption: string;
  fontsLoaded: boolean;
  seed: number;
  attachment: MemoryAttachment;
}) {
  const previewText = item.text?.trim() ? truncateText(item.text, 92) : 'Recuerdo';
  const stampLabel = item.createdAt ? caption : '♡';

  return (
    <View style={s.notePaperWrap}>
      {attachment === 'clip' ? <PaperClip side={seed % 2 === 0 ? 'left' : 'right'} /> : <TapePiece seed={seed} variant={attachment === 'double_tape' ? 'double' : 'single'} />}
      <View style={[s.notePaperCard, { backgroundColor: getMemoryPaperTone(item) }]}>
        <Text style={s.notePaperStamp} numberOfLines={1}>
          ♡
        </Text>
        <View style={s.notePaperLines} pointerEvents="none">
          <View style={s.notePaperLine} />
          <View style={s.notePaperLine} />
          <View style={s.notePaperLine} />
          <View style={[s.notePaperLine, s.notePaperLineShort]} />
        </View>
        <Text
          style={[s.notePaperText, fontsLoaded ? { fontFamily: 'DancingScript_600SemiBold' } : null]}
          numberOfLines={4}
          ellipsizeMode="tail"
        >
          {previewText}
        </Text>
        <Text style={s.notePaperMeta} numberOfLines={1}>
          {stampLabel}
        </Text>
      </View>
    </View>
  );
}

function DrawingPiece({
  item,
  caption,
  seed,
  fontsLoaded,
  attachment,
}: {
  item: AlbumEntry;
  caption: string;
  seed: number;
  fontsLoaded: boolean;
  attachment: MemoryAttachment;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUri = item.previewImage || item.photoUrl || item.drawingUrl;

  return (
    <View style={s.drawingWrap}>
      {attachment === 'clip' ? <PaperClip side={seed % 2 === 0 ? 'right' : 'left'} /> : <TapePiece seed={seed} variant="single" />}
      <View style={[s.drawingCard, { backgroundColor: getMemoryPaperTone(item) || item.backgroundColor || '#FFF8EE' }]}>
        {imageUri && !imageFailed ? (
          <Image source={{ uri: imageUri }} style={s.drawingImage} resizeMode="cover" onError={() => setImageFailed(true)} />
        ) : (
          <View style={s.drawingFallback}>
            <Text style={s.drawingFallbackIcon}>✦</Text>
            <View style={s.drawingFallbackDoodle}>
              <View style={s.drawingFallbackLine} />
              <View style={[s.drawingFallbackLine, s.drawingFallbackLineShort]} />
            </View>
            <Text style={s.drawingFallbackText}>Nota con dibujo</Text>
          </View>
        )}
        <Text
          style={[s.drawingCaption, fontsLoaded ? { fontFamily: 'DancingScript_600SemiBold' } : null]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

type MemoryPieceProps =
  | {
      item: AlbumEntry;
      layout: MemoryPieceLayout;
      fontsLoaded: boolean;
      onPress?: () => void;
    }
  | {
      entry: AlbumEntry;
      slot: AlbumSlot;
      fontsLoaded: boolean;
      onPress: () => void;
    };

const MemoryPiece = React.memo(function MemoryPiece(props: MemoryPieceProps) {
  const item = 'item' in props ? props.item : props.entry;
  const layout = 'item' in props ? props.layout : getLegacyMemoryPieceLayout(props.entry, props.slot);
  const onPress = props.onPress;
  const previewImage = item.previewImage || item.photoUrl || item.drawingUrl;
  const isPhotoPiece = item.type === 'photo' || (item.type === 'mixed' && !!previewImage);
  const isTextPiece = item.type === 'text' && !previewImage;
  const caption = getMemoryCaption(item);
  const seed = fnv1aHash(item.id);
  const attachment = getMemoryAttachment(item, seed);
  const pieceZIndex = isPhotoPiece ? 4 : isTextPiece ? 2 : 3;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        s.memoryPiece,
        {
          left: layout.x,
          top: layout.y,
          width: layout.w,
          height: layout.h,
          zIndex: pieceZIndex,
          transform: [{ rotate: getSeededRotate(layout.rotate, seed) }],
        },
      ]}
    >
      {isPhotoPiece ? (
        <PolaroidPiece item={item} seed={seed} caption={caption} fontsLoaded={props.fontsLoaded} attachment={attachment} />
      ) : isTextPiece ? (
        <NotePaperPiece item={item} caption={caption} fontsLoaded={props.fontsLoaded} seed={seed} attachment={attachment} />
      ) : (
        <DrawingPiece item={item} caption={caption} seed={seed} fontsLoaded={props.fontsLoaded} attachment={attachment} />
      )}
    </TouchableOpacity>
  );
});

function EditorPhotoItem({
  photo,
  isActive,
  canvasWidth,
  canvasHeight,
  onBringToFront,
  onInteractionStart,
  onInteractionEnd,
  onMove,
  disabled,
}: {
  photo: EditorPhotoElement;
  isActive: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onBringToFront: (id: string) => void;
  onInteractionStart: (id: string) => void;
  onInteractionEnd: () => void;
  onMove: (
    id: string,
    next: Partial<Pick<EditorPhotoElement, 'x' | 'y' | 'scale' | 'rotation'>>,
    clampToBounds: boolean
  ) => void;
  disabled: boolean;
}) {
  const localGestureCountRef = useRef(0);
  const translateX = useSharedValue(photo.x);
  const translateY = useSharedValue(photo.y);
  const liveScale = useSharedValue(photo.scale);
  const liveRotation = useSharedValue((photo.rotation * Math.PI) / 180);
  const startX = useSharedValue(photo.x);
  const startY = useSharedValue(photo.y);
  const pinchStartScale = useSharedValue(photo.scale);
  const rotationStart = useSharedValue((photo.rotation * Math.PI) / 180);

  useEffect(() => {
    if (localGestureCountRef.current > 0) return;
    translateX.value = photo.x;
    translateY.value = photo.y;
    liveScale.value = photo.scale;
    liveRotation.value = (photo.rotation * Math.PI) / 180;
  }, [liveRotation, liveScale, photo.rotation, photo.scale, photo.x, photo.y, translateX, translateY]);

  const beginInteraction = useCallback(() => {
    const next = localGestureCountRef.current + 1;
    localGestureCountRef.current = next;
    if (next === 1) {
      onInteractionStart(photo.id);
      onBringToFront(photo.id);
    }
  }, [onBringToFront, onInteractionStart, photo.id]);

  const endInteraction = useCallback(() => {
    const next = Math.max(0, localGestureCountRef.current - 1);
    localGestureCountRef.current = next;
    if (next === 0) {
      onInteractionEnd();
    }
  }, [onInteractionEnd]);

  const persistPan = useCallback(
    (nextX: number, nextY: number) => {
      onMove(photo.id, { x: nextX, y: nextY }, true);
    },
    [onMove, photo.id]
  );

  const persistScale = useCallback(
    (scaleValue: number) => {
      onMove(photo.id, { scale: clampNumber(scaleValue, 0.45, 2.4) }, true);
    },
    [onMove, photo.id]
  );

  const persistRotation = useCallback(
    (rotationRad: number) => {
      const deg = (rotationRad * 180) / Math.PI;
      onMove(photo.id, { rotation: deg }, true);
    },
    [onMove, photo.id]
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
      })
      .onFinalize(() => {
        runOnJS(persistPan)(translateX.value, translateY.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, persistPan, startX, startY, translateX, translateY]);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .enabled(!disabled)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        pinchStartScale.value = liveScale.value;
      })
      .onUpdate((e) => {
        const next = pinchStartScale.value * e.scale;
        liveScale.value = Math.min(2.4, Math.max(0.45, next));
      })
      .onFinalize(() => {
        runOnJS(persistScale)(liveScale.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, liveScale, persistScale, pinchStartScale]);

  const rotationGesture = useMemo(() => {
    return Gesture.Rotation()
      .enabled(!disabled)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        rotationStart.value = liveRotation.value;
      })
      .onUpdate((e) => {
        liveRotation.value = rotationStart.value + e.rotation;
      })
      .onFinalize(() => {
        runOnJS(persistRotation)(liveRotation.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, liveRotation, persistRotation, rotationStart]);

  const composedGesture = useMemo(() => {
    return Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);
  }, [panGesture, pinchGesture, rotationGesture]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: liveScale.value },
        { rotateZ: `${liveRotation.value}rad` },
      ],
    };
  });

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        pointerEvents="box-only"
        style={[
          s.editorPhotoContainer,
          {
            left: -photo.width / 2,
            top: -photo.height / 2,
            width: photo.width,
            height: photo.height,
          },
          animatedStyle,
        ]}
      >
        <View style={[s.editorPhotoPolaroid, isActive && s.editorPhotoPolaroidActive]}>
          <View style={[s.editorPhotoTape, { left: 10 }]} />
          <View style={[s.editorPhotoTapeSecondary, { right: 14 }]} />
          <Image source={{ uri: photo.uri }} style={s.editorPhotoImage} resizeMode="cover" />
          <View style={s.editorPhotoBottomSpace} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function EditorTextItem({
  textItem,
  isActive,
  isEditing,
  fontsLoaded,
  onTouchStart,
  onBringToFront,
  onInteractionStart,
  onInteractionEnd,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onChangeText,
  onFinalizeEdit,
  inputRef,
  onRequestEdit,
  disabled,
}: {
  textItem: EditorTextElement;
  isActive: boolean;
  isEditing: boolean;
  fontsLoaded: boolean;
  onTouchStart: (id: string) => void;
  onBringToFront: (id: string) => void;
  onInteractionStart: (id: string) => void;
  onInteractionEnd: () => void;
  onMove: (
    id: string,
    next: Partial<Pick<EditorTextElement, 'x' | 'y' | 'scale' | 'rotation' | 'text' | 'color' | 'fontSize' | 'fontVariant'>>
  ) => void;
  onDragStart: (id: string) => void;
  onDragMove: (centerX: number, centerY: number) => void;
  onDragEnd: (id: string, nextX: number, nextY: number, centerX: number, centerY: number) => void;
  onChangeText: (value: string) => void;
  onFinalizeEdit: (id: string) => void;
  inputRef: (ref: TextInput | null) => void;
  onRequestEdit: (id: string) => void;
  disabled: boolean;
}) {
  const { width, height } = estimateEditorTextSize(textItem);
  const localGestureCountRef = useRef(0);
  const translateX = useSharedValue(textItem.x);
  const translateY = useSharedValue(textItem.y);
  const liveScale = useSharedValue(textItem.scale);
  const liveRotation = useSharedValue((textItem.rotation * Math.PI) / 180);
  const startX = useSharedValue(textItem.x);
  const startY = useSharedValue(textItem.y);
  const pinchStartScale = useSharedValue(textItem.scale);
  const rotationStart = useSharedValue((textItem.rotation * Math.PI) / 180);

  useEffect(() => {
    if (localGestureCountRef.current > 0) return;
    translateX.value = textItem.x;
    translateY.value = textItem.y;
    liveScale.value = textItem.scale;
    liveRotation.value = (textItem.rotation * Math.PI) / 180;
  }, [
    liveRotation,
    liveScale,
    textItem.rotation,
    textItem.scale,
    textItem.x,
    textItem.y,
    translateX,
    translateY,
  ]);

  const beginInteraction = useCallback(() => {
    const next = localGestureCountRef.current + 1;
    localGestureCountRef.current = next;
    if (next === 1) {
      onInteractionStart(textItem.id);
      onBringToFront(textItem.id);
    }
  }, [onBringToFront, onInteractionStart, textItem.id]);

  const endInteraction = useCallback(() => {
    const next = Math.max(0, localGestureCountRef.current - 1);
    localGestureCountRef.current = next;
    if (next === 0) {
      onInteractionEnd();
    }
  }, [onInteractionEnd]);

  const persistScale = useCallback(
    (scaleValue: number) => {
      onMove(textItem.id, { scale: clampNumber(scaleValue, 0.45, 2.4) });
    },
    [onMove, textItem.id]
  );

  const persistRotation = useCallback(
    (rotationRad: number) => {
      onMove(textItem.id, { rotation: (rotationRad * 180) / Math.PI });
    },
    [onMove, textItem.id]
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled && !isEditing)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        runOnJS(onDragStart)(textItem.id);
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
        runOnJS(onDragMove)(translateX.value + width / 2, translateY.value + height / 2);
      })
      .onFinalize(() => {
        runOnJS(onDragEnd)(
          textItem.id,
          translateX.value,
          translateY.value,
          translateX.value + width / 2,
          translateY.value + height / 2
        );
        runOnJS(endInteraction)();
      });
  }, [
    beginInteraction,
    disabled,
    endInteraction,
    height,
    isEditing,
    onDragEnd,
    onDragMove,
    onDragStart,
    startX,
    startY,
    textItem.id,
    translateX,
    translateY,
    width,
  ]);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .enabled(!disabled && !isEditing)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        pinchStartScale.value = liveScale.value;
      })
      .onUpdate((e) => {
        const next = pinchStartScale.value * e.scale;
        liveScale.value = Math.min(2.4, Math.max(0.45, next));
      })
      .onFinalize(() => {
        runOnJS(persistScale)(liveScale.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, isEditing, liveScale, persistScale, pinchStartScale]);

  const rotationGesture = useMemo(() => {
    return Gesture.Rotation()
      .enabled(!disabled && !isEditing)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        rotationStart.value = liveRotation.value;
      })
      .onUpdate((e) => {
        liveRotation.value = rotationStart.value + e.rotation;
      })
      .onFinalize(() => {
        runOnJS(persistRotation)(liveRotation.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, isEditing, liveRotation, persistRotation, rotationStart]);

  const editTapGesture = useMemo(() => {
    return Gesture.Tap()
      .enabled(!disabled && !isEditing)
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        if (success) {
          runOnJS(onRequestEdit)(textItem.id);
        }
      });
  }, [disabled, isEditing, onRequestEdit, textItem.id]);

  const composedGesture = useMemo(() => {
    return Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture, editTapGesture);
  }, [editTapGesture, panGesture, pinchGesture, rotationGesture]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: liveScale.value },
      { rotateZ: `${liveRotation.value}rad` },
    ],
  }));

  const content = (
    <Animated.View
      pointerEvents={isEditing ? 'auto' : 'box-only'}
      onTouchStart={() => onTouchStart(textItem.id)}
      style={[
        s.editorCanvasTextItem,
        { width, minHeight: height, zIndex: isActive ? 18 : 14 },
        animatedStyle,
      ]}
    >
      {isEditing ? (
        <TextInput
          ref={inputRef}
          style={[
            s.editorCanvasTextInput,
            {
              color: textItem.color,
              fontSize: textItem.fontSize,
              lineHeight: textItem.fontSize + 6,
              ...getEditorTextVariantStyle(textItem.fontVariant, fontsLoaded),
            },
          ]}
          value={textItem.text}
          onChangeText={onChangeText}
          onBlur={() => onFinalizeEdit(textItem.id)}
          placeholder="Escribe..."
          placeholderTextColor="#B59A8A"
          editable={!disabled}
          multiline
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={() => onFinalizeEdit(textItem.id)}
          maxLength={180}
        />
      ) : (
        <Text
          style={[
            s.editorCanvasTextLabel,
            {
              color: textItem.color,
              fontSize: textItem.fontSize,
              lineHeight: textItem.fontSize + 6,
              ...getEditorTextVariantStyle(textItem.fontVariant, fontsLoaded),
            },
          ]}
        >
          {textItem.text || 'Escribe...'}
        </Text>
      )}
    </Animated.View>
  );

  if (isEditing) {
    return content;
  }

  return <GestureDetector gesture={composedGesture}>{content}</GestureDetector>;
}

function EditorStickerItem({
  stickerItem,
  isActive,
  onTouchStart,
  onBringToFront,
  onInteractionStart,
  onInteractionEnd,
  onMove,
  onDragStart,
  onDragMove,
  onDragEnd,
  disabled,
}: {
  stickerItem: EditorStickerElement;
  isActive: boolean;
  onTouchStart: (id: string) => void;
  onBringToFront: (id: string) => void;
  onInteractionStart: (id: string) => void;
  onInteractionEnd: () => void;
  onMove: (id: string, next: Partial<Pick<EditorStickerElement, 'x' | 'y' | 'scale' | 'rotation'>>) => void;
  onDragStart: (id: string) => void;
  onDragMove: (centerX: number, centerY: number) => void;
  onDragEnd: (id: string, nextX: number, nextY: number, centerX: number, centerY: number) => void;
  disabled: boolean;
}) {
  const { width, height } = estimateEditorStickerSize(stickerItem);
  const localGestureCountRef = useRef(0);
  const translateX = useSharedValue(stickerItem.x);
  const translateY = useSharedValue(stickerItem.y);
  const liveScale = useSharedValue(stickerItem.scale);
  const liveRotation = useSharedValue((stickerItem.rotation * Math.PI) / 180);
  const startX = useSharedValue(stickerItem.x);
  const startY = useSharedValue(stickerItem.y);
  const pinchStartScale = useSharedValue(stickerItem.scale);
  const rotationStart = useSharedValue((stickerItem.rotation * Math.PI) / 180);

  useEffect(() => {
    if (localGestureCountRef.current > 0) return;
    translateX.value = stickerItem.x;
    translateY.value = stickerItem.y;
    liveScale.value = stickerItem.scale;
    liveRotation.value = (stickerItem.rotation * Math.PI) / 180;
  }, [
    liveRotation,
    liveScale,
    stickerItem.rotation,
    stickerItem.scale,
    stickerItem.x,
    stickerItem.y,
    translateX,
    translateY,
  ]);

  const beginInteraction = useCallback(() => {
    const next = localGestureCountRef.current + 1;
    localGestureCountRef.current = next;
    if (next === 1) {
      onInteractionStart(stickerItem.id);
      onBringToFront(stickerItem.id);
    }
  }, [onBringToFront, onInteractionStart, stickerItem.id]);

  const endInteraction = useCallback(() => {
    const next = Math.max(0, localGestureCountRef.current - 1);
    localGestureCountRef.current = next;
    if (next === 0) {
      onInteractionEnd();
    }
  }, [onInteractionEnd]);

  const persistScale = useCallback(
    (scaleValue: number) => {
      onMove(stickerItem.id, { scale: clampNumber(scaleValue, 0.45, 2.4) });
    },
    [onMove, stickerItem.id]
  );

  const persistRotation = useCallback(
    (rotationRad: number) => {
      onMove(stickerItem.id, { rotation: (rotationRad * 180) / Math.PI });
    },
    [onMove, stickerItem.id]
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled)
      .minPointers(1)
      .maxPointers(1)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        runOnJS(onDragStart)(stickerItem.id);
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
        runOnJS(onDragMove)(translateX.value + width / 2, translateY.value + height / 2);
      })
      .onFinalize(() => {
        runOnJS(onDragEnd)(
          stickerItem.id,
          translateX.value,
          translateY.value,
          translateX.value + width / 2,
          translateY.value + height / 2
        );
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, height, onDragEnd, onDragMove, onDragStart, startX, startY, stickerItem.id, translateX, translateY, width]);

  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .enabled(!disabled)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        pinchStartScale.value = liveScale.value;
      })
      .onUpdate((e) => {
        const next = pinchStartScale.value * e.scale;
        liveScale.value = Math.min(2.4, Math.max(0.45, next));
      })
      .onFinalize(() => {
        runOnJS(persistScale)(liveScale.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, liveScale, persistScale, pinchStartScale]);

  const rotationGesture = useMemo(() => {
    return Gesture.Rotation()
      .enabled(!disabled)
      .onBegin(() => {
        runOnJS(beginInteraction)();
        rotationStart.value = liveRotation.value;
      })
      .onUpdate((e) => {
        liveRotation.value = rotationStart.value + e.rotation;
      })
      .onFinalize(() => {
        runOnJS(persistRotation)(liveRotation.value);
        runOnJS(endInteraction)();
      });
  }, [beginInteraction, disabled, endInteraction, liveRotation, persistRotation, rotationStart]);

  const composedGesture = useMemo(() => {
    return Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture);
  }, [panGesture, pinchGesture, rotationGesture]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: liveScale.value },
      { rotateZ: `${liveRotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        pointerEvents="box-only"
        onTouchStart={() => onTouchStart(stickerItem.id)}
        style={[
          s.editorStickerItem,
          { width, height, zIndex: isActive ? 16 : 12 },
          animatedStyle,
        ]}
      >
        <Text style={s.editorStickerLabel}>{stickerItem.sticker}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

function EditorPhotoSourceSheet({
  visible,
  onClose,
  onTake,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onTake: () => void;
  onPick: () => void;
}) {
  const SHEET_HEIGHT = 280;
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (!visible) return;
    translateY.value = SHEET_HEIGHT;
    translateY.value = withTiming(0, { duration: 220 });
  }, [SHEET_HEIGHT, translateY, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const close = useCallback(() => {
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished?: boolean) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  }, [SHEET_HEIGHT, onClose, translateY]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={s.photoSheetBackdrop}>
        <Pressable style={s.photoSheetBackdropPress} onPress={close} />
        <Animated.View style={[s.photoSheetCard, animatedStyle]}>
          <View style={s.photoSheetHandle} />
          <Pressable
            style={s.photoSheetButton}
            onPress={() => {
              close();
              onTake();
            }}
          >
            <Text style={s.photoSheetButtonText}>Tomar foto</Text>
          </Pressable>
          <Pressable
            style={s.photoSheetButton}
            onPress={() => {
              close();
              onPick();
            }}
          >
            <Text style={s.photoSheetButtonText}>Elegir foto</Text>
          </Pressable>
          <Pressable style={[s.photoSheetButton, s.photoSheetCancelButton]} onPress={close}>
            <Text style={[s.photoSheetButtonText, s.photoSheetCancelText]}>Cancelar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingState: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    minHeight: 56,
  },
  headerCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 3,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PINK_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(232, 140, 175, 0.36)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: TEXT_SOFT,
    letterSpacing: 0.8,
  },
  errorText: {
    marginBottom: 10,
    color: '#C75C7D',
    fontSize: 13,
  },
  noCoupleCard: {
    backgroundColor: WHITE,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    marginTop: 36,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 5,
  },
  noCoupleHeart: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noCoupleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
  },
  noCoupleText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SOFT,
    textAlign: 'center',
  },
  connectButton: {
    marginTop: 18,
    backgroundColor: PINK_STRONG,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  connectButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  canvasCard: {
    backgroundColor: WHITE,
    borderRadius: 30,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 6,
  },
  cardTitle: {
    color: '#D989A9',
    fontSize: 22,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  canvasGlowPink: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(248, 220, 232, 0.55)',
    top: -50,
    right: -40,
  },
  canvasGlowLilac: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(233, 224, 250, 0.42)',
    bottom: -28,
    left: -18,
  },
  canvasPaper: {
    height: Math.min(Math.max(SCREEN_HEIGHT * 0.31, 230), 268),
    backgroundColor: '#FFFDFE',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#EECFDC',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  noteInput: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    color: TEXT,
    fontSize: 15,
    lineHeight: 24,
  },
  mainCardPhotoPreview: {
    width: '100%',
    height: '100%',
  },
  mainCardPhotoLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(76, 42, 61, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 18,
  },
  sideToolButton: {
    width: 70,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FBE6EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sideToolButtonDisabled: {
    opacity: 0.6,
  },
  sideToolText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '700',
  },
  plusButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: PINK_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(232, 140, 175, 0.36)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 5,
  },
  plusButtonDisabled: {
    opacity: 0.7,
  },
  editorOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(76, 42, 61, 0.34)',
    justifyContent: 'center',
  },
  editorOverlayDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  editorOverlayCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  editorCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 34,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  editorCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 3,
  },
  editorHeader: {
    paddingRight: 64,
    marginBottom: 12,
  },
  editorTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.2,
  },
  editorSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SOFT,
    letterSpacing: 0.2,
  },
  editorCanvas: {
    height: Math.min(Math.max(SCREEN_HEIGHT * 0.42, 300), 390),
    borderRadius: 26,
    backgroundColor: '#FFF7FB',
    borderWidth: 2,
    borderColor: '#EECFDC',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  editorCanvasDrawSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  editorCanvasTextItem: {
    position: 'absolute',
    left: 0,
    top: 0,
    minWidth: 92,
    maxWidth: 240,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  editorCanvasTextItemActive: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 249, 252, 0.78)',
  },
  editorStickerItem: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorStickerItemActive: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 248, 252, 0.68)',
  },
  editorStickerLabel: {
    fontSize: 34,
    textAlign: 'center',
    includeFontPadding: false,
  },
  editorTrashTarget: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 250, 252, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(236, 200, 217, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(178, 84, 124, 0.18)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 40,
    opacity: 0,
    transform: [{ scale: 0.9 }],
  },
  editorTrashTargetVisible: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  editorTrashTargetActive: {
    backgroundColor: '#E88CAF',
    borderColor: '#D94B8A',
    transform: [{ scale: 1.08 }],
    shadowColor: 'rgba(217, 75, 138, 0.28)',
  },
  editorCanvasTextInput: {
    minWidth: 92,
    maxWidth: 240,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    color: TEXT,
    fontSize: 22,
    fontWeight: '600',
    includeFontPadding: false,
  },
  editorCanvasTextLabel: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: TEXT,
    fontSize: 22,
    fontWeight: '600',
  },
  editorTextWrap: {
    marginTop: 10,
    minHeight: 84,
    borderRadius: 22,
    backgroundColor: '#FFF9FC',
    borderWidth: 1,
    borderColor: '#F3DCE7',
    overflow: 'hidden',
  },
  editorTextInput: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    color: TEXT,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 84,
  },
  editorControlsPanel: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: '#FFF8FB',
    borderWidth: 1,
    borderColor: '#F3DCE7',
    padding: 10,
    gap: 8,
  },
  editorToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolChip: {
    flex: 1,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#FBE6EE',
    borderWidth: 1,
    borderColor: 'rgba(241, 215, 226, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolChipActive: {
    backgroundColor: '#F3D2E0',
    borderColor: '#E2A8C1',
  },
  toolChipText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '700',
  },
  toolChipTextActive: {
    color: '#B2547C',
  },
  toolSubChip: {
    flex: 1,
  },
  placeholderChip: {
    flex: 0,
    minWidth: 92,
    paddingHorizontal: 12,
  },
  dynamicToolsScrollRow: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  brushRow: { gap: 8, paddingVertical: 2 },
  brushChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
  },
  brushChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brushPreviewWrap: { width: 44, height: 16, justifyContent: 'center', alignItems: 'center' },
  brushPreviewCanvas: { width: 44, height: 16 },
  brushChipActive: { backgroundColor: '#FFF0F6', borderColor: '#E2A8C1' },
  brushChipText: { color: TEXT_SOFT, fontSize: 12, fontWeight: '800' },
  brushChipTextActive: { color: '#B2547C' },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 32,
  },
  sliderLabel: {
    width: 72,
    color: TEXT_SOFT,
    fontSize: 11,
    fontWeight: '800',
  },
  sliderControl: {
    flex: 1,
    height: 32,
  },
  editorPhotoContainer: {
    position: 'absolute',
    zIndex: 12,
    elevation: 12,
  },
  editorPhotoPolaroid: {
    flex: 1,
    backgroundColor: '#FBF7EE',
    borderRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(187, 178, 164, 0.34)',
    shadowColor: 'rgba(84, 74, 66, 0.11)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  editorPhotoPolaroidActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(181, 164, 145, 0.42)',
    shadowColor: 'rgba(98, 82, 69, 0.13)',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  editorPhotoTape: {
    position: 'absolute',
    top: -5,
    width: 42,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(195, 178, 151, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(129, 111, 92, 0.07)',
    transform: [{ rotate: '-15deg' }],
    shadowColor: 'rgba(92, 77, 62, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3,
    opacity: 0.78,
  },
  editorPhotoTapeSecondary: {
    position: 'absolute',
    top: -3,
    width: 31,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(172, 149, 121, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(118, 96, 74, 0.06)',
    transform: [{ rotate: '8deg' }],
    shadowColor: 'rgba(92, 77, 62, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 2,
    opacity: 0.68,
  },
  editorPhotoImage: {
    width: '100%',
    height: 142,
    borderRadius: 10,
    backgroundColor: '#EEE4D7',
    borderWidth: 1,
    borderColor: 'rgba(184, 173, 158, 0.18)',
  },
  editorPhotoBottomSpace: {
    height: 9,
    marginTop: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(246, 240, 231, 0.8)',
    borderTopWidth: 1,
    borderColor: 'rgba(193, 183, 169, 0.16)',
  },
  photoSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(76, 42, 61, 0.26)',
    justifyContent: 'flex-end',
  },
  photoSheetBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  photoSheetCard: {
    backgroundColor: '#FFF9FC',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: '#F3DCE7',
  },
  photoSheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(76, 42, 61, 0.18)',
    marginBottom: 12,
  },
  photoSheetButton: {
    height: 48,
    borderRadius: 18,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#F1D7E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoSheetButtonText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  photoSheetCancelButton: {
    backgroundColor: '#FBE6EE',
  },
  photoSheetCancelText: {
    color: '#B2547C',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  colorSwatchSelected: {
    borderColor: TEXT,
  },
  stickerChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FBE6EE',
    borderWidth: 1,
    borderColor: 'rgba(241, 215, 226, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerChipActive: {
    backgroundColor: '#F7D8E6',
    borderColor: '#E2A8C1',
  },
  stickerChipText: {
    fontSize: 18,
  },
  bucketPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#F1D7E2',
  },
  bucketPreviewSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 42, 61, 0.12)',
  },
  bucketPreviewText: {
    color: TEXT_SOFT,
    fontSize: 11,
    fontWeight: '700',
  },
  bucketColorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 42, 61, 0.08)',
    shadowColor: 'rgba(117, 89, 102, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  bucketColorSwatchWhite: {
    borderColor: 'rgba(76, 42, 61, 0.16)',
  },
  bucketColorSwatchActive: {
    borderColor: '#D77FA5',
    borderWidth: 2.5,
    shadowColor: 'rgba(215, 127, 165, 0.2)',
    elevation: 3,
  },
  resetBucketChip: {
    flex: 0,
    minWidth: 72,
  },
  colorButtonIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 42, 61, 0.18)',
  },
  colorPanelWrap: {
    paddingVertical: 2,
  },
  colorPanelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  colorPanelSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  colorPanelSwatchSelected: {
    borderColor: PINK_STRONG,
    borderWidth: 3,
  },
  colorPanelSwatchWhite: {
    borderColor: 'rgba(76, 42, 61, 0.18)',
  },
  editorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  editorActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FBE6EE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(241, 215, 226, 0.9)',
  },
  editorActionText: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '700',
  },
  editorSaveButton: {
    flex: 1.15,
    minWidth: 108,
    height: 46,
    borderRadius: 16,
    backgroundColor: PINK_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    shadowColor: 'rgba(232, 140, 175, 0.32)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 5,
  },
  editorSaveButtonDisabled: {
    opacity: 0.7,
  },
  editorSaveText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  albumHeroCard: {
    marginTop: 18,
    backgroundColor: '#F6CCDC',
    borderRadius: 34,
    minHeight: 184,
    paddingVertical: 22,
    paddingLeft: 34,
    paddingRight: 24,
    borderWidth: 1,
    borderColor: '#EFBACF',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 6,
    overflow: 'hidden',
  },
  albumHeroContent: {
    minHeight: 144,
    justifyContent: 'space-between',
    paddingLeft: 20,
    zIndex: 2,
  },
  albumSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 34,
    backgroundColor: '#D17399',
  },
  albumSpineShadow: {
    position: 'absolute',
    left: 30,
    top: 0,
    bottom: 0,
    width: 14,
    backgroundColor: 'rgba(155, 84, 117, 0.16)',
  },
  albumSpineInner: {
    position: 'absolute',
    left: 34,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: '#E8ADC3',
  },
  albumCoverMidTone: {
    position: 'absolute',
    left: 42,
    top: 0,
    bottom: 0,
    width: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  albumCoverEdgeLight: {
    position: 'absolute',
    right: 0,
    top: 10,
    bottom: 10,
    width: 10,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: 'rgba(255, 248, 251, 0.38)',
  },
  albumCoverGlowTop: {
    position: 'absolute',
    top: -6,
    right: 26,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  albumCoverGlowBottom: {
    position: 'absolute',
    bottom: -30,
    left: 58,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  albumSoftCircleLarge: {
    position: 'absolute',
    right: 102,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  albumSoftCircleSmall: {
    position: 'absolute',
    right: 82,
    bottom: 66,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  albumSticker: {
    position: 'absolute',
    right: 118,
    top: 48,
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  albumPaperDetail: {
    position: 'absolute',
    right: 18,
    top: 18,
    width: 86,
    height: 116,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 250, 252, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
    gap: 12,
    transform: [{ rotate: '5deg' }],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: 'rgba(115, 73, 93, 0.16)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  albumPaperTapeLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 223, 233, 0.9)',
    transform: [{ rotate: '-16deg' }],
  },
  albumPaperTapeRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 18,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 223, 233, 0.82)',
    transform: [{ rotate: '14deg' }],
  },
  albumPaperLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(206, 122, 157, 0.34)',
  },
  albumPaperLineShort: {
    width: '68%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(206, 122, 157, 0.28)',
  },
  albumPaperLineTiny: {
    width: '42%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(206, 122, 157, 0.22)',
  },
  albumDecorHeart: {
    position: 'absolute',
    left: 60,
    top: 26,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumDotsRow: {
    position: 'absolute',
    left: 56,
    bottom: 26,
    flexDirection: 'row',
    gap: 6,
  },
  albumDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(209, 115, 153, 0.58)',
  },
  albumTextBlock: {
    maxWidth: '62%',
    paddingTop: 18,
  },
  albumHeroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.25,
  },
  albumHeroSubtitle: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: '#8D6877',
  },
  albumCtaButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#D47A9E',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: 'rgba(190, 102, 138, 0.24)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  albumCtaText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  albumOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(76, 42, 61, 0.34)',
    justifyContent: 'center',
  },
  albumOverlayDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  albumOverlayCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  albumStaticShellWrap: {
    width: '92%',
    height: '68%',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  openBookContainer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumOverlayCloseButton: {
    position: 'absolute',
    top: -6,
    right: 8,
    zIndex: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 3,
  },
  albumStaticBook: {
    flexDirection: 'row',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF4E8',
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  albumBookTitle: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    zIndex: 3,
    textAlign: 'center',
    color: '#936D78',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  albumStaticPageLeft: {
    backgroundColor: '#FFF7EC',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  albumStaticFold: {
    backgroundColor: 'rgba(120, 70, 45, 0.14)',
  },
  albumStaticPageRight: {
    backgroundColor: '#FFF2E5',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  albumStaticPageCanvas: {
    flex: 1,
    position: 'relative',
  },
  pageDecoration: {
    position: 'absolute',
    color: 'rgba(180, 117, 145, 0.32)',
    fontSize: 16,
    zIndex: 0,
  },
  pageDecorationTiny: {
    color: 'rgba(154, 128, 118, 0.24)',
    fontSize: 12,
  },
  pageDecorationLeftTop: {
    top: 34,
    left: 18,
  },
  pageDecorationLeftBottom: {
    bottom: 58,
    right: 30,
  },
  pageDecorationRightTop: {
    top: 42,
    right: 18,
  },
  pageDecorationRightBottom: {
    bottom: 42,
    left: 26,
  },
  albumEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  albumStaticPageLabel: {
    color: '#6C454F',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  albumPager: {
    flex: 1,
    width: '100%',
  },
  albumPagerContent: {
    flexGrow: 1,
  },
  albumSpread: {
    width: '100%',
    flexDirection: 'row',
    minHeight: Math.min(SCREEN_HEIGHT * 0.58, 500),
  },
  openBookBindingSoft: {
    width: 8,
    backgroundColor: 'rgba(120, 70, 45, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBookBindingLineSoft: {
    width: 4,
    height: '100%',
    backgroundColor: 'rgba(120, 70, 45, 0.1)',
  },
  albumPageCanvas: {
    flex: 1,
    position: 'relative',
  },
  memoryPieceBase: {
    position: 'absolute',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
  },
  polaroidPiece: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(230, 187, 205, 0.46)',
  },
  tapePiece: {
    position: 'absolute',
    top: -6,
    width: 28,
    height: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 223, 233, 0.9)',
    zIndex: 2,
  },
  tapePieceLeft: {
    left: 18,
    transform: [{ rotate: '-10deg' }],
  },
  tapePieceRight: {
    right: 18,
    transform: [{ rotate: '10deg' }],
  },
  polaroidImg: {
    width: '100%',
    height: 92,
    borderRadius: 12,
    backgroundColor: '#FBE7EF',
  },
  polaroidCaptionSmall: {
    marginTop: 8,
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  notePiece: {
    backgroundColor: '#FFF0F5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(235, 193, 210, 0.9)',
    padding: 14,
    minHeight: 108,
  },
  notePiecePin: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7A4BE',
  },
  notePieceText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 19,
  },
  notePieceMeta: {
    marginTop: 8,
    color: TEXT_SOFT,
    fontSize: 11,
    fontWeight: '700',
  },
  drawingPiece: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 187, 205, 0.46)',
    minHeight: 118,
  },
  drawingPreview: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.52)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  drawingPreviewLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(123, 91, 108, 0.35)',
    marginBottom: 10,
  },
  drawingPreviewLineShort: {
    width: '72%',
  },
  drawingPreviewLineTiny: {
    width: '48%',
    marginBottom: 0,
  },
  drawingPieceLabel: {
    color: '#A55B7C',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  drawingPieceCaption: {
    color: TEXT,
    fontSize: 12,
    lineHeight: 16,
  },
  albumDetailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,12,16,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  albumDetailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF9FC',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  albumDetailClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WHITE,
  },
  albumDetailDate: {
    color: TEXT_SOFT,
    fontSize: 12,
    marginBottom: 6,
  },
  albumDetailAuthor: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  albumDetailImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 12,
  },
  albumDetailBody: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  openBookSpread: {
    width: '100%',
    minHeight: Math.min(Math.max(SCREEN_HEIGHT * 0.62, 500), 620),
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#FBF5F1',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  openBookShadow: {
    ...StyleSheet.absoluteFillObject,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  openBookPageLeft: {
    flex: 1,
    backgroundColor: '#FFF9F4',
    paddingTop: 34,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 34,
    borderBottomLeftRadius: 34,
  },
  openBookPageRight: {
    flex: 1,
    backgroundColor: '#FFFBF8',
    paddingTop: 34,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopRightRadius: 34,
    borderBottomRightRadius: 34,
  },
  openBookPageGlow: {
    position: 'absolute',
    top: -28,
    left: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(248, 220, 232, 0.28)',
  },
  openBookPageGlowRight: {
    position: 'absolute',
    top: -24,
    right: -28,
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: 'rgba(233, 224, 250, 0.26)',
  },
  openBookBinding: {
    position: 'absolute',
    left: '50%',
    top: 14,
    bottom: 14,
    marginLeft: -18,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  openBookBindingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#F0D7CC',
  },
  bindingRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF4EE',
    borderWidth: 2,
    borderColor: '#D8BCAF',
    marginVertical: 10,
  },
  memoryPiece: {
    position: 'absolute',
    borderRadius: 18,
    overflow: 'visible',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  tapePieceBase: {
    position: 'absolute',
    width: 44,
    height: 16,
    borderRadius: 5,
    backgroundColor: 'rgba(246, 220, 208, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(222, 182, 170, 0.24)',
    zIndex: 2,
    opacity: 0.95,
  },
  tapePieceTop: {
    top: -7,
    left: '50%',
  },
  tapePieceTopLeft: {
    top: -6,
    left: 10,
  },
  tapePieceTopRight: {
    top: -6,
    right: 10,
  },
  tapePieceCorner: {
    top: 8,
    right: 10,
    transform: [{ rotate: '12deg' }],
  },
  polaroidWrap: {
    width: '100%',
    height: '100%',
    paddingTop: 10,
  },
  polaroidShadow: {
    position: 'absolute',
    top: 16,
    left: 7,
    right: 7,
    bottom: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 52, 76, 0.06)',
  },
  polaroidFrame: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#FFFDF8',
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 11,
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.10)',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  polaroidPhotoArea: {
    flex: 1,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#F8EEE9',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7DCE8',
  },
  polaroidPlaceholderInner: {
    width: '64%',
    height: '54%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.48)',
  },
  polaroidPlaceholderIcon: {
    color: 'rgba(107, 52, 76, 0.45)',
    fontSize: 12,
    marginBottom: 3,
  },
  polaroidPlaceholderText: {
    color: '#6B344C',
    fontSize: 10,
    fontWeight: '600',
  },
  polaroidCaption: {
    marginTop: 7,
    color: '#6B344C',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  drawingWrap: {
    width: '100%',
    height: '100%',
    paddingTop: 10,
  },
  paperClip: {
    position: 'absolute',
    top: 2,
    width: 15,
    height: 24,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(129, 108, 118, 0.6)',
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  paperClipLeft: {
    left: 12,
  },
  paperClipRight: {
    right: 14,
  },
  paperClipInner: {
    position: 'absolute',
    top: 3,
    left: 2,
    right: 2,
    bottom: 7,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  drawingCard: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#FFF8EE',
    paddingTop: 10,
    paddingHorizontal: 9,
    paddingBottom: 9,
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.10)',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  drawingImage: {
    width: '100%',
    flex: 1,
    minHeight: 62,
    borderRadius: 4,
    marginBottom: 8,
  },
  drawingFallback: {
    flex: 1,
    minHeight: 62,
    borderRadius: 4,
    backgroundColor: 'rgba(247, 220, 232, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.08)',
  },
  drawingFallbackIcon: {
    color: 'rgba(107, 52, 76, 0.48)',
    fontSize: 12,
    marginBottom: 4,
  },
  drawingFallbackDoodle: {
    width: '60%',
    marginBottom: 6,
  },
  drawingFallbackLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 52, 76, 0.22)',
    marginBottom: 6,
  },
  drawingFallbackLineShort: {
    width: '68%',
    alignSelf: 'center',
    marginBottom: 0,
  },
  drawingFallbackText: {
    color: '#6B344C',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  drawingCaption: {
    color: '#6B344C',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  notePaperWrap: {
    width: '100%',
    height: '100%',
    paddingTop: 10,
  },
  notePaperCard: {
    flex: 1,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 8,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: 'rgba(120, 70, 45, 0.08)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
  },
  notePaperLines: {
    marginBottom: 10,
  },
  notePaperLine: {
    height: 1,
    backgroundColor: 'rgba(214, 173, 189, 0.28)',
    marginBottom: 7,
  },
  notePaperLineShort: {
    width: '72%',
  },
  notePaperText: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 19,
    paddingRight: 30,
  },
  notePaperStamp: {
    position: 'absolute',
    top: 8,
    right: 10,
    color: '#C16D93',
    fontSize: 12,
    fontWeight: '700',
  },
  notePaperMeta: {
    marginTop: 8,
    color: '#9B7080',
    fontSize: 10,
    textAlign: 'right',
  },
  emptyBookState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  emptyBookTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBookSubtitle: {
    marginTop: 6,
    color: TEXT_SOFT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  scrapPolaroid: {
    position: 'absolute',
    width: '64%',
    minHeight: 138,
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 10,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 4,
  },
  scrapPolaroidLeft: {
    position: 'absolute',
    top: 18,
    left: 12,
    transform: [{ rotate: '-5deg' }],
  },
  scrapPolaroidRight: {
    position: 'absolute',
    top: 18,
    right: 12,
    transform: [{ rotate: '4deg' }],
  },
  scrapTapeLeft: {
    position: 'absolute',
    top: -6,
    left: 22,
    width: 28,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 223, 233, 0.88)',
    transform: [{ rotate: '-9deg' }],
  },
  scrapTapeRight: {
    position: 'absolute',
    top: -6,
    right: 22,
    width: 28,
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 223, 233, 0.88)',
    transform: [{ rotate: '8deg' }],
  },
  scrapPolaroidImage: {
    width: '100%',
    height: 92,
    borderRadius: 14,
  },
  scrapPolaroidPlaceholder: {
    width: '100%',
    height: 92,
    borderRadius: 14,
    backgroundColor: '#FBE7EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrapPolaroidCaption: {
    marginTop: 10,
    color: TEXT_SOFT,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrapNoteCard: {
    position: 'absolute',
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3DCE7',
    padding: 14,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 4,
  },
  scrapNoteCardLeft: {
    left: 24,
    right: 18,
    top: 190,
    minHeight: 158,
  },
  scrapNoteCardRight: {
    left: 18,
    right: 24,
    bottom: 24,
    minHeight: 126,
  },
  scrapNoteDots: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  scrapDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5B7C9',
  },
  scrapAuthor: {
    color: '#C16D93',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  scrapBodyText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 21,
  },
  scrapDateText: {
    marginTop: 10,
    fontSize: 11,
    color: TEXT_SOFT,
  },
  scrapHeartSticker: {
    position: 'absolute',
    left: 22,
    bottom: 24,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FBE6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrapStickyNote: {
    position: 'absolute',
    right: 18,
    top: 194,
    width: '54%',
    minHeight: 122,
    backgroundColor: '#F7D8E5',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EBC1D2',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 4,
    transform: [{ rotate: '-3deg' }],
  },
  scrapStickyTitle: {
    color: '#C16D93',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  scrapStickyBody: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyAlbumState: {
    position: 'absolute',
    left: 22,
    right: 22,
    top: 96,
    bottom: 26,
    borderRadius: 28,
    backgroundColor: '#FFF9FC',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyAlbumBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAlbumCard: {
    marginTop: 16,
    backgroundColor: WHITE,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyAlbumTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyAlbumText: {
    marginTop: 6,
    color: TEXT_SOFT,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  albumList: {
    marginTop: 16,
    gap: 14,
  },
  albumPageScroll: {
    flex: 1,
  },
  albumPageContent: {
    paddingTop: 14,
    paddingBottom: 48,
    gap: 14,
  },
  albumScrapbookContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 28,
  },
  scrapbookCanvas: {
    flex: 1,
    backgroundColor: '#FFF9F4',
  },
  scrapbookCanvasGlowTop: {
    position: 'absolute',
    top: -40,
    right: -24,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(248, 220, 232, 0.22)',
  },
  scrapbookCanvasGlowBottom: {
    position: 'absolute',
    bottom: -56,
    left: -34,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(233, 224, 250, 0.16)',
  },
  scrapbookCanvasDotCluster: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    gap: 5,
  },
  scrapbookCanvasDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(209, 115, 153, 0.46)',
  },
  scrapbookHeaderCard: {
    alignSelf: 'center',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(236, 201, 217, 0.58)',
    transform: [{ rotate: '-1.2deg' }],
  },
  scrapbookHeaderTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrapbookHeaderSubtitle: {
    marginTop: 2,
    color: TEXT_SOFT,
    fontSize: 11,
    textAlign: 'center',
  },
  albumScrapbookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  albumScrapbookFlow: {
    paddingBottom: 24,
  },
  scrapbookCluster: {
    position: 'relative',
    minHeight: 232,
    marginBottom: 6,
  },
  scrapbookClusterAlt: {
    minHeight: 244,
  },
  scrapbookPageDecorLeft: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.9,
  },
  scrapbookPageDecorRight: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    opacity: 0.9,
  },
  scrapbookPageBlobA: {
    position: 'absolute',
    top: 54,
    left: -28,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(248, 220, 232, 0.18)',
  },
  scrapbookPageBlobB: {
    position: 'absolute',
    bottom: 44,
    right: -34,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(233, 224, 250, 0.16)',
  },
  scrapbookPageBlobC: {
    position: 'absolute',
    top: 70,
    right: -26,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 223, 233, 0.16)',
  },
  scrapbookPageBlobD: {
    position: 'absolute',
    bottom: 52,
    left: -42,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255, 247, 199, 0.12)',
  },
  scrapbookItem: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(230, 187, 205, 0.46)',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  scrapbookSlotEvenPrimary: {
    left: '2%',
    top: 8,
    width: '40%',
  },
  scrapbookSlotEvenSecondary: {
    right: '4%',
    top: 30,
    width: '34%',
  },
  scrapbookSlotEvenTertiary: {
    left: '28%',
    top: 128,
    width: '38%',
  },
  scrapbookSlotOddPrimary: {
    right: '3%',
    top: 8,
    width: '39%',
  },
  scrapbookSlotOddSecondary: {
    left: '5%',
    top: 44,
    width: '33%',
  },
  scrapbookSlotOddTertiary: {
    right: '20%',
    top: 138,
    width: '36%',
  },
  scrapbookPolaroid: {
    backgroundColor: WHITE,
    paddingTop: 7,
    paddingHorizontal: 7,
    paddingBottom: 10,
  },
  scrapbookNote: {
    backgroundColor: '#FFFBEF',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  scrapbookMixed: {
    backgroundColor: '#FFF6FA',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 11,
  },
  scrapbookTape: {
    position: 'absolute',
    top: -6,
    width: 28,
    height: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 223, 233, 0.9)',
  },
  scrapbookTapeLeft: {
    left: 22,
    transform: [{ rotate: '-10deg' }],
  },
  scrapbookTapeRight: {
    right: 22,
    transform: [{ rotate: '10deg' }],
  },
  scrapbookTapeSoft: {
    backgroundColor: 'rgba(255, 230, 238, 0.92)',
  },
  scrapbookTapeWarm: {
    backgroundColor: 'rgba(255, 237, 207, 0.92)',
  },
  scrapbookHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  scrapbookDateText: {
    color: TEXT_SOFT,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  scrapbookPhoto: {
    width: '100%',
    aspectRatio: 1,
    minHeight: 90,
    borderRadius: 10,
    backgroundColor: '#FBE7EF',
    marginBottom: 7,
  },
  scrapbookCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  scrapbookCaptionText: {
    flex: 1,
    color: TEXT,
    fontSize: 12,
    lineHeight: 17,
  },
  scrapbookKindPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(232, 140, 175, 0.16)',
  },
  scrapbookKindText: {
    color: '#B2547C',
    fontSize: 11,
    fontWeight: '800',
  },
  scrapbookRuledLines: {
    marginBottom: 8,
  },
  scrapbookLine: {
    height: 1,
    backgroundColor: 'rgba(220, 178, 197, 0.35)',
    marginBottom: 7,
  },
  scrapbookBodyText: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 19,
  },
  scrapbookTinyMeta: {
    color: '#B06C86',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  scrapbookPhotoCaption: {
    color: TEXT,
    fontSize: 11,
    lineHeight: 15,
  },
  scrapbookNotePin: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7A4BE',
  },
  scrapbookNoteText: {
    color: '#8E5873',
    fontSize: 15,
    lineHeight: 19,
  },
  scrapbookMiniCollage: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  scrapbookMiniBlockLarge: {
    width: '100%',
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  scrapbookMiniBlockRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scrapbookMiniBlock: {
    flex: 1,
    height: 26,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  scrapbookSketchPreview: {
    height: 74,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    justifyContent: 'center',
  },
  scrapbookSketchStroke: {
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(123, 91, 108, 0.35)',
    marginBottom: 10,
  },
  scrapbookSketchStrokeShort: {
    width: '72%',
  },
  scrapbookMiniSticker: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  scrapbookMixedLabel: {
    color: '#A55B7C',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  scrapbookMixedText: {
    color: TEXT,
    fontSize: 11,
    lineHeight: 15,
  },
  albumCard: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 4,
  },
  albumCardPink: {
    backgroundColor: PINK,
  },
  albumCardCream: {
    backgroundColor: CREAM,
  },
  albumCardLilac: {
    backgroundColor: LILAC,
  },
  albumCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  authorBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  authorBadgeMine: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  authorBadgePartner: {
    backgroundColor: 'rgba(232, 140, 175, 0.16)',
  },
  authorBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  authorBadgeTextMine: {
    color: TEXT,
  },
  authorBadgeTextPartner: {
    color: '#B2547C',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    color: TEXT_SOFT,
    fontSize: 12,
  },
  albumMemoryImage: {
    width: '100%',
    height: 152,
    borderRadius: 18,
    marginBottom: 12,
  },
  albumMemoryPreview: {
    width: '100%',
    minHeight: 92,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  albumMemoryPreviewLabel: {
    color: '#B2547C',
    fontSize: 15,
    fontWeight: '700',
  },
  albumMemoryKind: {
    color: '#B2547C',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  albumCardText: {
    color: TEXT,
    fontSize: 16,
    lineHeight: 25,
  },
});
