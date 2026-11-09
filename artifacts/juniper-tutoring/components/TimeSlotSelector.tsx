import React, { useState, useEffect, useMemo } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { SkeletonBlock } from '@/components/LoadingSkeleton';
import { useAuth } from '@/context/AuthContext';
import { DayOfWeek } from './WeeklyScheduler';

export type BookedSlot = {
  date: string;       // "YYYY-MM-DD"
  formattedDate: string; // "Mon, Nov 3"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  dayOfWeek: DayOfWeek;
};

interface TimeSlotSelectorProps {
  tutorId?: string;
  initialSlots?: Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
  selectedSlot: BookedSlot | null;
  onSelectSlot: (slot: BookedSlot | null) => void;
  title?: string;
  subtitle?: string;
}

const DAY_NAMES: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function TimeSlotSelector({
  tutorId,
  initialSlots,
  selectedSlot,
  onSelectSlot,
  title = 'Direct Time-Slot Booking',
  subtitle = 'Choose a guaranteed time directly on your tutor’s calendar.',
}: TimeSlotSelectorProps) {
  const colors = useColors();
  const { request } = useAuth();

  const [tutorSlots, setTutorSlots] = useState<Array<{
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  }>>(initialSlots || []);
  const [loading, setLoading] = useState(false);

  // Fetch tutor slots if tutorId provided and no initialSlots
  useEffect(() => {
    if (!tutorId || initialSlots?.length) return;
    let active = true;
    setLoading(true);
    void request<Array<{
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }>>(`/marketplace/tutors/${tutorId}/availability`)
      .then((data) => {
        if (!active) return;
        setTutorSlots(data.filter((s) => s.isActive !== false));
      })
      .catch(() => {
        // Fallback gracefully
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tutorId, initialSlots, request]);

  // Generate next 14 days
  const calendarDays = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const iso = date.toISOString().split('T')[0]; // "YYYY-MM-DD"
      const dayOfWeekKey = DAY_NAMES[date.getDay()];
      const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
      const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = date.getDate();

      // Check if tutor has active slots on this day of week
      const matchingSlots = tutorSlots.filter((s) => s.dayOfWeek === dayOfWeekKey);

      days.push({
        iso,
        dayOfWeekKey,
        weekdayShort,
        monthShort,
        dayNum,
        formattedDate: `${weekdayShort}, ${monthShort} ${dayNum}`,
        hasSlots: matchingSlots.length > 0,
        slots: matchingSlots,
      });
    }
    return days;
  }, [tutorSlots]);

  const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
    const firstWithSlots = calendarDays.find((d) => d.hasSlots);
    return firstWithSlots?.iso || calendarDays[0]?.iso || '';
  });

  const activeDayObj = useMemo(() => {
    return calendarDays.find((d) => d.iso === selectedDayIso) || calendarDays[0];
  }, [calendarDays, selectedDayIso]);

  // Break multi-hour blocks into 1-hour bookable slots
  const bookableTimes = useMemo(() => {
    if (!activeDayObj || !activeDayObj.slots.length) return [];
    const hourly: Array<{ start: string; end: string }> = [];

    activeDayObj.slots.forEach((s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      // Create 60-minute slices
      for (let m = startMinutes; m + 60 <= endMinutes; m += 60) {
        const sliceStartH = String(Math.floor(m / 60)).padStart(2, '0');
        const sliceStartM = String(m % 60).padStart(2, '0');
        const sliceEndH = String(Math.floor((m + 60) / 60)).padStart(2, '0');
        const sliceEndM = String((m + 60) % 60).padStart(2, '0');
        hourly.push({
          start: `${sliceStartH}:${sliceStartM}`,
          end: `${sliceEndH}:${sliceEndM}`,
        });
      }

      // If duration is less than 60 mins or not aligned
      if (hourly.length === 0) {
        hourly.push({ start: s.startTime, end: s.endTime });
      }
    });

    return hourly;
  }, [activeDayObj]);

  const handleSelectTime = (start: string, end: string) => {
    if (!activeDayObj) return;

    if (
      selectedSlot &&
      selectedSlot.date === activeDayObj.iso &&
      selectedSlot.startTime === start
    ) {
      onSelectSlot(null); // Unselect
    } else {
      onSelectSlot({
        date: activeDayObj.iso,
        formattedDate: activeDayObj.formattedDate,
        startTime: start,
        endTime: end,
        dayOfWeek: activeDayObj.dayOfWeekKey,
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.leaf }]}>
          <Ionicons name="time" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {selectedSlot ? (
              <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>SELECTED</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
      </View>

      {/* Selected Slot Banner */}
      {selectedSlot ? (
        <View style={[styles.selectedBanner, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.selectedBannerTitle, { color: colors.primary }]}>
              {selectedSlot.formattedDate} · {selectedSlot.startTime} – {selectedSlot.endTime}
            </Text>
            <Text style={[styles.selectedBannerSub, { color: colors.foreground }]}>
              Guaranteed 60-min session slot reserved with tutor
            </Text>
          </View>
          <HapticPressable onPress={() => onSelectSlot(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.primary} />
          </HapticPressable>
        </View>
      ) : null}

      {/* 14-Day Horizontal Scroll Calendar */}
      <View style={styles.calendarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendarScroll}
        >
          {calendarDays.map((day) => {
            const isDaySelected = selectedDayIso === day.iso;
            return (
              <HapticPressable
                key={day.iso}
                onPress={() => setSelectedDayIso(day.iso)}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: isDaySelected ? colors.primary : colors.background,
                    borderColor: isDaySelected ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${day.formattedDate}, ${day.hasSlots ? 'slots available' : 'no slots'}`}
              >
                <Text
                  style={[
                    styles.dayWeekday,
                    { color: isDaySelected ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {day.weekdayShort}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    { color: isDaySelected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {day.dayNum}
                </Text>
                <View
                  style={[
                    styles.slotDot,
                    {
                      backgroundColor: day.hasSlots
                        ? isDaySelected ? colors.primaryForeground : colors.primary
                        : 'transparent',
                    },
                  ]}
                />
              </HapticPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Available Slots for Active Day */}
      <View style={styles.timeSlotsSection}>
        <View style={styles.dayHeader}>
          <Text style={[styles.activeDayLabel, { color: colors.foreground }]}>
            Available for {activeDayObj?.formattedDate}
          </Text>
          {loading ? <SkeletonBlock style={{ height: 16, width: 16, borderRadius: 8 }} /> : null}
        </View>

        {bookableTimes.length > 0 ? (
          <View style={styles.timesGrid}>
            {bookableTimes.map((time) => {
              const isSelected =
                selectedSlot?.date === activeDayObj?.iso &&
                selectedSlot?.startTime === time.start;

              return (
                <HapticPressable
                  key={`${time.start}-${time.end}`}
                  onPress={() => handleSelectTime(time.start, time.end)}
                  style={[
                    styles.timePill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={isSelected ? colors.primaryForeground : colors.primary}
                  />
                  <Text
                    style={[
                      styles.timePillText,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {time.start} – {time.end}
                  </Text>
                </HapticPressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptySlotsNotice, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.emptySlotsText, { color: colors.mutedForeground }]}>
              Tutor hasn&apos;t published slots for {activeDayObj?.weekdayShort}. Pick another date or write your preferred time in details.
            </Text>
          </View>
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
    fontSize: 10,
    letterSpacing: 0.5,
  },
  selectedBanner: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  selectedBannerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  selectedBannerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  calendarContainer: {
    marginHorizontal: -6,
  },
  calendarScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
  },
  dayCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    minWidth: 54,
    paddingVertical: 10,
  },
  dayWeekday: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  dayNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  slotDot: {
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  timeSlotsSection: {
    gap: 10,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeDayLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePill: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  emptySlotsNotice: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  emptySlotsText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
});
