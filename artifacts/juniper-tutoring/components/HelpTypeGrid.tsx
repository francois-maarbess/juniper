import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticPressable } from '@/components/HapticPressable';
import { useColors } from '@/hooks/useColors';

export type HelpTypeId = 'tutoring' | 'exam_prep' | 'homework' | 'language' | 'project' | 'quick_question';

export const HELP_TYPES: Array<{
  id: HelpTypeId;
  title: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  serviceType: 'live_session' | 'exam_prep' | 'assignment_project';
  learningPath?: string;
}> = [
  { id: 'tutoring', title: 'Tutoring', hint: 'Learn a subject', icon: 'people-outline', serviceType: 'live_session' },
  { id: 'exam_prep', title: 'Exam prep', hint: 'Make a study plan', icon: 'clipboard-outline', serviceType: 'exam_prep', learningPath: 'exams' },
  { id: 'homework', title: 'Homework', hint: 'Understand the work', icon: 'book-outline', serviceType: 'assignment_project' },
  { id: 'language', title: 'Languages', hint: 'Speak & write', icon: 'chatbubbles-outline', serviceType: 'live_session', learningPath: 'languages' },
  { id: 'project', title: 'Projects', hint: 'Research, thesis, paper', icon: 'document-text-outline', serviceType: 'assignment_project' },
  { id: 'quick_question', title: 'One topic', hint: 'Get unstuck', icon: 'help-circle-outline', serviceType: 'live_session' },
];

const surfaces = ['#E5EBDF', '#F2E8D9', '#F2E3DC', '#E4ECE9', '#F1E8D9', '#E8E9DF'];

export function HelpTypeGrid({ onSelect }: { onSelect: (item: (typeof HELP_TYPES)[number]) => void }) {
  const colors = useColors();
  return (
    <View style={styles.grid}>
      {HELP_TYPES.map((item, index) => {
        return (
          <HapticPressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.hint}`}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: surfaces[index], borderColor: colors.border, transform: [{ scale: pressed ? 0.975 : 1 }], opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={styles.ornament} />
            <View style={[styles.icon, { backgroundColor: 'rgba(255,253,248,0.78)' }]}>
              <Ionicons name={item.icon} size={19} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
              <Text numberOfLines={2} style={[styles.hint, { color: colors.mutedForeground }]}>{item.hint}</Text>
            </View>
          </HapticPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'space-between' },
  tile: { alignItems: 'center', borderRadius: 19, borderWidth: 1, flexBasis: '31%', flexGrow: 0, flexShrink: 0, minHeight: 104, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 10, position: 'relative', width: '31%' },
  ornament: { backgroundColor: 'rgba(255,255,255,0.26)', borderRadius: 99, height: 56, position: 'absolute', right: -24, top: -25, width: 56 },
  icon: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  copy: { alignItems: 'center', marginTop: 8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: -0.2, lineHeight: 14, textAlign: 'center' },
  hint: { fontFamily: 'Inter_500Medium', fontSize: 9, lineHeight: 12, marginTop: 3, textAlign: 'center' },
});
