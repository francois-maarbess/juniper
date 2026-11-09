import React from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type OfferType = 'hourly' | 'package';

interface TutorBundleCreatorProps {
  offerType: OfferType;
  onOfferTypeChange: (type: OfferType) => void;
  priceText: string;
  onPriceChange: (price: string) => void;
  sessionCount: number;
  onSessionCountChange: (count: number) => void;
  packageDescription: string;
  onPackageDescriptionChange: (desc: string) => void;
}

export function TutorBundleCreator({
  offerType,
  onOfferTypeChange,
  priceText,
  onPriceChange,
  sessionCount,
  onSessionCountChange,
  packageDescription,
  onPackageDescriptionChange,
}: TutorBundleCreatorProps) {
  const colors = useColors();

  const numericPrice = parseFloat(priceText) || 0;
  const perSessionPrice =
    offerType === 'package' && sessionCount > 0 && numericPrice > 0
      ? (numericPrice / sessionCount).toFixed(0)
      : null;

  return (
    <View style={styles.container}>
      {/* Segmented Selector: Hourly vs Package */}
      <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
        <HapticPressable
          accessibilityRole="tab"
          accessibilityState={{ selected: offerType === 'hourly' }}
          onPress={() => onOfferTypeChange('hourly')}
          style={[
            styles.tab,
            offerType === 'hourly' && [styles.activeTab, { backgroundColor: colors.card }],
          ]}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={offerType === 'hourly' ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: offerType === 'hourly' ? colors.primary : colors.mutedForeground },
            ]}
          >
            Single Session
          </Text>
        </HapticPressable>

        <HapticPressable
          accessibilityRole="tab"
          accessibilityState={{ selected: offerType === 'package' }}
          onPress={() => onOfferTypeChange('package')}
          style={[
            styles.tab,
            offerType === 'package' && [styles.activeTab, { backgroundColor: colors.card }],
          ]}
        >
          <Ionicons
            name="cube-outline"
            size={14}
            color={offerType === 'package' ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.tabText,
              { color: offerType === 'package' ? colors.primary : colors.mutedForeground },
            ]}
          >
            Value Bundle
          </Text>
          <View style={[styles.pillBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.pillBadgeText}>NEW</Text>
          </View>
        </HapticPressable>
      </View>

      {/* Package Specific Controls */}
      {offerType === 'package' && (
        <View style={[styles.bundleConfigBox, { backgroundColor: colors.pale, borderColor: colors.border }]}>
          <View style={styles.stepperRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>Number of Sessions</Text>
              <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                e.g. 4 sessions for Midterm Prep or Final Review
              </Text>
            </View>

            <View style={[styles.stepper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <HapticPressable
                disabled={sessionCount <= 2}
                onPress={() => onSessionCountChange(Math.max(2, sessionCount - 1))}
                style={[styles.stepperBtn, sessionCount <= 2 && { opacity: 0.3 }]}
              >
                <Ionicons name="remove" size={16} color={colors.foreground} />
              </HapticPressable>
              <Text style={[styles.stepperValue, { color: colors.foreground }]}>{sessionCount}</Text>
              <HapticPressable
                disabled={sessionCount >= 12}
                onPress={() => onSessionCountChange(Math.min(12, sessionCount + 1))}
                style={[styles.stepperBtn, sessionCount >= 12 && { opacity: 0.3 }]}
              >
                <Ionicons name="add" size={16} color={colors.foreground} />
              </HapticPressable>
            </View>
          </View>

          <TextInput
            value={packageDescription}
            onChangeText={onPackageDescriptionChange}
            placeholder="Package details (e.g. '4 sessions covering all chapter reviews, proofs, and past exams')"
            placeholderTextColor={colors.mutedForeground}
            maxLength={180}
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
          />

          {perSessionPrice && (
            <View style={[styles.calcBanner, { backgroundColor: colors.leaf }]}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={[styles.calcBannerText, { color: colors.primary }]}>
                ${numericPrice} total (${perSessionPrice} / session) · Great value for student
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 10,
  },
  tabBar: {
    borderRadius: 14,
    flexDirection: 'row',
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 11,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 9,
  },
  activeTab: {
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tabText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  pillBadge: {
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  pillBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
  },
  bundleConfigBox: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  subLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    marginTop: 1,
  },
  stepper: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stepperBtn: {
    alignItems: 'center',
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepperValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    minWidth: 18,
    textAlign: 'center',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  calcBanner: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  calcBannerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
