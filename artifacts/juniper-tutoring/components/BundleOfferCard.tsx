import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ActionButton, StatusPill } from '@/components/JuniperUI';

interface BundleOfferCardProps {
  offer: {
    id: string;
    amountCents: number;
    note: string;
    tutorId: string;
    tutorName: string;
    headline: string | null;
    offerType?: string;
    packageSessionCount?: number | null;
    packageDescription?: string | null;
  };
  isAccepting: boolean;
  disabled?: boolean;
  onAccept: (offerId: string) => void;
}

export function BundleOfferCard({
  offer,
  isAccepting,
  disabled = false,
  onAccept,
}: BundleOfferCardProps) {
  const colors = useColors();

  const isPackage = offer.offerType === 'package' && (offer.packageSessionCount ?? 0) > 1;
  const sessionCount = offer.packageSessionCount ?? 4;
  const totalPrice = offer.amountCents / 100;
  const perSession = (totalPrice / sessionCount).toFixed(0);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isPackage ? colors.warning : colors.border,
          borderWidth: isPackage ? 1.5 : 1,
        },
      ]}
    >
      {/* Top Banner for Value Bundles */}
      {isPackage && (
        <View style={[styles.bundleBanner, { backgroundColor: colors.warning }]}>
          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
          <Text style={styles.bundleBannerText}>
            VALUE BUNDLE · {sessionCount} SESSIONS PACKAGE
          </Text>
        </View>
      )}

      {/* Tutor Profile Header */}
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: colors.leaf }]}>
          <Ionicons name="school-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.identity}>
          <Text style={[styles.tutorName, { color: colors.foreground }]}>{offer.tutorName}</Text>
          <Text style={[styles.tutorHeadline, { color: colors.mutedForeground }]}>
            {offer.headline ?? 'Approved Juniper Tutor'}
          </Text>
        </View>
        <StatusPill label="Verified" tone="green" />
      </View>

      {/* Price & Sessions Row */}
      <View style={[styles.priceBox, { backgroundColor: colors.pale }]}>
        <View>
          <Text style={[styles.totalPrice, { color: colors.primary }]}>
            ${totalPrice.toFixed(2)}
          </Text>
          <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
            {isPackage ? `Total for ${sessionCount} sessions` : 'Proposed session rate'}
          </Text>
        </View>

        {isPackage && (
          <View style={[styles.perSessionPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.perSessionText, { color: colors.foreground }]}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>${perSession}</Text> / session
            </Text>
          </View>
        )}
      </View>

      {/* Package Description / Pitch Note */}
      {offer.packageDescription ? (
        <View style={[styles.descBox, { backgroundColor: colors.leaf }]}>
          <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
          <Text style={[styles.descText, { color: colors.deep }]}>
            {offer.packageDescription}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.noteText, { color: colors.foreground }]}>{offer.note}</Text>

      {/* Accept CTA */}
      <ActionButton
        label={isAccepting ? 'Confirming…' : isPackage ? `Accept ${sessionCount}-Session Bundle` : 'Accept this offer'}
        icon="arrow-forward"
        variant="primary"
        disabled={disabled || isAccepting}
        onPress={() => onAccept(offer.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    gap: 12,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  bundleBanner: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 5,
    marginBottom: 4,
  },
  bundleBannerText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  tutorName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  tutorHeadline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  priceBox: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  totalPrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
  },
  priceLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 1,
  },
  perSessionPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  perSessionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  descBox: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  descText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  noteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
});
