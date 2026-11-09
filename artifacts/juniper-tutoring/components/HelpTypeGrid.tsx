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

const surfaces = ['#E4EBDD', '#F5EADD', '#F3E6E2', '#E6EFED', '#F4EBDD', '#E8E9DF'];

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
              { backgroundColor: surfaces[index], borderColor: colors.border, transform: [{ scale: pressed ? 0.985 : 1 }] },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: { alignItems: 'center', borderRadius: 17, borderWidth: 1, flexBasis: '31%', flexGrow: 0, flexShrink: 0, minHeight: 92, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 8, position: 'relative', width: '31%' },
  ornament: { backgroundColor: 'rgba(255,255,255,0.26)', borderRadius: 99, height: 56, position: 'absolute', right: -24, top: -25, width: 56 },
  icon: { alignItems: 'center', borderRadius: 11, height: 31, justifyContent: 'center', width: 31 },
  copy: { alignItems: 'center', marginTop: 7 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 10.5, letterSpacing: -0.2, lineHeight: 13, textAlign: 'center' },
  hint: { fontFamily: 'Inter_500Medium', fontSize: 8.5, lineHeight: 11, marginTop: 3, textAlign: 'center' },
});
