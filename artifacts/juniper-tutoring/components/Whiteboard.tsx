import React, { useState, useRef } from 'react';
import { PanResponder, View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { HapticPressable } from '@/components/HapticPressable';

export interface WhiteboardElement {
  id: string;
  type: 'stroke' | 'shape' | 'text' | 'math';
  color: string;
  width: number;
  points?: { x: number; y: number }[];
  shape?: 'circle' | 'rect' | 'line';
  x?: number; y?: number; w?: number; h?: number;
  text?: string;
}

interface WhiteboardProps {
  elements: WhiteboardElement[];
  onDraw: (element: WhiteboardElement) => void;
  onClear: () => void;
  readOnly?: boolean;
  height?: number;
}

const COLORS = ['#1B4332', '#D4A574', '#C97750', '#2F604C', '#000000', '#FFFFFF'];
const WIDTHS = [2, 4, 8];

export function Whiteboard({ elements, onDraw, onClear, readOnly = false, height = 300 }: WhiteboardProps) {
  const colors = useColors();
  const [tool, setTool] = useState<'pen' | 'eraser' | 'shape'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[1]);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawing, setDrawing] = useState(false);
  const drawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  const readOnlyRef = useRef(readOnly);
  const onDrawRef = useRef(onDraw);
  const backgroundRef = useRef(colors.card);
  toolRef.current = tool;
  colorRef.current = color;
  widthRef.current = strokeWidth;
  readOnlyRef.current = readOnly;
  onDrawRef.current = onDraw;
  backgroundRef.current = colors.card;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !readOnlyRef.current,
      onMoveShouldSetPanResponder: () => !readOnlyRef.current,
      onPanResponderGrant: (e) => {
        if (readOnlyRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        drawingRef.current = true;
        pointsRef.current = [{ x: locationX, y: locationY }];
        setDrawing(true);
        setCurrentPoints(pointsRef.current);
      },
      onPanResponderMove: (e) => {
        if (!drawingRef.current || readOnlyRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        pointsRef.current = [...pointsRef.current, { x: locationX, y: locationY }];
        setCurrentPoints(pointsRef.current);
      },
      onPanResponderRelease: () => {
        if (!drawingRef.current || readOnlyRef.current) return;
        drawingRef.current = false;
        setDrawing(false);
        const points = pointsRef.current;
        if (points.length > 1) {
          onDrawRef.current({
            id: `stroke-${Date.now()}`,
            type: 'stroke',
            color: toolRef.current === 'eraser' ? backgroundRef.current : colorRef.current,
            width: toolRef.current === 'eraser' ? 20 : widthRef.current,
            points,
          });
        }
        pointsRef.current = [];
        setCurrentPoints([]);
      },
    })
  ).current;

  const pointsToPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  return (
    <View style={[styles.container, { height, backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <View style={styles.toolGroup}>
          <HapticPressable onPress={() => setTool('pen')} style={[styles.toolBtn, tool === 'pen' && { backgroundColor: colors.leaf }]}>
            <Ionicons name="pencil" size={16} color={tool === 'pen' ? colors.primary : colors.mutedForeground} />
          </HapticPressable>
          <HapticPressable onPress={() => setTool('eraser')} style={[styles.toolBtn, tool === 'eraser' && { backgroundColor: colors.leaf }]}>
            <Ionicons name="remove-circle-outline" size={16} color={tool === 'eraser' ? colors.primary : colors.mutedForeground} />
          </HapticPressable>
        </View>
        <View style={styles.toolGroup}>
          {COLORS.map((c) => (
            <HapticPressable key={c} onPress={() => setColor(c)} style={[styles.colorBtn, { backgroundColor: c, borderColor: color === c ? colors.primary : 'transparent' }]} />
          ))}
        </View>
        <View style={styles.toolGroup}>
          {WIDTHS.map((w) => (
            <HapticPressable key={w} onPress={() => setStrokeWidth(w)} style={[styles.widthBtn, strokeWidth === w && { backgroundColor: colors.leaf }]}>
              <View style={{ width: w * 2, height: w * 2, borderRadius: w, backgroundColor: color }} />
            </HapticPressable>
          ))}
        </View>
        <HapticPressable onPress={onClear} style={styles.toolBtn}>
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
        </HapticPressable>
      </View>

      {/* Canvas */}
      <View style={styles.canvas} {...panResponder.panHandlers}>
        <Svg width="100%" height={height - 44}>
          {elements.map((el) => {
            if (el.type === 'stroke' && el.points) {
              return <Path key={el.id} d={pointsToPath(el.points)} stroke={el.color} strokeWidth={el.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
            }
            if (el.type === 'shape' && el.shape === 'circle') {
              return <Circle key={el.id} cx={el.x} cy={el.y} r={el.w} stroke={el.color} strokeWidth={2} fill="none" />;
            }
            if (el.type === 'shape' && el.shape === 'rect') {
              return <Rect key={el.id} x={el.x} y={el.y} width={el.w} height={el.h} stroke={el.color} strokeWidth={2} fill="none" />;
            }
            if (el.type === 'text' && el.text) {
              return <SvgText key={el.id} x={el.x} y={el.y} fill={el.color} fontSize={16}>{el.text}</SvgText>;
            }
            return null;
          })}
          {/* Current stroke being drawn */}
          {drawing && currentPoints.length > 1 && (
            <Path d={pointsToPath(currentPoints)} stroke={tool === 'eraser' ? '#FFFFFF' : color} strokeWidth={tool === 'eraser' ? 20 : strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  toolbar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  toolGroup: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  toolBtn: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', width: 32 },
  colorBtn: { borderRadius: 12, borderWidth: 2, height: 20, width: 20 },
  widthBtn: { alignItems: 'center', borderRadius: 8, height: 32, justifyContent: 'center', width: 32 },
  canvas: { flex: 1 },
});
