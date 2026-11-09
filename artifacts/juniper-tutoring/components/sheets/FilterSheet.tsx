import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Pill } from '@/components/JuniperUI';
import { HapticPressable } from '@/components/HapticPressable';

export type SheetHandle = { present: () => void; dismiss: () => void };

export const FilterSheet = forwardRef<SheetHandle, {
  selectedUniversity: string;
  setSelectedUniversity: (v: string) => void;
  selectedCourseCode: string;
  setSelectedCourseCode: (v: string) => void;
  selectedLevel: string;
  setSelectedLevel: (v: string) => void;
  universities: string[];
}>(function FilterSheet(props, ref) {
  const colors = useColors();
  const innerRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => ({
    present: () => innerRef.current?.present(),
    dismiss: () => innerRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={['60%']}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={[styles.content, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Refine your search</Text>
        </View>

        <Text style={[styles.caption, { color: colors.mutedForeground }]}>University</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[...new Set(['All', ...props.universities, ...(props.selectedUniversity !== 'All' ? [props.selectedUniversity] : [])])].map((uni) => (
            <Pill
              key={uni}
              label={uni === 'All' ? 'All Universities' : uni}
              selected={props.selectedUniversity === uni}
              onPress={() => props.setSelectedUniversity(uni)}
            />
          ))}
        </ScrollView>

        <Text style={[styles.caption, { color: colors.mutedForeground }]}>Course code or title</Text>
        <TextInput value={props.selectedCourseCode} onChangeText={props.setSelectedCourseCode} placeholder="Type any course code or name" placeholderTextColor={colors.mutedForeground} accessibilityLabel="Filter by course code or title" style={[styles.courseInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />

        <Text style={[styles.caption, { color: colors.mutedForeground }]}>Learner level</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {['All levels', 'Primary', 'Middle school', 'High school', 'University', 'Adult learning'].map((level) => (
            <Pill key={level} label={level} selected={props.selectedLevel === level} onPress={() => props.setSelectedLevel(level)} />
          ))}
        </ScrollView>

        <HapticPressable
          onPress={() => innerRef.current?.dismiss()}
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.doneText, { color: colors.primaryForeground }]}>Done</Text>
        </HapticPressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { gap: 12, padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  caption: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8, marginTop: 4 },
  row: { gap: 8, paddingVertical: 4 },
  doneButton: { alignItems: 'center', borderRadius: 14, marginTop: 8, paddingVertical: 12 },
  doneText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  courseInput: { borderRadius: 12, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 44, paddingHorizontal: 12 },
});
