import { Canvas, Path as SkiaPath, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { clampNumber, DrawingBrushType, DrawingPoint, DrawingStroke } from '../lib/drawing-engine';

type FastBrushInput = DrawingBrushType | 'soft' | 'crayon';
type CanvasPoint = { x: number; y: number };

type FastDrawingSurfaceProps = {
  width: number;
  height: number;
  strokes: DrawingStroke[];
  brush: FastBrushInput;
  color: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  enabled: boolean;
  onAddStroke: (stroke: DrawingStroke) => void;
  onDrawingStart?: () => void;
  onDrawingEnd?: () => void;
  shouldStartStroke?: (point: CanvasPoint) => boolean;
};

function normalizeFastBrush(brush: FastBrushInput): DrawingBrushType {
  switch (brush) {
    case 'marker':
    case 'highlighter':
    case 'spray':
    case 'watercolor':
      return 'marker';
    case 'pen':
    case 'soft':
      return 'pen';
    case 'eraser':
      return 'eraser';
    case 'pencil':
    case 'crayon':
    default:
      return 'pencil';
  }
}

function getFastMinDistance(brush: DrawingBrushType): number {
  switch (brush) {
    case 'marker':
      return 3.4;
    case 'pen':
      return 2.6;
    case 'eraser':
      return 2.8;
    case 'pencil':
    default:
      return 2.8;
  }
}

function getFastStrokeWidth(brush: DrawingBrushType, baseWidth: number): number {
  switch (brush) {
    case 'marker':
      return clampNumber(baseWidth * 1.75, 1.5, 40);
    case 'pen':
      return clampNumber(baseWidth * 0.8, 1, 28);
    case 'eraser':
      return clampNumber(baseWidth * 1.2, 2, 44);
    case 'pencil':
    default:
      return clampNumber(baseWidth, 1, 30);
  }
}

function getFastStrokeOpacity(brush: DrawingBrushType, baseOpacity: number): number {
  switch (brush) {
    case 'marker':
      return clampNumber(baseOpacity * 0.94, 0.06, 1);
    case 'pen':
      return clampNumber(baseOpacity * 0.96, 0.06, 1);
    case 'eraser':
      return 1;
    case 'pencil':
    default:
      return clampNumber(baseOpacity * 0.9, 0.06, 1);
  }
}

function shouldAddFastPoint(last: DrawingPoint | null, next: DrawingPoint, minDistance: number): boolean {
  if (!last) return true;
  const dx = next.x - last.x;
  const dy = next.y - last.y;
  return Math.sqrt(dx * dx + dy * dy) >= minDistance;
}

function pointsToFastPath(points: DrawingPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }

  const parts: string[] = [];
  parts.push(`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`);
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

const StrokePath = React.memo(function StrokePath({
  stroke,
  backgroundColor,
}: {
  stroke: DrawingStroke;
  backgroundColor: string;
}) {
  const skPath = useMemo(() => {
    if (!stroke.d) return Skia.Path.Make();
    return Skia.Path.MakeFromSVGString(stroke.d) ?? Skia.Path.Make();
  }, [stroke.d]);

  const brush = normalizeFastBrush(stroke.brush);
  const color = brush === 'eraser' ? backgroundColor : stroke.color;
  const width = getFastStrokeWidth(brush, stroke.width);
  const opacity = getFastStrokeOpacity(brush, stroke.opacity);

  return <SkiaPath path={skPath} color={color} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" opacity={opacity} />;
});

export default function FastDrawingSurface({
  width,
  height,
  strokes,
  brush,
  color,
  backgroundColor,
  strokeWidth,
  opacity,
  enabled,
  onAddStroke,
  onDrawingStart,
  onDrawingEnd,
  shouldStartStroke,
}: FastDrawingSurfaceProps) {
  const [activeStroke, setActiveStroke] = useState<DrawingStroke | null>(null);
  const activePointsRef = useRef<DrawingPoint[]>([]);
  const activeMetaRef = useRef<{
    id: string;
    brush: DrawingBrushType;
    color: string;
    width: number;
    opacity: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const panResponder = useMemo(() => {
    const getPoint = (e: any): DrawingPoint => ({
      x: clampNumber(Number(e.nativeEvent.locationX ?? 0), 0, Math.max(width, 0)),
      y: clampNumber(Number(e.nativeEvent.locationY ?? 0), 0, Math.max(height, 0)),
      t: Date.now(),
      pressure: 0.5,
    });

    const flushActiveStroke = () => {
      const meta = activeMetaRef.current;
      if (!meta) {
        setActiveStroke(null);
        return;
      }

      const points = activePointsRef.current;
      setActiveStroke({
        id: meta.id,
        brush: meta.brush,
        color: meta.color,
        width: meta.width,
        opacity: meta.opacity,
        points: [...points],
        d: pointsToFastPath(points),
      });
    };

    const schedulePreviewUpdate = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        flushActiveStroke();
      });
    };

    const finishStroke = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const meta = activeMetaRef.current;
      const points = activePointsRef.current;
      activeMetaRef.current = null;
      activePointsRef.current = [];

      if (meta && points.length > 1) {
        onAddStroke({
          id: meta.id,
          brush: meta.brush,
          color: meta.color,
          width: meta.width,
          opacity: meta.opacity,
          points: [...points],
          d: pointsToFastPath(points),
        });
      }

      setActiveStroke(null);
      onDrawingEnd?.();
    };

    const startStroke = (point: DrawingPoint) => {
      const nextBrush = normalizeFastBrush(brush);
      activePointsRef.current = [point];
      activeMetaRef.current = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        brush: nextBrush,
        color: nextBrush === 'eraser' ? backgroundColor : color,
        width: strokeWidth,
        opacity,
      };
      setActiveStroke({
        id: activeMetaRef.current.id,
        brush: activeMetaRef.current.brush,
        color: activeMetaRef.current.color,
        width: activeMetaRef.current.width,
        opacity: activeMetaRef.current.opacity,
        points: [point],
        d: pointsToFastPath([point]),
      });
      onDrawingStart?.();
    };

    const appendPoint = (point: DrawingPoint) => {
      const meta = activeMetaRef.current;
      if (!meta) return;
      const points = activePointsRef.current;
      const last = points[points.length - 1] ?? null;
      if (!shouldAddFastPoint(last, point, getFastMinDistance(meta.brush))) return;
      points.push(point);
      schedulePreviewUpdate();
    };

    const canStart = (point: DrawingPoint) => {
      if (!enabled || width <= 0 || height <= 0) return false;
      if (!shouldStartStroke) return true;
      return shouldStartStroke({ x: point.x, y: point.y });
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (e) => canStart(getPoint(e)),
      onMoveShouldSetPanResponder: (e) => canStart(getPoint(e)),
      onPanResponderGrant: (e) => {
        startStroke(getPoint(e));
      },
      onPanResponderMove: (e) => {
        appendPoint(getPoint(e));
      },
      onPanResponderRelease: finishStroke,
      onPanResponderTerminate: finishStroke,
      onPanResponderTerminationRequest: () => false,
    });
  }, [backgroundColor, brush, color, enabled, height, onAddStroke, onDrawingEnd, onDrawingStart, opacity, shouldStartStroke, strokeWidth, width]);

  return (
    <View pointerEvents={enabled ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {strokes.map((stroke) => (
          <StrokePath key={stroke.id} stroke={stroke} backgroundColor={backgroundColor} />
        ))}
        {activeStroke ? <StrokePath stroke={activeStroke} backgroundColor={backgroundColor} /> : null}
      </Canvas>
      <View style={styles.touchLayer} {...panResponder.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
