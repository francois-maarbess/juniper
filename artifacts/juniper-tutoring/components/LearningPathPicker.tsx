import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticPressable } from '@/components/HapticPressable';
import { LEARNING_PATHS, type LearningPathId } from '@/constants/juniper-data';
import { useColors } from '@/hooks/useColors';

export function LearningPathPicker({
  selected,
  onChange,
}: {
  selected: LearningPathId;
  onChange: (path: LearningPathId) => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.grid}>
      {LEARNING_PATHS.map((path) => {
        const active = path.id === selected;
        return (
          <HapticPressable
            key={path.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(path.id)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: active ? colors.primaryForeground : colors.leaf }]}>
              <Ionicons name={path.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.label, { color: active ? colors.primaryForeground : colors.foreground }]}>{path.label}</Text>
            </View>
            {active ? <View style={[styles.check, { backgroundColor: colors.primaryForeground }]}><Ionicons name="checkmark" size={12} color={colors.primary} /></View> : null}
          </HapticPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { alignItems: 'flex-start', borderRadius: 18, borderWidth: 1, gap: 10, minHeight: 100, padding: 12, position: 'relative', width: '47%' },
  icon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, justifyContent: 'center', paddingRight: 12 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16 },
  check: { alignItems: 'center', borderRadius: 99, height: 20, justifyContent: 'center', position: 'absolute', right: 9, top: 9, width: 20 },
});
