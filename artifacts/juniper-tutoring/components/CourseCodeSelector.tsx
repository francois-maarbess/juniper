import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { SkeletonBlock } from '@/components/LoadingSkeleton';
import { useAuth } from '@/context/AuthContext';
import { hapticLight } from '@/lib/haptics';

export type UniversityCourse = {
  id: string;
  university: string;
  code: string;
  name: string;
  department?: string | null;
  credits?: number | null;
};

interface CourseCodeSelectorProps {
  selectedCourseIds: string[];
  onChangeSelectedCourseIds: (courseIds: string[]) => void;
  maxSelections?: number;
  title?: string;
  subtitle?: string;
  initialCourses?: UniversityCourse[];
}

export function CourseCodeSelector({
  selectedCourseIds,
  onChangeSelectedCourseIds,
  maxSelections = 20,
  title = 'University Course Codes',
  subtitle = 'Add listed course codes when available. Learners can also search by subject, institution, and a course name you enter.',
  initialCourses = [],
}: CourseCodeSelectorProps) {
  const colors = useColors();
  const { request } = useAuth();

  const [selectedUni, setSelectedUni] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UniversityCourse[]>(initialCourses);
  const [loading, setLoading] = useState(false);
  const [allKnownCourses, setAllKnownCourses] = useState<Map<string, UniversityCourse>>(() => {
    const map = new Map<string, UniversityCourse>();
    initialCourses.forEach((c) => map.set(c.id, c));
    return map;
  });

  // Fetch courses matching filter & query
  const fetchCourses = useCallback(async (query: string, university: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (university !== 'All') params.set('university', university);

      const data = await request<UniversityCourse[]>(`/marketplace/courses?${params.toString()}`);
      setSearchResults(data);

      setAllKnownCourses((prev) => {
        const next = new Map(prev);
        data.forEach((c) => next.set(c.id, c));
        return next;
      });
    } catch {
      // Fallback silently if offline or network error
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCourses(searchQuery, selectedUni);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedUni, fetchCourses]);

  const toggleCourse = (course: UniversityCourse) => {
    hapticLight();
    const exists = selectedCourseIds.includes(course.id);
    if (exists) {
      onChangeSelectedCourseIds(selectedCourseIds.filter((id) => id !== course.id));
    } else {
      if (selectedCourseIds.length >= maxSelections) return;
      onChangeSelectedCourseIds([...selectedCourseIds, course.id]);
      setAllKnownCourses((prev) => new Map(prev).set(course.id, course));
    }
  };

  const removeCourseById = (id: string) => {
    hapticLight();
    onChangeSelectedCourseIds(selectedCourseIds.filter((cid) => cid !== id));
  };

  const selectedCoursesList = useMemo(() => {
    return selectedCourseIds
      .map((id) => allKnownCourses.get(id))
      .filter((c): c is UniversityCourse => Boolean(c));
  }, [selectedCourseIds, allKnownCourses]);
  const universities = useMemo(() => ['All', ...new Set([...initialCourses, ...searchResults].map((course) => course.university).filter(Boolean).sort())], [initialCourses, searchResults]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.leaf }]}>
          <Ionicons name="school-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {selectedCourseIds.length}/{maxSelections}
              </Text>
            </View>
          </View>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {/* Selected Chips */}
      {selectedCoursesList.length > 0 ? (
        <View style={styles.selectedSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            SELECTED COURSES ({selectedCoursesList.length})
          </Text>
          <View style={styles.chipRow}>
            {selectedCoursesList.map((c) => (
              <HapticPressable
                key={c.id}
                onPress={() => removeCourseById(c.id)}
                style={[
                  styles.selectedChip,
                  { backgroundColor: colors.leaf, borderColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.university} ${c.code}`}
              >
                <View style={styles.chipContent}>
                  <Text style={[styles.chipUni, { color: colors.primary }]}>{c.university}</Text>
                  <Text style={[styles.chipCode, { color: colors.foreground }]}>{c.code}</Text>
                </View>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </HapticPressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* University Pill Tabs */}
      <View style={styles.uniTabs}>
        {universities.map((uni) => {
          const active = selectedUni === uni;
          return (
            <HapticPressable
              key={uni}
              onPress={() => { hapticLight(); setSelectedUni(uni); }}
              style={[
                styles.uniTab,
                {
                  backgroundColor: active ? colors.primary : colors.background,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.uniTabText,
                  { color: active ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {uni}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Filter by code (e.g. MATH201, NFA031) or course name..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="characters"
        />
        {searchQuery.length > 0 ? (
          <HapticPressable onPress={() => { hapticLight(); setSearchQuery(''); }} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={16} color={colors.mutedForeground} />
          </HapticPressable>
        ) : null}
        {loading ? <SkeletonBlock style={{ height: 16, width: 16, borderRadius: 8 }} /> : null}
      </View>

      {/* Results List */}
      <View style={styles.resultsList}>
        {searchResults.length === 0 && !loading ? (
          <View style={styles.emptyResults}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No courses found for &quot;{searchQuery || selectedUni}&quot;.
            </Text>
          </View>
        ) : (
          searchResults.map((course) => {
            const isSelected = selectedCourseIds.includes(course.id);
            return (
              <HapticPressable
                key={course.id}
                onPress={() => toggleCourse(course)}
                style={[
                  styles.courseRow,
                  {
                    backgroundColor: isSelected ? colors.leaf : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={styles.courseBadgeCol}>
                  <View
                    style={[
                      styles.courseCodeBadge,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.courseCodeText,
                        { color: isSelected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {course.code}
                    </Text>
                  </View>
                  <Text style={[styles.courseUniText, { color: colors.mutedForeground }]}>
                    {course.university}
                  </Text>
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[
                      styles.courseName,
                      { color: isSelected ? colors.primary : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {course.name}
                  </Text>
                  {course.department ? (
                    <Text
                      style={[styles.courseDept, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {course.department} {course.credits ? `· ${course.credits} cr.` : ''}
                    </Text>
                  ) : null}
                </View>

                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.mutedForeground}
                />
              </HapticPressable>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  selectedSection: {
    gap: 8,
    paddingTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  chipUni: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  chipCode: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  uniTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  uniTab: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  uniTabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  resultsList: {
    gap: 6,
    maxHeight: 280,
  },
  emptyResults: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  courseRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  courseBadgeCol: {
    alignItems: 'center',
    gap: 2,
    width: 78,
  },
  courseCodeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: '100%',
    alignItems: 'center',
  },
  courseCodeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  courseUniText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  courseName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  courseDept: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});
