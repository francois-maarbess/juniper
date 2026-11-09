import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BundleOfferCardProps {
  packageName: string;
  sessionCount: number;
  totalPriceLBP: number;
  description?: string;
  tutorName: string;
  tutorAvatarInitial: string;
  onAccept: () => void;
  /** When true, renders a slimmer layout for side-by-side comparisons */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatLBP(amount: number): string {
  return new Intl.NumberFormat('en-LB', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function BundleOfferCard({
  packageName,
  sessionCount,
  totalPriceLBP,
  description,
  tutorName,
  tutorAvatarInitial,
  onAccept,
  compact = false,
}: BundleOfferCardProps) {
  const perSessionPrice = sessionCount > 0 ? Math.round(totalPriceLBP / sessionCount) : 0;

  const handleAccept = useCallback(() => {
    onAccept();
  }, [onAccept]);

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* VALUE BUNDLE badge */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="star" size={11} color="#FFFFFF" />
          <Text style={styles.badgeText}>VALUE BUNDLE</Text>
        </View>
        <Text style={styles.savings}>
          Save {Math.round(100 - (perSessionPrice / (totalPriceLBP * 1.1)) * 100)}% vs single sessions
        </Text>
      </View>

      {/* Package name */}
      <Text style={styles.packageName}>{packageName}</Text>

      {/* Tutor row */}
      <View style={styles.tutorRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{tutorAvatarInitial.toUpperCase()}</Text>
        </View>
        <Text style={styles.tutorName}>with {tutorName}</Text>
      </View>

      {/* Session count chip */}
      <View style={styles.sessionRow}>
        <View style={styles.sessionChip}>
          <Ionicons name="calendar-outline" size={15} color={Colors.primary} />
          <Text style={styles.sessionText}>{sessionCount} Sessions</Text>
        </View>
      </View>

      {/* Description */}
      {description ? (
        <Text style={styles.description} numberOfLines={compact ? 2 : 4}>
          {description}
        </Text>
      ) : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Pricing */}
      <View style={styles.pricingRow}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>LBP {formatLBP(totalPriceLBP)}</Text>
        </View>
        <View style={styles.perSessionWrap}>
          <Text style={styles.perSessionLabel}>Per session</Text>
          <Text style={styles.perSessionPrice}>LBP {formatLBP(perSessionPrice)}</Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaBtn}
        onPress={handleAccept}
        activeOpacity={0.82}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.ctaBtnText}>Accept Bundle</Text>
      </TouchableOpacity>

      {/* Trust note */}
      <View style={styles.trustRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color={Colors.textSecondary} />
        <Text style={styles.trustText}>Secured by Juniper — cancel anytime</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const BUNDLE_GOLD = Colors.warning; // '#D4A017'
const BUNDLE_GOLD_LIGHT = Colors.warningLight; // '#FFF8E1'

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: BUNDLE_GOLD,
    shadowColor: BUNDLE_GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardCompact: {
    padding: 14,
    borderRadius: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BUNDLE_GOLD,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  savings: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: BUNDLE_GOLD,
  },
  packageName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 26,
  },
  tutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  tutorName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sessionRow: {
    marginBottom: 10,
  },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  sessionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  totalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  totalPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  perSessionWrap: {
    alignItems: 'flex-end',
  },
  perSessionLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  perSessionPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.primary,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 10,
  },
  ctaBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  trustText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
