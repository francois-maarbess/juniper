import React, { useState, useMemo } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type AvailabilitySlot = {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  isActive?: boolean;
};

interface WeeklySchedulerProps {
  slots: AvailabilitySlot[];
  onChangeSlots: (slots: AvailabilitySlot[]) => void;
  timezone?: string;
}

const DAYS: Array<{ key: DayOfWeek; short: string; label: string }> = [
  { key: 'monday', short: 'Mon', label: 'Monday' },
  { key: 'tuesday', short: 'Tue', label: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', label: 'Wednesday' },
  { key: 'thursday', short: 'Thu', label: 'Thursday' },
  { key: 'friday', short: 'Fri', label: 'Friday' },
  { key: 'saturday', short: 'Sat', label: 'Saturday' },
  { key: 'sunday', short: 'Sun', label: 'Sunday' },
];

const PRESETS = [
  { label: 'Morning', start: '09:00', end: '12:00', icon: 'sunny-outline' as const },
  { label: 'Afternoon', start: '12:00', end: '16:00', icon: 'partly-sunny-outline' as const },
  { label: 'Evening', start: '16:00', end: '20:00', icon: 'moon-outline' as const },
  { label: 'Night', start: '20:00', end: '22:00', icon: 'star-outline' as const },
];

export function WeeklyScheduler({
  slots,
  onChangeSlots,
  timezone = 'Asia/Beirut',
}: WeeklySchedulerProps) {
  const colors = useColors();
  const [activeDay, setActiveDay] = useState<DayOfWeek>('monday');

  // Slots for the active selected day
  const activeDaySlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === activeDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [slots, activeDay]);

  // Overall hours summary calculation
  const totalWeeklyHours = useMemo(() => {
    let totalMinutes = 0;
    slots.forEach((s) => {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
      }
    });
    return Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);
  }, [slots]);

  const activeDaysCount = useMemo(() => {
    const daySet = new Set(slots.map((s) => s.dayOfWeek));
    return daySet.size;
  }, [slots]);

  // Toggle a standard preset for the active day
  const togglePreset = (start: string, end: string) => {
    const existingIndex = slots.findIndex(
      (s) => s.dayOfWeek === activeDay && s.startTime === start && s.endTime === end,
    );

    if (existingIndex >= 0) {
      // Remove
      onChangeSlots(slots.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add
      onChangeSlots([
        ...slots,
        { dayOfWeek: activeDay, startTime: start, endTime: end, isActive: true },
      ]);
    }
  };

  // Remove a specific slot
  const removeSlot = (slotToRemove: AvailabilitySlot) => {
    onChangeSlots(
      slots.filter(
        (s) =>
          !(
            s.dayOfWeek === slotToRemove.dayOfWeek &&
            s.startTime === slotToRemove.startTime &&
            s.endTime === slotToRemove.endTime
          ),
      ),
    );
  };

  // Quick action: Apply current day's slots to all weekdays (Mon-Fri)
  const copyToAllWeekdays = () => {
    const currentDayTemplate = slots.filter((s) => s.dayOfWeek === activeDay);
    const weekdays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    // Keep weekend slots, replace weekday slots with currentDayTemplate duplicated across weekdays
    const weekendSlots = slots.filter((s) => s.dayOfWeek === 'saturday' || s.dayOfWeek === 'sunday');
    const newWeekdaySlots: AvailabilitySlot[] = [];

    weekdays.forEach((day) => {
      currentDayTemplate.forEach((template) => {
        newWeekdaySlots.push({
          dayOfWeek: day,
          startTime: template.startTime,
          endTime: template.endTime,
          isActive: true,
        });
      });
    });

    onChangeSlots([...newWeekdaySlots, ...weekendSlots]);
  };

  // Quick action: Clear current day
  const clearDay = () => {
    onChangeSlots(slots.filter((s) => s.dayOfWeek !== activeDay));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.leaf }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Weekly Teaching Schedule</Text>
            <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {totalWeeklyHours}h / week
              </Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Set your recurring available hours. Learners can book direct 1-on-1 sessions into these slots.
          </Text>
        </View>
      </View>

      {/* Weekday Selector Tabs */}
      <View style={styles.daysRow}>
        {DAYS.map(({ key, short }) => {
          const isSelected = activeDay === key;
          const daySlotsCount = slots.filter((s) => s.dayOfWeek === key).length;

          return (
            <HapticPressable
              key={key}
              onPress={() => setActiveDay(key)}
              style={[
                styles.dayTab,
                {
                  backgroundColor: isSelected ? colors.primary : colors.background,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${key}, ${daySlotsCount} active slots`}
            >
              <Text
                style={[
                  styles.dayShort,
                  { color: isSelected ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {short}
              </Text>
              <View
                style={[
                  styles.slotIndicatorDot,
                  {
                    backgroundColor: daySlotsCount > 0
                      ? isSelected ? colors.primaryForeground : colors.primary
                      : 'transparent',
                  },
                ]}
              />
            </HapticPressable>
          );
        })}
      </View>

      {/* Active Day Presets */}
      <View style={styles.section}>
        <View style={styles.dayHeaderRow}>
          <Text style={[styles.dayHeading, { color: colors.foreground }]}>
            {DAYS.find((d) => d.key === activeDay)?.label} Slots
          </Text>
          {activeDaySlots.length > 0 ? (
            <HapticPressable onPress={clearDay} hitSlop={6}>
              <Text style={[styles.clearText, { color: colors.mutedForeground }]}>Clear day</Text>
            </HapticPressable>
          ) : null}
        </View>

        <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
          Tap time windows to toggle availability:
        </Text>

        <View style={styles.presetsGrid}>
          {PRESETS.map((preset) => {
            const isPresetActive = activeDaySlots.some(
              (s) => s.startTime === preset.start && s.endTime === preset.end,
            );

            return (
              <HapticPressable
                key={preset.label}
                onPress={() => togglePreset(preset.start, preset.end)}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: isPresetActive ? colors.leaf : colors.background,
                    borderColor: isPresetActive ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isPresetActive }}
              >
                <View style={styles.presetTop}>
                  <Ionicons
                    name={preset.icon}
                    size={16}
                    color={isPresetActive ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.presetLabel,
                      { color: isPresetActive ? colors.primary : colors.foreground },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.presetTime,
                    { color: isPresetActive ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {preset.start} – {preset.end}
                </Text>
              </HapticPressable>
            );
          })}
        </View>
      </View>

      {/* Active Day Slots List */}
      {activeDaySlots.length > 0 ? (
        <View style={styles.activeSlotsSection}>
          <Text style={[styles.slotsLabel, { color: colors.mutedForeground }]}>
            ACTIVE WINDOWS ({activeDaySlots.length})
          </Text>
          <View style={styles.activeSlotsList}>
            {activeDaySlots.map((slot) => (
              <View
                key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}
                style={[
                  styles.slotPill,
                  { backgroundColor: colors.leaf, borderColor: colors.primary },
                ]}
              >
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={[styles.slotPillText, { color: colors.primary }]}>
                  {slot.startTime} – {slot.endTime}
                </Text>
                <HapticPressable
                  onPress={() => removeSlot(slot)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Remove slot"
                >
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </HapticPressable>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.emptyDayNotice, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="moon-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.emptyDayText, { color: colors.mutedForeground }]}>
            No teaching windows set for {DAYS.find((d) => d.key === activeDay)?.label}.
          </Text>
        </View>
      )}

      {/* Quick Actions Footer */}
      <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
        <HapticPressable
          onPress={copyToAllWeekdays}
          style={[styles.quickActionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
          <Text style={[styles.quickActionText, { color: colors.foreground }]}>
            Apply {DAYS.find((d) => d.key === activeDay)?.short} to Mon–Fri
          </Text>
        </HapticPressable>

        <View style={styles.timezoneBadge}>
          <Ionicons name="globe-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.timezoneText, { color: colors.mutedForeground }]}>
            {timezone}
          </Text>
        </View>
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
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  dayTab: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    paddingVertical: 8,
  },
  dayShort: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  slotIndicatorDot: {
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  section: {
    gap: 8,
  },
  dayHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayHeading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  clearText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCard: {
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minWidth: '47%',
    padding: 10,
    gap: 4,
  },
  presetTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  presetLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  presetTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
  },
  activeSlotsSection: {
    gap: 6,
  },
  slotsLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  activeSlotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slotPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  emptyDayNotice: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  emptyDayText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  footerRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  quickActionBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  timezoneBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  timezoneText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});
